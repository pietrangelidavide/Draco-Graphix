import { ApiError } from './api';
import type { Api, ProfilePatch, ProjectPatch, QuotePatch, RecordPaymentInput, SignUpInput, SignUpResult } from './api';
import { uid } from '../lib/util';
import type {
  AppNotification, Bike, Brand, CreateOrderInput, FileRef, Lead, Order, OrderFull, Payment, Product, Profile, ProjectFull,
  ProjectMessage, Proof, Quote, Role, Session, Settings, SubmitProjectInput, SubmitQuoteInput,
} from '../lib/types';

// Collegamento a Supabase con semplici chiamate HTTP (PostgREST, GoTrue, Storage): nessuna libreria da installare.
// Le regole di sicurezza stanno nel database (supabase/schema.sql): questo file si limita a chiedere i dati.

const AUTH_KEY = 'dg-sb-auth';

interface Tokens {
  access_token: string;
  refresh_token: string;
  expires_at: number; // secondi dal 1970
  user_id: string;
}

const ORDER_SELECT = '*,items:order_items(*),events:order_events(*),payments(*),customer:profiles!user_id(id,full_name,email,phone)';
const PROJECT_SELECT = '*,proofs(*),payments(*),customer:profiles!user_id(id,full_name,email,phone)';

export function createSupabaseApi(rawUrl: string, anonKey: string): Api {
  const base = rawUrl.replace(/\/+$/, '');
  const listeners = new Set<() => void>();
  let tokens: Tokens | null = null;
  const signedCache = new Map<string, { url: string; exp: number }>();

  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (raw) tokens = JSON.parse(raw) as Tokens;
  } catch {
    tokens = null;
  }
  const saveTokens = (t: Tokens | null) => {
    tokens = t;
    try {
      if (t) localStorage.setItem(AUTH_KEY, JSON.stringify(t));
      else localStorage.removeItem(AUTH_KEY);
    } catch {
      /* archiviazione bloccata: la sessione dura finché la pagina resta aperta */
    }
  };
  const emit = () => listeners.forEach((l) => l());

  // ---------- rete ----------
  async function refresh(): Promise<void> {
    if (!tokens) return;
    const res = await fetch(`${base}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { apikey: anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: tokens.refresh_token }),
    }).catch(() => null);
    if (!res || !res.ok) {
      saveTokens(null);
      return;
    }
    saveTokens(toTokens(await res.json()));
  }

  async function bearer(): Promise<string> {
    if (tokens && tokens.expires_at - 60 < Date.now() / 1000) await refresh();
    return tokens?.access_token ?? anonKey;
  }

  async function call(url: string, init: RequestInit & { json?: unknown } = {}): Promise<Response> {
    const headers: Record<string, string> = { apikey: anonKey, Authorization: `Bearer ${await bearer()}`, ...(init.headers as Record<string, string>) };
    let body = init.body;
    if (init.json !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(init.json);
    }
    let res: Response;
    try {
      res = await fetch(url, { ...init, headers, body });
    } catch {
      throw new ApiError('Connessione assente: riprova tra poco', 'rete');
    }
    if (!res.ok) throw await toError(res);
    return res;
  }

  async function toError(res: Response): Promise<ApiError> {
    let msg = '';
    let code = '';
    try {
      const j = (await res.json()) as { message?: string; msg?: string; error_description?: string; code?: string; error?: string };
      msg = j.message ?? j.msg ?? j.error_description ?? j.error ?? '';
      code = j.code ?? '';
    } catch {
      /* corpo vuoto */
    }
    if (/permission denied|row-level security|42501/i.test(msg + code)) return new ApiError('Operazione non consentita', 'permesso');
    if (/JWT expired|invalid JWT/i.test(msg)) return new ApiError('Sessione scaduta: accedi di nuovo', 'login');
    if (/Invalid login credentials/i.test(msg)) return new ApiError('Email o password non corrette', 'credenziali');
    if (/already registered|already been registered/i.test(msg)) return new ApiError('Esiste già un account con questa email');
    if (/Password should be/i.test(msg)) return new ApiError('La password deve avere almeno 6 caratteri');
    if (/Email not confirmed/i.test(msg)) return new ApiError('Conferma prima l’email: ti abbiamo scritto un link', 'conferma');
    return new ApiError(msg || `Errore ${res.status}`, code || 'errore');
  }

  const rest = async <T,>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> => {
    const res = await call(`${base}/rest/v1/${path}`, init);
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
  };
  const rpc = <T,>(fn: string, args: Record<string, unknown> = {}) => rest<T>(`rpc/${fn}`, { method: 'POST', json: args });
  const get = <T,>(path: string) => rest<T>(path);
  const getOne = async <T,>(path: string): Promise<T | null> => {
    const rows = await get<T[]>(path);
    return rows[0] ?? null;
  };
  const mutate = async <T,>(fn: () => Promise<T>): Promise<T> => {
    const out = await fn();
    emit();
    return out;
  };
  const eq = (v: string) => `eq.${encodeURIComponent(v)}`;

  function toTokens(j: { access_token: string; refresh_token: string; expires_in?: number; expires_at?: number; user: { id: string } }): Tokens {
    return {
      access_token: j.access_token,
      refresh_token: j.refresh_token,
      expires_at: j.expires_at ?? Math.floor(Date.now() / 1000) + (j.expires_in ?? 3600),
      user_id: j.user.id,
    };
  }

  async function loadSession(): Promise<Session | null> {
    if (!tokens) return null;
    try {
      const user = await getOne<Profile>(`profiles?id=${eq(tokens.user_id)}&select=*`);
      return user ? { user } : null;
    } catch (e) {
      if ((e as ApiError).code === 'login') saveTokens(null);
      return null;
    }
  }

  const sortEvents = (o: OrderFull): OrderFull => ({
    ...o,
    events: [...(o.events ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at)),
    items: o.items ?? [],
    payments: o.payments ?? [],
  });
  const sortProject = (p: ProjectFull): ProjectFull => ({
    ...p,
    proofs: [...(p.proofs ?? [])].sort((a, b) => a.version - b.version),
    messages: [...(p.messages ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at)),
    payments: p.payments ?? [],
  });

  const getOrder = async (id: string) => {
    const o = await getOne<OrderFull>(`orders?id=${eq(id)}&select=${encodeURIComponent(ORDER_SELECT)}`);
    return o ? sortEvents(o) : null;
  };
  const getProject = async (id: string) => {
    const p = await getOne<ProjectFull>(`projects?id=${eq(id)}&select=${encodeURIComponent(PROJECT_SELECT + ',messages:project_messages(*)')}`);
    return p ? sortProject(p) : null;
  };

  const requireId = (x: unknown): string => {
    const id = typeof x === 'string' ? x : '';
    if (!id) throw new ApiError('Risposta inattesa dal server');
    return id;
  };

  // ---------- aggiornamento periodico (niente websocket: basta sapere quando ricaricare) ----------
  let poll: ReturnType<typeof setInterval> | null = null;
  const startPolling = () => {
    if (poll || typeof document === 'undefined') return;
    poll = setInterval(() => {
      if (document.visibilityState === 'visible' && tokens) emit();
    }, 20000);
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && emit());
  };

  const api: Api = {
    mode: 'supabase',

    getSession: loadSession,

    async signIn(email, password) {
      const res = await call(`${base}/auth/v1/token?grant_type=password`, { method: 'POST', json: { email: email.trim(), password } });
      saveTokens(toTokens(await res.json()));
      const s = await loadSession();
      if (!s) throw new ApiError('Profilo non trovato: contatta l’assistenza');
      emit();
      return s;
    },

    async signUp(input: SignUpInput): Promise<SignUpResult> {
      const res = await call(`${base}/auth/v1/signup`, {
        method: 'POST',
        json: { email: input.email.trim(), password: input.password, data: { full_name: input.full_name.trim(), phone: input.phone?.trim() ?? '' } },
      });
      const j = await res.json();
      if (!j.access_token) return { needsConfirmation: true };
      saveTokens(toTokens(j));
      const s = await loadSession();
      if (!s) return { needsConfirmation: true };
      emit();
      return { session: s };
    },

    async signOut() {
      if (tokens) await call(`${base}/auth/v1/logout`, { method: 'POST' }).catch(() => undefined);
      saveTokens(null);
      emit();
    },

    updateProfile: (patch: ProfilePatch) =>
      mutate(async () => {
        if (!tokens) throw new ApiError('Accedi per continuare', 'login');
        const rows = await rest<Profile[]>(`profiles?id=${eq(tokens.user_id)}`, { method: 'PATCH', json: patch, headers: { Prefer: 'return=representation' } });
        return rows[0]!;
      }),

    // catalogo e impostazioni
    listBrands: () => get<Brand[]>('brands?select=*&order=sort'),
    listProducts: (opts) => get<Product[]>(`products?select=*&order=sort${opts?.all ? '' : '&active=eq.true'}`),
    saveProduct: (p: Product) =>
      mutate(async () => {
        const rows = await rest<Product[]>('products', { method: 'POST', json: p, headers: { Prefer: 'resolution=merge-duplicates,return=representation' } });
        return rows[0]!;
      }),
    saveBrand: (b: Brand) =>
      mutate(async () => {
        const rows = await rest<Brand[]>('brands', { method: 'POST', json: b, headers: { Prefer: 'resolution=merge-duplicates,return=representation' } });
        return rows[0]!;
      }),
    async getSettings() {
      const row = await getOne<{ data: Settings }>('settings?id=eq.1&select=data');
      if (!row) throw new ApiError('Impostazioni mancanti: esegui supabase/seed.sql');
      return row.data;
    },
    saveSettings: (s: Settings) =>
      mutate(async () => {
        const rows = await rest<{ data: Settings }[]>('settings?id=eq.1', { method: 'PATCH', json: { data: s }, headers: { Prefer: 'return=representation' } });
        if (!rows.length) throw new ApiError('Solo il titolare può cambiare le impostazioni', 'permesso');
        return rows[0]!.data;
      }),

    // area cliente
    async listWishlist() {
      if (!tokens) return [];
      return (await get<{ product_id: string }[]>('wishlist?select=product_id')).map((w) => w.product_id);
    },
    async toggleWishlist(productId) {
      const uidv = tokens?.user_id;
      if (!uidv) throw new ApiError('Accedi per continuare', 'login');
      const has = await getOne<{ product_id: string }>(`wishlist?select=product_id&product_id=${eq(productId)}`);
      await mutate(() =>
        has
          ? rest(`wishlist?user_id=${eq(uidv)}&product_id=${eq(productId)}`, { method: 'DELETE' })
          : rest('wishlist', { method: 'POST', json: { user_id: uidv, product_id: productId } }),
      );
      return (await get<{ product_id: string }[]>('wishlist?select=product_id')).map((w) => w.product_id);
    },
    async listBikes() {
      if (!tokens) return [];
      return get<Bike[]>('bikes?select=*&order=created_at');
    },
    saveBike: (b) =>
      mutate(async () => {
        if (!tokens) throw new ApiError('Accedi per continuare', 'login');
        if (!b.model.trim()) throw new ApiError('Indica il modello della moto');
        const row = { brand: b.brand.trim(), model: b.model.trim(), year: b.year, rider_name: b.rider_name.trim(), rider_number: b.rider_number.trim() };
        const rows = b.id
          ? await rest<Bike[]>(`bikes?id=${eq(b.id)}`, { method: 'PATCH', json: row, headers: { Prefer: 'return=representation' } })
          : await rest<Bike[]>('bikes', { method: 'POST', json: { ...row, user_id: tokens.user_id }, headers: { Prefer: 'return=representation' } });
        return rows[0]!;
      }),
    deleteBike: (id) => mutate(() => rest<void>(`bikes?id=${eq(id)}`, { method: 'DELETE' })),

    // ordini
    createOrder: (input: CreateOrderInput) =>
      mutate(async () => {
        const id = requireId(
          await rpc('create_order', {
            p_items: input.items, p_shipping: input.shipping_address, p_billing: input.billing, p_note: input.customer_note, p_method: input.payment_method,
          }),
        );
        const o = await getOrder(id);
        if (!o) throw new ApiError('Ordine creato ma non leggibile: controlla “I miei ordini”');
        return o;
      }),
    async listOrders() {
      if (!tokens) return [];
      return (await get<OrderFull[]>(`orders?select=${encodeURIComponent(ORDER_SELECT)}&order=created_at.desc`)).map(sortEvents);
    },
    getOrder,
    setOrderStatus: (id, status, note = '') => mutate(() => rpc<void>('set_order_status', { p_id: id, p_status: status, p_note: note })),
    updateOrder: (id, patch: Partial<Pick<Order, 'staff_note' | 'courier' | 'tracking_code'>>) =>
      mutate(() => rest<void>(`orders?id=${eq(id)}`, { method: 'PATCH', json: patch })),

    // pagamenti
    recordPayment: (input: RecordPaymentInput) =>
      mutate(async () => {
        const id = requireId(
          await rpc('record_payment', {
            p_order: input.order_id ?? null, p_project: input.project_id ?? null, p_kind: input.kind, p_amount: input.amount_cents, p_method: input.method, p_reference: input.reference ?? '',
          }),
        );
        return (await getOne<Payment>(`payments?id=${eq(id)}&select=*`))!;
      }),
    confirmPayment: (id, reference = '') => mutate(() => rpc<void>('confirm_payment', { p_id: id, p_reference: reference })),

    // progetti
    submitProject: (input: SubmitProjectInput) =>
      mutate(async () => {
        const id = requireId(
          await rpc('submit_project', { p_title: input.title, p_brief: input.brief, p_files: input.files, p_shipping: input.shipping_address, p_method: input.payment_method }),
        );
        const p = await getProject(id);
        if (!p) throw new ApiError('Progetto creato ma non leggibile: controlla “Le mie grafiche”');
        return p;
      }),
    async listProjects() {
      if (!tokens) return [];
      return (await get<ProjectFull[]>(`projects?select=${encodeURIComponent(PROJECT_SELECT)}&order=updated_at.desc`)).map(sortProject);
    },
    getProject,
    setProjectStatus: (id, status) => mutate(() => rpc<void>('set_project_status', { p_id: id, p_status: status })),
    updateProject: (id, patch: ProjectPatch) => mutate(() => rpc<void>('staff_update_project', { p_id: id, p_patch: patch })),
    addProof: (projectId, file: FileRef, note) =>
      mutate(async () => {
        const id = requireId(await rpc('add_proof', { p_project: projectId, p_file: file, p_note: note }));
        return (await getOne<Proof>(`proofs?id=${eq(id)}&select=*`))!;
      }),
    decideProof: (proofId, decision, comment) => mutate(() => rpc<void>('decide_proof', { p_proof: proofId, p_decision: decision, p_comment: comment })),
    sendMessage: (projectId, body, files) =>
      mutate(async () => {
        const id = requireId(await rpc('send_project_message', { p_project: projectId, p_body: body, p_files: files }));
        return (await getOne<ProjectMessage>(`project_messages?id=${eq(id)}&select=*`))!;
      }),

    // preventivi
    submitQuote: (input: SubmitQuoteInput) =>
      mutate(async () => {
        await rpc('submit_quote', {
          p_contact: input.contact, p_team: input.team_name, p_riders: input.riders, p_bike_type: input.bike_type, p_service: input.service, p_message: input.message,
        });
      }),
    async listQuotes() {
      if (!tokens) return [];
      return get<Quote[]>('quotes?select=*&order=created_at.desc');
    },
    getQuote: (id) => getOne<Quote>(`quotes?id=${eq(id)}&select=*`),
    saveQuote: (id, patch: QuotePatch) =>
      mutate(async () => {
        await rpc('save_quote', { p_id: id, p_patch: patch });
        return (await getOne<Quote>(`quotes?id=${eq(id)}&select=*`))!;
      }),
    decideQuote: (id, accept) => mutate(() => rpc<void>('decide_quote', { p_id: id, p_accept: accept })),
    quoteToOrder: (id) =>
      mutate(async () => {
        const oid = requireId(await rpc('quote_to_order', { p_id: id }));
        return (await getOrder(oid))!;
      }),

    // contatti
    submitLead: (input) =>
      mutate(async () => {
        await rpc('submit_lead', { p_kind: input.kind, p_name: input.name, p_email: input.email, p_phone: input.phone ?? '', p_message: input.message ?? '' });
      }),
    listLeads: () => get<Lead[]>('leads?select=*&order=created_at.desc'),
    markLead: (id, handled) => mutate(() => rest<void>(`leads?id=${eq(id)}`, { method: 'PATCH', json: { handled } })),

    // clienti
    listCustomers: () => get<Profile[]>('profiles?select=*&order=created_at.desc'),
    setRole: (userId, role: Role) => mutate(() => rpc<void>('set_role', { p_user: userId, p_role: role })),
    setCustomerNote: (userId, note) => mutate(() => rpc<void>('set_customer_note', { p_user: userId, p_note: note })),

    // notifiche
    async listNotifications() {
      if (!tokens) return [];
      return get<AppNotification[]>('notifications?select=*&order=created_at.desc&limit=60');
    },
    markNotificationRead: (id) => mutate(() => rpc<void>('mark_notification_read', { p_id: id })),
    markAllNotificationsRead: () => mutate(() => rpc<void>('mark_all_notifications_read')),

    // file
    async uploadFile(file, folder) {
      if (!tokens) throw new ApiError('Accedi per continuare', 'login');
      const safe = file.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9._-]+/g, '-').slice(-80) || 'file';
      const isCatalog = folder === 'catalog';
      const bucket = isCatalog ? 'catalog' : 'files';
      // Regole dell'archivio: i clienti scrivono solo in "<id utente>/…"; il gestionale può scrivere ovunque
      // (le bozze in "proofs/<id progetto>/…" sono leggibili dal cliente del progetto).
      const staffArea = folder.startsWith('proofs/');
      const prefix = isCatalog || staffArea ? folder : `${tokens.user_id}/${folder}`;
      const path = `${prefix}/${uid().slice(0, 8)}-${safe}`;
      await call(`${base}/storage/v1/object/${bucket}/${path}`, { method: 'POST', body: file, headers: { 'Content-Type': file.type || 'application/octet-stream', 'x-upsert': 'false' } });
      const ref: FileRef = {
        path: isCatalog ? `${base}/storage/v1/object/public/catalog/${path}` : path,
        name: file.name, size: file.size, type: file.type,
      };
      return ref;
    },
    async fileUrl(ref) {
      if (/^(https?:|data:|blob:)/.test(ref.path)) return ref.path;
      const hit = signedCache.get(ref.path);
      if (hit && hit.exp > Date.now() + 60000) return hit.url;
      const res = await call(`${base}/storage/v1/object/sign/files/${ref.path.split('/').map(encodeURIComponent).join('/')}`, { method: 'POST', json: { expiresIn: 3600 } });
      const j = (await res.json()) as { signedURL?: string };
      if (!j.signedURL) throw new ApiError('File non disponibile');
      const url = `${base}/storage/v1${j.signedURL}`;
      signedCache.set(ref.path, { url, exp: Date.now() + 3600000 });
      return url;
    },

    subscribe(cb) {
      listeners.add(cb);
      startPolling();
      return () => listeners.delete(cb);
    },
  };
  return api;
}
