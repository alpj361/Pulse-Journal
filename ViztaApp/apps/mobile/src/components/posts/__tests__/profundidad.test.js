import { esBreve, esInformativo, esLaObra, obraDelPost } from '../profundidad';

const con = (probabilidades) => ({ clasificacion: { probabilidades } });

// Los dos posts que PJ marcó (1-nov-2026) y uno de noticias.
const DISFRACES = con({ comedia: 0.76, baile_tendencia: 0.61, hechos: 0.03, informacion: 0.04 });
const TRAILER = con({ comedia: 0.8, hechos: 0.58, informacion: 0.39 });
const NOTICIA = con({ comedia: 0.05, hechos: 0.9, informacion: 0.85 });

test('un disfraz y un tráiler son breves; una noticia no', () => {
  expect(esBreve({}, DISFRACES)).toBe(true);
  expect(esBreve({}, TRAILER)).toBe(true);
  expect(esBreve({}, NOTICIA)).toBe(false);
});

test('un hecho suelto en un post liviano no lo vuelve informativo', () => {
  expect(esInformativo(TRAILER)).toBe(false);
  expect(esInformativo(NOTICIA)).toBe(true);
  expect(esInformativo(con({ hechos: 0.7 }))).toBe(true);
});

test('lo que diga el backend manda sobre la clasificación', () => {
  expect(esBreve({ profundidad: 'completa' }, DISFRACES)).toBe(false);
  expect(esBreve({ profundidad: 'breve' }, NOTICIA)).toBe(true);
  expect(esBreve({}, {})).toBe(false);
});

test('la obra sale del vistazo guardado, o del análisis', () => {
  const obra = { titulo: 'El Drama', relacion: 'referencia' };
  expect(obraDelPost({}, { vistazo: { obra_identificada: obra } })).toBe(obra);
  expect(obraDelPost({ vistazo: { obra_identificada: obra } }, {})).toBe(obra);
  expect(obraDelPost({}, {})).toBe(null);
});

test('la obra de arriba no se repite entre los materiales', () => {
  const obra = { titulo: 'Los Juegos del Hambre: Amanecer en la cosecha', titulo_original: 'The Hunger Games: Sunrise on the Reaping' };
  expect(esLaObra({ texto: 'The Hunger Games: Sunrise on the Reaping' }, obra)).toBe(true);
  expect(esLaObra({ texto: 'Sunrise', identidad: { titulo: 'Los juegos del hambre: amanecer en la cosecha' } }, obra)).toBe(true);
  expect(esLaObra({ texto: 'Sinners' }, obra)).toBe(false);
  expect(esLaObra({ texto: 'x' }, null)).toBe(false);
});
