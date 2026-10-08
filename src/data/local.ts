import { ApiError } from './api';
import type { Api, ProfilePatch, ProjectPatch, QuotePatch, RecordPaymentInput, SignUpInput, SignUpResult } from './api';
import { buildDemoDb } from './demo';
import type { LocalDb } from './demo';
import { addressComplete, resolveLines, totals } from '../lib/pricing';
import { isEmail, nowIso, uid } from '../lib/util';
import { ORDER_STATUS, PROJECT_STATUS } from '../lib/status';
import { eur } from '../lib/money';
import type {
  AppNotification, Bike, Brand, CreateOrderInput, FileRef, Lead, Order, OrderFull, OrderStatus, Payment, Product,
  Profile, Project, ProjectFull, ProjectMessage, ProjectStatus, Proof, Quote, Role, Settings,
  SubmitProjectInput, SubmitQuoteInput,
} from '../lib/types';

const KEY = 'dg-demo-v1';

function readStorage(): LocalDb | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const db = JSON.parse(raw) as LocalDb;
    return db && db.v === 1 ? db : null;
  } catch {
    return null;
  }
}

const copy = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

/** Implementazione demo: i dati vivono nel browser (localStorage, con ripiego in memoria). */
export function createLocalApi(): Api {
  let db: LocalDb = readStorage() ?? buildDemoDb(new Date());
  const listeners = new Set<() => void>();
  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  const persist = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
    } catch {
      /* spazio finito o archiviazione bloccata: si resta in memoria */
    }
  };
  const changed = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(persist, 120);
    listeners.forEach((l) => l());
  };

  // altre schede: ricarica i dati quando cambiano
  try {
    addEventListener('storage', (e) => {
      if (e.key === KEY) {
        const fresh = readStorage();
        if (fresh) {
          db = fresh;
          listeners.forEach((l) => l());
        }
      }
    });
  } catch {
    /* ambiente senza window */
  }

  // ---------- helpers ----------
  const me = (): Profile | null => db.users.find((u) => u.id === db.sessionUserId) ?? null;
  const requireUser = (): Profile => {
    const u = me();
    if (!u) throw new ApiError('Accedi per continuare', 'login');
    return u;
  };
  const isStaff = (u: Profile | null) => !!u && (u.role === 'staff' || u.role === 'admin');
  const requireStaff = (): Profile => {
    const u = requireUser();
    if (!isStaff(u)) throw new ApiError('Operazione riservata al gestionale', 'permesso');
    return u;
  };

  const nextNumber = (prefix: string): string => {
    const year = new Date().getFullYear();
    const key = `${prefix}-${year}`;
    db.counters[key] = (db.counters[key] ?? 0) + 1;
    return `${prefix}-${year}-${String(db.counters[key]).padStart(4, '0')}`;
  };

  const notify = (n: { user_id?: string | null; audience: 'user' | 'staff'; title: string; body?: string; link: string }) => {
    db.notifications.unshift({
      id: uid(), user_id: n.user_id ?? null, audience: n.audience, title: n.title, body: n.body ?? '', link: n.link,
      read_at: null, created_at: nowIso(),
    });
  };
  const notifyStaff = (title: string, body: string, link: string) => notify({ audience: 'staff', title, body, link });
  const notifyUser = (user_id: string | null, title: string, body: string, link: string) => {
    if (user_id) notify({ user_id, audience: 'user', title, body, link });
  };

  const profileLite = (id: string) => {
    const u = db.users.find((x) => x.id === id);
    return u ? { id: u.id, full_name: u.full_name, email: u.email, phone: u.phone } : undefined;
  };

  const orderFull = (o: Order): OrderFull => ({
    ...o,
    items: db.order_items.filter((i) => i.order_id === o.id),
    events: db.order_events.filter((e) => e.order_id === o.id).sort((a, b) => a.created_at.localeCompare(b.created_at)),
    payments: db.payments.filter((p) => p.order_id === o.id),
    customer: profileLite(o.user_id),
  });

  const projectFull = (p: Project, withMessages: boolean): ProjectFull => ({
    ...p,
    proofs: db.proofs.filter((x) => x.project_id === p.id).sort((a, b) => a.version - b.version),
    messages: withMessages ? db.messages.filter((m) => m.project_id === p.id).sort((a, b) => a.created_at.localeCompare(b.created_at)) : [],
    payments: db.payments.filter((x) => x.project_id === p.id),
    customer: profileLite(p.user_id),
  });

  const addOrderEvent = (order: Order, status: OrderStatus, note: string, actor: string) => {
    db.order_events.push({ id: uid(), order_id: order.id, status, note, actor_name: actor, created_at: nowIso() });
  };

  const addSystemMessage = (project_id: string, body: string) => {
    db.messages.push({
      id: uid(), project_id, sender_id: '', sender_role: 'staff', sender_name: 'Draco Graphix', kind: 'system', body, files: [], created_at: nowIso(),
    });
  };

  function recomputeOrderPayment(order: Order) {
    const rows = db.payments.filter((p) => p.order_id === order.id);
    const paid = rows.filter((p) => p.status === 'ricevuto').reduce((t, p) => t + p.amount_cents, 0);
    const refunded = rows.some((p) => p.status === 'rimborsato');
    order.payment_status = paid >= order.total_cents && order.total_cents > 0 ? 'pagato' : paid > 0 ? 'acconto' : refunded ? 'rimborsato' : 'da_pagare';
  }

  /** Un pagamento è arrivato: aggiorna ordine o progetto e avvisa il cliente. */
  function applyPaymentReceived(pay: Payment, reference: string | undefined, actor: string) {
    pay.status = 'ricevuto';
    pay.paid_at = nowIso();
    if (reference) pay.reference = reference;
    if (pay.order_id) {
      const order = db.orders.find((o) => o.id === pay.order_id);
      if (order) {
        recomputeOrderPayment(order);
        order.updated_at = nowIso();
        if (order.payment_status === 'pagato' && order.status === 'ricevuto') {
          order.status = 'in_preparazione';
          addOrderEvent(order, 'in_preparazione', 'Pagamento ricevuto', actor);
          notifyUser(order.user_id, `Pagamento ricevuto · ${order.number}`, 'Stiamo preparando i file per la tua moto.', `/account/ordini/${order.id}`);
        }
      }
    }
    if (pay.project_id) {
      const project = db.projects.find((p) => p.id === pay.project_id);
      if (project) {
        project.updated_at = nowIso();
        if (pay.kind === 'acconto' && project.status === 'nuovo') {
          project.status = 'in_grafica';
          addSystemMessage(project.id, 'Acconto ricevuto: il grafico inizia a lavorare alla prima bozza.');
          notifyUser(project.user_id, `Acconto ricevuto · ${project.number}`, 'Il grafico inizia a lavorare alla prima bozza.', `/account/progetti/${project.id}`);
        }
        if (pay.kind === 'saldo') {
          addSystemMessage(project.id, 'Saldo ricevuto: passiamo alla stampa.');
          notifyUser(project.user_id, `Saldo ricevuto · ${project.number}`, 'Passiamo alla stampa.', `/account/progetti/${project.id}`);
        }
      }
    }
  }

  const wrap = async <T,>(fn: () => T): Promise<T> => {
    const out = fn();
    changed();
    return copy(out);
  };
  const read = async <T,>(fn: () => T): Promise<T> => copy(fn());

  const api: Api = {
    mode: 'demo',

    // ---------- sessione ----------
    async getSession() {
      const u = me();
      return u ? copy({ user: u }) : null;
    },
    async signIn(email, password) {
      const u = db.users.find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
      if (!u || db.passwords[u.id] !== password) throw new ApiError('Email o password non corretti', 'credenziali');
      db.sessionUserId = u.id;
      changed();
      return copy({ user: u });
    },
    async signUp(input: SignUpInput): Promise<SignUpResult> {
      const email = input.email.trim().toLowerCase();
      if (!isEmail(email)) throw new ApiError('Email non valida');
      if (input.password.length < 6) throw new ApiError('La password deve avere almeno 6 caratteri');
      if (db.users.some((u) => u.email.toLowerCase() === email)) throw new ApiError('Esiste già un account con questa email');
      const u: Profile = {
        id: uid(), role: 'customer', full_name: input.full_name.trim(), email, phone: input.phone?.trim() ?? '', address: null,
        billing: {}, newsletter: false, staff_note: '', created_at: nowIso(),
      };
      db.users.push(u);
      db.passwords[u.id] = input.password;
      db.sessionUserId = u.id;
      notifyStaff('Nuovo cliente registrato', `${u.full_name} · ${u.email}`, `/gestionale/clienti/${u.id}`);
      changed();
      return { session: copy({ user: u }) };
    },
    async signOut() {
      db.sessionUserId = null;
      changed();
    },
    async updateProfile(patch: ProfilePatch) {
      const u = requireUser();
      Object.assign(u, patch);
      return wrap(() => u);
    },
    async demoLogin(who) {
      const u = db.users.find((x) => x.id === (who === 'cliente' ? 'u-marco' : 'u-titolare'))!;
      db.sessionUserId = u.id;
      changed();
      return copy({ user: u });
    },
    async resetDemo() {
      db = buildDemoDb(new Date());
      changed();
    },
    async demoPay(paymentId) {
      const u = requireUser();
      const pay = db.payments.find((p) => p.id === paymentId);
      if (!pay) throw new ApiError('Pagamento non trovato');
      const owner = pay.order_id ? db.orders.find((o) => o.id === pay.order_id)?.user_id : db.projects.find((p) => p.id === pay.project_id)?.user_id;
      if (owner !== u.id && !isStaff(u)) throw new ApiError('Non autorizzato', 'permesso');
      applyPaymentReceived(pay, 'DEMO', 'Pagamento simulato');
      changed();
    },

    // ---------- catalogo e impostazioni ----------
    listBrands: () => read(() => [...db.brands].sort((a, b) => a.sort - b.sort)),
    async listProducts(opts) {
      const staff = isStaff(me());
      return read(() => db.products.filter((p) => (opts?.all && staff ? true : p.active)).sort((a, b) => a.sort - b.sort));
    },
    async saveProduct(p: Product) {
      requireStaff();
      const i = db.products.findIndex((x) => x.id === p.id);
      if (i >= 0) db.products[i] = copy(p);
      else db.products.push(copy({ ...p, sort: db.products.length }));
      return wrap(() => p);
    },
    async saveBrand(b: Brand) {
      requireStaff();
      const i = db.brands.findIndex((x) => x.id === b.id);
      if (i >= 0) db.brands[i] = copy(b);
      else db.brands.push(copy(b));
      return wrap(() => b);
    },
    getSettings: () => read(() => db.settings),
    async saveSettings(s: Settings) {
      const u = requireStaff();
      if (u.role !== 'admin') throw new ApiError('Solo il titolare può cambiare le impostazioni', 'permesso');
      db.settings = copy(s);
      return wrap(() => db.settings);
    },

    // ---------- area cliente ----------
    async listWishlist() {
      const u = me();
      return read(() => (u ? db.wishlist.filter((w) => w.user_id === u.id).map((w) => w.product_id) : []));
    },
    async toggleWishlist(productId) {
      const u = requireUser();
      const i = db.wishlist.findIndex((w) => w.user_id === u.id && w.product_id === productId);
      if (i >= 0) db.wishlist.splice(i, 1);
      else db.wishlist.push({ user_id: u.id, product_id: productId });
      return wrap(() => db.wishlist.filter((w) => w.user_id === u.id).map((w) => w.product_id));
    },
    async listBikes() {
      const u = me();
      return read(() => (u ? db.bikes.filter((b) => b.user_id === u.id) : []));
    },
    async saveBike(input) {
      const u = requireUser();
      const clean = { brand: input.brand.trim(), model: input.model.trim(), year: input.year, rider_name: input.rider_name.trim(), rider_number: input.rider_number.trim() };
      if (!clean.model) throw new ApiError('Indica il modello della moto');
      const existing = input.id ? db.bikes.find((b) => b.id === input.id && b.user_id === u.id) : undefined;
      let bike: Bike;
      if (existing) {
        Object.assign(existing, clean);
        bike = existing;
      } else {
        bike = { id: uid(), user_id: u.id, ...clean, created_at: nowIso() };
        db.bikes.push(bike);
      }
      return wrap(() => bike);
    },
    async deleteBike(id) {
      const u = requireUser();
      db.bikes = db.bikes.filter((b) => !(b.id === id && b.user_id === u.id));
      changed();
    },

    // ---------- ordini ----------
    async createOrder(input: CreateOrderInput) {
      const u = requireUser();
      if (!addressComplete(input.shipping_address)) throw new ApiError('Completa l’indirizzo di spedizione');
      const method = db.settings.payment_methods.find((m) => m.id === input.payment_method && m.enabled);
      if (!method) throw new ApiError('Scegli un metodo di pagamento');
      let lines;
      try {
        lines = resolveLines(input.items, db.products);
      } catch (e) {
        throw new ApiError((e as Error).message);
      }
      const t = totals(lines, db.settings);
      const now = nowIso();
      const order: Order = {
        id: uid(), number: nextNumber('DG'), user_id: u.id, status: 'ricevuto', payment_status: 'da_pagare', payment_method: method.id,
        subtotal_cents: t.subtotal_cents, shipping_cents: t.shipping_cents, total_cents: t.total_cents,
        shipping_address: copy(input.shipping_address), billing: copy(input.billing), customer_note: input.customer_note.trim().slice(0, 500),
        staff_note: '', courier: '', tracking_code: '', quote_id: null, created_at: now, updated_at: now,
      };
      db.orders.unshift(order);
      for (const l of lines) {
        db.order_items.push({
          id: uid(), order_id: order.id, product_id: l.product.id, name: l.product.name, kind: l.product.kind, qty: l.qty,
          unit_price_cents: l.unit_price_cents, config: copy(l.config),
        });
        if (l.product.stock != null) {
          const p = db.products.find((x) => x.id === l.product.id)!;
          p.stock = Math.max(0, (p.stock ?? 0) - l.qty);
        }
      }
      db.payments.push({
        id: uid(), order_id: order.id, project_id: null, kind: 'ordine', amount_cents: order.total_cents, method: method.id, status: 'in_attesa',
        reference: '', paid_at: null, created_at: now,
      });
      addOrderEvent(order, 'ricevuto', 'Ordine ricevuto', u.full_name);
      notifyStaff(`Nuovo ordine ${order.number}`, `${u.full_name} · ${eur(order.total_cents)}`, `/gestionale/ordini/${order.id}`);
      return wrap(() => orderFull(order));
    },
    async listOrders() {
      const u = me();
      if (!u) return [];
      return read(() => db.orders.filter((o) => isStaff(u) || o.user_id === u.id).map(orderFull).sort((a, b) => b.created_at.localeCompare(a.created_at)));
    },
    async getOrder(id) {
      const u = me();
      const o = db.orders.find((x) => x.id === id);
      if (!u || !o || (!isStaff(u) && o.user_id !== u.id)) return null;
      return read(() => orderFull(o));
    },
    async setOrderStatus(id, status, note = '') {
      const u = requireStaff();
      const o = db.orders.find((x) => x.id === id);
      if (!o) throw new ApiError('Ordine non trovato');
      if (o.status === status) return;
      if (status === 'annullato' && o.status !== 'annullato') {
        for (const it of db.order_items.filter((i) => i.order_id === o.id)) {
          const p = it.product_id ? db.products.find((x) => x.id === it.product_id) : undefined;
          if (p && p.stock != null) p.stock += it.qty;
        }
      }
      o.status = status;
      o.updated_at = nowIso();
      addOrderEvent(o, status, note, u.full_name);
      notifyUser(o.user_id, `${o.number}: ${ORDER_STATUS[status].label}`, ORDER_STATUS[status].customer, `/account/ordini/${o.id}`);
      changed();
    },
    async updateOrder(id, patch) {
      requireStaff();
      const o = db.orders.find((x) => x.id === id);
      if (!o) throw new ApiError('Ordine non trovato');
      Object.assign(o, patch);
      o.updated_at = nowIso();
      changed();
    },

    // ---------- pagamenti ----------
    async recordPayment(input: RecordPaymentInput) {
      const u = requireStaff();
      if (!input.order_id && !input.project_id) throw new ApiError('Collega il pagamento a un ordine o a un progetto');
      if (!(input.amount_cents > 0)) throw new ApiError('Importo non valido');
      const pay: Payment = {
        id: uid(), order_id: input.order_id ?? null, project_id: input.project_id ?? null, kind: input.kind, amount_cents: input.amount_cents,
        method: input.method, status: 'in_attesa', reference: input.reference ?? '', paid_at: null, created_at: nowIso(),
      };
      db.payments.push(pay);
      applyPaymentReceived(pay, input.reference, u.full_name);
      return wrap(() => pay);
    },
    async confirmPayment(id, reference) {
      const u = requireStaff();
      const pay = db.payments.find((p) => p.id === id);
      if (!pay) throw new ApiError('Pagamento non trovato');
      if (pay.status === 'ricevuto') return;
      applyPaymentReceived(pay, reference, u.full_name);
      changed();
    },

    // ---------- progetti ----------
    async submitProject(input: SubmitProjectInput) {
      const u = requireUser();
      if (!input.brief.model.trim()) throw new ApiError('Indica il modello della moto');
      if (!input.brief.style.trim()) throw new ApiError('Racconta com’è la grafica che immagini');
      const method = db.settings.payment_methods.find((m) => m.id === input.payment_method && m.enabled);
      if (!method) throw new ApiError('Scegli come versare l’acconto');
      const now = nowIso();
      const project: Project = {
        id: uid(), number: nextNumber('GP'), user_id: u.id, title: input.title.trim() || `${input.brief.brand} ${input.brief.model}`.trim(),
        status: 'nuovo', brief: copy(input.brief), files: copy(input.files), deposit_cents: db.settings.deposit_cents, total_cents: null, revisions: 0,
        courier: '', tracking_code: '', shipping_address: input.shipping_address ? copy(input.shipping_address) : null, staff_note: '', created_at: now, updated_at: now,
      };
      db.projects.unshift(project);
      db.payments.push({
        id: uid(), order_id: null, project_id: project.id, kind: 'acconto', amount_cents: project.deposit_cents, method: method.id, status: 'in_attesa',
        reference: '', paid_at: null, created_at: now,
      });
      addSystemMessage(project.id, 'Brief ricevuto. Appena arriva l’acconto il grafico inizia a lavorare.');
      notifyStaff(`Nuovo progetto ${project.number}`, `${u.full_name} · ${project.title}`, `/gestionale/progetti/${project.id}`);
      return wrap(() => projectFull(project, true));
    },
    async listProjects() {
      const u = me();
      if (!u) return [];
      return read(() => db.projects.filter((p) => isStaff(u) || p.user_id === u.id).map((p) => projectFull(p, false)).sort((a, b) => b.updated_at.localeCompare(a.updated_at)));
    },
    async getProject(id) {
      const u = me();
      const p = db.projects.find((x) => x.id === id);
      if (!u || !p || (!isStaff(u) && p.user_id !== u.id)) return null;
      return read(() => projectFull(p, true));
    },
    async setProjectStatus(id, status: ProjectStatus) {
      requireStaff();
      const p = db.projects.find((x) => x.id === id);
      if (!p) throw new ApiError('Progetto non trovato');
      if (p.status === status) return;
      p.status = status;
      p.updated_at = nowIso();
      addSystemMessage(p.id, `Stato aggiornato: ${PROJECT_STATUS[status].label}.`);
      notifyUser(p.user_id, `${p.number}: ${PROJECT_STATUS[status].label}`, PROJECT_STATUS[status].customer, `/account/progetti/${p.id}`);
      changed();
    },
    async updateProject(id, patch: ProjectPatch) {
      requireStaff();
      const p = db.projects.find((x) => x.id === id);
      if (!p) throw new ApiError('Progetto non trovato');
      const totalChanged = patch.total_cents !== undefined && patch.total_cents !== p.total_cents;
      Object.assign(p, patch);
      p.updated_at = nowIso();
      if (totalChanged && patch.total_cents != null) {
        addSystemMessage(p.id, `Totale della grafica: ${eur(patch.total_cents)} (acconto già scalato).`);
      }
      changed();
    },
    async addProof(projectId, file: FileRef, note) {
      const u = requireStaff();
      const p = db.projects.find((x) => x.id === projectId);
      if (!p) throw new ApiError('Progetto non trovato');
      const version = Math.max(0, ...db.proofs.filter((x) => x.project_id === projectId).map((x) => x.version)) + 1;
      for (const old of db.proofs.filter((x) => x.project_id === projectId && x.status === 'in_attesa')) old.status = 'sostituita';
      const proof: Proof = { id: uid(), project_id: projectId, version, file: copy(file), note: note.trim(), status: 'in_attesa', customer_comment: '', created_at: nowIso(), decided_at: null };
      db.proofs.push(proof);
      p.status = 'bozza_inviata';
      p.updated_at = nowIso();
      addSystemMessage(projectId, `${u.full_name} ha caricato la bozza v${version}.`);
      notifyUser(p.user_id, `Bozza pronta · ${p.number}`, `È pronta la bozza v${version}: approvala o chiedi modifiche.`, `/account/progetti/${p.id}`);
      return wrap(() => proof);
    },
    async decideProof(proofId, decision, comment) {
      const u = requireUser();
      const proof = db.proofs.find((x) => x.id === proofId);
      const p = proof ? db.projects.find((x) => x.id === proof.project_id) : undefined;
      if (!proof || !p || p.user_id !== u.id) throw new ApiError('Bozza non trovata', 'permesso');
      if (proof.status !== 'in_attesa') throw new ApiError('Questa bozza è già stata valutata');
      if (decision === 'modifiche' && !comment.trim()) throw new ApiError('Scrivi cosa vuoi cambiare');
      proof.status = decision;
      proof.customer_comment = comment.trim();
      proof.decided_at = nowIso();
      p.updated_at = nowIso();
      if (decision === 'approvata') {
        p.status = 'approvata';
        addSystemMessage(p.id, `${u.full_name} ha approvato la bozza v${proof.version}.`);
        notifyStaff(`Bozza approvata · ${p.number}`, `${u.full_name} ha approvato la v${proof.version}. Imposta il totale e chiedi il saldo.`, `/gestionale/progetti/${p.id}`);
      } else {
        p.status = 'modifiche';
        p.revisions += 1;
        addSystemMessage(p.id, `${u.full_name} ha chiesto modifiche alla bozza v${proof.version}.`);
        notifyStaff(`Modifiche richieste · ${p.number}`, comment.trim().slice(0, 140), `/gestionale/progetti/${p.id}`);
      }
      if (comment.trim()) {
        db.messages.push({ id: uid(), project_id: p.id, sender_id: u.id, sender_role: u.role, sender_name: u.full_name, kind: 'message', body: comment.trim(), files: [], created_at: nowIso() });
      }
      changed();
    },
    async sendMessage(projectId, body, files) {
      const u = requireUser();
      const p = db.projects.find((x) => x.id === projectId);
      if (!p || (!isStaff(u) && p.user_id !== u.id)) throw new ApiError('Progetto non trovato', 'permesso');
      if (!body.trim() && files.length === 0) throw new ApiError('Scrivi un messaggio');
      const m: ProjectMessage = {
        id: uid(), project_id: projectId, sender_id: u.id, sender_role: u.role, sender_name: u.full_name, kind: 'message', body: body.trim().slice(0, 2000), files: copy(files), created_at: nowIso(),
      };
      db.messages.push(m);
      p.updated_at = nowIso();
      if (isStaff(u)) notifyUser(p.user_id, `Nuovo messaggio · ${p.number}`, m.body.slice(0, 140), `/account/progetti/${p.id}`);
      else notifyStaff(`Messaggio da ${u.full_name} · ${p.number}`, m.body.slice(0, 140), `/gestionale/progetti/${p.id}`);
      return wrap(() => m);
    },

    // ---------- preventivi ----------
    async submitQuote(input: SubmitQuoteInput) {
      const u = me();
      if (!input.contact.name.trim()) throw new ApiError('Indica il tuo nome');
      if (!isEmail(input.contact.email)) throw new ApiError('Email non valida');
      if (!input.team_name.trim()) throw new ApiError('Indica il nome del team o del motoclub');
      const now = nowIso();
      const q: Quote = {
        id: uid(), number: nextNumber('PR'), user_id: u?.id ?? null, contact: copy(input.contact), team_name: input.team_name.trim(),
        riders: Math.max(1, Math.trunc(input.riders) || 1), bike_type: input.bike_type.trim(), service: input.service.trim(), message: input.message.trim().slice(0, 2000),
        status: 'nuova', lines: [], total_cents: 0, valid_until: null, staff_note: '', order_id: null, created_at: now, updated_at: now,
      };
      db.quotes.unshift(q);
      notifyStaff(`Nuova richiesta di preventivo ${q.number}`, `${q.team_name} · ${q.riders} piloti`, `/gestionale/preventivi/${q.id}`);
      changed();
    },
    async listQuotes() {
      const u = me();
      if (!u) return [];
      return read(() => db.quotes.filter((q) => isStaff(u) || q.user_id === u.id).sort((a, b) => b.created_at.localeCompare(a.created_at)));
    },
    async getQuote(id) {
      const u = me();
      const q = db.quotes.find((x) => x.id === id);
      if (!u || !q || (!isStaff(u) && q.user_id !== u.id)) return null;
      return read(() => q);
    },
    async saveQuote(id, patch: QuotePatch) {
      requireStaff();
      const q = db.quotes.find((x) => x.id === id);
      if (!q) throw new ApiError('Preventivo non trovato');
      const prev = q.status;
      if (patch.lines) {
        q.lines = copy(patch.lines.filter((l) => l.description.trim()));
        q.total_cents = q.lines.reduce((t, l) => t + l.qty * l.unit_price_cents, 0);
      }
      if (patch.valid_until !== undefined) q.valid_until = patch.valid_until;
      if (patch.staff_note !== undefined) q.staff_note = patch.staff_note;
      if (patch.status) q.status = patch.status;
      q.updated_at = nowIso();
      if (patch.status === 'inviato' && prev !== 'inviato') {
        if (!q.user_id) {
          const match = db.users.find((u) => u.email.toLowerCase() === q.contact.email.toLowerCase());
          if (match) q.user_id = match.id;
        }
        notifyUser(q.user_id, `Preventivo ${q.number} pronto`, `${q.team_name}: ${eur(q.total_cents)}. Aprilo per accettarlo.`, `/account/preventivi/${q.id}`);
      }
      return wrap(() => q);
    },
    async decideQuote(id, accept) {
      const u = requireUser();
      const q = db.quotes.find((x) => x.id === id);
      if (!q || q.user_id !== u.id) throw new ApiError('Preventivo non trovato', 'permesso');
      if (q.status !== 'inviato') throw new ApiError('Il preventivo non è in attesa di risposta');
      q.status = accept ? 'accettato' : 'rifiutato';
      q.updated_at = nowIso();
      notifyStaff(`Preventivo ${q.number} ${accept ? 'accettato' : 'rifiutato'}`, `${q.team_name} · ${eur(q.total_cents)}`, `/gestionale/preventivi/${q.id}`);
      changed();
    },
    async quoteToOrder(id) {
      const u = requireStaff();
      const q = db.quotes.find((x) => x.id === id);
      if (!q) throw new ApiError('Preventivo non trovato');
      if (q.order_id) throw new ApiError('Questo preventivo è già stato convertito');
      if (q.lines.length === 0) throw new ApiError('Il preventivo non ha righe');
      if (!q.user_id) {
        const match = db.users.find((x) => x.email.toLowerCase() === q.contact.email.toLowerCase());
        if (!match) throw new ApiError('Il cliente non ha ancora un account: fallo registrare con la stessa email del preventivo');
        q.user_id = match.id;
      }
      const customer = db.users.find((x) => x.id === q.user_id)!;
      const now = nowIso();
      const order: Order = {
        id: uid(), number: nextNumber('DG'), user_id: customer.id, status: 'ricevuto', payment_status: 'da_pagare',
        payment_method: db.settings.payment_methods.find((m) => m.enabled)?.id ?? 'bonifico',
        subtotal_cents: q.total_cents, shipping_cents: 0, total_cents: q.total_cents,
        shipping_address: customer.address ? copy(customer.address) : { street: '', city: '', zip: '', province: '', country: 'IT' },
        billing: copy(customer.billing), customer_note: `Da preventivo ${q.number}`, staff_note: '', courier: '', tracking_code: '', quote_id: q.id, created_at: now, updated_at: now,
      };
      db.orders.unshift(order);
      for (const l of q.lines) {
        db.order_items.push({ id: uid(), order_id: order.id, product_id: null, name: l.description, kind: 'altro', qty: l.qty, unit_price_cents: l.unit_price_cents, config: [] });
      }
      db.payments.push({ id: uid(), order_id: order.id, project_id: null, kind: 'ordine', amount_cents: order.total_cents, method: order.payment_method, status: 'in_attesa', reference: '', paid_at: null, created_at: now });
      addOrderEvent(order, 'ricevuto', `Creato dal preventivo ${q.number}`, u.full_name);
      q.status = 'convertito';
      q.order_id = order.id;
      q.updated_at = now;
      notifyUser(customer.id, `Ordine ${order.number} creato`, `Dal preventivo ${q.number}. Versa il pagamento per avviare la produzione.`, `/account/ordini/${order.id}`);
      return wrap(() => orderFull(order));
    },

    // ---------- contatti ----------
    async submitLead(input) {
      if (!isEmail(input.email)) throw new ApiError('Email non valida');
      if (input.kind === 'contatto' && !input.message?.trim()) throw new ApiError('Scrivi un messaggio');
      if (input.kind === 'newsletter' && db.leads.some((l) => l.kind === 'newsletter' && l.email.toLowerCase() === input.email.trim().toLowerCase())) return;
      const lead: Lead = {
        id: uid(), kind: input.kind, name: input.name.trim(), email: input.email.trim(), phone: input.phone?.trim() ?? '', message: (input.message ?? '').trim().slice(0, 2000),
        handled: false, created_at: nowIso(),
      };
      db.leads.unshift(lead);
      if (lead.kind === 'contatto') notifyStaff(`Messaggio da ${lead.name || lead.email}`, lead.message.slice(0, 140), '/gestionale/contatti');
      changed();
    },
    async listLeads() {
      requireStaff();
      return read(() => db.leads);
    },
    async markLead(id, handled) {
      requireStaff();
      const l = db.leads.find((x) => x.id === id);
      if (l) l.handled = handled;
      changed();
    },

    // ---------- clienti ----------
    async listCustomers() {
      requireStaff();
      return read(() => db.users);
    },
    async setRole(userId, role: Role) {
      const u = requireStaff();
      if (u.role !== 'admin') throw new ApiError('Solo il titolare può cambiare i ruoli', 'permesso');
      if (userId === u.id && role !== 'admin') throw new ApiError('Non puoi togliere a te stesso il ruolo di titolare');
      const t = db.users.find((x) => x.id === userId);
      if (t) t.role = role;
      changed();
    },
    async setCustomerNote(userId, note) {
      requireStaff();
      const t = db.users.find((x) => x.id === userId);
      if (t) t.staff_note = note;
      changed();
    },

    // ---------- notifiche ----------
    async listNotifications() {
      const u = me();
      if (!u) return [];
      return read(() => db.notifications.filter((n) => (n.audience === 'staff' ? isStaff(u) : n.user_id === u.id)).slice(0, 60) as AppNotification[]);
    },
    async markNotificationRead(id) {
      const n = db.notifications.find((x) => x.id === id);
      if (n && !n.read_at) n.read_at = nowIso();
      changed();
    },
    async markAllNotificationsRead() {
      const u = me();
      if (!u) return;
      for (const n of db.notifications) if (!n.read_at && (n.audience === 'staff' ? isStaff(u) : n.user_id === u.id)) n.read_at = nowIso();
      changed();
    },

    // ---------- file ----------
    async uploadFile(file, _folder) {
      requireUser();
      const dataUrl = await fileToDataUrl(file);
      return { path: dataUrl, name: file.name, size: file.size, type: file.type };
    },
    async fileUrl(ref) {
      return ref.path;
    },

    subscribe(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
  };
  return api;
}

/** In demo i file restano nel browser: le immagini vengono ridotte, gli altri file devono essere piccoli. */
async function fileToDataUrl(file: File): Promise<string> {
  const read = () =>
    new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(new ApiError('Non riesco a leggere il file'));
      r.readAsDataURL(file);
    });
  if (!file.type.startsWith('image/')) {
    if (file.size > 400_000) throw new ApiError('In modalità demo i file non immagine possono pesare al massimo 400 KB');
    return read();
  }
  const src = await read();
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('immagine'));
      i.src = src;
    });
    const max = 1100;
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.8);
  } catch {
    return src;
  }
}
