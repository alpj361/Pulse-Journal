import { chipsDelFeed, claseViolencia, conClase, conEstado, limpiar, noticiasDelFeed, personalizado, temasAjustables, VACIAS } from '../preferencias';

// Formas de `news_cards` (catálogo v2): el enum en categoria_principal.
const card = (id, categoria_principal, extra = {}) => ({ id, categoria_principal, dia: 'hoy', ...extra });
const cards = [
  card('p1', 'Política'),
  card('v1', 'Violencia', { subcategoria: 'Homicidios', subtipo: 'Ataque armado' }),
  card('j1', 'Justicia'),
  card('v2', 'Violencia', { subcategoria: 'Capturas y operativos' }),
  card('e1', 'Economía y costo de vida'),
  card('j2', 'Justicia', { dia: 'ayer' }),
  card('p2', 'Política', { dia: 'ayer' }),
];
const ids = (l) => l.map((c) => c.id);
const dia = (c) => c.dia;

describe('noticiasDelFeed', () => {
  test('sin ajustes, todo igual que antes', () => {
    expect(ids(noticiasDelFeed(cards, VACIAS, 'todo', dia))).toEqual(ids(cards));
  });
  test('un tema oculto sale del feed, pero su chip lo sigue mostrando', () => {
    const prefs = conEstado(VACIAS, 'Violencia', 'ocultar');
    expect(ids(noticiasDelFeed(cards, prefs, 'todo', dia))).toEqual(['p1', 'j1', 'e1', 'j2', 'p2']);
    expect(ids(noticiasDelFeed(cards, prefs, 'Violencia', dia))).toEqual(['v1', 'v2']);
  });
  test('«primero» adelanta el tema dentro de cada día, sin mezclar días', () => {
    const prefs = conEstado(VACIAS, 'Justicia', 'primero');
    expect(ids(noticiasDelFeed(cards, prefs, 'todo', dia))).toEqual(['j1', 'p1', 'v1', 'v2', 'e1', 'j2', 'p2']);
  });
  test('un tipo de violencia apagado no sale ni desde el chip de Violencia', () => {
    const prefs = conClase(VACIAS, 'homicidios', false);
    expect(ids(noticiasDelFeed(cards, prefs, 'todo', dia))).not.toContain('v1');
    expect(ids(noticiasDelFeed(cards, prefs, 'Violencia', dia))).toEqual(['v2']);
  });
});

describe('chipsDelFeed', () => {
  test('sin ajustes: «todo» y los temas por cuenta, con alias unificados', () => {
    expect(chipsDelFeed([{ categoria: 'Económica' }, { categoria_principal: 'Economía', categoria: 'Social' }])).toEqual([
      { clave: 'todo', nombre: 'todo', cuenta: 2 },
      { clave: 'Economía', nombre: 'Economía', cuenta: 2, tenue: false },
    ]);
  });
  test('«tu feed» cuenta lo propio; los de primero adelante y los ocultos al final, tenues', () => {
    const prefs = conEstado(conEstado(VACIAS, 'Violencia', 'ocultar'), 'Economía', 'primero');
    const chips = chipsDelFeed(cards, prefs);
    expect(chips[0]).toEqual({ clave: 'todo', nombre: 'tu feed', cuenta: 5 });
    expect(chips.map((c) => c.clave)).toEqual(['todo', 'Economía', 'Política', 'Justicia', 'Violencia']);
    expect(chips.at(-1).tenue).toBe(true);
  });
  test('las cuentas descuentan los tipos de violencia apagados', () => {
    const chips = chipsDelFeed(cards, conClase(VACIAS, 'capturas', false));
    expect(chips.find((c) => c.clave === 'Violencia').cuenta).toBe(1);
  });
});

describe('forma guardada', () => {
  test('tipos de violencia del catálogo, el linchamiento manda', () => {
    expect(claseViolencia({ subcategoria: 'Homicidios', subtipo: 'Linchamiento' })).toBe('linchamientos');
    expect(claseViolencia({ subcategoria: 'Extorsión y amenazas' })).toBe('extorsion');
    expect(claseViolencia({ subcategoria: 'Violencia contra mujeres y niñez' })).toBe('mujeres_ninez');
    expect(claseViolencia({ subcategoria: 'Otro hecho violento' })).toBe('otros');
    expect(claseViolencia({})).toBe('otros');
  });
  test('«normal» no se guarda y lo desconocido se descarta', () => {
    expect(conEstado(conEstado(VACIAS, 'Política', 'primero'), 'Política', 'normal')).toEqual(VACIAS);
    expect(limpiar({ temas: { Política: 'raro', Justicia: 'ocultar' }, violencia: ['robos', 'nada', 'robos'] })).toEqual({ temas: { Justicia: 'ocultar' }, violencia: ['robos'] });
    expect(limpiar(null)).toEqual(VACIAS);
    expect(personalizado(VACIAS)).toBe(false);
    expect(personalizado(conClase(VACIAS, 'robos', false))).toBe(true);
  });
  test('el ajuste ofrece los temas del enum y los que hayan llegado aparte', () => {
    const temas = temasAjustables([card('t', 'Tecnología')]);
    expect(temas.slice(0, 3)).toEqual(['Política', 'Elecciones', 'Justicia']);
    expect(temas.at(-1)).toBe('Tecnología');
  });
});

describe('tarjetas con más de una categoría y Elecciones', () => {
  // eslint-disable-next-line global-require
  const { temasDe, stickerDe, temaDe, otrasCategoriasDe } = require('../temas');
  const multi = [
    card('m1', 'Violencia', { otras_categorias: [{ categoria: 'Justicia', subcategoria: 'Tribunales y audiencias' }, { categoria: 'Política', subcategoria: 'Congreso' }] }),
    card('m2', 'Política', { otras_categorias: [{ categoria: 'Política', subcategoria: 'Congreso' }] }),
    card('el', 'Elecciones Generales'),
  ];

  test('los temas de una tarjeta: el principal primero, sin repetir', () => {
    expect(temasDe(multi[0])).toEqual(['Violencia', 'Justicia', 'Política']);
    expect(temasDe(multi[1])).toEqual(['Política']);
    expect(temaDe('Elecciones Generales')).toBe('Elecciones');
    expect(stickerDe(multi[2])).toBe('elecciones');
    expect(otrasCategoriasDe(multi[0])).toEqual([
      { tema: 'Justicia', subcategoria: 'Tribunales y audiencias' },
      { tema: 'Política', subcategoria: 'Congreso' },
    ]);
    expect(otrasCategoriasDe(multi[1])).toEqual([]);
    expect(otrasCategoriasDe(card('x', 'Clima', { otras_categorias: [{ categoria: 'Movilidad', subcategoria: 'Otro' }] })))
      .toEqual([{ tema: 'Movilidad', subcategoria: null }]);
  });

  test('con un tema elegido sale toda tarjeta que lo tenga, también como segunda categoría', () => {
    expect(ids(noticiasDelFeed(multi, VACIAS, 'Justicia', dia))).toEqual(['m1']);
    expect(ids(noticiasDelFeed(multi, VACIAS, 'Política', dia))).toEqual(['m1', 'm2']);
    expect(ids(noticiasDelFeed(multi, VACIAS, 'Elecciones', dia))).toEqual(['el']);
  });

  test('cada tema cuenta las suyas; «todo» cuenta tarjetas, no temas', () => {
    const chips = chipsDelFeed(multi, VACIAS);
    const cuenta = (k) => chips.find((c) => c.clave === k)?.cuenta;
    expect(cuenta('todo')).toBe(3);
    expect(cuenta('Política')).toBe(2);
    expect(cuenta('Justicia')).toBe(1);
    expect(cuenta('Elecciones')).toBe(1);
  });
});
