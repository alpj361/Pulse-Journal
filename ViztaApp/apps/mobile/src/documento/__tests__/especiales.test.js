import { aMarkdown, clavesEnSerie, desdeMarkdown, validar } from '../index.js';
import {
  aDocumento,
  actualizarMedio,
  agregarColumna,
  agregarFila,
  bloqueEspecial,
  desdeDocumento,
  editarBloque,
  editarCelda,
  escribir,
  firmaDeMedios,
  insertarBloque,
  mediosEnElTexto,
  quitarColumna,
  quitarFila,
  quitarMedio,
} from '../editor/index.js';

const abrir = (md) => ({ estado: desdeDocumento(desdeMarkdown(md, { clave: clavesEnSerie('b') })), clave: clavesEnSerie('n') });
const k = (estado, i) => estado.orden[i];

describe('bloques especiales', () => {
  test('un renglón vacío en el medio se vuelve el bloque; el último se deja', () => {
    let { estado, clave } = abrir('uno\n\ndos\n');
    const r = insertarBloque(estado, k(estado, 1), bloqueEspecial('tabla', clave));
    expect(r.foco.especial).toBe(true);
    expect(r.estado.orden.length).toBe(estado.orden.length);
    expect(r.estado.porKey[k(r.estado, 1)]._type).toBe('tabla');

    ({ estado, clave } = abrir('uno\n'));
    const fin = insertarBloque(estado, k(estado, 1), bloqueEspecial('separador', clave)).estado;
    expect(fin.orden.map((x) => fin.porKey[x]._type)).toEqual(['block', 'separador', 'block']);
    expect(validar(aDocumento(fin)).ok).toBe(true);
  });

  test('tabla: celdas, filas y columnas; nunca menos de una', () => {
    let { estado, clave } = abrir('uno');
    estado = insertarBloque(estado, k(estado, 0), bloqueEspecial('tabla', clave)).estado;
    const t = k(estado, 1);
    estado = editarCelda(estado, t, 0, 0, 'Nombre').estado;
    estado = agregarFila(estado, t).estado;
    estado = agregarColumna(estado, t).estado;
    expect(estado.porKey[t].filas).toEqual([
      ['Nombre', '', ''],
      ['', '', ''],
      ['', '', ''],
    ]);
    estado = quitarFila(estado, t, 1).estado;
    estado = quitarColumna(estado, t, 2).estado;
    expect(estado.porKey[t].filas).toEqual([
      ['Nombre', ''],
      ['', ''],
    ]);
    // La misma celda con el mismo texto no es un cambio.
    expect(editarCelda(estado, t, 0, 0, 'Nombre').estado).toBe(estado);
    expect(aMarkdown(aDocumento(estado))).toContain('| Nombre |');
  });

  test('editar un especial no toca los de texto', () => {
    const { estado, clave } = abrir('uno');
    const e = insertarBloque(estado, k(estado, 0), bloqueEspecial('codigo', clave)).estado;
    const c = k(e, 1);
    expect(editarBloque(e, c, { texto: 'x = 1', lenguaje: 'python' }).estado.porKey[c].texto).toBe('x = 1');
    expect(editarBloque(e, k(e, 0), { texto: 'no' }).estado).toBe(e);
  });

  test('medios: entran con ref, se quedan con la ruta, salen', () => {
    let { estado, clave } = abrir('uno\ndos');
    estado = insertarBloque(estado, k(estado, 0), bloqueEspecial('medio', clave, { tipo: 'foto', ref: 'sub-1' })).estado;
    expect(firmaDeMedios(estado)).toBe('sub-1');
    estado = actualizarMedio(estado, 'sub-1', { storage_path: 'u/foto.jpg' }).estado;
    const m = estado.porKey[k(estado, 1)];
    expect(m.ref).toBeUndefined();
    expect(m.storage_path).toBe('u/foto.jpg');
    expect([...mediosEnElTexto(aDocumento(estado))]).toEqual(['u/foto.jpg']);
    // Se reconoce por la ruta una vez subido.
    estado = quitarMedio(estado, 'u/foto.jpg').estado;
    expect(firmaDeMedios(estado)).toBe('');
    expect(aMarkdown(aDocumento(estado))).toBe('uno\ndos');
  });

  test('«```py » y «$$ » al empezar un renglón', () => {
    const { estado, clave } = abrir('uno\n');
    // El atajo se cierra con el espacio, tecleado después de lo demás.
    const tecleado = (antes) => escribir(estado, k(estado, 1), antes, { start: antes.length }, { clave }).estado;
    const r = escribir(tecleado('```py'), k(estado, 1), '```py ', { start: 6 }, { clave });
    expect(r.estado.porKey[r.foco.key]).toMatchObject({ _type: 'codigo', lenguaje: 'py' });
    const f = escribir(tecleado('$$'), k(estado, 1), '$$ ', { start: 3 }, { clave });
    expect(f.estado.porKey[f.foco.key]._type).toBe('formula');
  });
});
