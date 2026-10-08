import type {
  AppNotification, Bike, Brand, CreateOrderInput, FileRef, Lead, Order, OrderFull, OrderStatus, Payment, PaymentKind,
  Product, Profile, ProjectFull, ProjectMessage, ProjectStatus, Proof, Quote, QuoteLine, QuoteStatus, Role,
  Session, Settings, SubmitProjectInput, SubmitQuoteInput,
} from '../lib/types';

export type ProfilePatch = Partial<Pick<Profile, 'full_name' | 'phone' | 'address' | 'billing' | 'newsletter'>>;

export interface SignUpInput {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
}

export type SignUpResult = { session: Session } | { needsConfirmation: true };

export interface RecordPaymentInput {
  order_id?: string;
  project_id?: string;
  kind: PaymentKind;
  amount_cents: number;
  method: string;
  reference?: string;
}

export interface QuotePatch {
  lines?: QuoteLine[];
  valid_until?: string | null;
  staff_note?: string;
  status?: QuoteStatus;
}

export interface ProjectPatch {
  total_cents?: number | null;
  staff_note?: string;
  courier?: string;
  tracking_code?: string;
}

/**
 * Tutto ciò che l'interfaccia chiede ai dati. Due implementazioni:
 * - local.ts: modalità demo, i dati stanno nel browser;
 * - supabase.ts: dati veri su Supabase. Le regole di sicurezza stanno nel database (RLS), non qui.
 */
export interface Api {
  readonly mode: 'demo' | 'supabase';

  // sessione
  getSession(): Promise<Session | null>;
  signIn(email: string, password: string): Promise<Session>;
  signUp(input: SignUpInput): Promise<SignUpResult>;
  signOut(): Promise<void>;
  updateProfile(patch: ProfilePatch): Promise<Profile>;
  /** Solo demo: entra con un utente di prova. */
  demoLogin?(who: 'cliente' | 'titolare'): Promise<Session>;
  /** Solo demo: riporta i dati allo stato iniziale. */
  resetDemo?(): Promise<void>;
  /** Solo demo: il cliente simula di aver pagato. */
  demoPay?(paymentId: string): Promise<void>;

  // catalogo e impostazioni
  listBrands(): Promise<Brand[]>;
  listProducts(opts?: { all?: boolean }): Promise<Product[]>;
  saveProduct(p: Product): Promise<Product>;
  saveBrand(b: Brand): Promise<Brand>;
  getSettings(): Promise<Settings>;
  saveSettings(s: Settings): Promise<Settings>;

  // area cliente
  listWishlist(): Promise<string[]>;
  toggleWishlist(productId: string): Promise<string[]>;
  listBikes(): Promise<Bike[]>;
  saveBike(b: Partial<Bike> & Pick<Bike, 'brand' | 'model' | 'year' | 'rider_name' | 'rider_number'>): Promise<Bike>;
  deleteBike(id: string): Promise<void>;

  // ordini
  createOrder(input: CreateOrderInput): Promise<OrderFull>;
  listOrders(): Promise<OrderFull[]>;
  getOrder(id: string): Promise<OrderFull | null>;
  setOrderStatus(id: string, status: OrderStatus, note?: string): Promise<void>;
  updateOrder(id: string, patch: Partial<Pick<Order, 'staff_note' | 'courier' | 'tracking_code'>>): Promise<void>;

  // pagamenti (staff)
  recordPayment(input: RecordPaymentInput): Promise<Payment>;
  confirmPayment(id: string, reference?: string): Promise<void>;

  // grafiche personalizzate
  submitProject(input: SubmitProjectInput): Promise<ProjectFull>;
  listProjects(): Promise<ProjectFull[]>;
  getProject(id: string): Promise<ProjectFull | null>;
  setProjectStatus(id: string, status: ProjectStatus): Promise<void>;
  updateProject(id: string, patch: ProjectPatch): Promise<void>;
  addProof(projectId: string, file: FileRef, note: string): Promise<Proof>;
  decideProof(proofId: string, decision: 'approvata' | 'modifiche', comment: string): Promise<void>;
  sendMessage(projectId: string, body: string, files: FileRef[]): Promise<ProjectMessage>;

  // preventivi
  submitQuote(input: SubmitQuoteInput): Promise<void>;
  listQuotes(): Promise<Quote[]>;
  getQuote(id: string): Promise<Quote | null>;
  saveQuote(id: string, patch: QuotePatch): Promise<Quote>;
  decideQuote(id: string, accept: boolean): Promise<void>;
  quoteToOrder(id: string): Promise<OrderFull>;

  // contatti e newsletter
  submitLead(input: { kind: Lead['kind']; name: string; email: string; phone?: string; message?: string }): Promise<void>;
  listLeads(): Promise<Lead[]>;
  markLead(id: string, handled: boolean): Promise<void>;

  // clienti (staff)
  listCustomers(): Promise<Profile[]>;
  setRole(userId: string, role: Role): Promise<void>;
  setCustomerNote(userId: string, note: string): Promise<void>;

  // notifiche
  listNotifications(): Promise<AppNotification[]>;
  markNotificationRead(id: string): Promise<void>;
  markAllNotificationsRead(): Promise<void>;

  // file
  uploadFile(file: File, folder: string): Promise<FileRef>;
  fileUrl(ref: FileRef): Promise<string>;

  /** Chiamata quando i dati cambiano (anche da un'altra scheda). Restituisce la funzione per smettere di ascoltare. */
  subscribe(cb: () => void): () => void;
}

export class ApiError extends Error {
  constructor(message: string, public code = 'errore') {
    super(message);
  }
}
