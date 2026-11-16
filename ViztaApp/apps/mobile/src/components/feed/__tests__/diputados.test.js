import { asignarCurules, bancadasDeLaVotacion, claveNombre, diputadosDe, iniciales, nombreBancada, ordenBancadas, siglaDe, siglaDelVoto, votosUnicos } from '../diputados';

jest.mock('../../../utils/supabase', () => ({ supabase: {} }));

// Filas como las guarda el dataset «Congreso de Guatemala».
const fila = (id, nombre, partido, distrito) => ({ id, values: { nombre, partido, distrito, foto_diputado: `https://x/${id}.jpg` } });
const filas = [
  fila('a', 'Ana Patricia  Orantes Thomas', 'Independiente - IND', 'Listado Nacional'),
  fila('b', 'Allan Estuardo Rodríguez Reyes', 'Vamos por una Guatemala Diferente - VAMOS', 'Sololá'),
  fila('c', 'Luis Alberto Rodríguez Reyes', 'Vamos por una Guatemala Diferente - VAMOS', 'Sololá'),
  fila('d', 'Sonia Marina Gutierrez Raguay', 'Movimiento Político Winaq-Unidad Revolucionaria Nacional Guatemalteca - WINAQ-URNG- MAIZ', 'Listado Nacional'),
  fila('e', 'Karla Betzaida Cardona Arreaga', 'Unidad Nacional de la Esperanza - UNE', 'Huehuetenango'),
];
const diputados = diputadosDe(filas);

test('la sigla sale del partido del dataset y del bloque del registro de votos', () => {
  expect(siglaDe('Vamos por una Guatemala Diferente - VAMOS')).toBe('VAMOS');
  expect(siglaDe('Partido Azul - Azul')).toBe('AZUL');
  expect(siglaDe('Movimiento Político Winaq-Unidad Revolucionaria Nacional Guatemalteca - WINAQ-URNG- MAIZ')).toBe('WINAQ');
  expect(siglaDelVoto('INDEP')).toBe('IND');
  expect(siglaDelVoto('WINAQ')).toBe('WINAQ');
  expect(nombreBancada('VAMOS')).toBe('Vamos');
  expect(nombreBancada('UNE')).toBe('UNE');
  expect(nombreBancada('IND', { plural: true })).toBe('Independientes');
});

test('el nombre se reconoce aunque venga con los apellidos primero', () => {
  expect(claveNombre('Orantes Thomas Ana Patricia')).toBe(claveNombre('Ana Patricia  Orantes Thomas'));
  expect(diputados[0].nombre).toBe('Ana Patricia Orantes Thomas');
  expect(iniciales('Ana Patricia Orantes Thomas')).toBe('AO');
});

test('las bancadas van de la más grande a la más chica, con los independientes al final', () => {
  expect(ordenBancadas(diputados).map((b) => b.sigla)).toEqual(['VAMOS', 'UNE', 'WINAQ', 'IND']);
});

test('cada diputado cae siempre en la misma curul, sin importar el orden de la lista', () => {
  const una = asignarCurules(diputados).map((c) => c.diputado.id);
  const otra = asignarCurules([...diputados].reverse()).map((c) => c.diputado.id);
  expect(una).toEqual(otra);
  expect(una).toEqual(['b', 'c', 'e', 'd', 'a']);
});

test('una persona repetida en el registro cuenta un solo voto', () => {
  const votos = votosUnicos([
    { diputado: 'Ana Patricia Orantes Thomas', bloque: 'INDEP', voto: 'A FAVOR' },
    { diputado: 'Orantes Thomas Ana Patricia', bloque: 'INDEP', voto: 'A FAVOR' },
    { diputado: 'Allan Estuardo Rodríguez Reyes', bloque: 'VAMOS', voto: 'EN CONTRA' },
    { diputado: 'Luis Alberto Rodríguez Reyes', bloque: 'VAMOS', voto: 'A FAVOR' },
    { diputado: 'Alguien Que Ya No Está', bloque: 'VAMOS', voto: 'A FAVOR' },
  ]);
  expect(votos.size).toBe(4);
  const [vamos, ind] = bancadasDeLaVotacion(votos, diputados);
  expect(vamos).toMatchObject({ sigla: 'VAMOS', total: 3, favor: 2, contra: 1 });
  // Quien se apartó de su bancada va primero, y trae su ficha del dataset.
  expect(vamos.personas[0]).toMatchObject({ nombre: 'Allan Estuardo Rodríguez Reyes', voto: 'contra', distrito: 'Sololá' });
  // Quien ya no está en el dataset igual cuenta, sin foto.
  expect(vamos.personas.find((p) => p.nombre === 'Alguien Que Ya No Está').foto).toBeNull();
  expect(ind).toMatchObject({ sigla: 'IND', total: 1 });
});

test('un toque en el mapa cae en su distrito, y en el centro de la capital, en el Distrito Central', () => {
  const { distritoEn } = require('../distritosGuatemala');
  // En un dibujo de 414 × 418 puntos, cada grado son 100 puntos: x = (lon + 92.3) · 100, y = (17.86 − lat) · 100.
  const toque = (lon, lat) => distritoEn((lon + 92.3) * 100, (17.86 - lat) * 100, 414, 418);
  expect(toque(-90.5, 14.62)).toBe('Distrito Central');
  expect(toque(-90.35, 14.8)).toBe('Guatemala');
  expect(toque(-90.0, 17.0)).toBe('Petén');
  expect(toque(-91.6, 15.7)).toBe('Huehuetenango');
  expect(toque(-87.5, 14.0)).toBeNull();
});

describe('diputados que dejan el cargo', () => {
  // eslint-disable-next-line global-require
  const { ayudaEstado, dejoLaCurul, enElPleno, rotuloEstado } = require('../diputados');
  const fila = (id, values) => ({ id, values: { partido: 'Unidad Nacional de la Esperanza - UNE', distrito: 'Zacapa', ...values } });

  test('el fallecido queda en la lista, con su pill y su curul vacía hasta el reemplazo', () => {
    const [p] = diputadosDe([fila('p', { nombre: 'Julio César Portillo Paz', estado: 'fallecido', fecha_estado: '2026-11-06' })]);
    expect(dejoLaCurul(p)).toBe(true);
    expect(rotuloEstado(p)).toBe('fallecimiento · 6 nov');
    expect(ayudaEstado(p, [p])).toBe('Fallecimiento: 6 de noviembre de 2026. La curul permanece vacante hasta la juramentación de quien sustituya en el cargo. Los votos emitidos antes de esa fecha se conservan en el registro.');
    expect(enElPleno([p])).toEqual([p]);
  });

  test('con reemplazo, el que entra ocupa la curul y el helper lo dice', () => {
    const lista = diputadosDe([
      fila('p', { nombre: 'Julio César Portillo Paz', estado: 'fallecido', fecha_estado: '2026-11-06' }),
      fila('r', { nombre: 'Ana Reemplazo', ocupa_la_curul_de: 'Julio César Portillo Paz', fecha_estado: '2026-11-20' }),
    ]);
    expect(enElPleno(lista).map((d) => d.id)).toEqual(['r']);
    expect(ayudaEstado(lista[0], lista)).toMatch(/La curul la ocupa Ana Reemplazo\./);
    expect(ayudaEstado(lista[1], lista)).toBe('Sustituye en la curul a Julio César Portillo Paz desde el 20 de noviembre de 2026.');
  });

  test('la licencia no deja la curul; sin estado, nada', () => {
    const [l, n] = diputadosDe([fila('l', { nombre: 'Con Licencia', estado: 'licencia' }), fila('n', { nombre: 'En Funciones' })]);
    expect(dejoLaCurul(l)).toBe(false);
    expect(rotuloEstado(l)).toBe('licencia');
    expect(rotuloEstado(n)).toBeNull();
    expect(ayudaEstado(n, [])).toBeNull();
  });
});

test('el logo de cada bancada sale del dataset y los distritos se agrupan, el Listado Nacional primero', () => {
  // eslint-disable-next-line global-require
  const { distritosOrdenados, logosDeBancadas } = require('../diputados');
  const lista = diputadosDe([
    { id: 'a', values: { nombre: 'Ana Uno', partido: 'CABAL - CABAL', distrito: 'Quiché', logo_del_partido: 'cabal.png' } },
    { id: 'b', values: { nombre: 'Beto Dos', partido: 'CABAL - CABAL', distrito: 'Quiché' } },
    { id: 'c', values: { nombre: 'Ceci Tres', partido: 'CABAL - CABAL', distrito: 'Listado Nacional', logo_del_partido: 'cabal.png' } },
    { id: 'd', values: { nombre: 'Dani Cuatro', partido: 'Independiente - IND', distrito: 'Petén', logo_del_partido: 'ind.jpg' } },
  ]);
  expect(logosDeBancadas(lista)).toEqual({ CABAL: 'cabal.png', IND: 'ind.jpg' });
  expect(distritosOrdenados(lista.filter((d) => d.sigla === 'CABAL')).map((g) => `${g.distrito} ${g.personas.length}`))
    .toEqual(['Listado Nacional 1', 'Quiché 2']);
});
