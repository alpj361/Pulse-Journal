import {
  buscarLegal, compararArticulos, consultaAmplia, descripcionDe, sinTitulo, leerConsulta, nombreEstado, partesDelFragmento, porCoincidencia, recorteAlrededor, separarEncabezado, textoLegible,
} from '../buscadorLegal';

const mockRpc = jest.fn();
const mockFrom = jest.fn();
jest.mock('../../../utils/supabase', () => ({ supabase: { rpc: (...a) => mockRpc(...a), from: (...a) => mockFrom(...a) } }));

beforeEach(() => {
  mockRpc.mockReset();
  mockFrom.mockReset();
});

test('un artículo por número se separa de la ley que se nombra', () => {
  expect(leerConsulta('art 102 constitución')).toEqual({ q: 'art 102 constitución', numero: '102', resto: 'constitución' });
  expect(leerConsulta('Artículo 41 bis del Código de Trabajo')).toMatchObject({ numero: '41 BIS', resto: 'Código Trabajo' });
  expect(leerConsulta('art. 78')).toMatchObject({ numero: '78', resto: '' });
  expect(leerConsulta('despido sin justa causa').numero).toBeNull();
});

test('la búsqueda amplia deja solo las palabras que dicen algo', () => {
  expect(consultaAmplia('¿qué pasa si me despiden del trabajo?')).toBe('despiden or trabajo');
  expect(consultaAmplia('qué pasa')).toBeNull();
});

test('lo que coincide queda marcado, sin etiquetas, y lo seguido se junta', () => {
  expect(partesDelFragmento('<b>justa</b> <b>causa</b> del\n<b>despido</b>, debe')).toEqual([
    { texto: 'justa causa', marca: true },
    { texto: ' del ', marca: false },
    { texto: 'despido', marca: true },
    { texto: ', debe', marca: false },
  ]);
  expect(partesDelFragmento('')).toEqual([]);
});

test('el texto del PDF se lee sin sus cortes de renglón', () => {
  expect(textoLegible('El patrono  debe\npagar al traba-\njador.\n\nSegundo párrafo.')).toBe('El patrono debe pagar al trabajador.\n\nSegundo párrafo.');
});

test('los artículos van en orden de lectura', () => {
  expect(['42', '41 TER', '41', '41 BIS', '100', 'Transitorio I'].sort(compararArticulos)).toEqual(['41', '41 BIS', '41 TER', '42', '100', 'Transitorio I']);
});

test('la descripción no lleva notas internas ni repite el título', () => {
  expect(descripcionDe({ titulo: 'Código Municipal', descripcion: 'Regula los municipios. ATENCIÓN: el texto cargado es el ORIGINAL.' })).toBe('Regula los municipios.');
  expect(descripcionDe({ titulo: 'Ley X', descripcion: 'Fuente: Poder Ciudadano (congreso). Ley X' })).toBeNull();
  expect(descripcionDe({ titulo: 'Ley X', descripcion: null })).toBeNull();
});

test('vigente no se dice; lo demás sí', () => {
  expect(nombreEstado('vigente')).toBeNull();
  expect(nombreEstado('vetado')).toBe('vetada');
});

const respuestas = (porRpc) => mockRpc.mockImplementation((nombre, { q }) => Promise.resolve({ data: porRpc(nombre, q), error: null }));

test('busca leyes, artículos e iniciativas a la vez', async () => {
  respuestas((nombre) => ({
    buscar_leyes: [{ id: 'n1', titulo: 'Código de Trabajo', decreto: 'Decreto 1441', estado: 'vigente', articulos_count: 438, rank: 0.4, fragmento: '<b>despido</b>' }],
    buscar_articulos: [{ articulo_id: 'a1', numero_articulo: '78', norma_id: 'n1', norma_titulo: 'Código de Trabajo', rank: 0.3, fragmento: 'el <b>despido</b>' }],
    buscar_iniciativas: [],
  })[nombre]);
  const { resultados, amplia } = await buscarLegal('despido');
  expect(amplia).toBe(false);
  expect(resultados.map((r) => r.clave)).toEqual(['ley-n1', 'articulo-a1']);
  expect(resultados[1]).toMatchObject({ tipo: 'articulo', normaId: 'n1', numero: '78' });
});

test('si nada tiene todas las palabras, busca con alguna y lo dice', async () => {
  respuestas((nombre, q) => (q.includes(' or ') && nombre === 'buscar_articulos'
    ? [{ articulo_id: 'a2', numero_articulo: '82', norma_id: 'n1', norma_titulo: 'Código de Trabajo', fragmento: '' }]
    : []));
  const { resultados, amplia } = await buscarLegal('qué pasa si me despiden del trabajo');
  expect(amplia).toBe(true);
  expect(mockRpc).toHaveBeenLastCalledWith('buscar_iniciativas', { q: 'despiden or trabajo', limite: 30 });
  expect(resultados).toHaveLength(1);
});

test('un artículo por número sale de la ley que se nombró', async () => {
  const filas = [
    { id: 'x1', numero_articulo: '102', texto: 'Derechos sociales mínimos', norma_id: 'c', normas: { titulo: 'Constitución Política de la República de Guatemala', tipo: 'constitucion' } },
    { id: 'x2', numero_articulo: '102', texto: 'Otro', norma_id: 'p', normas: { titulo: 'Código Penal', tipo: 'codigo' } },
  ];
  mockFrom.mockReturnValue({ select: () => ({ ilike: () => ({ limit: () => Promise.resolve({ data: filas, error: null }) }) }) });
  const { resultados } = await buscarLegal('art 102 constitucion');
  expect(resultados.map((r) => r.id)).toEqual(['x1']);
  expect(mockRpc).not.toHaveBeenCalled();
});

test('sin el número repetido ni el encabezado de página del PDF', () => {
  const ley = 'Constitución Política de la República de Guatemala';
  expect(textoLegible('Artículo 102. Derechos sociales; d) costo;\n\nCONSTITUCIÓN POLÍTICA DE LA REPÚBLICA DE GUATEMALA 20 e) Inembargabilidad', { numero: '102', titulo: ley }))
    .toBe('Derechos sociales; d) costo; e) Inembargabilidad');
  expect(partesDelFragmento('Artículo 76. <b>Despido</b> Justificado', { numero: '76', titulo: 'Ley de Servicio Civil' })[0]).toEqual({ texto: 'Despido', marca: true });
});

test('el título de la sección siguiente se separa del artículo', () => {
  expect(separarEncabezado('quedando exonerados de toda clase de impuestos y arbitrios. SECCIÓN SÉPTIMA Salud, seguridad y asistencia social'))
    .toEqual({ texto: 'quedando exonerados de toda clase de impuestos y arbitrios.', encabezado: 'SECCIÓN SÉPTIMA Salud, seguridad y asistencia social' });
  expect(separarEncabezado('conforme al título de la ley.').encabezado).toBeNull();
});

test('lo que más coincide va primero, y una ley sin marcas no repite su título', () => {
  const r = porCoincidencia([
    { tipo: 'ley', rank: 0.9, partes: [{ texto: 'Ley X', marca: false }] },
    { tipo: 'articulo', rank: 0.5, partes: [{ texto: 'embarazo', marca: true }] },
  ]);
  expect(r.map((x) => x.tipo)).toEqual(['articulo', 'ley']);
  expect(r[1].partes).toEqual([]);
  // Coincidía en el título: no baja aunque el fragmento quede vacío.
  const t = porCoincidencia([
    { tipo: 'articulo', rank: 0.2, partes: [{ texto: 'x', marca: true }] },
    { tipo: 'ley', rank: 0.6, coincide: true, partes: [] },
  ]);
  expect(t.map((x) => x.tipo)).toEqual(['ley', 'articulo']);
});

test('el fragmento de una ley no repite su título ni dice de dónde salió', () => {
  expect(sinTitulo('<b>Competencia</b> Fuente: Poder Ciudadano (congreso). Ley de <b>Competencia</b> Congreso de la República', 'Ley de Competencia'))
    .toBe('<b>Competencia</b> Congreso de la República');
});

test('de un artículo largo, el pedazo donde aparece lo buscado', () => {
  const texto = `${'palabra '.repeat(60)}se impondrá una multa de cien salarios ${'otra '.repeat(80)}`;
  const r = recorteAlrededor(texto, 'MULTA', 20, 40);
  expect(r.startsWith('… ')).toBe(true);
  expect(r.endsWith(' …')).toBe(true);
  expect(r).toContain('una multa de cien');
  expect(recorteAlrededor(texto, 'inexistente')).toBeNull();
});

test('un título más largo que el fragmento tampoco se repite', () => {
  expect(sinTitulo('Declarar electos como director titular y suplente del Directorio de la <b>Superintendencia</b> de <b>Competencia</b>, respectivamente, a los profesionales',
    'Declarar electos como director titular y suplente del Directorio de la Superintendencia de Competencia, respectivamente, a los profesionales Jorge Mario'))
    .toBe('');
});
