import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  esLlavePublishable,
  resolverLlavePublica,
  resolverUrl,
} from './llaveSupabase';

// Use AsyncStorage instead of SecureStore to avoid the 2048-byte limit
// that causes iOS to crash silently when supabase writes large session tokens
const AsyncStorageAdapter = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
};

const url = resolverUrl();
const llave = resolverLlavePublica();

/**
 * supabase-js (2.118) sigue mandando la publishable como
 * `Authorization: Bearer` cuando no hay sesión. Esa llave no es un JWT:
 * sin `apikey` el REST responde 401. La sesión del usuario sí va en
 * Bearer; la llave del proyecto, solo en `apikey`.
 */
function fetchSinBearerDeLlave(input, init) {
  const headers = new Headers(init?.headers);
  const auth = headers.get('Authorization');
  if (esLlavePublishable(llave) && auth === `Bearer ${llave}`) {
    headers.delete('Authorization');
  }
  return fetch(input, { ...init, headers });
}

export const supabase = createClient(url, llave, {
  global: { fetch: fetchSinBearerDeLlave },
  auth: {
    storage: AsyncStorageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
