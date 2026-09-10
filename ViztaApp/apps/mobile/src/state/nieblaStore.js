import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CELDAS_DEL_PAIS } from '../components/mapa/niebla';

/**
 * Lo que ya se descubrió.
 *
 * **Se guarda como array y se usa como Set.** El Set es lo que hace que raspar
 * la misma celda dos veces sea gratis y que dibujar consulte en tiempo
 * constante; el array es lo único que JSON sabe serializar. La conversión pasa
 * en los bordes —al hidratar y al persistir— y nunca en el camino del gesto.
 *
 * **Escribir es idempotente y silencioso si no cambia nada.** `raspar` recibe
 * las celdas bajo el pincel en cada frame del arrastre, y la enorme mayoría ya
 * estaban: si se emitiera un estado nuevo igual, cada frame re-renderizaría el
 * mapa entero para no cambiar un pixel. Por eso se comprueba antes y se sale
 * sin tocar el store cuando no hay celdas nuevas.
 */

export const useNieblaStore = create(
  persist(
    (set, get) => ({
      /** Set de claves `"cx:cy"`. */
      celdas: new Set(),

      /** Devuelve cuántas celdas nuevas entraron, por si quien llama quiere avisar. */
      raspar: (claves) => {
        if (!claves?.length) return 0;
        const actual = get().celdas;
        let nuevas = 0;
        for (const k of claves) if (!actual.has(k)) nuevas += 1;
        // Nada que agregar: no se emite estado. Sin esta salida temprana el
        // mapa se redibujaría sesenta veces por segundo mientras el dedo se
        // arrastra sobre terreno ya descubierto.
        if (!nuevas) return 0;

        const proximo = new Set(actual);
        for (const k of claves) proximo.add(k);
        set({ celdas: proximo });
        return nuevas;
      },

      limpiar: () => set({ celdas: new Set() }),

      /** Porcentaje del país descubierto. Para la insignia de progreso. */
      porcentaje: () => {
        const n = get().celdas.size;
        if (!n) return 0;
        return Math.min(100, (n / CELDAS_DEL_PAIS) * 100);
      },
    }),
    {
      name: 'niebla-vizta',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ celdas: Array.from(s.celdas) }),
      merge: (persistido, actual) => ({
        ...actual,
        celdas: new Set(Array.isArray(persistido?.celdas) ? persistido.celdas : []),
      }),
    }
  )
);
