import { aMarkdown, clavesEnSerie, desdeMarkdown, validar } from '../index.js';
import { aDocumento, desdeDocumento, escribir, marcar, ponerTipo, tipoDe } from '../editor/index.js';

const abrir = (md) => ({ estado: desdeDocumento(desdeMarkdown(md, { clave: clavesEnSerie('b') })), clave: clavesEnSerie('n') });
const k = (e, i = 0) => e.orden[i];
const marcasDe = (e, i = 0) => e.porKey[k(e, i)].children.map((s) => [s.text, s.marks]);

describe('resaltado con color', () => {
  test('un tramo tiene un solo color; el mismo color lo apaga', () => {
    let { estado, clave } = abrir('hola mundo');
    estado = marcar(estado, k(estado), 0, 4, 'resaltado', { clave }).estado;
    estado = marcar(estado, k(estado), 0, 4, 'resaltado:verde', { clave }).estado;
    expect(marcasDe(estado)[0]).toEqual(['hola', ['h-verde']]);
    expect(estado.porKey[k(estado)].markDefs.map((d) => d._key)).toEqual(['h-verde']);
    expect(validar(aDocumento(estado)).ok).toBe(true);
    // En markdown todos los colores son ==.
    expect(aMarkdown(aDocumento(estado))).toBe('==hola== mundo');

    const otra = marcar(estado, k(estado), 0, 4, 'resaltado:verde', { clave }).estado;
    expect(marcasDe(otra)[0]).toEqual(['hola mundo', []]);
  });

  test('sin color saca cualquiera, y deja las demás marcas', () => {
    let { estado, clave } = abrir('**hola** mundo');
    estado = marcar(estado, k(estado), 0, 10, 'resaltado:rosa', { clave }).estado;
    estado = marcar(estado, k(estado), 0, 10, 'resaltado:ninguno', { clave }).estado;
    expect(marcasDe(estado)).toEqual([
      ['hola', ['strong']],
      [' mundo', []],
    ]);
    expect(estado.porKey[k(estado)].markDefs).toEqual([]);
  });

  test('en blanco queda pendiente con su color', () => {
    let { estado, clave } = abrir('a ');
    const r = marcar(estado, k(estado), 2, 2, 'resaltado:azul', { clave });
    expect(r.estado.pendiente.agregar).toEqual(['h-azul']);
    estado = escribir(r.estado, k(estado), 'a x', { start: 2 }, { clave }).estado;
    const b = estado.porKey[k(estado)];
    expect(b.children.at(-1)).toMatchObject({ text: 'x', marks: ['h-azul'] });
    expect(b.markDefs.map((d) => d._key)).toEqual(['h-azul']);
  });
});

describe('estilo Bloque', () => {
  test('es un estilo del renglón y se apaga igual que los otros', () => {
    const { estado } = abrir('un dato');
    const e = ponerTipo(estado, k(estado), 'tarjeta').estado;
    expect(tipoDe(e.porKey[k(e)])).toBe('tarjeta');
    expect(validar(aDocumento(e)).ok).toBe(true);
    // En markdown se lee como párrafo (el estilo vive en el documento).
    expect(aMarkdown(aDocumento(e))).toBe('un dato');
    expect(tipoDe(ponerTipo(e, k(e), 'tarjeta').estado.porKey[k(e)])).toBe('normal');
  });
});
