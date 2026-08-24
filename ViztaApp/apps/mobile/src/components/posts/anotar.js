import { normalizar } from '../codex/menciones';

/**
 * Pinta, dentro del texto del post, lo que la IA reconoció.
 *
 * Reusa `normalizar` de las menciones para no tener dos ideas distintas de qué
 * significa «el mismo nombre»: sin tildes, sin mayúsculas, y sin correr los
 * índices —de eso depende poder cortar el texto original y mostrarlo tal como
 * lo escribió el autor del post.
 *
 * A diferencia de las menciones del Codex, acá los términos no vienen de una
 * tabla sino del modelo, así que pueden ser cualquier cosa: se ordenan de más
 * largo a más corto para que «Ministerio de Gobernación» gane sobre
 * «Gobernación», y se exige que el match empiece y termine en borde de palabra
 * para no pintar la mitad de una.
 */
export function anotarTexto(texto, actores = [], entidades = []) {
  const original = String(texto || '');
  if (!original) return [];

  const terminos = [
    ...actores.map((t) => ({ t: String(t || '').trim(), tipo: 'actor' })),
    ...entidades.map((t) => ({ t: String(t || '').trim(), tipo: 'entidad' })),
  ]
    .filter((x) => x.t.length > 2)
    .sort((a, b) => b.t.length - a.t.length);

  if (!terminos.length) return [{ texto: original, tipo: null }];

  const norm = normalizar(original);
  const esLetra = (c) => !!c && /[a-z0-9]/.test(c);

  const tramos = [];
  let i = 0;
  let buffer = '';

  while (i < original.length) {
    let encontrado = null;

    for (const { t, tipo } of terminos) {
      const tn = normalizar(t);
      if (!tn) continue;
      if (norm.startsWith(tn, i)) {
        // Bordes: ni el carácter previo ni el siguiente pueden ser parte de una
        // palabra, o estaríamos pintando un pedazo de otra.
        const antes = i > 0 ? norm[i - 1] : '';
        const despues = norm[i + tn.length] || '';
        if (!esLetra(antes) && !esLetra(despues)) {
          encontrado = { largo: tn.length, tipo };
          break;
        }
      }
    }

    if (encontrado) {
      if (buffer) {
        tramos.push({ texto: buffer, tipo: null });
        buffer = '';
      }
      tramos.push({ texto: original.slice(i, i + encontrado.largo), tipo: encontrado.tipo });
      i += encontrado.largo;
    } else {
      buffer += original[i];
      i += 1;
    }
  }

  if (buffer) tramos.push({ texto: buffer, tipo: null });
  return tramos;
}
