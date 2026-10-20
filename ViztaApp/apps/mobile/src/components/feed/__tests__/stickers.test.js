import { stickerDe, temaDe } from '../temas';

describe('stickerDe', () => {
  it('categorías nuevas del catálogo v2', () => {
    expect(temaDe('Clima y desastres')).toBe('Clima');
    expect(temaDe('Economía y costo de vida')).toBe('Economía');
    expect(stickerDe({ categoria_principal: 'Clima y desastres' })).toBe('clima');
    expect(stickerDe({ categoria_principal: 'Justicia' })).toBe('justicia');
  });
  it('violencia por subtipo', () => {
    const v = (subcategoria, extra) => stickerDe({ categoria_principal: 'Violencia', subcategoria, ...extra });
    expect(v('Homicidios')).toBe('violencia-homicidio');
    expect(v('Homicidios', { subtipo: 'Linchamiento' })).toBe('violencia-linchamiento');
    expect(v('Robos y asaltos', { subtipo: 'En transporte' })).toBe('violencia-transporte');
    expect(v('Violencia contra mujeres y niñez', { subtipo: 'Contra niñez' })).toBe('violencia-ninez');
    expect(v('Violencia contra mujeres y niñez', { subtipo: 'Intrafamiliar' })).toBe('violencia-intrafamiliar');
    expect(v('Uso de la fuerza por agentes del Estado')).toBe('violencia-estado');
    expect(v('Capturas y operativos')).toBe('violencia');
    expect(v(undefined)).toBe('violencia');
  });
});
