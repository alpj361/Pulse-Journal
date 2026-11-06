import {
  buscarLegal, compararArticulos, consultaAmplia, decretosNombrados, deResolucion, descripcionDe, iniciativasDeLey, nombreDecreto, notaVisible, numeroDeDecreto, propositoDe, reformaDe, reformaDeArticulo, relacionDe, rotuloDeNorma, sinTitulo, leerConsulta, nombreEstado, partesDelFragmento, porCoincidencia, recorteAlrededor, separarEncabezado, textoLegible, ultimaReforma,
} from '../buscadorLegal';

const mockRpc = jest.fn();
const mockFrom = jest.fn();
const mockSesion = jest.fn();
jest.mock('../../../utils/supabase', () => ({ supabase: { rpc: (...a) => mockRpc(...a), from: (...a) => mockFrom(...a), auth: { getSession: () => mockSesion() } } }));

beforeEach(() => {
  mockRpc.mockReset();
  mockFrom.mockReset();
  mockSesion.mockReset();
  mockSesion.mockResolvedValue({ data: { session: null } });
  global.fetch = jest.fn();
});

test('un artículo por número se separa de la ley que se nombra', () => {
  expect(leerConsulta('art 102 constitución')).toEqual({ q: 'art 102 constitución', numero: '102', resto: 'constitución' });
  expect(leerConsulta('Artículo 41 bis del Código de Trabajo')).toMatchObject({ numero: '41 BIS', resto: 'Código Trabajo' });
  expect(leerConsulta('art. 78')).toMatchObject({ numero: '78', resto: '' });
  expect(leerConsulta('despido sin justa causa').numero).toBeNull();
});

test('los sufijos: latinos completos, letras con Ñ, y una letra suelta que no es sufijo', () => {
  expect(leerConsulta('artículo 327 "G" del Código Penal')).toMatchObject({ numero: '327 G', resto: 'Código Penal' });
  expect(leerConsulta('art 327 g del código penal').numero).toBe('327 G');
  expect(leerConsulta('art 407 Ñ código penal').numero).toBe('407 Ñ');
  expect(leerConsulta('art 491 sexies código penal').numero).toBe('491 SEXIES');
  expect(leerConsulta('art 195 quáter').numero).toBe('195 QUATER');
  expect(leerConsulta('art 5 a la ley de tránsito')).toMatchObject({ numero: '5', resto: 'a ley tránsito' });
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
  // La serie latina va por su rango, no por el abecedario; luego las letras, con Ñ después de N.
  expect(['195 TER', '195 QUINQUIES', '195 QUATER', '195 BIS', '195'].sort(compararArticulos)).toEqual(['195', '195 BIS', '195 TER', '195 QUATER', '195 QUINQUIES']);
  expect(['407 O', '407 Ñ', '407 N', '407 A'].sort(compararArticulos)).toEqual(['407 A', '407 N', '407 Ñ', '407 O']);
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
  respuestas((nombre, q) => (String(q).includes(' or ') && nombre === 'buscar_articulos'
    ? [{ articulo_id: 'a2', numero_articulo: '82', norma_id: 'n1', norma_titulo: 'Código de Trabajo', fragmento: '' }]
    : []));
  const { resultados, amplia } = await buscarLegal('qué pasa si me despiden del trabajo');
  expect(amplia).toBe(true);
  expect(mockRpc).toHaveBeenCalledWith('buscar_iniciativas', { q: 'despiden or trabajo', limite: 30 });
  expect(resultados).toHaveLength(1);
});

test('un artículo por número sale de la ley que se nombró', async () => {
  const filas = [
    { id: 'x1', numero_articulo: '102', texto: 'Derechos sociales mínimos', norma_id: 'c', normas: { titulo: 'Constitución Política de la República de Guatemala', tipo: 'constitucion' } },
    { id: 'x2', numero_articulo: '102', texto: 'Otro', norma_id: 'p', normas: { titulo: 'Código Penal', tipo: 'codigo' } },
  ];
  const consulta = { select: () => consulta, ilike: () => consulta, eq: () => consulta, in: () => consulta, limit: () => Promise.resolve({ data: filas, error: null }) };
  mockFrom.mockReturnValue(consulta);
  mockRpc.mockResolvedValue({ data: [{ articulo_id: 'x1', decreto_reforma: null, reformado_por: null }], error: null });
  const { resultados } = await buscarLegal('art 102 constitucion');
  expect(resultados.map((r) => r.id)).toEqual(['x1']);
  // Sin sesión no se pregunta al servidor; la procedencia va en una sola consulta.
  expect(global.fetch).not.toHaveBeenCalled();
  expect(mockRpc).toHaveBeenCalledTimes(1);
  expect(mockRpc).toHaveBeenCalledWith('legal_procedencia_articulos', { p_ids: ['x1'] });
});

test('con sesión, el artículo por número lo resuelve el servidor, sin adivinar', async () => {
  mockSesion.mockResolvedValue({ data: { session: { access_token: 't' } } });
  global.fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({
    found: 1,
    results: [{ articulo_id: 'g', norma_id: 'cp', articulo: 'Art. 327 G', norma: 'Código Penal', decreto: 'Decreto 17-73', texto: 'Artículo 327 "G". Clonación de tarjeta.',
      procedencia: { decreto_reforma: 'Decreto 2-2025', reformado_por: 'd2', vigente_desde: '2025-03-08' } }],
  }) });
  const { resultados } = await buscarLegal('art 327 G código penal');
  expect(global.fetch.mock.calls[0][0]).toContain('/api/legal/resolve?limit=10&query=art%20327%20G');
  expect(resultados).toEqual([expect.objectContaining({ id: 'g', normaId: 'cp', numero: '327 G', reforma: { decreto: 'Decreto 2-2025', normaId: 'd2', desde: '2025-03-08' } })]);
  expect(mockFrom).not.toHaveBeenCalled();
});

test('si el servidor ve varias leyes posibles, se muestra el artículo en cada una', async () => {
  mockSesion.mockResolvedValue({ data: { session: { access_token: 't' } } });
  global.fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ found: 0, results: [], seleccion: { ambigua: true, candidatos: [{ id: 'cp' }, { id: 'cpp' }] } }) });
  const enLeyes = jest.fn();
  const filas = [
    { id: 'a', numero_articulo: '5', texto: 'x', norma_id: 'cp', normas: { titulo: 'Código Penal', tipo: 'codigo' } },
    { id: 'b', numero_articulo: '5', texto: 'y', norma_id: 'cpp', normas: { titulo: 'Código Procesal Penal', tipo: 'codigo' } },
  ];
  const consulta = { select: () => consulta, ilike: () => consulta, eq: () => consulta, in: (...a) => { enLeyes(...a); return consulta; }, limit: () => Promise.resolve({ data: filas, error: null }) };
  mockFrom.mockReturnValue(consulta);
  mockRpc.mockResolvedValue({ data: null, error: new Error('sin procedencia') });
  const { resultados } = await buscarLegal('art 5 código penal');
  expect(enLeyes).toHaveBeenCalledWith('norma_id', ['cp', 'cpp']);
  expect(resultados.map((r) => r.id)).toEqual(['a', 'b']);
});

test('la reforma de un artículo, como la acredita la base', () => {
  expect(nombreDecreto('9-2009')).toBe('Decreto 9-2009');
  expect(nombreDecreto('Decreto 2-2025')).toBe('Decreto 2-2025');
  expect(numeroDeDecreto('9-2009')).toBe('9-2009');
  expect(rotuloDeNorma({ titulo: 'Ley contra la Violencia Sexual', decreto: '9-2009', tipo: 'ley' })).toBe('DECRETO 9-2009');
  expect(reformaDe({ decreto_reforma: '9-2009', reformado_por: 'v', vigente_desde: '2009-04-04' })).toEqual({ decreto: 'Decreto 9-2009', normaId: 'v', desde: '2009-04-04' });
  expect(reformaDe({ decreto_reforma: null, reformado_por: null })).toBeNull();
  expect(deResolucion({ articulo_id: 'g', articulo: 'Art. 407 Ñ', norma: 'Código Penal', texto: '' }).numero).toBe('407 Ñ');
  const decretos = new Map([['d2', { decreto: 'Decreto 2-2025', titulo: 'Reformas al Código Penal' }], ['v', { decreto: '9-2009' }]]);
  const reformas = new Map([['d2|327 G', 'adiciona']]);
  const g = reformaDeArticulo({ numero_articulo: '327 G', reformado_por: 'd2', vigente_desde: '2025-03-08' }, reformas, decretos);
  expect(g).toMatchObject({ decreto: 'Decreto 2-2025', accion: 'adiciona', desde: '2025-03-08' });
  const d = reformaDeArticulo({ numero_articulo: '175', reformado_por: 'v', vigente_desde: '2009-04-04', derogado: true }, reformas, decretos);
  expect(d).toMatchObject({ decreto: 'Decreto 9-2009', accion: 'deroga' });
  expect(reformaDeArticulo({ numero_articulo: '1' }, reformas, decretos)).toBeNull();
  expect(ultimaReforma([{ reforma: d }, { reforma: g }, { reforma: null }])).toBe(g);
});

test('el número repetido se quita aunque traiga su sufijo entre comillas', () => {
  expect(textoLegible('Artículo 327 "G". Clonación de tarjeta.', { numero: '327 G' })).toBe('Clonación de tarjeta.');
  expect(textoLegible('Artículo 327 “D”. Distribución.', { numero: '327 D' })).toBe('Distribución.');
  expect(textoLegible('Artículo 195 Quáter. Utilización.', { numero: '195 QUATER' })).toBe('Utilización.');
  expect(textoLegible('Artículo 132 BIS. (Ejecución extrajudicial).', { numero: '132 BIS' })).toBe('(Ejecución extrajudicial).');
});

test('si lo buscado es el nombre de una ley, esa ley va primero', () => {
  const r = (clave, titulo, rank, marca) => ({ tipo: 'ley', clave, titulo, rank, partes: [{ texto: 'x', marca }] });
  const orden = porCoincidencia([
    r('reforma', 'Reformas al Decreto 51-92, Código Procesal Penal', 0.9, true),
    r('penal', 'Código Penal', 0.2, false),
  ], 'codigo penal').map((x) => x.clave);
  expect(orden).toEqual(['penal', 'reforma']);
});

test('la nota de un artículo, sin lo que es de quien cargó el texto', () => {
  expect(notaVisible('Reformado por el Decreto 15-2026, art. 104 (vigente desde 17/09/2026). Texto anterior en backup 2026-10-02.'))
    .toBe('Reformado por el Decreto 15-2026, art. 104 (vigente desde 17/09/2026).');
  expect(notaVisible('Nota de carga 2026-10-02: la fuente imprime por error «337».')).toBeNull();
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
    const { origenes, cambios } = iniciativasDeLey(normas[2], inis, normas);
    expect(origenes.map((o) => o.ini.numero)).toEqual([6400]);
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
