import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../utils/supabase';
import { limpiar, VACIAS } from '../components/feed/preferencias';

/**
 * Cómo quiere cada quien su feed (ver `components/feed/preferencias.js`).
 *
 * Se guarda en el teléfono para que el feed salga armado desde la primera
 * pintada, y en la cuenta (`user_preferences`) para que siga a la persona en
 * otro teléfono. Al abrir, si la cuenta tiene algo, manda la cuenta; sin
 * sesión, queda solo el teléfono.
 */
export const CLAVE = 'feed.temas';

async function miId() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.user?.id || null;
}

export const useFeedStore = create(
  persist(
    (set, get) => ({
      prefs: VACIAS,

      cambiar: (prefs) => set({ prefs: limpiar(prefs) }),

      /** Trae lo de la cuenta, si hay sesión y algo guardado. */
      traerDeLaCuenta: async () => {
        const userId = await miId();
        if (!userId) return;
        // Si lo de la cuenta llegara antes que lo del teléfono, el teléfono lo pisaría.
        if (!useFeedStore.persist.hasHydrated()) await new Promise((r) => useFeedStore.persist.onFinishHydration(r));
        const { data } = await supabase.from('user_preferences').select('preferences').eq('user_id', userId).maybeSingle();
        const guardadas = data?.preferences?.[CLAVE];
        if (guardadas) set({ prefs: limpiar(guardadas) });
      },

      /** Se lee y se mezcla antes de escribir: la fila guarda todas las preferencias. */
      guardarEnLaCuenta: async () => {
        const userId = await miId();
        if (!userId) return;
        const { data: actual } = await supabase.from('user_preferences').select('preferences').eq('user_id', userId).maybeSingle();
        const preferences = { ...(actual?.preferences || {}), [CLAVE]: get().prefs };
        const { error } = await supabase
          .from('user_preferences')
          .upsert({ user_id: userId, preferences, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
        if (error) throw error;
      },
    }),
    {
      name: 'vizta-feed',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ prefs: s.prefs }),
    }
  )
);
