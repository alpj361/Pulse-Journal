import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Dónde estabas en la hoja: en qué pantalla y en qué espacio.
 *
 * Espacios se desmonta al pasar a Notas, y con él se iba lo elegido: escribir
 * algo y volver te dejaba en la lista de espacios, a buscar de nuevo el que
 * tenías abierto. Esto lo recuerda —también al cerrar la app—.
 *
 * Se guarda el id y no el espacio: al volver se busca en la lista recién
 * leída, así que si cambió de nombre o se borró, se ve lo que hay ahora.
 *
 * La pantalla —Notas o Espacios— también: tocar el orbe vuelve a abrir la hoja
 * donde la dejaste, en vez de mandarte siempre a Notas.
 */
export const useEspacioElegidoStore = create(
  persist(
    (set) => ({
      espacioId: null,
      elegir: (id) => set({ espacioId: id || null }),
      /** `'notas'` o `'espacios'`. */
      pantalla: 'notas',
      recordarPantalla: (p) => set({ pantalla: p === 'espacios' ? 'espacios' : 'notas' }),
    }),
    {
      name: 'espacio-elegido',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ espacioId: s.espacioId, pantalla: s.pantalla }),
    }
  )
);
