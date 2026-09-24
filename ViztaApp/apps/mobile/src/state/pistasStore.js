import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Qué ya aprendió el usuario.
 *
 * Las pistas de la app —cómo se escribe, cómo se adjunta una grabación— se ven
 * **una vez** y se van en cuanto la persona hizo esa acción. No vuelven.
 *
 * Antes eran renglones fijos al lado del control. Eso sirve la primera vez y
 * estorba las otras mil: ocupa lugar permanente en una interfaz que busca aire,
 * y le habla a alguien que ya aprendió.
 *
 * Se persiste porque «ya lo hizo» no puede olvidarse al cerrar la app: volver a
 * explicar lo mismo en cada arranque es exactamente lo que esto viene a
 * resolver.
 */
export const usePistasStore = create(
  persist(
    (set, get) => ({
      hechas: {},

      /** ¿Todavía hay que mostrarla? */
      pendiente: (clave) => !get().hechas[clave],

      /**
       * La persona hizo la acción: la pista se retira para siempre.
       *
       * Se llama desde la acción misma y no desde un temporizador. Una pista que
       * se va sola a los cinco segundos se va justo cuando alguien la estaba
       * leyendo despacio, y vuelve la próxima vez porque nadie hizo nada.
       */
      marcar: (clave) =>
        set((s) => (s.hechas[clave] ? s : { hechas: { ...s.hechas, [clave]: true } })),
    }),
    {
      name: 'vizta-pistas',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ hechas: s.hechas }),
    }
  )
);

/** Las claves, todas acá: una suelta mal escrita es una pista que no se apaga. */
export const PISTA = {
  ESCRIBIR: 'escribir',
  GRABAR: 'grabar',
  POST_EN_CURSO: 'post_en_curso',
};
