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
    expect(temas.slice(0, 3)).toEqual(['Política', 'Justicia', 'Violencia']);
    expect(temas.at(-1)).toBe('Tecnología');
  });
});
