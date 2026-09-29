import { aMarkdown, clavesEnSerie, desdeMarkdown, validar } from '../index.js';
import {
  aDocumento,
  alternarAbierto,
  alternarHecho,
  borrarAlInicio,
  crearHistorial,
  desdeDocumento,
  diferencia,
  escribir,
  marcar,
  partir,
  pegar,
  ponerTipo,
  reemplazarRango,
  sangrar,
  textoDe,
  tipoDe,
  visible,
} from '../editor/index.js';

const abrir = (md) => {
  const clave = clavesEnSerie('b');
  return { estado: desdeDocumento(desdeMarkdown(md, { clave })), clave: clavesEnSerie('n') };
};
const md = (estado) => aMarkdown(aDocumento(estado));
const k = (estado, i) => estado.orden[i];
const texto = (estado, i) => textoDe(estado.porKey[k(estado, i)].children);

describe('diferencia', () => {
  test('una letra al final', () => {
    expect(diferencia('hola', 'holas')).toEqual({ desde: 4, hasta: 4, insertado: 's' });
  });
  test('el cursor desempata letras repetidas', () => {
    expect(diferencia('aa', 'aaa', 1)).toEqual({ desde: 1, hasta: 1, insertado: 'a' });
  });
  test('borrar y reemplazar', () => {
    expect(diferencia('hola mundo', 'hola')).toEqual({ desde: 4, hasta: 10, insertado: '' });
    expect(diferencia('teh gato', 'the gato', 3)).toEqual({ desde: 1, hasta: 3, insertado: 'he' });
  });
});

describe('estado plano', () => {
  test('ida y vuelta sin tocar nada', () => {
    const nota = '# Título\n- uno\n  - dos\n1. tres\n\n> cita\n| a |\n| --- |\n| 1 |';
    const { estado } = abrir(nota);
    expect(md(estado)).toBe(nota);
    expect(validar(aDocumento(estado)).ok).toBe(true);
  });

  test('un toggle se aplana y se vuelve a anidar', () => {
    const doc = desdeMarkdown('Detalles\nadentro\nafuera', { clave: clavesEnSerie() });
    const [t, h, a] = doc.paginas[0].bloques;
    doc.paginas[0].bloques = [{ ...t, _type: 'toggle', abierto: false, bloques: [h] }, a];
    delete doc.paginas[0].bloques[0].style;
    const estado = desdeDocumento(doc);
    expect(estado.orden).toEqual([t._key, h._key, a._key]);
    expect(estado.padre[h._key]).toBe(t._key);
    expect(visible(estado, h._key)).toBe(false);
    const vuelta = aDocumento(estado);
    expect(vuelta.paginas[0].bloques[0].bloques.map((b) => b._key)).toEqual([h._key]);
    expect(validar(vuelta).ok).toBe(true);
  });
});

describe('escribir', () => {
  test('una letra hereda el formato de la de antes', () => {
    const { estado, clave } = abrir('hola **mundo**');
    const r = escribir(estado, k(estado, 0), 'hola mundos', { start: 10 }, { clave });
    expect(md(r.estado)).toBe('hola **mundos**');
    expect(r.foco).toBeNull();
  });

  test('no toca el estado anterior', () => {
    const { estado, clave } = abrir('hola');
    const antes = estado.porKey[k(estado, 0)];
    const r = escribir(estado, k(estado, 0), 'holas', { start: 4 }, { clave });
    expect(estado.porKey[k(estado, 0)]).toBe(antes);
    expect(textoDe(antes.children)).toBe('hola');
    // Los otros bloques siguen siendo los mismos objetos.
    expect(r.estado.porKey).not.toBe(estado.porKey);
  });

  test('sin cambio devuelve el mismo estado', () => {
    const { estado } = abrir('hola');
    expect(escribir(estado, k(estado, 0), 'hola', null).estado).toBe(estado);
  });

  test.each([
    ['# ', 'h1', '# x'],
    ['## ', 'h2', '## x'],
    ['- ', 'bullet', '- x'],
    ['* ', 'bullet', '- x'],
    ['1. ', 'number', '1. x'],
    ['[] ', 'todo', '- [ ] x'],
    ['[x] ', 'todo', '- [x] x'],
    ['> ', 'cita', '> x'],
    ['>> ', 'toggle', 'x'],
  ])('atajo «%s» → %s', (escrito, tipo, esperado) => {
    let { estado, clave } = abrir('');
    const key = k(estado, 0);
    const antes = escrito.slice(0, -1);
    estado = escribir(estado, key, antes, { start: 0 }, { clave }).estado;
    const r = escribir(estado, key, escrito, { start: antes.length }, { clave });
    expect(tipoDe(r.estado.porKey[key])).toBe(tipo);
    expect(r.foco).toEqual({ key, pos: 0 });
    const conTexto = escribir(r.estado, key, 'x', { start: 0 }, { clave }).estado;
    expect(md(conTexto)).toBe(esperado);
  });

  test('un atajo en medio del renglón es texto', () => {
    const { estado, clave } = abrir('hola -');
    const r = escribir(estado, k(estado, 0), 'hola - ', { start: 6 }, { clave });
    expect(tipoDe(r.estado.porKey[k(estado, 0)])).toBe('normal');
  });

  test('pegar markdown en un renglón da formato', () => {
    const { estado, clave } = abrir('a ');
    const r = escribir(estado, k(estado, 0), 'a **b** c', { start: 2 }, { clave });
    expect(md(r.estado)).toBe('a **b** c');
    expect(texto(r.estado, 0)).toBe('a b c');
  });

  test('un salto de renglón parte el bloque', () => {
    const { estado, clave } = abrir('holamundo');
    const r = escribir(estado, k(estado, 0), 'hola\nmundo', { start: 4 }, { clave });
    expect(md(r.estado)).toBe('hola\nmundo');
    expect(r.foco).toEqual({ key: k(r.estado, 1), pos: 0 });
  });
});

describe('partir (Enter)', () => {
  test('en medio de un párrafo', () => {
    const { estado, clave } = abrir('hola **mun**do');
    const r = partir(estado, k(estado, 0), 7, 7, { clave });
    expect(md(r.estado)).toBe('hola **mu**\n**n**do');
  });

  test('una viñeta sigue siendo viñeta; un título sigue como párrafo', () => {
    let { estado, clave } = abrir('- uno');
    expect(md(partir(estado, k(estado, 0), 5, 5, { clave }).estado)).toBe('- uno\n- ');
    ({ estado, clave } = abrir('# Título'));
    expect(md(partir(estado, k(estado, 0), 6, 6, { clave }).estado)).toBe('# Título\n');
  });

  test('en una viñeta vacía se sale de la lista', () => {
    const { estado, clave } = abrir('- uno\n- ');
    const r = partir(estado, k(estado, 1), 0, 0, { clave });
    expect(md(r.estado)).toBe('- uno\n');
  });

  test('en una viñeta sangrada vacía, primero sube un nivel', () => {
    const { estado, clave } = abrir('- uno\n  - ');
    const r = partir(estado, k(estado, 1), 0, 0, { clave });
    expect(md(r.estado)).toBe('- uno\n- ');
  });

  test('al principio de un título abre un renglón arriba', () => {
    const { estado, clave } = abrir('# Título');
    const r = partir(estado, k(estado, 0), 0, 0, { clave });
    expect(md(r.estado)).toBe('\n# Título');
    expect(r.foco).toEqual({ key: k(estado, 0), pos: 0 });
  });

  test('con texto seleccionado lo borra y parte', () => {
    const { estado, clave } = abrir('hola mundo');
    expect(md(partir(estado, k(estado, 0), 4, 5, { clave }).estado)).toBe('hola\nmundo');
  });

  test('un to-do nuevo sale sin marcar', () => {
    const { estado, clave } = abrir('- [x] listo');
    expect(md(partir(estado, k(estado, 0), 5, 5, { clave }).estado)).toBe('- [x] listo\n- [ ] ');
  });
});

describe('borrar al inicio', () => {
  test('primero le quita el formato al bloque', () => {
    const { estado } = abrir('uno\n# dos');
    const r = borrarAlInicio(estado, k(estado, 1));
    expect(md(r.estado)).toBe('uno\ndos');
  });

  test('después lo une con el de arriba, con su formato', () => {
    const { estado, clave } = abrir('uno\n**dos**');
    const r = borrarAlInicio(estado, k(estado, 1), { clave });
    expect(md(r.estado)).toBe('uno**dos**');
    expect(r.foco).toEqual({ key: k(estado, 0), pos: 3 });
  });

  test('una viñeta sangrada sube un nivel', () => {
    const { estado } = abrir('- a\n  - b');
    expect(md(borrarAlInicio(estado, k(estado, 1)).estado)).toBe('- a\n- b');
  });

  test('el primer bloque no se une con nada', () => {
    const { estado } = abrir('hola');
    expect(borrarAlInicio(estado, k(estado, 0)).estado).toBe(estado);
  });

  test('un separador de arriba se borra', () => {
    const { estado } = abrir('a\n---\nb');
    expect(md(borrarAlInicio(estado, k(estado, 2)).estado)).toBe('a\nb');
  });

  test('una tabla de arriba no se borra', () => {
    const { estado } = abrir('| a |\nb');
    expect(borrarAlInicio(estado, k(estado, 1)).estado).toBe(estado);
  });
});

describe('pegar varios renglones', () => {
  test('en medio de un párrafo', () => {
    const { estado, clave } = abrir('antes después');
    const r = pegar(estado, k(estado, 0), 6, 6, 'uno\n# dos\ntres', { clave });
    expect(md(r.estado)).toBe('antes uno\n# dos\ntresdespués');
    expect(r.foco.pos).toBe(4);
  });

  test('en un renglón vacío toma el tipo de lo pegado', () => {
    const { estado, clave } = abrir('');
    const r = pegar(estado, k(estado, 0), 0, 0, '- a\n- b', { clave });
    expect(md(r.estado)).toBe('- a\n- b');
  });

  test('una tabla pegada queda como bloque', () => {
    const { estado, clave } = abrir('x');
    const r = pegar(estado, k(estado, 0), 1, 1, '\n| a |\n| --- |\n| 1 |', { clave });
    expect(md(r.estado)).toBe('x\n| a |\n| --- |\n| 1 |\n');
  });
});

describe('formato', () => {
  test('negrita sobre lo seleccionado, y otra vez la quita', () => {
    const { estado, clave } = abrir('hola mundo');
    const r = marcar(estado, k(estado, 0), 5, 10, 'negrita', { clave });
    expect(md(r.estado)).toBe('hola **mundo**');
    expect(md(marcar(r.estado, k(estado, 0), 5, 10, 'negrita', { clave }).estado)).toBe('hola mundo');
  });

  test('parado en una palabra se aplica a la palabra', () => {
    const { estado, clave } = abrir('hola mundo');
    expect(md(marcar(estado, k(estado, 0), 7, 7, 'resaltado', { clave }).estado)).toBe('hola ==mundo==');
  });

  test('en blanco queda pendiente para lo que se escriba', () => {
    const { estado, clave } = abrir('hola ');
    const key = k(estado, 0);
    const r = marcar(estado, key, 5, 5, 'cursiva', { clave });
    expect(r.estado.pendiente).toEqual({ key, pos: 5, agregar: ['em'], quitar: [] });
    const e = escribir(r.estado, key, 'hola x', { start: 5 }, { clave }).estado;
    expect(md(e)).toBe('hola _x_');
    expect(e.pendiente).toBeNull();
  });

  test('cambiar el tipo prende y apaga', () => {
    const { estado } = abrir('hola');
    const r = ponerTipo(estado, k(estado, 0), 'h2');
    expect(md(r.estado)).toBe('## hola');
    expect(md(ponerTipo(r.estado, k(estado, 0), 'h2').estado)).toBe('hola');
  });

  test('un toggle que deja de serlo no pierde a sus hijos', () => {
    let { estado, clave } = abrir('título');
    const t = k(estado, 0);
    estado = ponerTipo(estado, t, 'toggle').estado;
    estado = partir(estado, t, 6, 6, { clave }).estado;
    const hijo = k(estado, 1);
    expect(estado.padre[hijo]).toBe(t);
    estado = escribir(estado, hijo, 'adentro', { start: 0 }, { clave }).estado;
    estado = ponerTipo(estado, t, 'toggle').estado;
    expect(estado.padre[hijo]).toBeNull();
    expect(md(estado)).toBe('título\nadentro');
  });

  test('sangrar, to-do y toggle', () => {
    let { estado } = abrir('- a\n- [ ] b');
    estado = sangrar(estado, k(estado, 0), 1).estado;
    estado = alternarHecho(estado, k(estado, 1)).estado;
    expect(md(estado)).toBe('  - a\n- [x] b');
    expect(sangrar(estado, k(estado, 0), -5).estado.porKey[k(estado, 0)].level).toBe(1);
    const t = ponerTipo(estado, k(estado, 0), 'toggle').estado;
    expect(t.porKey[k(estado, 0)].abierto).toBe(true);
    expect(alternarAbierto(t, k(estado, 0)).estado.porKey[k(estado, 0)].abierto).toBe(false);
  });

  test('reemplazar un rango deja el cursor al final de lo nuevo', () => {
    const { estado, clave } = abrir('con bern');
    const r = reemplazarRango(estado, k(estado, 0), 4, 8, 'Bernardo Arévalo ', { clave });
    expect(texto(r.estado, 0)).toBe('con Bernardo Arévalo ');
    expect(r.foco).toEqual({ key: k(estado, 0), pos: 21 });
  });
});

describe('historial', () => {
  test('agrupa las teclas seguidas y deshace de a frases', () => {
    let ahora = 0;
    const h = crearHistorial({ reloj: () => ahora });
    const { estado, clave } = abrir('');
    const key = k(estado, 0);
    let e = estado;
    for (const t of ['h', 'ho', 'hol', 'hola']) {
      const sig = escribir(e, key, t, { start: t.length - 1 }, { clave }).estado;
      h.anotar({ antes: e, despues: sig, tipo: 'escribir', key });
      e = sig;
      ahora += 100;
    }
    ahora += 1000;
    const sig = escribir(e, key, 'hola!', { start: 4 }, { clave }).estado;
    h.anotar({ antes: e, despues: sig, tipo: 'escribir', key });

    expect(textoDe(h.deshacer().estado.porKey[key].children)).toBe('hola');
    expect(textoDe(h.deshacer().estado.porKey[key].children)).toBe('');
    expect(h.deshacer()).toBeNull();
    expect(textoDe(h.rehacer().estado.porKey[key].children)).toBe('hola');
  });

  test('Enter es un paso propio', () => {
    const h = crearHistorial({ reloj: () => 0 });
    const { estado, clave } = abrir('ab');
    const key = k(estado, 0);
    const e1 = escribir(estado, key, 'abc', { start: 2 }, { clave }).estado;
    h.anotar({ antes: estado, despues: e1, tipo: 'escribir', key });
    const e2 = partir(e1, key, 3, 3, { clave }).estado;
    h.anotar({ antes: e1, despues: e2, tipo: 'partir', key });
    expect(h.deshacer().estado).toBe(e1);
    expect(h.deshacer().estado).toBe(estado);
  });
});
