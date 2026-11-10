import { esModelo, fechaGuardado, guardadoDeLaObra, imagenDe, infoTipo, ordenarGuardados, qDe, tipoDeBookmark, tiposPresentes } from '../bookmarks';

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

test('un modelo de lenguaje es su propio tipo; la miniatura del post no es la imagen del guardado', () => {
  expect(tipoDeBookmark(b('tool', { tags: ['auto', 'modelo'] }))).toBe('modelo');
  expect(tipoDeBookmark(b('tool', { tags: ['auto'] }))).toBe('tool');
  expect(infoTipo('modelo').etiqueta).toBe('modelo');
  const mini = 'https://scontent.cdninstagram.com/v/abc.jpg';
  expect(imagenDe({ bookmark: { image_url: mini } }, mini)).toBeNull();
  expect(imagenDe({ bookmark: { image_url: 'https://scontent.cdninstagram.com/otra.jpg' } }, null)).toBeNull();
  expect(imagenDe({ bookmark: { image_url: 'https://commons.wikimedia.org/wiki/Special:FilePath/ChatGPT-Logo.svg?width=256' } }, mini))
    .toBe('https://commons.wikimedia.org/wiki/Special:FilePath/ChatGPT-Logo.svg?width=256');
});

test('un modelo va dentro de la herramienta del mismo post; el logo de Wikidata reemplaza a la miniatura', () => {
  const mini = 'https://scontent.cdninstagram.com/v/abc.jpg';
  const chatgpt = { id: 'c', name: 'ChatGPT', bookmark: { kind: 'tool', url: 'https://www.wikidata.org/wiki/Q115564437', image_url: mini } };
  const astra = { id: 'a', name: 'GPT-6 Astra', bookmark: { kind: 'tool', url: 'https://www.wikidata.org/wiki/Q141554688', image_url: mini } };
  expect(qDe(chatgpt)).toBe('Q115564437');
  const ids = { Q115564437: { logo: 'https://commons.wikimedia.org/x.png', modelo: false }, Q141554688: { logo: null, modelo: true } };
  const { principal, modelos, resto } = ordenarGuardados([astra, chatgpt], ids, mini);
  expect(principal.item.name).toBe('ChatGPT');
  expect(principal.imagen).toBe('https://commons.wikimedia.org/x.png');
  expect(modelos.map((m) => m.item.name)).toEqual(['GPT-6 Astra']);
  expect(modelos[0].imagen).toBeNull(); // sin logo: el ícono de su tipo, no la foto del reel
  expect(resto).toEqual([]);
  // Sin una herramienta en el post, el modelo va solo.
  expect(ordenarGuardados([astra], ids, mini).principal.tipo).toBe('modelo');
  expect(esModelo('modelo de lenguaje de gran tamaño de OpenAI')).toBe(true);
  expect(esModelo('bot de charla basado en inteligencia artificial')).toBe(false);
});
