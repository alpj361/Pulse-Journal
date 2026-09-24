import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../utils/supabase';
import { construirIndice } from './menciones';

/**
 * Índice de menciones del Codex, listo para resaltar mientras se escribe.
 *
 * Se cachea a nivel de módulo porque la nota se abre y se cierra seguido, y
 * volver a bajar ~1300 items en cada apertura agregaría medio segundo de
 * espera justo cuando la persona quiere escribir algo antes de que se le
 * olvide. El índice sobrevive a la hoja; solo se vuelve a pedir si pasaron más
 * de cinco minutos.
 *
 * Quedan afuera los Snippets y los Posts. No es un descuido: los dos son
 * *fuentes* de menciones, no destinos. Además el nombre de un Snippet es la
 * primera línea de su texto, así que incluirlos haría que escribir una frase
 * parecida a una nota vieja pinte media oración de color.
 */

const VIGENCIA_MS = 5 * 60 * 1000;

let cache = { indice: null, cuando: 0 };
let enVuelo = null;

// PostgREST corta en 1000 filas por respuesta y `limit` no lo sube: es un techo
// del servidor, no del cliente. Con ~1200 items matcheables, pedir «2000» traía
// 1000 y descartaba el resto en silencio — y como no había ORDER BY, cuáles
// quedaban afuera era arbitrario. Así fue como «Bernardo Arévalo» no se pintaba
// aunque estuviera en el Codex.
//
// Se pagina con `range` y se ordena por id para que las páginas no se pisen ni
// se salteen filas. El tope de páginas es un cinturón de seguridad: si algún
// día el Codex crece muchísimo, es preferible resaltar de menos que quedarse
// haciendo consultas para siempre al abrir una nota.
const PAGINA = 1000;
const MAX_PAGINAS = 8;

async function traer() {
  const filas = [];

  for (let p = 0; p < MAX_PAGINAS; p++) {
    const desde = p * PAGINA;
    const { data, error } = await supabase
      .from('codex_universe_items')
      .select('id, name, tipo, aliases')
      // `Fact` también afuera: su nombre es una oración entera, y pintarla al
      // escribir algo parecido marcaría media frase como si fuera un nombre.
      .not('tipo', 'in', '("Snippet","Post","Fact")')
      .order('id', { ascending: true })
      .range(desde, desde + PAGINA - 1);

    if (error) throw error;
    if (!data?.length) break;

    filas.push(...data);
    if (data.length < PAGINA) break; // última página
  }

  return construirIndice(filas);
}

/**
 * El mismo índice, fuera de un componente.
 *
 * Comparte la caché y el pedido en vuelo con el hook: el grafo de un espacio
 * lo necesita para saber qué nombra la nota principal, y bajar el Codex entero
 * dos veces —una para la hoja y otra para el grafo— sería pagar dos veces lo
 * mismo.
 */
export async function indiceCodex() {
  const fresco = cache.indice && Date.now() - cache.cuando < VIGENCIA_MS;
  if (fresco) return cache.indice;
  if (!enVuelo) {
    enVuelo = traer()
      .then((nuevo) => {
        cache = { indice: nuevo, cuando: Date.now() };
        return nuevo;
      })
      .finally(() => {
        enVuelo = null;
      });
  }
  return enVuelo;
}

export function invalidarIndice() {
  cache = { indice: null, cuando: 0 };
}

export default function useIndiceCodex() {
  const [indice, setIndice] = useState(() => cache.indice || new Map());
  const [pedido, setPedido] = useState(0);

  // `refrescar` existe para el caso de crear un item desde la nota misma: sin
  // esto, el nombre recién creado se quedaría en negro hasta cerrar y volver a
  // abrir la hoja, que es justo el momento en que uno espera ver el efecto.
  const refrescar = useCallback(() => {
    invalidarIndice();
    setPedido((n) => n + 1);
  }, []);

  useEffect(() => {
    let vivo = true;

    const fresco = cache.indice && Date.now() - cache.cuando < VIGENCIA_MS;
    if (fresco) {
      setIndice(cache.indice);
      return;
    }

    // Una sola petición aunque se monten dos hojas a la vez.
    if (!enVuelo) {
      enVuelo = traer()
        .then((nuevo) => {
          cache = { indice: nuevo, cuando: Date.now() };
          return nuevo;
        })
        .finally(() => {
          enVuelo = null;
        });
    }

    enVuelo
      .then((nuevo) => {
        if (vivo) setIndice(nuevo);
      })
      .catch(() => {
        // Sin índice se escribe igual, solo que sin colores. Que falle el
        // resaltado no es motivo para no dejar tomar la nota.
      });

    return () => {
      vivo = false;
    };
  }, [pedido]);

  return { indice, refrescar };
}
