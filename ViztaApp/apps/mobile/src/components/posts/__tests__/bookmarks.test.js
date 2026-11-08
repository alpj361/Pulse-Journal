import { fechaGuardado, guardadoDeLaObra, infoTipo, tipoDeBookmark, tiposPresentes } from '../bookmarks';

jest.mock('../../../utils/supabase', () => ({ supabase: { auth: { getSession: jest.fn() } } }));

const b = (kind, extra = {}) => ({ id: Math.random().toString(36), name: 'X', bookmark: { kind }, ...extra });

test('el tipo de un guardado: material, propio, paper y desconocido', () => {
  expect(tipoDeBookmark(b('film'))).toBe('film');
  expect(tipoDeBookmark(b('article'))).toBe('article');
  expect(tipoDeBookmark(b('article', { tags: ['paper'] }))).toBe('paper');
  expect(tipoDeBookmark(b('raro'))).toBe('other');
  expect(tipoDeBookmark({})).toBe('other');
  expect(infoTipo('film').etiqueta).toBe('película');
  expect(infoTipo('paper').etiqueta).toBe('paper');
  expect(infoTipo('list').etiqueta).toBe('lista');
});

test('los tipos presentes, del que más hay al que menos', () => {
  expect(tiposPresentes([b('book'), b('film'), b('film')])).toEqual([{ tipo: 'film', n: 2 }, { tipo: 'book', n: 1 }]);
});

test('la obra del post se reconoce en su guardado «Título (año)»', () => {
  const items = [{ name: 'Oppenheimer (2023)', bookmark: { kind: 'film' } }, { name: 'Lista de libros', bookmark: { kind: 'list' } }];
  expect(guardadoDeLaObra(items, { titulo: 'Oppenheimer' })).toBe(items[0]);
  expect(guardadoDeLaObra(items, { titulo: 'Barbie' })).toBeNull();
  expect(guardadoDeLaObra(items, null)).toBeNull();
});

test('la fecha de guardado, corta', () => {
  expect(fechaGuardado(null)).toBeNull();
  expect(fechaGuardado('no es fecha')).toBeNull();
  expect(fechaGuardado(new Date().toISOString())).not.toMatch(/\d{4}/);
});
