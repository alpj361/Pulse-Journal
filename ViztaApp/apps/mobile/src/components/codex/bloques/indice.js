import { renglonesPorBloque } from '../../../documento';
import { textoDe } from '../../../documento/editor';
import { indiceDeHistoria } from '../historia';

/**
 * El índice de una historia escrita con bloques.
 *
 * Si la nota tiene páginas, el índice son sus páginas —es lo mismo que hace
 * la base al partirla (`historia_partir_nota`)—, más una entrada para lo que
 * haya antes de la primera. Si no, son las mismas secciones de siempre
 * (`indiceDeHistoria`), pero cada una apunta a su bloque: saltar ya no es
 * aritmética de renglones, es ir al bloque.
 *
 * @returns `[{ titulo, pagina?, bloque? }]`
 */
export function indiceDelDocumento(doc) {
  const raiz = doc?.paginas?.[0];
  if (!raiz) return [];

  const paginas = raiz.bloques.filter((b) => b._type === 'pagina');
  if (paginas.length) {
    const salida = [];
    const primero = raiz.bloques[0];
    if (primero && primero._type !== 'pagina') {
      const t = textoDe(primero.children).trim();
      if (t) salida.push({ titulo: t.length > 60 ? `${t.slice(0, 60).replace(/\s+\S*$/, '')}…` : t, bloque: primero._key });
    }
    for (const b of paginas) {
      const p = doc.paginas.find((x) => x._key === b.pagina);
      salida.push({ titulo: p?.titulo || 'sin título', pagina: b.pagina, bloque: b._key });
    }
    return salida;
  }

  // Solo la nota, sin expandir páginas (no las hay) ni saltar a otra.
  const renglones = renglonesPorBloque({ ...doc, paginas: [raiz] });
  const inicios = [];
  let pos = 0;
  for (const r of renglones) {
    inicios.push({ key: r.key, inicio: pos });
    pos += r.texto.length + 1;
  }
  const md = renglones.map((r) => r.texto).join('\n');
  return indiceDeHistoria(md).map((s) => {
    let bloque = inicios[0]?.key;
    for (const x of inicios) {
      if (x.inicio > s.inicio) break;
      bloque = x.key;
    }
    return { titulo: s.titulo, bloque };
  });
}
