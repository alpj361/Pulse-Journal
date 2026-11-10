import { createParser } from '@openuidev/react-lang';
import { primeraOracion, programaDelAnalisis, repite } from '../vistaDelPost';

jest.mock('../../../utils/supabase', () => ({ supabase: { from: jest.fn() } }));
jest.mock('../../feed/TarjetasCongreso', () => ({ Hemiciclo: () => null }));
jest.mock('../../../utils/portada', () => () => null);
jest.mock('../../MorphingInfinity', () => () => null);
const { catalogo } = require('../../visual/catalogo');

const leer = (programa) => createParser(catalogo.toJSONSchema(), 'Vista').parse(programa);

const ANALISIS = {
  resumen: 'Jev busca vuelos en 7 segundos.',
  narrativa: 'El contenido presenta una visión optimista. Después detalla casos.',
  hechos: [
    { id: 'h0', texto: 'Jev busca vuelos en 7 segundos.', cita: 'busca vuelos en unos 7 segundos', cita_en_texto: true, hablante: 'v1' },
    { id: 'h1', texto: 'Analizó 724 anuncios por 9 centavos.', cita: '', hablante: null },
  ],
  cantidades: [
    { numero: 7, valor: '7', variable: 'segundos', hacia: 'búsqueda de vuelos' },
    { numero: 724, valor: '724', variable: 'anuncios', hacia: null },
    { numero: null, valor: null, variable: 'nada' },
  ],
  menciones: [
    { texto: 'Alvaro Sanchez', tipo: 'Actor', rol: 'de_paso', codex: null },
    { texto: 'Matthew Berman', tipo: 'Actor', rol: 'central', codex: { id: 'a1', tipo: 'Actor' } },
    { texto: 'zona 4', tipo: 'Territorio', codex: { id: 't1', tipo: 'Territorio' } },
  ],
  linea_tiempo: [{ desde: 0, hasta: 7, texto: 'habla a cámara' }],
  relaciones: [{ a: 'Jev', b: 'TypeSafe AI', verbo: 'es desarrollado por' }],
  fuentes: [{ nombre: 'Matthew Berman', cita: 'lo usó para analizar 724 anuncios de 37 marcas' }],
};

test('arma una vista válida del catálogo, con cada sección que tiene datos', () => {
  const p = programaDelAnalisis(ANALISIS);
  const r = leer(p);
  expect(r.meta.errors).toEqual([]);
  expect(r.root.typeName).toBe('Vista');
  expect(p).toMatch(/Seccion\("Lo que dice"/);
  expect(p).toMatch(/Cifra\("7", "segundos", "búsqueda de vuelos"\)/);
  // Nadie habla a cámara en este análisis: los nombrados son «Mencionados».
  expect(p).toMatch(/Seccion\("Mencionados", \[Personas\(\[Persona\("Matthew Berman", "a1", "Actor"\), Persona\("Alvaro Sanchez", "", "Actor"\)\]\)\]/);
  expect(p).not.toMatch(/t1/); // un territorio no es un actor
  expect(p).not.toMatch(/LineaDeTiempo/); // los tramos del video no son una cronología
  expect(p).toMatch(/Relacion\("Jev", "es desarrollado por", "TypeSafe AI"\)/);
  // Los hechos van con su id, para guardarlos desde la vista.
  expect(p).toMatch(/Hecho\("h1", "Analizó 724 anuncios por 9 centavos\."\)/);
  expect(p).toMatch(/Cita\("lo usó para analizar 724 anuncios de 37 marcas", "Matthew Berman"\)/);
  // Lo que repite el título no se vuelve a decir.
  expect(p).not.toMatch(/busca vuelos en unos 7 segundos/);
});

test('la voz «v1» no se muestra como nombre, y «según X» no es una cita', () => {
  const p = programaDelAnalisis({
    ...ANALISIS,
    hechos: [{ id: 'h9', texto: 'Ahorra dinero en publicidad.', cita: 'esto les ahorra miles de dólares al mes', hablante: 'v1' }],
    fuentes: [{ nombre: 'Alex Volkov', cita: 'según Alex Volkov.' }],
  });
  expect(p).toMatch(/Hecho\("h9", "Ahorra dinero en publicidad\.", "esto les ahorra miles de dólares al mes"\)/);
  expect(p).toMatch(/Texto\("Alex Volkov"\)/);
});

test('quién aparece es quien está en el video; los nombrados y las entidades van aparte', () => {
  const p = programaDelAnalisis({
    ...ANALISIS,
    menciones: [
      { texto: 'Alvaro Sanchez', tipo: 'Actor', codex: null },
      { texto: 'TypeSafe AI', tipo: 'Entidad', codex: null },
      { texto: 'Matthew Berman', tipo: 'Actor', codex: { id: 'a1', tipo: 'Actor' } },
    ],
  }, { hablante: { tipo: 'persona', nombre: 'Alvaro Sanchez' } });
  expect(p).toMatch(/Seccion\("Quién aparece", \[Personas\(\[Persona\("Alvaro Sanchez", "", "Actor", "habla a cámara"\)\], true\)\]/);
  expect(p).toMatch(/Seccion\("Mencionados", \[Personas\(\[Persona\("Matthew Berman", "a1", "Actor"\)\]\)\]/);
  expect(p).toMatch(/Seccion\("Entidades", \[Personas\(\[Persona\("TypeSafe AI", "", "Entidad"\)\]\)\]/);
});

test('las voces: con nombre y su rol; sin nombre, por cómo se reconocen', () => {
  const p = programaDelAnalisis({
    ...ANALISIS,
    hablantes: [
      { id: 'H1', rol: 'anfitrion', nombre: null, descripcion: 'hombre, charla con humor' },
      { id: 'H2', rol: 'invitado', nombre: 'Ana Pérez', persona_item_id: 'p9' },
    ],
  });
  expect(p).toMatch(/Persona\("Conduce", "", "", "", "hombre, charla con humor", "H1"\)/);
  expect(p).toMatch(/Persona\("Ana Pérez", "p9", "Actor", "invitado", "", "H2"\)/);
});

test('lo dicho a mano: una voz nombrada y alguien que el análisis no detectó', () => {
  const p = programaDelAnalisis({
    ...ANALISIS,
    hablantes: [{ id: 'H1', rol: 'anfitrion', nombre: null, descripcion: 'hombre' }],
  }, { aparecen: [{ id: 'p1', name: 'Luis Ruiz', voz: 'H1' }, { id: 'p2', name: 'Marta Gil', voz: null }] });
  expect(p).toMatch(/Persona\("Luis Ruiz", "p1", "Actor", "conduce", "", "H1"\)/);
  expect(p).toMatch(/Persona\("Marta Gil", "p2", "Actor"\)/);
  expect(p).not.toMatch(/"Conduce"/);
});

test('sin con qué armar dos secciones, se queda la vista de siempre', () => {
  expect(programaDelAnalisis(null)).toBeNull();
  expect(programaDelAnalisis({ resumen: 'x', hechos: [{ id: 'h', texto: 'Algo pasó.' }] })).toBeNull();
});

test('las comillas y saltos del texto no rompen el programa', () => {
  const p = programaDelAnalisis({ ...ANALISIS, resumen: 'Dijo "basta"\ny se fue' });
  expect(leer(p).meta.errors).toEqual([]);
  expect(p).toMatch(/Dijo \\"basta\\" y se fue/);
});

test('un resumen cortado a la mitad no es el título, y la bajada no repite al título', () => {
  const cortado = 'El contenido es una atribución de autoría informativa que identifica a Andres Johnson como el creador del material audiovisual publicado baj';
  const narrativa = 'El contenido es una atribución de autoría informativa que identifica a Andres Johnson como el creador del material audiovisual publicado bajo la cuenta andres.gjohnson.';
  const p = programaDelAnalisis({ ...ANALISIS, resumen: cortado, narrativa });
  expect(p.split('\n')[0]).toBe(`root = Vista(${JSON.stringify(narrativa)}, [s1, s2, s3, s4, s5])`);
});

test('la bajada es la primera oración', () => {
  expect(primeraOracion('Uno. Dos.')).toBe('Uno.');
  expect(primeraOracion('')).toBe('');
});

test('repite: casi las mismas palabras', () => {
  expect(repite('Jev busca vuelos en 7 segundos.', 'Jev de TypeSafe busca vuelos en unos 7 segundos')).toBe(true);
  expect(repite('Analizó 724 anuncios', 'Jev busca vuelos')).toBe(false);
});
