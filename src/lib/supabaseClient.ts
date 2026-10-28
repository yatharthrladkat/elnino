import { createClient } from '@supabase/supabase-js';
import firebaseConfig from '../../firebase-applet-config.json' with { type: 'json' };

// Supabase project credentials with fallback to config & environment
export const supabaseUrl =
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_URL) ||
  (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) ||
  (import.meta as any)?.env?.NEXT_PUBLIC_SUPABASE_URL ||
  (import.meta as any)?.env?.VITE_SUPABASE_URL ||
  'https://gfnuqcpbrniwrfuwiorf.supabase.co';

export const supabaseAnonKey =
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) ||
  (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY) ||
  (import.meta as any)?.env?.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  (import.meta as any)?.env?.VITE_SUPABASE_ANON_KEY ||
  firebaseConfig.apiKey ||
  'sb_publishable_6kUSQNyzeGXf94KcKqpFbA_jOdcZr69';

/**
 * Initialized Supabase client configured for persistent browser authentication
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    storageKey: 'epe_supabase_auth_token'
  }
});

export default supabase;
