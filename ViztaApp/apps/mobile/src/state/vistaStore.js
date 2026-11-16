import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Lo que la persona tenía abierto en el inicio: qué feed (Guatemala, Congreso,
 * Observatorio), qué tema del feed y qué sección del Congreso (iniciativas,
 * leyes, votaciones…). Al refrescar o volver a abrir la app sigue ahí, en vez
 * de volver al feed del país.
 *
 * Se guarda solo en el teléfono: es dónde se quedó, no una preferencia de la
 * cuenta. Los valores se validan al leerlos (`feedValido`, `seccionValida`):
 * si una sección dejó de existir, se vuelve a lo de siempre.
 */
export const useVistaStore = create(
  persist(
    (set) => ({
      feed: 'pais',
      temaFeed: 'todo',
      seccionCongreso: null,
      setFeed: (feed) => set({ feed }),
      setTemaFeed: (temaFeed) => set({ temaFeed }),
      setSeccionCongreso: (seccionCongreso) => set({ seccionCongreso }),
    }),
    {
      name: 'vizta-vista',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ feed: s.feed, temaFeed: s.temaFeed, seccionCongreso: s.seccionCongreso }),
    }
  )
);

export const feedValido = (feed, claves) => (claves.includes(feed) ? feed : 'pais');
export const seccionValida = (seccion, claves) => (seccion && claves.includes(seccion) ? seccion : null);
