import { anotar, armarPedido, contextos, lugaresDe, memoriaNueva, mencionEnTramos, palabrasAprox, piezas } from '../rastreo';

const R = (textos) => textos.map((texto, i) => ({ key: `k${i}`, texto }));

describe('contexto de cada renglón', () => {
  test('cuenta palabras como la base, sin enlaces ni ==marcas==', () => {
    expect(palabrasAprox('Hola **Ana**, ¿qué tal?')).toBe(4);
    expect(palabrasAprox('ver https://a.gt/x_y y ==esto==')).toBe(2);
    expect(palabrasAprox('---')).toBe(0);
  });

  test('junta renglones vecinos hasta tener palabras de sobra', () => {
    const { antes, despues } = contextos(R(['uno dos tres cuatro', '---', '', 'cinco seis siete ocho nueve', 'X', 'fin']));
    // Arriba de «X» hay 5 palabras en el renglón de al lado y 4 más arriba,
    // saltando el separador y el blanco.
    expect(antes[4]).toBe('uno dos tres cuatro\n---\n\ncinco seis siete ocho nueve');
    // Abajo de «uno…»: 5 + 1 palabras no alcanzan, sigue hasta el final.
    expect(despues[0]).toBe('---\n\ncinco seis siete ocho nueve\nX\nfin');
    expect(antes[0]).toBe('');
    expect(despues[5]).toBe('');
  });
});

describe('armarPedido', () => {
  const texto = new Set(['k0', 'k1', 'k2', 'k3']);

  test('sin nada sabido pide un solo tramo', () => {
    const { pedido, hashes } = armarPedido(R(['a b', 'c d', 'e f', 'g h']), texto, new Set());
    expect(pedido.map((p) => [p.k, p.sigue])).toEqual([
      ['k0', false],
      ['k1', true],
      ['k2', true],
      ['k3', true],
    ]);
    expect(Object.keys(hashes)).toEqual(['k0', 'k1', 'k2', 'k3']);
    // El contexto de abajo lo lleva solo el último del tramo.
    expect(pedido.slice(0, 3).every((p) => p.despues === '')).toBe(true);
  });

  test('con todo sabido no pide nada; al cambiar un renglón, pide ese y sus vecinos cercanos', () => {
    const renglones = R(['a b', 'c d', 'e f', 'g h']);
    const primera = armarPedido(renglones, texto, new Set());
    const sabidos = new Set(Object.values(primera.hashes));
    expect(armarPedido(renglones, texto, sabidos).pedido).toEqual([]);

    const otra = R(['a b', 'c d', 'e f CAMBIO', 'g h']);
    const { pedido } = armarPedido(otra, texto, sabidos);
    // Con renglones tan cortos, el cambio entra en el contexto de todos.
    expect(pedido.map((p) => p.k)).toContain('k2');
  });

  test('un renglón lejano no se vuelve a pedir', () => {
    const largo = 'una dos tres cuatro cinco seis siete ocho nueve diez';
    const renglones = R([largo, largo, largo, largo, largo]);
    const t = new Set(['k0', 'k1', 'k2', 'k3', 'k4']);
    const primera = armarPedido(renglones, t, new Set());
    const sabidos = new Set(Object.values(primera.hashes));
    const cambiado = renglones.map((r, i) => (i === 4 ? { ...r, texto: `${largo} más` } : r));
    const { pedido } = armarPedido(cambiado, t, sabidos);
    expect(pedido.map((p) => p.k)).toEqual(['k3', 'k4']);
    expect(pedido[0].antes).toBe(largo);
  });

  test('los que no son texto no se piden, pero sirven de contexto', () => {
    const renglones = R(['uno dos', '| Ana | Luis |', 'tres']);
    const { pedido } = armarPedido(renglones, new Set(['k0', 'k2']), new Set());
    expect(pedido.map((p) => p.k)).toEqual(['k0', 'k2']);
    expect(pedido[1].sigue).toBe(false);
    expect(pedido[1].antes).toContain('| Ana | Luis |');
  });

  test('la clave cambia si cambia el contexto, no solo el renglón', () => {
    const t = new Set(['k1']);
    const a = armarPedido(R(['Ana dijo', 'hola']), t, new Set()).hashes.k1;
    const b = armarPedido(R(['Luis dijo', 'hola']), t, new Set()).hashes.k1;
    expect(a).not.toBe(b);
    expect(armarPedido(R(['Ana dijo', 'hola']), t, new Set()).hashes.k1).toBe(a);
  });
});

describe('veredictos', () => {
  const ana = { id: 'a', name: 'Ana' };
  const vamos = { id: 'v', name: 'Vamos' };
  const filas = [
    { palabra: 3, escrito: 'Vamos', item_id: 'v', veredicto: 'dudosa', firma: 'f2', firma_corta: 'c2', origen: 'regla' },
    { palabra: 1, escrito: 'Ana', item_id: 'a', veredicto: 'si', firma: 'f1', firma_corta: 'c1', origen: 'regla' },
  ];

  test('ordena por lugar y aplica lo ya decidido', () => {
    const l = lugaresDe(filas, new Map([['v|f2', 'no']]));
    expect(l.map((x) => [x.clave, x.estado])).toEqual([
      ['ana', 'si'],
      ['vamos', 'no'],
    ]);
  });

  test('anota los tramos y recuerda mientras llega la respuesta', () => {
    const tramos = [{ texto: 'Ana', item: ana }, { texto: ' y ' }, { texto: 'Vamos', item: vamos }];
    const memoria = memoriaNueva();
    const r = anotar(tramos, lugaresDe(filas), memoria, { ahora: 1000 });
    expect(r.tramos[0].estado).toBe('si');
    expect(r.tramos[2].estado).toBe('dudosa');
    expect(r.entrando).toBe(true);
    const luego = anotar(tramos, null, memoria, { ahora: 2000 });
    expect(luego.tramos[0]).toMatchObject({ estado: 'si', alfa: 1 });
    expect(luego.entrando).toBe(false);
  });

  test('un nombre nuevo espera; si la base falla, se pinta igual', () => {
    const tramos = [{ texto: 'Ana', item: ana }];
    expect(anotar(tramos, null, memoriaNueva()).tramos[0]).toEqual({ texto: 'Ana', pendiente: true });
    expect(anotar(tramos, null, memoriaNueva(), { fallo: true }).tramos[0].estado).toBe('si');
  });
});

describe('piezas', () => {
  test('cruza formato y menciones sin cambiar el texto', () => {
    const children = [
      { text: 'Hola ', marks: [] },
      { text: 'Ana Pérez', marks: ['strong'] },
      { text: ' y más', marks: [] },
    ];
    const tramos = [{ texto: 'Hola ' }, { texto: 'Ana', item: { id: 'a' } }, { texto: ' Pérez y más' }];
    const p = piezas(children, tramos);
    expect(p.map((x) => x.texto).join('')).toBe('Hola Ana Pérez y más');
    expect(p.map((x) => [x.texto, x.marcas, !!x.mencion])).toEqual([
      ['Hola ', [], false],
      ['Ana', ['strong'], true],
      [' Pérez', ['strong'], false],
      [' y más', [], false],
    ]);
  });

  test('mención bajo el cursor', () => {
    const tramos = [{ texto: 'con ' }, { texto: 'Ana', item: { id: 'a' } }, { texto: '.' }];
    expect(mencionEnTramos(tramos, 4)?.desde).toBe(4);
    expect(mencionEnTramos(tramos, 7)).toBeNull();
  });
});
