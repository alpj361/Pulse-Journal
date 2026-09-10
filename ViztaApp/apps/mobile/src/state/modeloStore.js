import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Con qué modelo pregunta Vizta.
 *
 * Se guarda porque es una preferencia, no una decisión por consulta: quien
 * eligió un modelo rápido lo quiere para todas sus preguntas, y volver a
 * elegirlo cada vez que se abre la nota sería pedirle lo mismo otra vez.
 *
 * El default es `anthropic/claude-sonnet-4.6`, que es el que ya usa Vizta como
 * modelo del sistema — así la primera pregunta contesta como contestaría la web,
 * sin que nadie tenga que elegir nada para arrancar.
 */
const POR_DEFECTO = 'anthropic/claude-sonnet-4.6';

export const useModeloStore = create(
  persist(
    (set) => ({
      modelo: POR_DEFECTO,
      // El nombre lindo, para no tener que buscar el modelo en la lista solo
      // para poder escribirlo en el botón.
      nombre: 'Claude Sonnet 4.6',

      elegir: (modelo, nombre) => set({ modelo, nombre: nombre || modelo }),
    }),
    {
      name: 'vizta-modelo',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
