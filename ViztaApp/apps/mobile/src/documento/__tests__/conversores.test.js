import {
  aGlobal,
  aLocal,
  aMarkdown,
  aTextoPlano,
  clavesEnSerie,
  crearDocumento,
  desdeMarkdown,
  validar,
} from '../index.js';

const bloques = (md) => desdeMarkdown(md, { clave: clavesEnSerie() }).paginas[0].bloques;
const idaYVuelta = (md) => aMarkdown(desdeMarkdown(md));

/** Una nota como las que escribe la gente y los modelos, con todo lo que se usa hoy. */
const NOTA = [
  '# Políticos',
  '',
  'Algo **importante** y algo _en cursiva_ con ==resaltado==.',
  'Segundo renglón del mismo párrafo.',
  '',
  '## Lista',
  '- uno',
  '  - uno punto uno',
  '- dos con `código`',
  '',
  '### Pasos',
  '1. Primero',
  '2. Segundo',
  '',
  '3. Tercero después de un blanco',
  '',
  '---',
  '',
  '> Una cita con **negrita**',
  '> ',
  '- [ ] pendiente',
  '- [x] hecho',
  '',
  '| Nombre | Partido |',
  '| --- | :---: |',
  '| Ana | **VOS** |',
  '',
  '```js',
  'const a = **b**;',
  '```',
  'Fin.',
].join('\n');

describe('desdeMarkdown', () => {
  test('un bloque por renglón y el blanco es un bloque vacío', () => {
    const b = bloques('a\n\nb');
    expect(b.map((x) => x.children.map((s) => s.text).join(''))).toEqual(['a', '', 'b']);
  });

  test('forma exacta de un documento chico', () => {
    expect(desdeMarkdown('## Hola\n- **a**', { clave: clavesEnSerie() })).toEqual({
      _type: 'vizta.doc',
      version: 1,
      paginas: [
        {
          _key: 'k5',
          titulo: '',
          bloques: [
            {
              _type: 'block',
              _key: 'k2',
              style: 'h2',
              children: [{ _type: 'span', _key: 'k1', text: 'Hola', marks: [] }],
              markDefs: [],
            },
            {
              _type: 'block',
              _key: 'k4',
              style: 'normal',
              listItem: 'bullet',
              level: 1,
              children: [{ _type: 'span', _key: 'k3', text: 'a', marks: ['strong'] }],
              markDefs: [],
            },
          ],
        },
      ],
    });
  });

  test('entiende todo lo que escriben las notas', () => {
    const b = bloques(NOTA);
    const tipos = b.map((x) => (x._type === 'block' ? `${x.style}${x.listItem ? `:${x.listItem}${x.level}` : ''}` : x._type));
    expect(tipos).toEqual([
      'h1',
      'normal',
      'normal',
      'normal',
      'normal',
      'h2',
      'normal:bullet1',
      'normal:bullet2',
      'normal:bullet1',
      'normal',
      'h3',
      'normal:number1',
      'normal:number1',
      'normal',
      'normal:number1',
      'normal',
      'separador',
      'normal',
      'cita',
      'cita',
      'todo',
      'todo',
      'normal',
      'tabla',
      'normal',
      'codigo',
      'normal',
    ]);
    const tabla = b.find((x) => x._type === 'tabla');
    expect(tabla).toMatchObject({
      encabezado: true,
      alineacion: [null, 'centro'],
      filas: [
        ['Nombre', 'Partido'],
        ['Ana', '**VOS**'],
      ],
    });
    expect(b.find((x) => x._type === 'codigo')).toMatchObject({ lenguaje: 'js', texto: 'const a = **b**;' });
    expect(b.filter((x) => x._type === 'todo').map((x) => x.hecho)).toEqual([false, true]);
  });

  test('guarda el número escrito solo cuando la cuenta no lo daría', () => {
    const b = bloques('1. Tema\nUn párrafo.\n2. Otro tema\n3. Y otro');
    const numeradas = b.filter((x) => x.listItem === 'number');
    expect(numeradas.map((x) => x.numero)).toEqual([undefined, 2, undefined]);
  });

  test('un código sin cerrar llega hasta el final', () => {
    const b = bloques('```\na\nb');
    expect(b).toHaveLength(1);
    expect(b[0]).toMatchObject({ _type: 'codigo', texto: 'a\nb' });
  });

  test('las claves no se repiten', () => {
    expect(validar(desdeMarkdown(NOTA)).ok).toBe(true);
  });
});

describe('aMarkdown', () => {
  test('la nota vuelve idéntica', () => {
    expect(idaYVuelta(NOTA)).toBe(NOTA);
  });

  test('lo vacío vuelve vacío', () => {
    expect(idaYVuelta('')).toBe('');
    expect(aMarkdown(null)).toBe('');
  });

  test('saltos al principio y al final se conservan', () => {
    expect(idaYVuelta('\nhola\n')).toBe('\nhola\n');
  });

  test('numeración cortada por un párrafo', () => {
    const md = '1. Tema\nUn párrafo.\n2. Otro tema\n3. Y otro';
    expect(idaYVuelta(md)).toBe(md);
  });

  test('los números escritos se respetan aunque no cuenten seguido', () => {
    // `markdown.js` muestra el número tal cual está escrito: si la nota dice
    // «1, 1, 1», así se ve hoy y así tiene que seguir.
    expect(idaYVuelta('1. a\n1. b\n1. c')).toBe('1. a\n1. b\n1. c');
  });

  test('sin número guardado, la lista se cuenta sola', () => {
    const doc = desdeMarkdown('1. a\n1. b');
    for (const b of doc.paginas[0].bloques) delete b.numero;
    expect(aMarkdown(doc)).toBe('1. a\n2. b');
  });

  test('normaliza la escritura sin cambiar el documento', () => {
    const casos = {
      '* viñeta': '- viñeta',
      '*cursiva*': '_cursiva_',
      '****': '---',
      '|a|b|\n|--|--|\n|1|2|': '| a | b |\n| --- | --- |\n| 1 | 2 |',
    };
    for (const [antes, despues] of Object.entries(casos)) {
      expect(idaYVuelta(antes)).toBe(despues);
      expect(idaYVuelta(despues)).toBe(despues);
    }
  });

  test('bloques propios', () => {
    const clave = clavesEnSerie('x');
    const doc = crearDocumento({ clave });
    doc.paginas.push({
      _key: 'p2',
      titulo: 'Capítulo 2',
      bloques: [{ _type: 'block', _key: 'q', style: 'normal', markDefs: [], children: [{ _type: 'span', _key: 'r', text: 'adentro', marks: [] }] }],
    });
    const span = (text) => [{ _type: 'span', _key: clave(), text, marks: [] }];
    doc.paginas[0].bloques = [
      { _type: 'toggle', _key: 'a', abierto: false, children: span('Detalles'), markDefs: [], bloques: [
        { _type: 'block', _key: 'b', style: 'normal', markDefs: [], children: span('oculto') },
      ] },
      { _type: 'formula', _key: 'c', latex: 'E=mc^2' },
      { _type: 'medio', _key: 'd', tipo: 'foto', storage_path: 'x.jpg' },
      { _type: 'dibujo', _key: 'e', ancho: 1, alto: 0.6, trazos: [] },
      { _type: 'separador', _key: 'f', estilo: 'puntos' },
      { _type: 'pagina', _key: 'g', pagina: 'p2' },
      { _type: 'block', _key: 'h', style: 'normal', listItem: 'bullet', level: 1, markDefs: [], children: span('uno\ndos') },
    ];
    expect(validar(doc)).toEqual({ ok: true, errores: [] });
    expect(aMarkdown(doc)).toBe(['Detalles', 'oculto', '$$E=mc^2$$', '---', '# Capítulo 2', 'adentro', '- uno', '  dos'].join('\n'));
  });

  test('una página que se incluye a sí misma no da vueltas', () => {
    const doc = crearDocumento({ clave: clavesEnSerie() });
    doc.paginas[0].bloques = [{ _type: 'pagina', _key: 'z', pagina: doc.paginas[0]._key }];
    expect(aMarkdown(doc)).toBe('');
  });
});

describe('aTextoPlano', () => {
  test('texto sin marcadores y mapa por bloque', () => {
    const doc = desdeMarkdown('# Hola **Ana**\n\n- con ==Luis==', { clave: clavesEnSerie() });
    const { texto, mapa } = aTextoPlano(doc);
    expect(texto).toBe('Hola Ana\n\ncon Luis');
    const [titulo, blanco, item] = doc.paginas[0].bloques;
    expect(mapa).toEqual([
      { key: titulo._key, desde: 0, hasta: 8 },
      { key: blanco._key, desde: 9, hasta: 9 },
      { key: item._key, desde: 10, hasta: 18 },
    ]);

    const luis = texto.indexOf('Luis');
    expect(aLocal(mapa, luis)).toEqual({ key: item._key, offset: 4 });
    expect(aGlobal(mapa, item._key, 4)).toBe(luis);
    expect(aLocal(mapa, 99)).toBeNull();
    expect(aGlobal(mapa, 'no-existe', 0)).toBe(-1);
  });

  test('las celdas de una tabla son renglones con su celda en el mapa', () => {
    const doc = desdeMarkdown('| Nombre |\n| --- |\n| **Ana** |');
    const { texto, mapa } = aTextoPlano(doc);
    expect(texto).toBe('Nombre\nAna');
    const tabla = doc.paginas[0].bloques[0]._key;
    expect(aLocal(mapa, 8)).toEqual({ key: tabla, offset: 1, celda: [1, 0] });
    expect(aGlobal(mapa, tabla, 0, [1, 0])).toBe(7);
  });

  test('el código no entra al rastreo', () => {
    expect(aTextoPlano(desdeMarkdown('a\n```\nAna\n```\nb')).texto).toBe('a\nb');
  });
});

describe('validar', () => {
  test('un documento vacío es válido', () => {
    expect(validar(crearDocumento()).ok).toBe(true);
  });

  test('junta todos los errores', () => {
    const doc = desdeMarkdown('a\nb', { clave: clavesEnSerie() });
    const [x, y] = doc.paginas[0].bloques;
    y._key = x._key;
    x.style = 'gigante';
    x.children[0].marks = ['h-verde'];
    doc.paginas[0].bloques.push({ _type: 'pagina', _key: 'zz', pagina: 'nada' }, { _type: 'raro', _key: 'yy' });
    const { ok, errores } = validar(doc);
    expect(ok).toBe(false);
    expect(errores.join('\n')).toMatch(/_key repetida/);
    expect(errores.join('\n')).toMatch(/estilo «gigante»/);
    expect(errores.join('\n')).toMatch(/marca «h-verde» sin definición/);
    expect(errores.join('\n')).toMatch(/página «nada» no existe/);
    expect(errores.join('\n')).toMatch(/tipo de bloque «raro»/);
  });

  test('no lanza con basura', () => {
    expect(validar(null).ok).toBe(false);
    expect(validar({ _type: 'vizta.doc', version: 2, paginas: [] }).errores).toHaveLength(2);
  });
});
