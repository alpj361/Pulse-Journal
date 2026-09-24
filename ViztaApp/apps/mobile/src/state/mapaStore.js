import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Dónde quedó el mapa.
 *
 * Abrir el mapa y aterrizar siempre en la Ciudad de Guatemala está bien la
 * primera vez y es molesto todas las demás: quien estaba mirando Petén tiene
 * que volver a viajar hasta allá cada vez. Se guarda la cámara y el centro
 * inicial pasa a ser lo que es —un valor por defecto para la primera apertura—
 * en vez de un destino fijo.
 *
 * **Se escribe al soltar, no por frame.** El gesto corre en el hilo de UI y
 * mueve la cámara sesenta veces por segundo; escribir eso en AsyncStorage
 * sería sesenta escrituras a disco por arrastre. `recordar` se llama cuando el
 * gesto termina.
 *
 * **La validación no es paranoia.** Un `NaN` que llegue acá queda persistido y
 * envenena todas las aperturas siguientes: la pantalla arranca en blanco y no
 * hay forma de volver sin borrar los datos de la app. Por eso se descarta lo
 * que no sea finito y esté en rango, tanto al escribir como al leer.
 */

const LAT_MAX = 85.05112878;

// Lo que puede venir del disco. Un valor viejo o corrupto vuelve a «todo» en
// vez de dejar el mapa filtrado por algo que ya no existe.
const PROCEDENCIAS = new Set(['todo', 'items', 'notas', 'posts']);

function valida(v) {
  if (!v) return null;
  const { lat, lng, zoom } = v;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(zoom)) return null;
  if (Math.abs(lat) > LAT_MAX || Math.abs(lng) > 180) return null;
  if (zoom < 1 || zoom > 24) return null;
  return { lat, lng, zoom };
}

export const useMapaStore = create(
  persist(
    (set) => ({
      /** `null` hasta que se haya movido el mapa al menos una vez. */
      camara: null,

      /**
       * Los territorios que la persona decidió no ver.
       *
       * **Se guarda lo oculto, no lo visible.** Parece lo mismo y no lo es: con
       * una lista de visibles, cada territorio nuevo que se cree o se importe
       * nacería invisible hasta que alguien lo prenda a mano, y nadie
       * relacionaría «guardé un área y no aparece» con un filtro que tocó la
       * semana pasada. Guardando lo oculto, lo que no se nombró se ve — que es
       * lo que alguien espera de algo que acaba de crear.
       */
      ocultos: new Set(),

      /**
       * De dónde viene lo que se está mirando.
       *
       * `todo` · `items` (lo que cargaste vos) · `notas` (lo que mencionan tus
       * notas) · `posts` (lo que mencionan los posts). Reemplazó a las tres
       * clases por geometría —áreas, puntos, recorridos—, que eran nombres del
       * programa: nadie abre el mapa preguntándose «¿quiero ver polígonos?».
       */
      procedencia: 'todo',

      /**
       * A qué escala se dibujan los límites. `null` es sin capa.
       *
       * Se persiste, y el valor de fábrica es `null` a propósito: el mapa abre
       * limpio. Antes abría con los departamentos encima sin que nadie los
       * pidiera, y esa capa tapa justo lo que se fue a mirar.
       */
      nivel: null,

      recordar: (camara) => {
        const limpia = valida(camara);
        if (limpia) set({ camara: limpia });
      },

      olvidar: () => set({ camara: null }),

      alternarOculto: (id) =>
        set((s) => {
          const proximo = new Set(s.ocultos);
          if (proximo.has(id)) proximo.delete(id);
          else proximo.add(id);
          return { ocultos: proximo };
        }),

      /**
       * Ocultar o mostrar varios de una vez.
       *
       * Existe para los subgrupos del filtro —«Frontera» dentro de «áreas»
       * puede ser 300 territorios—. Alternarlos uno por uno sería 300
       * escrituras al store y 300 renders por un solo toque; esto es una.
       */
      ocultarLote: (ids, ocultar) =>
        set((s) => {
          const proximo = new Set(s.ocultos);
          for (const id of ids) {
            if (ocultar) proximo.add(id);
            else proximo.delete(id);
          }
          return { ocultos: proximo };
        }),

      elegirProcedencia: (procedencia) => set({ procedencia: procedencia || 'todo' }),

      elegirNivel: (nivel) => set({ nivel: nivel || null }),

      mostrarTodo: () => set({ ocultos: new Set(), procedencia: 'todo', nivel: null }),
    }),
    {
      name: 'mapa-vizta',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        camara: s.camara,
        ocultos: Array.from(s.ocultos),
        procedencia: s.procedencia,
        nivel: s.nivel,
      }),
      // Lo que ya está en disco pudo escribirse con una versión anterior —o
      // haberse corrompido—, así que se revalida al rehidratar en vez de
      // confiar en que salió de `recordar`.
      merge: (persistido, actual) => ({
        ...actual,
        camara: valida(persistido?.camara),
        ocultos: new Set(Array.isArray(persistido?.ocultos) ? persistido.ocultos : []),
        procedencia: PROCEDENCIAS.has(persistido?.procedencia) ? persistido.procedencia : 'todo',
        nivel: typeof persistido?.nivel === 'string' ? persistido.nivel : null,
      }),
    }
  )
);

/**
 * Si ya se leyó el disco.
 *
 * AsyncStorage hidrata asíncrono, así que en un arranque en frío el mapa puede
 * montarse antes de que se sepa dónde había quedado. Montarlo igual y moverlo
 * después no sirve: `MapaVizta` lee su centro inicial una sola vez, al montar,
 * y un salto de cámara a los 200 ms se ve peor que esperar. Quien dependa de la
 * cámara guardada espera a que esto sea `true`.
 */
export function useCamaraLista() {
  const [lista, setLista] = useState(() => useMapaStore.persist.hasHydrated());

  useEffect(() => {
    if (lista) return undefined;
    const fin = useMapaStore.persist.onFinishHydration(() => setLista(true));
    // Entre el render y esta suscripción la hidratación pudo terminar, y ese
    // evento ya no llega: hay que volver a preguntar o la espera es eterna.
    if (useMapaStore.persist.hasHydrated()) setLista(true);
    return fin;
  }, [lista]);

  return lista;
}
