import { supabase } from '../../utils/supabase';

/**
 * La historia de un espacio como árbol (Task 8.1): sus snippets en orden,
 * cada uno con sus secciones. La arma la base (`historia_arbol`) a partir
 * de lo que ya parte `historia_sincronizar` en `space_sections`.
 *
 * @returns `{ espacio: { id, nombre, aspectos, hibrido }, historias: [{
 *   nota, numero, titulo, secciones: [{ id, titulo, orden, documento, ideas }]
 * }] }` o `null`.
 */
export async function leerArbol(espacioId) {
  if (!espacioId) return null;
  const { data, error } = await supabase.rpc('historia_arbol', { p_space: espacioId });
  if (error) throw error;
  return data || null;
}

/** Los párrafos de una sección, al abrirla: `[{ id, texto, orden }]`. */
export async function leerIdeas(seccionId) {
  const { data, error } = await supabase.rpc('historia_ideas_de', { p_seccion: seccionId });
  if (error) throw error;
  return data || [];
}

// Para comparar títulos: sin mayúsculas, acentos, marcas ni puntos
// suspensivos. La base corta los títulos largos con «…»; el índice de la
// nota, también, pero no siempre en el mismo lugar.
const plano = (t) =>
  String(t || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[*_=#>`~[\]()…]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

/**
 * La entrada del índice de la nota abierta que corresponde a una sección de
 * la base. Se busca por título, porque el orden puede no coincidir mientras
 * la base todavía no se puso al día con lo último escrito; si ningún título
 * coincide, por el lugar.
 */
export function entradaDeSeccion(indice, seccion) {
  if (!indice?.length || !seccion) return null;
  const buscado = plano(seccion.titulo);
  if (buscado) {
    const exacta = indice.find((e) => plano(e.titulo) === buscado);
    if (exacta) return exacta;
    // Uno de los dos puede estar cortado: alcanza con que empiecen igual.
    const corto = buscado.slice(0, 40);
    const parecida = indice.find((e) => {
      const t = plano(e.titulo);
      return t && (t.startsWith(corto) || buscado.startsWith(t.slice(0, 40)));
    });
    if (parecida) return parecida;
  }
  return Number.isInteger(seccion.orden) ? indice[seccion.orden] || null : null;
}

/**
 * Lo que se busca en el texto para llegar a un párrafo: su comienzo, sin
 * marcas. Corto a propósito: la base guarda la idea como texto plano y la
 * nota la tiene con formato, así que comparar todo fallaría por una coma.
 */
export const comienzoDe = (texto) => plano(texto).slice(0, 32);

/** ¿Este texto (de un bloque o de la nota) contiene ese comienzo? */
export const contiene = (texto, comienzo) => !!comienzo && plano(texto).includes(comienzo);

/** «2 capítulos · 16 escenas», con los nombres del espacio. */
export function resumen(arbol, niveles, contar) {
  const historias = arbol?.historias || [];
  const secciones = historias.reduce((n, h) => n + (h.secciones?.length || 0), 0);
  const partes = [contar(historias.length, niveles[0])];
  if (secciones) partes.push(contar(secciones, niveles[1]));
  return partes.join(' · ');
}
