import type { OrderStatus, PaymentStatus, ProjectStatus, QuoteStatus } from './types';

export type Tone = 'neutral' | 'info' | 'warn' | 'ok' | 'bad';

export interface StatusInfo {
  label: string;
  tone: Tone;
  /** Frase mostrata al cliente. */
  customer: string;
}

export const ORDER_STATUS: Record<OrderStatus, StatusInfo> = {
  ricevuto: { label: 'Ricevuto', tone: 'info', customer: 'Abbiamo ricevuto il tuo ordine.' },
  in_preparazione: { label: 'In preparazione', tone: 'info', customer: 'Stiamo preparando i file per la tua moto.' },
  in_stampa: { label: 'In stampa', tone: 'info', customer: 'Le tue grafiche sono in stampa.' },
  pronto: { label: 'Pronto', tone: 'ok', customer: 'Il kit è pronto: lo affidiamo al corriere.' },
  spedito: { label: 'Spedito', tone: 'ok', customer: 'Il pacco è in viaggio.' },
  consegnato: { label: 'Consegnato', tone: 'ok', customer: 'Consegnato. Buon divertimento in pista!' },
  annullato: { label: 'Annullato', tone: 'bad', customer: 'Ordine annullato.' },
};

/** Le tappe mostrate nel tracciamento (senza "annullato"). */
export const ORDER_FLOW: OrderStatus[] = ['ricevuto', 'in_preparazione', 'in_stampa', 'pronto', 'spedito', 'consegnato'];

export const PAYMENT_STATUS: Record<PaymentStatus, { label: string; tone: Tone }> = {
  da_pagare: { label: 'Da pagare', tone: 'warn' },
  acconto: { label: 'Acconto versato', tone: 'info' },
  pagato: { label: 'Pagato', tone: 'ok' },
  rimborsato: { label: 'Rimborsato', tone: 'neutral' },
};

export const PROJECT_STATUS: Record<ProjectStatus, StatusInfo & { turn: 'cliente' | 'draco' | 'nessuno'; step: number }> = {
  nuovo: { label: 'In attesa acconto', tone: 'warn', customer: 'Versa l’acconto: appena lo riceviamo il grafico inizia a lavorare.', turn: 'cliente', step: 0 },
  in_grafica: { label: 'In grafica', tone: 'info', customer: 'Il nostro grafico sta preparando la prima bozza.', turn: 'draco', step: 1 },
  bozza_inviata: { label: 'Bozza da approvare', tone: 'warn', customer: 'La bozza è pronta: approvala o chiedi modifiche.', turn: 'cliente', step: 2 },
  modifiche: { label: 'Modifiche richieste', tone: 'info', customer: 'Il grafico sta applicando le tue modifiche.', turn: 'draco', step: 1 },
  approvata: { label: 'Approvata', tone: 'ok', customer: 'Bozza approvata. Versa il saldo per passare alla stampa.', turn: 'cliente', step: 3 },
  in_stampa: { label: 'In stampa', tone: 'info', customer: 'La tua grafica è in stampa.', turn: 'draco', step: 4 },
  spedita: { label: 'Spedita', tone: 'ok', customer: 'Il pacco è in viaggio.', turn: 'nessuno', step: 5 },
  consegnata: { label: 'Consegnata', tone: 'ok', customer: 'Consegnata. Buon divertimento in pista!', turn: 'nessuno', step: 6 },
  annullata: { label: 'Annullata', tone: 'bad', customer: 'Progetto annullato.', turn: 'nessuno', step: 0 },
};

export const PROJECT_FLOW: { key: string; label: string }[] = [
  { key: 'nuovo', label: 'Brief e acconto' },
  { key: 'in_grafica', label: 'Bozza' },
  { key: 'bozza_inviata', label: 'Approvazione' },
  { key: 'approvata', label: 'Saldo' },
  { key: 'in_stampa', label: 'Stampa' },
  { key: 'spedita', label: 'Spedizione' },
  { key: 'consegnata', label: 'Consegna' },
];

export const QUOTE_STATUS: Record<QuoteStatus, { label: string; tone: Tone }> = {
  nuova: { label: 'Nuova richiesta', tone: 'warn' },
  in_preparazione: { label: 'In preparazione', tone: 'info' },
  inviato: { label: 'Inviato al cliente', tone: 'info' },
  accettato: { label: 'Accettato', tone: 'ok' },
  rifiutato: { label: 'Rifiutato', tone: 'bad' },
  scaduto: { label: 'Scaduto', tone: 'neutral' },
  convertito: { label: 'Convertito in ordine', tone: 'ok' },
};

export const ORDER_STATUSES = Object.keys(ORDER_STATUS) as OrderStatus[];
export const PROJECT_STATUSES = Object.keys(PROJECT_STATUS) as ProjectStatus[];
export const QUOTE_STATUSES = Object.keys(QUOTE_STATUS) as QuoteStatus[];

/** Prossimo stato naturale di un ordine, se esiste. */
export function nextOrderStatus(s: OrderStatus): OrderStatus | null {
  const i = ORDER_FLOW.indexOf(s);
  return i >= 0 && i < ORDER_FLOW.length - 1 ? ORDER_FLOW[i + 1]! : null;
}

/** Ordine ancora da lavorare in laboratorio. */
export const isOrderOpen = (s: OrderStatus) => s !== 'consegnato' && s !== 'annullato';
export const isProjectOpen = (s: ProjectStatus) => s !== 'consegnata' && s !== 'annullata';
