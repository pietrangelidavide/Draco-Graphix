import type { Api } from './api';
import { createLocalApi } from './local';
import { createSupabaseApi } from './supabase';

const url = typeof __SUPABASE_URL__ === 'string' ? __SUPABASE_URL__ : '';
const key = typeof __SUPABASE_ANON_KEY__ === 'string' ? __SUPABASE_ANON_KEY__ : '';
const forceDemo = typeof __DEMO_FORCED__ === 'boolean' && __DEMO_FORCED__;

/** Con SUPABASE_URL e SUPABASE_ANON_KEY nel file .env l'app usa i dati veri; altrimenti parte in modalità demo. */
export const api: Api = url && key && !forceDemo ? createSupabaseApi(url, key) : createLocalApi();
export const isDemo = api.mode === 'demo';
export type { Api } from './api';
export { ApiError } from './api';
