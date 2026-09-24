import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * El espacio en el que estabas.
 *
 * Espacios se desmonta al pasar a Notas, y con él se iba lo elegido: escribir
 * algo y volver te dejaba en la lista de espacios, a buscar de nuevo el que
 * tenías abierto. Esto lo recuerda —también al cerrar la app—.
 *
 * Se guarda el id y no el espacio: al volver se busca en la lista recién
 * leída, así que si cambió de nombre o se borró, se ve lo que hay ahora.
 */
export const useEspacioElegidoStore = create(
  persist(
    (set) => ({
      espacioId: null,
      elegir: (id) => set({ espacioId: id || null }),
    }),
    {
      name: 'espacio-elegido',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ espacioId: s.espacioId }),
    }
  )
);
