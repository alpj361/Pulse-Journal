import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../utils/supabase';

export const usePulseConnectionStore = create(
  persist(
    (set, get) => ({
      isConnected: false,
      isConnecting: false,
      connectedUser: null, // { id, email, user_type, role }
      connectedAt: null,
      error: null,

      // Inicializar listener de sesión de Supabase — llamar una vez al montar la app
      initSessionSync: () => {
        console.log('[pulseStore] initSessionSync — suscribiendo onAuthStateChange');
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
          console.log('[pulseStore] onAuthStateChange →', event, '| session:', session ? `OK user=${session.user?.email}` : 'NULL');
          if (event === 'SIGNED_OUT' || (!session && (event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION'))) {
            // Sesión perdida o expirada — limpiar Zustand
            const { isConnected } = get();
            if (isConnected) {
              console.log('[pulseStore] ⚠️ Sesión inválida detectada — limpiando isConnected');
              set({ isConnected: false, connectedUser: null, connectedAt: null });
            }
          } else if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) {
            // Sesión válida — asegurar que Zustand esté sincronizado
            const { isConnected, connectedUser } = get();
            if (!connectedUser || connectedUser.id !== session.user.id) {
              console.log('[pulseStore] 🔄 Sincronizando usuario desde sesión Supabase:', session.user.email);
              const { data: profile } = await supabase
                .from('profiles')
                .select('id, email, user_type, role, credits')
                .eq('id', session.user.id)
                .single();
              set({
                isConnected: true,
                connectedUser: profile || { id: session.user.id, email: session.user.email },
                connectedAt: get().connectedAt || new Date().toISOString(),
              });
            }
          }
        });
        return () => subscription.unsubscribe();
      },

      connect: async (email, password) => {
        console.log('[pulseStore] connect() called');
        set({ isConnecting: true, error: null });
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          console.log('[pulseStore] connect() error:', error.message);
          set({ isConnecting: false, error: error.message });
          return false;
        }
        console.log('[pulseStore] connect() success, fetching profile...');
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, email, user_type, role, credits')
          .eq('id', data.user.id)
          .single();
        console.log('[pulseStore] profile:', profile?.email);
        set({
          isConnected: true,
          isConnecting: false,
          connectedUser: profile || { id: data.user.id, email: data.user.email },
          connectedAt: new Date().toISOString(),
          error: null,
        });
        console.log('[pulseStore] set isConnected=true DONE');
        return true;
      },

      disconnect: async () => {
        console.log('[pulseStore] disconnect() called');
        try {
          await supabase.auth.signOut();
          console.log('[pulseStore] supabase.signOut() done');
        } catch (e) {
          console.log('[pulseStore] supabase.signOut() ERROR:', e?.message);
        }
        console.log('[pulseStore] calling set isConnected=false...');
        set({ isConnected: false, connectedUser: null, connectedAt: null, error: null });
        console.log('[pulseStore] set isConnected=false DONE');
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'pulse-connection',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        isConnected: s.isConnected,
        connectedUser: s.connectedUser,
        connectedAt: s.connectedAt,
      }),
      onRehydrateStorage: () => {
        console.log('[pulseStore] hydration starting...');
        return (state, error) => {
          if (error) {
            console.log('[pulseStore] hydration ERROR:', error);
          } else {
            console.log('[pulseStore] hydration done — isConnected:', state?.isConnected, 'user:', state?.connectedUser?.email);
          }
        };
      },
    }
  )
);
