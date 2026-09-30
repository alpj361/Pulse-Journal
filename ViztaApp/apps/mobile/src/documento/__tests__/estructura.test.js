import { aMarkdown, alinearClaves, clavesEnSerie, desdeMarkdown, fusionar, validar } from '../index.js';
import {
  aDocumento,
  abrirPagina,
  borrarBloques,
  copiarBloques,
  desdeDocumento,
  escribir,
  moverBloques,
  moverUnPaso,
  nuevaPagina,
  partir,
  ponerTipo,
  renombrarPagina,
  textoDe,
  volver,
} from '../editor/index.js';

const abrir = (md) => ({ estado: desdeDocumento(desdeMarkdown(md, { clave: clavesEnSerie('b') })), clave: clavesEnSerie('n') });
const md = (estado) => aMarkdown(aDocumento(estado));
const k = (estado, i) => estado.orden[i];

describe('páginas', () => {
  test('crear, escribir adentro, volver', () => {
    let { estado, clave } = abrir('intro\n');
    const r = nuevaPagina(estado, k(estado, 1), { clave });
    estado = r.estado;
    expect(r.foco.titulo).toBe(true);
    const pagina = estado.pagina;
    expect(pagina).not.toBe(estado.resto.paginas[0]._key);
    estado = renombrarPagina(estado, pagina, 'Capítulo 1').estado;
    estado = escribir(estado, k(estado, 0), 'adentro', { start: 0 }, { clave }).estado;
    // Visto desde la nota: el renglón vacío se volvió el bloque de la página.
    expect(md(estado)).toBe('intro\n# Capítulo 1\nadentro');
    const v = volver(estado);
    expect(v.estado.pagina).toBe(v.estado.resto.paginas[0]._key);
    expect(v.estado.porKey[v.foco.key]._type).toBe('pagina');
    expect(validar(aDocumento(v.estado)).ok).toBe(true);
    // Volver a entrar conserva lo escrito.
    const otra = abrirPagina(v.estado, pagina).estado;
    expect(textoDe(otra.porKey[k(otra, 0)].children)).toBe('adentro');
  });

  test('borrar el bloque de una página se lleva la página', () => {
    let { estado, clave } = abrir('a');
    estado = nuevaPagina(estado, k(estado, 0), { clave }).estado;
    estado = volver(estado).estado;
    expect(aDocumento(estado).paginas).toHaveLength(2);
    const bloque = estado.orden.find((x) => estado.porKey[x]._type === 'pagina');
    estado = borrarBloques(estado, [bloque], { clave }).estado;
    expect(aDocumento(estado).paginas).toHaveLength(1);
    expect(md(estado)).toBe('a');
  });

  test('en la nota no se puede volver más arriba', () => {
    const { estado } = abrir('a');
    expect(volver(estado).estado).toBe(estado);
  });
});

describe('selección de bloques', () => {
  test('subir y bajar de a uno', () => {
    const { estado } = abrir('a\nb\nc');
    expect(md(moverUnPaso(estado, [k(estado, 2)], -1).estado)).toBe('a\nc\nb');
    expect(md(moverUnPaso(estado, [k(estado, 0)], 1).estado)).toBe('b\na\nc');
    expect(moverUnPaso(estado, [k(estado, 0)], -1).estado).toBe(estado);
    expect(moverUnPaso(estado, [k(estado, 2)], 1).estado).toBe(estado);
  });

  test('mover varios a otro lugar', () => {
    const { estado } = abrir('a\nb\nc\nd');
    expect(md(moverBloques(estado, [k(estado, 0), k(estado, 1)], null).estado)).toBe('c\nd\na\nb');
    expect(md(moverBloques(estado, [k(estado, 3)], k(estado, 0)).estado)).toBe('d\na\nb\nc');
  });

  test('un toggle se mueve con sus hijos', () => {
    let { estado, clave } = abrir('t\nx');
    const t = k(estado, 0);
    estado = ponerTipo(estado, t, 'toggle').estado;
    estado = partir(estado, t, 1, 1, { clave }).estado;
    const hijo = estado.orden[1];
    estado = escribir(estado, hijo, 'h', { start: 0 }, { clave }).estado;
    expect(md(estado)).toBe('t\nh\nx');
    const movido = moverUnPaso(estado, [t], 1).estado;
    expect(md(movido)).toBe('x\nt\nh');
    expect(movido.padre[hijo]).toBe(t);
  });

  test('borrar todo deja un renglón', () => {
    const { estado, clave } = abrir('a\nb');
    const r = borrarBloques(estado, estado.orden, { clave });
    expect(r.estado.orden).toHaveLength(1);
    expect(md(r.estado)).toBe('');
  });

  test('copiar da markdown', () => {
    const { estado } = abrir('# T\n- a\n- b\nfin');
    expect(copiarBloques(estado, [k(estado, 1), k(estado, 2)])).toBe('- a\n- b');
  });
});

describe('fusión por bloque', () => {
  const tres = (md0) => {
    const base = desdeMarkdown(md0, { clave: clavesEnSerie('b') });
    const copia = () => JSON.parse(JSON.stringify(base));
    return { base, nuestro: copia(), suyo: copia() };
  };
  const txt = (doc, i) => textoDe(doc.paginas[0].bloques[i].children);
  const poner = (doc, i, t) => {
    doc.paginas[0].bloques[i].children = [{ _type: 'span', _key: `s${t}`, text: t, marks: [] }];
  };

  test('cada lado cambió un bloque distinto: quedan los dos cambios', () => {
    const { base, nuestro, suyo } = tres('a\nb\nc');
    poner(nuestro, 0, 'A');
    poner(suyo, 2, 'C');
    expect(aMarkdown(fusionar(base, nuestro, suyo))).toBe('A\nb\nC');
  });

  test('los dos cambiaron el mismo: gana el de acá', () => {
    const { base, nuestro, suyo } = tres('a\nb');
    poner(nuestro, 0, 'nuestro');
    poner(suyo, 0, 'suyo');
    expect(aMarkdown(fusionar(base, nuestro, suyo))).toBe('nuestro\nb');
  });

  test('lo que agregó el otro entra en su lugar; lo que borró, se va', () => {
    const { base, nuestro, suyo } = tres('a\nb\nc');
    suyo.paginas[0].bloques.splice(1, 0, desdeMarkdown('nuevo').paginas[0].bloques[0]);
    suyo.paginas[0].bloques.pop(); // borró «c»
    nuestro.paginas[0].bloques.push(desdeMarkdown('mío').paginas[0].bloques[0]);
    expect(aMarkdown(fusionar(base, nuestro, suyo))).toBe('a\nnuevo\nb\nmío');
  });

  test('borrado allá pero tocado acá: queda', () => {
    const { base, nuestro, suyo } = tres('a\nb');
    suyo.paginas[0].bloques.pop();
    poner(nuestro, 1, 'b tocado');
    expect(aMarkdown(fusionar(base, nuestro, suyo))).toBe('a\nb tocado');
  });

  test('la web solo cambió el markdown: se alinean las claves y se fusiona igual', () => {
    const { base, nuestro } = tres('uno\ndos\ntres');
    poner(nuestro, 0, 'UNO');
    const suyo = alinearClaves(base, desdeMarkdown('uno\ndos\ntres\ncuatro'));
    const r = fusionar(base, nuestro, suyo);
    expect(aMarkdown(r)).toBe('UNO\ndos\ntres\ncuatro');
    expect(validar(r).ok).toBe(true);
    expect(txt(r, 3)).toBe('cuatro');
  });
});
