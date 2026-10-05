/**
 * Materiales: la clase de algo que un contenido cita o recomienda —película,
 * libro, lugar—, paralela al tipo del Codex.
 *
 * Un elemento puede tener tipo y material (Antigua Guatemala: Territorio y
 * lugar), solo material (Parásitos: Ref y película) o solo tipo. Las claves
 * son las mismas que guarda la base y devuelve el análisis, en inglés; acá
 * viven las etiquetas en español y el color.
 *
 * Sin íconos a propósito: esto lo importa `autofiltro`, que es lógica pura.
 * Los íconos están en `IconoMaterial`.
 */
export const MATERIAL = {
  film: { etiqueta: 'película', plural: 'películas', color: '#BE123C' },
  series: { etiqueta: 'serie', plural: 'series', color: '#7C3AED' },
  book: { etiqueta: 'libro', plural: 'libros', color: '#A16207' },
  game: { etiqueta: 'juego', plural: 'juegos', color: '#2563EB' },
  place: { etiqueta: 'lugar', plural: 'lugares', color: '#0D9488' },
  food: { etiqueta: 'comida', plural: 'comida', color: '#EA580C' },
  music: { etiqueta: 'música', plural: 'música', color: '#C026D3' },
  podcast: { etiqueta: 'podcast', plural: 'podcasts', color: '#65A30D' },
  website: { etiqueta: 'sitio web', plural: 'sitios web', color: '#475569' },
  tool: { etiqueta: 'herramienta', plural: 'herramientas', color: '#0F766E' },
  product: { etiqueta: 'producto', plural: 'productos', color: '#B45309' },
};

export const ORDEN_MATERIALES = Object.keys(MATERIAL);

/** La clave del material de una mención o elemento, si es uno conocido. */
export const materialDe = (x) => (x?.material && MATERIAL[x.material] ? x.material : null);
