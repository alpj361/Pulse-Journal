import { supabase } from '../../utils/supabase';

/**
 * Lo que rodea al borrado de un post (STA-225).
 *
 * Borrar un post se lleva en cascada sus fichas hijas —los hechos y las cosas
 * que se guardaron desde él—. Eso lo hace la base; acá va lo que la base no
 * hace: saber cuántas son, para decirlo antes, y limpiar lo que queda apuntando
 * a algo que ya no existe.
 */

/** Los ids de las fichas hijas de un post. Si no se puede leer, ninguna: el aviso no frena el borrado. */
export async function fichasHijas(postId) {
  const { data, error } = await supabase.from('codex_universe_items').select('id').eq('parent_id', postId);
  if (error) return [];
  return (data || []).map((x) => x.id);
}

/** El texto de la confirmación, con las fichas hijas si las hay. */
export function avisoDeBorrado(cuantas) {
  const base = 'Se borra de tus posts junto con su transcripción y su análisis.';
  if (!cuantas) return base;
  return cuantas === 1
    ? `${base} También se borra la ficha que guardaste desde él.`
    : `${base} También se borran las ${cuantas} fichas que guardaste desde él.`;
}

/**
 * Sacar de los lienzos lo que se acaba de borrar.
 *
 * Un lienzo guarda sus elementos por id dentro de un JSON (`canvasItems`,
 * `positions`, `connections`), así que la base no los limpia al borrar la
 * ficha: quedaba el hueco y las conexiones colgando. Se quitan los ids
 * borrados de los tres lugares, y solo se escribe el lienzo que cambió.
 *
 * No lanza: el post ya se borró, y un lienzo sin limpiar no es motivo para
 * decir que el borrado falló.
 */
export async function limpiarLienzos(ids) {
  const fuera = new Set(ids.filter(Boolean));
  if (!fuera.size) return 0;
  try {
    const { data } = await supabase.from('free_canvases').select('id, data');
    let limpiados = 0;
    for (const lienzo of data || []) {
      const d = lienzo.data;
      if (!d || typeof d !== 'object') continue;
      const items = Array.isArray(d.canvasItems) ? d.canvasItems : [];
      const conexiones = Array.isArray(d.connections) ? d.connections : [];
      const idDe = (x) => (typeof x === 'string' ? x : x?.id);
      const toca =
        items.some((x) => fuera.has(idDe(x))) || conexiones.some((c) => fuera.has(c?.srcId) || fuera.has(c?.tgtId));
      if (!toca) continue;

      const nuevo = {
        ...d,
        canvasItems: items.filter((x) => !fuera.has(idDe(x))),
        connections: conexiones.filter((c) => !fuera.has(c?.srcId) && !fuera.has(c?.tgtId)),
      };
      if (d.positions && typeof d.positions === 'object' && !Array.isArray(d.positions)) {
        nuevo.positions = Object.fromEntries(Object.entries(d.positions).filter(([k]) => !fuera.has(k)));
      }
      const { error } = await supabase.from('free_canvases').update({ data: nuevo }).eq('id', lienzo.id);
      if (!error) limpiados += 1;
    }
    return limpiados;
  } catch {
    return 0;
  }
}
