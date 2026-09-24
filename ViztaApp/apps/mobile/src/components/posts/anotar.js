import { normalizar } from '../codex/menciones';

/**
 * Pinta, dentro del texto del post, lo que el análisis reconoció.
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
 *
 * Recibe las menciones enteras —con su tipo y su vínculo al Codex— y devuelve
 * cada tramo con la mención que le toca, para que la pantalla decida el color y
 * qué hacer al tocarlo. Antes recibía dos listas sueltas, actores y entidades,
 * y todo lo demás se quedaba sin pintar.
 *
 * Los nombres de dos letras entran («MP», «CC»): el borde de palabra ya impide
 * que se pinten dentro de otra palabra, y dejarlos afuera escondía justo las
 * instituciones que más se nombran por sigla.
 */
export function anotarTexto(texto, menciones = []) {
  const original = String(texto || '');
  if (!original) return [];

  const terminos = (menciones || [])
    .map((m) => ({ t: String(m?.texto || '').trim(), mencion: m }))
    .filter((x) => x.t.length > 1)
    .map((x) => ({ ...x, tn: normalizar(x.t) }))
    .filter((x) => x.tn)
    .sort((a, b) => b.tn.length - a.tn.length);

  if (!terminos.length) return [{ texto: original, mencion: null }];

  const norm = normalizar(original);
  const esLetra = (c) => !!c && /[a-z0-9]/.test(c);

  const tramos = [];
  let i = 0;
  let buffer = '';

  while (i < original.length) {
    let encontrado = null;

    for (const { tn, mencion } of terminos) {
      if (norm.startsWith(tn, i)) {
        // Bordes: ni el carácter previo ni el siguiente pueden ser parte de una
        // palabra, o estaríamos pintando un pedazo de otra.
        const antes = i > 0 ? norm[i - 1] : '';
        const despues = norm[i + tn.length] || '';
        if (!esLetra(antes) && !esLetra(despues)) {
          encontrado = { largo: tn.length, mencion };
          break;
        }
      }
    }

    if (encontrado) {
      if (buffer) {
        tramos.push({ texto: buffer, mencion: null });
        buffer = '';
      }
      tramos.push({ texto: original.slice(i, i + encontrado.largo), mencion: encontrado.mencion });
      i += encontrado.largo;
    } else {
      buffer += original[i];
      i += 1;
    }
  }

  if (buffer) tramos.push({ texto: buffer, mencion: null });
  return tramos;
}
