import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Dónde se quedó la persona.
 *
 * Cerrar la app en medio de una nota y volver al feed del día es perder el hilo:
 * hay que acordarse de qué se estaba leyendo y volver a buscarlo. Esto guarda el
 * lugar y lo devuelve al abrir.
 *
 * **Se guarda el id, nunca el objeto.** Un item serializado entero queda
 * congelado: si se editó desde la web, al volver se vería la versión vieja como
 * si fuera la actual. Con el id se vuelve a pedir, y lo que aparece es lo que
 * hay ahora.
 *
 * **El registro se borra al intentar restaurar, no al terminar.** Es la
 * diferencia entre un mal restaurado y un ciclo del que no se sale: si el
 * destino rompe la app —un item con datos corruptos, una pantalla con un bug—,
 * borrarlo después nunca llega a ejecutarse y cada apertura vuelve a romper,
 * sin forma de escapar salvo reinstalando. Borrándolo antes, el fallo cuesta una
 * apertura y la siguiente arranca limpia.
 *
 * **Solo restaura lo reciente.** Volver a una nota que se estaba escribiendo
 * hace veinte minutos es continuar; volver a una de hace tres semanas es
 * desconcertante — para eso está el historial. El corte va en 24 horas: dentro
 * del mismo día se está retomando algo, después ya se está empezando otra cosa.
 */

/** Cuánto vale un lugar guardado. Pasado esto, se abre en el feed. */
const VENCE = 24 * 60 * 60 * 1000;

export const useUltimoLugarStore = create(
  persist(
    (set, get) => ({
      /** `{ tipo, id?, espacioId?, ts }` o `null`. */
      lugar: null,

      /**
       * Lo que hay que restaurar en este arranque. Vive solo en memoria: es el
       * encargo de una vez, no un dato que deba sobrevivir a cerrar la app.
       */
      porRestaurar: null,

      /**
       * Si ya se leyó el registro de este arranque.
       *
       * Existe porque los efectos de React corren de adentro hacia afuera: las
       * pantallas —que son hijas del layout— avisan «no tengo nada abierto»
       * antes de que el layout alcance a leer dónde se había quedado la
       * persona. Sin esta bandera ese aviso borraba el registro un instante
       * antes de que alguien lo mirara, y la app abría siempre en el feed
       * habiendo guardado bien el lugar.
       *
       * No se persiste: cada arranque vuelve a empezar en falso.
       */
      arrancada: false,

      /** Anota dónde está parada la persona. Se llama al abrir una superficie. */
      recordar: (lugar) => {
        if (!lugar?.tipo) return;
        set({ lugar: { ...lugar, ts: Date.now() } });
      },

      /** Se llama al cerrar: volver al feed también es un lugar, y es el que
       *  corresponde si alguien cerró todo antes de irse. */
      olvidar: () => set({ lugar: null }),

      /**
       * Olvidar, pero solo si lo anotado es de estos tipos.
       *
       * Hay varias superficies abiertas a la vez —una ficha sobre un espacio, el
       * mapa sobre el feed— y cada una avisa cuando se cierra. Si cerrar la
       * ficha borrara el registro sin mirar, se llevaría puesto el del mapa que
       * sigue abierto en la otra pestaña, y al volver la app abriría en el feed
       * habiendo dejado el mapa a la vista.
       *
       * Con el filtro, cada pantalla solo puede borrar lo suyo.
       */
      olvidarSi: (tipos) => {
        const t = get().lugar?.tipo;
        if (t && tipos.includes(t)) set({ lugar: null });
      },

      /**
       * Arranca la restauración. Se llama una vez, al montar la app.
       *
       * Devuelve el lugar a restaurar —o `null`— y en el mismo movimiento borra
       * el registro persistido, por lo dicho arriba sobre los ciclos.
       */
      iniciarRestauracion: () => {
        const guardado = get().lugar;
        set({ lugar: null, arrancada: true });

        if (!guardado?.tipo) return null;
        if (!guardado.ts || Date.now() - guardado.ts > VENCE) return null;

        set({ porRestaurar: guardado });
        return guardado;
      },

      /**
       * Una pantalla reclama lo suyo.
       *
       * Devuelve el encargo solo si es de su tipo, y lo consume: si dos
       * pantallas preguntaran por el mismo, la segunda encontraría vacío en vez
       * de abrir un duplicado.
       */
      consumir: (tipo) => {
        const p = get().porRestaurar;
        if (!p || p.tipo !== tipo) return null;
        set({ porRestaurar: null });
        return p;
      },
    }),
    {
      name: 'ultimo-lugar',
      storage: createJSONStorage(() => AsyncStorage),
      // `porRestaurar` queda fuera a propósito: es el encargo de este arranque.
      // Persistirlo lo volvería a disparar en el siguiente, incluso después de
      // haberlo atendido.
      partialize: (s) => ({ lugar: s.lugar }),
    }
  )
);

/**
 * Anota el lugar en el que está parada una pantalla.
 *
 * Se le pasa el lugar ya resuelto —o `null` si esa pantalla no tiene nada
 * abierto— y los tipos que le pertenecen, para que al cerrarse solo borre lo
 * suyo.
 *
 * La pantalla resuelve la precedencia, no el store: solo ella sabe que una
 * ficha abierta sobre un espacio es una ficha, y que cerrarla deja el espacio.
 */
export function useRecordarLugar(lugar, tipos) {
  const recordar = useUltimoLugarStore((s) => s.recordar);
  const olvidarSi = useUltimoLugarStore((s) => s.olvidarSi);
  const arrancada = useUltimoLugarStore((s) => s.arrancada);

  // Por contenido y no por identidad: los objetos se rearman en cada render y
  // compararlos por referencia reescribiría el registro sesenta veces por
  // segundo.
  const firma = lugar ? JSON.stringify(lugar) : null;

  useEffect(() => {
    // Hasta que no se haya leído el registro, esta pantalla no tiene nada que
    // decir: al montar no tiene nada abierto, y ese «nada» no es una noticia
    // sobre dónde estaba la persona — es solo que la app recién arrancó.
    if (!arrancada) return;

    if (firma) recordar(JSON.parse(firma));
    else olvidarSi(tipos);
    // `tipos` es una constante de módulo en cada llamador.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firma, arrancada]);
}

/**
 * Si el store ya leyó el disco.
 *
 * `persist` arranca con el estado vacío y lo rellena un tick después, cuando
 * AsyncStorage contesta. Preguntar antes de eso siempre da «no había nada
 * guardado», así que restaurar sin esperar es no restaurar nunca.
 */
export function useLugarHidratado() {
  const [listo, setListo] = useState(() => useUltimoLugarStore.persist.hasHydrated());

  useEffect(() => {
    if (listo) return;
    return useUltimoLugarStore.persist.onFinishHydration(() => setListo(true));
  }, [listo]);

  return listo;
}
