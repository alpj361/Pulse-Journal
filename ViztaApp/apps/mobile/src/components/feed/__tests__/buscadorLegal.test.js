import {
  buscarLegal, compararArticulos, consultaAmplia, decretosNombrados, descripcionDe, iniciativasDeLey, numeroDeDecreto, propositoDe, relacionDe, rotuloDeNorma, sinTitulo, leerConsulta, nombreEstado, partesDelFragmento, porCoincidencia, recorteAlrededor, separarEncabezado, textoLegible,
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
    .toBe('Congreso de la República');
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

describe('iniciativas al lado de las leyes', () => {
  const normas = [
    { id: 'penal', titulo: 'Código Penal', decreto: 'Decreto 17-73', tipo: 'codigo' },
    { id: 'trabajo', titulo: 'Código de Trabajo', decreto: 'Decreto 1441', tipo: 'codigo' },
    { id: 'comp', titulo: 'Ley de Competencia', decreto: 'Decreto 32-2024', tipo: 'ley' },
    { id: 'reforma-comp', titulo: 'Reformas a la Ley de Competencia', decreto: 'Decreto 8-2025', tipo: 'ley' },
    { id: 'conv', titulo: 'Convenio 169 OIT — Pueblos Indígenas', decreto: 'Convenio 169 OIT', tipo: 'convenio' },
  ];

  test('los decretos que nombra un título, y el número de una ley', () => {
    expect(decretosNombrados('reformas al Decreto Número 17-73 y al Decreto 57 - 2008, y al Decreto Ley 107')).toEqual(['17-73', '57-2008', '107']);
    expect(numeroDeDecreto('Decreto 1441')).toBe('1441');
    expect(numeroDeDecreto('Decreto Ley 107')).toBe('107');
    expect(numeroDeDecreto('Convenio 169 OIT')).toBeNull();
  });

  test('una reforma dice qué ley cambia, con o sin ficha en la base', () => {
    const rel = relacionDe({ numero: 6767, titulo: 'Iniciativa que dispone aprobar reforma al Decreto Número 1441 y al Decreto 57-2008' }, normas);
    expect(rel).toMatchObject({ proposito: 'reforma', aprobada: false, sinFicha: ['57-2008'] });
    expect(rel.cambia.map((n) => n.id)).toEqual(['trabajo']);
    // Sin número, por el nombre de la ley.
    expect(relacionDe({ titulo: 'reformas al Código Penal' }, normas).cambia.map((n) => n.id)).toEqual(['penal']);
  });

  test('aprobada: en qué decreto se volvió; una ley nueva no cambia otra', () => {
    const rel = relacionDe({ numero: 6605, titulo: 'Reforma a la Ley de Competencia, Decreto Número 32-2024', decreto_resultante: '8-2025' }, normas);
    expect(rel.aprobada).toBe(true);
    expect(rel.resultante.id).toBe('reforma-comp');
    expect(rel.cambia.map((n) => n.id)).toEqual(['comp']);
    expect(relacionDe({ titulo: 'Iniciativa que dispone aprobar Ley de Aguas' }, normas)).toMatchObject({ proposito: 'nueva', cambia: [] });
    expect(propositoDe('aprobar ampliación al presupuesto')).toBe('otra');
  });

  test('desde una ley: de qué iniciativa nació y cuáles la cambiarían, primero las en trámite', () => {
    const inis = [
      { numero: 6605, titulo: 'Reforma a la Ley de Competencia, Decreto Número 32-2024', decreto_resultante: '8-2025' },
      { numero: 6700, titulo: 'Reformas al Decreto Número 32-2024, Ley de Competencia' },
      { numero: 6400, titulo: 'Ley de Competencia', decreto_resultante: '32-2024' },
    ];
    const { origen, cambios } = iniciativasDeLey(normas[2], inis, normas);
    expect(origen.ini.numero).toBe(6400);
    expect(cambios.map((c) => c.ini.numero)).toEqual([6700, 6605]);
    expect(cambios.map((c) => c.rel.aprobada)).toEqual([false, true]);
  });

  test('vetada: el Congreso la aprobó, pero no es ley ni cambió nada', () => {
    const conVeto = [...normas, { id: 'veto', titulo: 'Reformas al Código Penal', decreto: 'Decreto 10-2026', tipo: 'ley', estado: 'vetado' }];
    const ini = { numero: 6355, titulo: 'Iniciativa que dispone aprobar reforma al Decreto Número 17-73, Código Penal.', decreto_resultante: '10-2026' };
    expect(relacionDe(ini, conVeto)).toMatchObject({ aprobada: false, vetada: true, estadoLey: null });
    // Desde el Código Penal, la vetada va con las terminadas, después de las que siguen en trámite.
    const { cambios } = iniciativasDeLey(normas[0], [ini, { numero: 6700, titulo: 'reformas al Código Penal' }], conVeto);
    expect(cambios.map((c) => [c.ini.numero, c.rel.vetada])).toEqual([[6700, false], [6355, true]]);
    // Aprobada pero sin sancionar: aprobada, con su estado al lado.
    const pendiente = [...normas, { id: 'p', titulo: 'Ley X', decreto: 'Decreto 24-2026', tipo: 'ley', estado: 'pendiente_sancion' }];
    expect(relacionDe({ titulo: 'Ley X', decreto_resultante: '24-2026' }, pendiente)).toMatchObject({ aprobada: true, vetada: false, estadoLey: 'pendiente de sanción' });
  });

  test('el rótulo de una ley no repite el título', () => {
    expect(rotuloDeNorma(normas[1])).toBe('DECRETO 1441');
    expect(rotuloDeNorma({ titulo: 'Constitución Política de la República de Guatemala', decreto: 'Constitución 1985', tipo: 'constitucion' })).toBe('CONSTITUCIÓN 1985');
    expect(rotuloDeNorma(normas[4])).toBe('CONVENIO');
    expect(rotuloDeNorma({ titulo: 'Declarar electos…', decreto: 'Acuerdo 5-2025', tipo: 'otro' })).toBe('ACUERDO 5-2025');
  });

  test('la descripción no empieza repitiendo el nombre de la ley', () => {
    expect(descripcionDe({ titulo: 'Código de Trabajo', descripcion: 'Código de Trabajo de Guatemala. Regula las relaciones entre empleadores y trabajadores.' }))
      .toBe('Regula las relaciones entre empleadores y trabajadores.');
    expect(descripcionDe({ titulo: 'Código de Comercio', descripcion: 'Código de Comercio (Decreto 2-70). Arts. 45 y 125 reformados por el Decreto 15-2026.' }))
      .toBe('Arts. 45 y 125 reformados por el Decreto 15-2026.');
  });
});

test('el fragmento no lleva notas internas ni el final cortado del título', () => {
  expect(sinTitulo('Penal (Decreto 51-92). Regula el proceso. Ojo: hay una reforma pendiente, el Decreto 23-2026', 'Código Procesal Penal'))
    .toBe('Regula el proceso.');
});
