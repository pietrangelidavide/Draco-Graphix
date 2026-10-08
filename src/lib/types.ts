// Modello dati di Draco Graphix. I nomi dei campi coincidono con le colonne di supabase/schema.sql.

export type Role = 'customer' | 'staff' | 'admin';

export interface Address {
  name?: string;
  street: string;
  city: string;
  zip: string;
  province: string;
  country: string;
  phone?: string;
}

/** Dati per la fattura (privato o azienda/team). */
export interface Billing {
  business_name?: string;
  vat_number?: string;
  tax_code?: string;
  sdi_code?: string;
  pec?: string;
}

export interface Profile {
  id: string;
  role: Role;
  full_name: string;
  email: string;
  phone: string;
  address: Address | null;
  billing: Billing;
  newsletter: boolean;
  staff_note: string;
  created_at: string;
}

/** Una moto salvata nel "garage" del cliente. */
export interface Bike {
  id: string;
  user_id: string;
  brand: string;
  model: string;
  year: number | null;
  rider_name: string;
  rider_number: string;
  created_at: string;
}

export interface Brand {
  id: string;
  name: string;
  sort: number;
  active: boolean;
}

// ---------- Catalogo ----------

export type ProductKind = 'kit' | 'forcella' | 'accessorio';

export type FieldType = 'text' | 'select' | 'year';
/** Il ruolo collega il campo al garage e all'anteprima. */
export type FieldRole = 'model' | 'year' | 'rider_name' | 'rider_number' | 'base' | 'finish';

export interface FieldChoice {
  value: string;
  label: string;
  delta_cents: number;
}

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  role?: FieldRole;
  help?: string;
  placeholder?: string;
  maxLength?: number;
  choices?: FieldChoice[];
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  kind: ProductKind;
  brand_id: string | null;
  tags: string[];
  description: string;
  contents: string[];
  specs: string[];
  price_cents: number;
  discount_percent: number;
  images: string[];
  art_colors: string[];
  fields: FieldDef[];
  badge: string | null;
  featured: boolean;
  active: boolean;
  stock: number | null;
  sort: number;
  created_at: string;
}

// ---------- Ordini ----------

export type OrderStatus = 'ricevuto' | 'in_preparazione' | 'in_stampa' | 'pronto' | 'spedito' | 'consegnato' | 'annullato';
export type PaymentStatus = 'da_pagare' | 'acconto' | 'pagato' | 'rimborsato';

export interface ConfigEntry {
  key: string;
  label: string;
  value: string;
  value_label: string;
  delta_cents: number;
  role?: FieldRole;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  name: string;
  kind: ProductKind | 'altro';
  qty: number;
  unit_price_cents: number;
  config: ConfigEntry[];
}

export interface Order {
  id: string;
  number: string;
  user_id: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method: string;
  subtotal_cents: number;
  shipping_cents: number;
  total_cents: number;
  shipping_address: Address;
  billing: Billing;
  customer_note: string;
  staff_note: string;
  courier: string;
  tracking_code: string;
  quote_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderEvent {
  id: string;
  order_id: string;
  status: OrderStatus;
  note: string;
  actor_name: string;
  created_at: string;
}

export type PaymentKind = 'ordine' | 'acconto' | 'saldo';
export type PaymentRowStatus = 'in_attesa' | 'ricevuto' | 'rimborsato';

export interface Payment {
  id: string;
  order_id: string | null;
  project_id: string | null;
  kind: PaymentKind;
  amount_cents: number;
  method: string;
  status: PaymentRowStatus;
  reference: string;
  paid_at: string | null;
  created_at: string;
}

export interface OrderFull extends Order {
  items: OrderItem[];
  events: OrderEvent[];
  payments: Payment[];
  customer?: Pick<Profile, 'id' | 'full_name' | 'email' | 'phone'>;
}

// ---------- Grafiche personalizzate ----------

export type ProjectStatus =
  | 'nuovo'
  | 'in_grafica'
  | 'bozza_inviata'
  | 'modifiche'
  | 'approvata'
  | 'in_stampa'
  | 'spedita'
  | 'consegnata'
  | 'annullata';

export interface FileRef {
  path: string;
  name: string;
  size: number;
  type: string;
}

export interface ProjectBrief {
  brand: string;
  model: string;
  year: string;
  rider_name: string;
  rider_number: string;
  colors: string;
  style: string;
  sponsors: string;
  base: string;
  finish: string;
}

export interface Project {
  id: string;
  number: string;
  user_id: string;
  title: string;
  status: ProjectStatus;
  brief: ProjectBrief;
  files: FileRef[];
  deposit_cents: number;
  total_cents: number | null;
  revisions: number;
  courier: string;
  tracking_code: string;
  shipping_address: Address | null;
  staff_note: string;
  created_at: string;
  updated_at: string;
}

export type ProofStatus = 'in_attesa' | 'approvata' | 'modifiche' | 'sostituita';

export interface Proof {
  id: string;
  project_id: string;
  version: number;
  file: FileRef;
  note: string;
  status: ProofStatus;
  customer_comment: string;
  created_at: string;
  decided_at: string | null;
}

export interface ProjectMessage {
  id: string;
  project_id: string;
  sender_id: string;
  sender_role: Role;
  sender_name: string;
  kind: 'message' | 'system';
  body: string;
  files: FileRef[];
  created_at: string;
}

export interface ProjectFull extends Project {
  proofs: Proof[];
  messages: ProjectMessage[];
  payments: Payment[];
  customer?: Pick<Profile, 'id' | 'full_name' | 'email' | 'phone'>;
}

// ---------- Preventivi ----------

export type QuoteStatus = 'nuova' | 'in_preparazione' | 'inviato' | 'accettato' | 'rifiutato' | 'scaduto' | 'convertito';

export interface QuoteLine {
  description: string;
  qty: number;
  unit_price_cents: number;
}

export interface QuoteContact {
  name: string;
  email: string;
  phone: string;
}

export interface Quote {
  id: string;
  number: string;
  user_id: string | null;
  contact: QuoteContact;
  team_name: string;
  riders: number;
  bike_type: string;
  service: string;
  message: string;
  status: QuoteStatus;
  lines: QuoteLine[];
  total_cents: number;
  valid_until: string | null;
  staff_note: string;
  order_id: string | null;
  created_at: string;
  updated_at: string;
}

// ---------- Varie ----------

export interface Lead {
  id: string;
  kind: 'contatto' | 'newsletter';
  name: string;
  email: string;
  phone: string;
  message: string;
  handled: boolean;
  created_at: string;
}

export interface AppNotification {
  id: string;
  user_id: string | null;
  audience: 'user' | 'staff';
  title: string;
  body: string;
  link: string;
  read_at: string | null;
  created_at: string;
}

export interface PaymentMethodSetting {
  id: string;
  label: string;
  instructions: string;
  enabled: boolean;
}

export interface Settings {
  company: {
    name: string;
    vat_number: string;
    email: string;
    phone: string;
    instagram: string;
    facebook: string;
    address: string;
  };
  deposit_cents: number;
  vat_percent: number;
  shipping_flat_cents: number;
  shipping_free_over_cents: number | null;
  lead_time: string;
  payment_methods: PaymentMethodSetting[];
  couriers: string[];
  privacy_text: string;
  terms_text: string;
}

export interface Session {
  user: Profile;
}

// ---------- Input delle operazioni ----------

export interface CartLineInput {
  product_id: string;
  qty: number;
  selections: Record<string, string>;
}

export interface CreateOrderInput {
  items: CartLineInput[];
  shipping_address: Address;
  billing: Billing;
  customer_note: string;
  payment_method: string;
}

export interface SubmitProjectInput {
  title: string;
  brief: ProjectBrief;
  files: FileRef[];
  shipping_address: Address | null;
  payment_method: string;
}

export interface SubmitQuoteInput {
  contact: QuoteContact;
  team_name: string;
  riders: number;
  bike_type: string;
  service: string;
  message: string;
}
