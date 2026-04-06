import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../utils/supabase';

export const usePulseConnectionStore = create(
  persist(
    (set) => ({
      isConnected: false,
      isConnecting: false,
      connectedUser: null, // { id, email, user_type, role }
      connectedAt: null,
      error: null,

      connect: async (email, password) => {
        set({ isConnecting: true, error: null });
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          set({ isConnecting: false, error: error.message });
          return false;
        }
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, email, user_type, role, credits')
          .eq('id', data.user.id)
          .single();
        set({
          isConnected: true,
          isConnecting: false,
          connectedUser: profile || { id: data.user.id, email: data.user.email },
          connectedAt: new Date().toISOString(),
          error: null,
        });
        return true;
      },

      disconnect: async () => {
        await supabase.auth.signOut();
        set({ isConnected: false, connectedUser: null, connectedAt: null, error: null });
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
    }
  )
);
