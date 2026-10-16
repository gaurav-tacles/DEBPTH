import { createClient, SupabaseClient, Session, User } from '@supabase/supabase-js';
import { logger } from './logger';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

const STORAGE_KEY_URL = 'projecthub_supabase_url';
const STORAGE_KEY_KEY = 'projecthub_supabase_key';

export function getStoredSupabaseConfig(): SupabaseConfig {
  const envUrl = (typeof import.meta !== 'undefined' && import.meta.env ? (import.meta.env.VITE_SUPABASE_URL as string) : '') || '';
  const envKey = (typeof import.meta !== 'undefined' && import.meta.env ? (import.meta.env.VITE_SUPABASE_ANON_KEY as string) : '') || '';

  const localUrl = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY_URL) || '' : '';
  const localKey = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY_KEY) || '' : '';

  return {
    url: localUrl || envUrl,
    anonKey: localKey || envKey,
  };
}

export function isSupabaseConfigured(): boolean {
  const { url, anonKey } = getStoredSupabaseConfig();
  return Boolean(
    url &&
    anonKey &&
    url.startsWith('http') &&
    url !== 'https://your-project-id.supabase.co' &&
    anonKey !== 'your-anon-public-key'
  );
}

export function saveSupabaseConfig(url: string, anonKey: string) {
  if (url) localStorage.setItem(STORAGE_KEY_URL, url);
  else localStorage.removeItem(STORAGE_KEY_URL);

  if (anonKey) localStorage.setItem(STORAGE_KEY_KEY, anonKey);
  else localStorage.removeItem(STORAGE_KEY_KEY);

  cachedClient = null;
  logger.info('SupabaseConfig', 'Updated Supabase credentials configuration');
}

let cachedClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  const { url, anonKey } = getStoredSupabaseConfig();
  if (!isSupabaseConfigured()) {
    return null;
  }

  if (!cachedClient) {
    try {
      cachedClient = createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage: window.localStorage,
        },
      });
      logger.info('SupabaseClient', 'Initialized Supabase client with URL', { url });
    } catch (err) {
      logger.error('SupabaseClient', 'Failed to initialize Supabase client', err);
      return null;
    }
  }

  return cachedClient;
}

export async function testSupabaseConnection(
  url: string,
  anonKey: string
): Promise<{ success: boolean; message: string; latencyMs?: number }> {
  if (!url || !anonKey) {
    return { success: false, message: 'URL and Anon Key are required.' };
  }

  try {
    const startTime = performance.now();
    const testClient = createClient(url, anonKey);
    const { error } = await testClient.from('profiles').select('count', { count: 'exact', head: true });
    const latencyMs = Math.round(performance.now() - startTime);

    if (error && error.code !== 'PGRST116' && error.code !== '42P01') {
      logger.warn('SupabaseTest', 'Connection responded with notice', error);
      return {
        success: false,
        message: `Endpoint reached, but query returned: ${error.message} (Code: ${error.code})`,
        latencyMs,
      };
    }

    logger.info('SupabaseTest', 'Connection successful', { latencyMs });
    return { success: true, message: `Connected successfully! (Latency: ${latencyMs}ms)`, latencyMs };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error('SupabaseTest', 'Failed to connect to Supabase', errorMsg);
    return { success: false, message: `Failed to connect: ${errorMsg}` };
  }
}
