import { leerEnLinea, escribirEnLinea, textoDe } from '../enLinea.js';
import { clavesEnSerie } from '../esquema.js';

/** Los spans como pares [texto, marcas], sin claves, para leer las pruebas de un vistazo. */
const leer = (md) => {
  const { children, markDefs } = leerEnLinea(md, { clave: clavesEnSerie() });
  return { spans: children.map((s) => [s.text, s.marks]), markDefs };
};

const vuelta = (md) => {
  const { children, markDefs } = leerEnLinea(md);
  return escribirEnLinea(children, markDefs);
};

describe('leerEnLinea', () => {
  test('texto sin formato es un solo span', () => {
    expect(leer('Hola mundo').spans).toEqual([['Hola mundo', []]]);
  });

  test('un renglón vacío igual tiene un span', () => {
    expect(leer('').spans).toEqual([['', []]]);
  });

  test('negrita, cursiva con _ y con *, código', () => {
    expect(leer('a **b** _c_ *d* `e`').spans).toEqual([
      ['a ', []],
      ['b', ['strong']],
      [' ', []],
      ['c', ['em']],
      [' ', []],
      ['d', ['em']],
      [' ', []],
      ['e', ['code']],
    ]);
  });

  test('__ también es negrita, como en markdown.js', () => {
    expect(leer('__fuerte__').spans).toEqual([['fuerte', ['strong']]]);
  });

  test('==resaltado== usa la definición amarilla', () => {
    const { spans, markDefs } = leer('algo ==importante==');
    expect(spans).toEqual([
      ['algo ', []],
      ['importante', ['h-amarillo']],
    ]);
    expect(markDefs).toEqual([{ _key: 'h-amarillo', _type: 'resaltado', color: '#F5C842' }]);
  });

  test('cursiva dentro de negrita', () => {
    expect(leer('**a _b_ c**').spans).toEqual([
      ['a ', ['strong']],
      ['b', ['strong', 'em']],
      [' c', ['strong']],
    ]);
  });

  test('negrita que cierra pegada a una cursiva', () => {
    expect(leer('**a *b***').spans).toEqual([
      ['a ', ['strong']],
      ['b', ['strong', 'em']],
    ]);
  });

  test('dentro del código los asteriscos son texto', () => {
    expect(leer('`**no**`').spans).toEqual([['**no**', ['code']]]);
  });

  test('lo que no cierra queda como texto', () => {
    expect(leer('**suelto').spans).toEqual([['**suelto', []]]);
    expect(leer('***Los Donnovan. Por supuesto.').spans).toEqual([['***Los Donnovan. Por supuesto.', []]]);
  });

  test('una marca no abre contra un espacio', () => {
    expect(leer('3 * 4 * 5').spans).toEqual([['3 * 4 * 5', []]]);
  });

  test('los guiones bajos de un usuario no son cursiva', () => {
    expect(leer('Instagram @elenamotta._ / @elenamotta_').spans).toEqual([
      ['Instagram @elenamotta._ / @elenamotta_', []],
    ]);
    expect(leer('snake_case_name').spans).toEqual([['snake_case_name', []]]);
  });

  test('dentro de una URL no se busca formato', () => {
    expect(leer('ver https://x.com/a_b_c?q=*1* ya').spans).toEqual([['ver https://x.com/a_b_c?q=*1* ya', []]]);
  });

  test('[texto](enlace) es un link', () => {
    const { spans, markDefs } = leer('ver [la fuente](https://a.gt/x)');
    expect(spans).toEqual([
      ['ver ', []],
      ['la fuente', ['k1']],
    ]);
    expect(markDefs).toEqual([{ _key: 'k1', _type: 'link', href: 'https://a.gt/x' }]);
  });

  test('textoDe junta el texto visible', () => {
    expect(textoDe(leerEnLinea('a **b** ==c==').children)).toBe('a b c');
  });
});

describe('escribirEnLinea', () => {
  test('vuelve igual lo que ya está en la forma de la app', () => {
    for (const md of [
      'Hola',
      'a **b** _c_ `d` ==e==',
      '**a _b_ c**',
      '~~tachado~~ y [link](https://a.gt)',
      '**suelto',
      'Instagram @elenamotta._ / @elenamotta_',
      'https://x.com/a_b_c',
    ]) {
      expect(vuelta(md)).toBe(md);
    }
  });

  test('la cursiva sale con _', () => {
    expect(vuelta('*hola*')).toBe('_hola_');
  });

  test('pegada a una letra, la cursiva sale con *', () => {
    const md = escribirEnLinea([
      { _type: 'span', text: 'pala', marks: [] },
      { _type: 'span', text: 'bra', marks: ['em'] },
    ]);
    expect(md).toBe('pala*bra*');
    expect(leer(md).spans).toEqual([
      ['pala', []],
      ['bra', ['em']],
    ]);
  });

  test('los espacios de las puntas quedan afuera de la marca', () => {
    const md = escribirEnLinea([
      { _type: 'span', text: 'a', marks: [] },
      { _type: 'span', text: ' b ', marks: ['strong'] },
      { _type: 'span', text: 'c', marks: [] },
    ]);
    expect(md).toBe('a **b** c');
  });

  test('el código no deja abrir otras marcas adentro', () => {
    const md = escribirEnLinea([
      { _type: 'span', text: 'x', marks: ['code'] },
      { _type: 'span', text: 'y', marks: ['code', 'strong'] },
    ]);
    expect(md).toBe('`x`**`y`**');
  });

  test('el subrayado no tiene markdown y se omite', () => {
    expect(escribirEnLinea([{ _type: 'span', text: 'hola', marks: ['underline'] }])).toBe('hola');
  });

  test('marcas sin definición se ignoran', () => {
    expect(escribirEnLinea([{ _type: 'span', text: 'hola', marks: ['nada'] }])).toBe('hola');
  });
});
