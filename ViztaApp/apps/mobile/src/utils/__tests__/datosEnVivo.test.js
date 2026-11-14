jest.mock('../supabase', () => ({ supabase: { channel: jest.fn(), removeChannel: jest.fn() } }));
const { GRUPOS } = require('../datosEnVivo');

const grupoDe = (tabla) => GRUPOS.find((g) => g.tablas.includes(tabla));
const refresca = (tabla, clave) => grupoDe(tabla).consultas({ queryKey: clave });

test('cada tabla del feed y del Congreso refresca las consultas que la leen', () => {
  expect(refresca('news_cards', ['pulse-hot-topics'])).toBe(true);
  expect(refresca('news_cards', ['noticias-dia', '2026-11-10'])).toBe(true);
  expect(refresca('dataset_rows', ['congreso-diputados'])).toBe(true);
  expect(refresca('votaciones', ['congreso-votaciones-registro'])).toBe(true);
  expect(refresca('normas', ['norma-legal', 'x'])).toBe(true);
  expect(refresca('sesion_avisos', ['avisos-sesiones'])).toBe(true);
  // Y no las ajenas.
  expect(refresca('news_cards', ['congreso-diputados'])).toBe(false);
  expect(refresca('votaciones', ['pulse-hot-topics'])).toBe(false);
});

test('una tabla está en un solo grupo', () => {
  const todas = GRUPOS.flatMap((g) => g.tablas);
  expect(new Set(todas).size).toBe(todas.length);
});
