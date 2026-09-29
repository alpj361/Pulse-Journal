import { desdeMarkdown } from '../../../../documento';
import { aDocumento } from '../../../../documento/editor';
import { validar } from '../../../../documento/esquema';
import { crearEditor } from '../store';
import { columnasYFilas, textoDeCelda } from '../datasheets';

jest.mock('../../../../utils/supabase', () => ({ supabase: { rpc: jest.fn() } }));

describe('datasheet', () => {
  test('de tabla a dataset: columnas únicas, filas vacías fuera', () => {
    const r = columnasYFilas([
      ['Nombre', '', 'Nombre'],
      ['Ana', 'x', ''],
      ['', '', ''],
      ['Luis'],
    ]);
    expect(r.columnas).toEqual(['Nombre', 'Columna 2', 'Nombre 2']);
    expect(r.filas).toEqual([
      ['Ana', 'x', ''],
      ['Luis', '', ''],
    ]);
    expect(columnasYFilas([['a', 'b']], { encabezado: false }).columnas).toEqual(['Columna 1', 'Columna 2']);
  });

  test('valores de celda como texto', () => {
    expect(textoDeCelda(null)).toBe('');
    expect(textoDeCelda(3.5)).toBe('3.5');
    expect(textoDeCelda(true)).toBe('true');
  });

  test('insertar, conectar y convertir una tabla sin cambiar su clave', () => {
    const editor = crearEditor(desdeMarkdown('uno\n\n| a | b |\n| --- | --- |\n| 1 | 2 |'));
    const { estado } = editor.getState();
    const tabla = estado.orden.find((k) => estado.porKey[k]._type === 'tabla');
    editor.getState().conectarDataset(tabla, 'ds-1', 'Cifras');
    const b = editor.getState().estado.porKey[tabla];
    expect(b).toMatchObject({ _type: 'datasheet', _key: tabla, dataset_id: 'ds-1', nombre: 'Cifras' });
    expect(b.filas).toBeUndefined();

    editor.getState().seleccionar(editor.getState().estado.orden[0], 3);
    editor.getState().formatear('datasheet');
    const nuevo = editor.getState().estado.orden.find((k) => {
      const x = editor.getState().estado.porKey[k];
      return x._type === 'datasheet' && !x.dataset_id;
    });
    expect(nuevo).toBeTruthy();
    expect(validar(aDocumento(editor.getState().estado)).ok).toBe(true);
    // Deshacer vuelve a la tabla simple.
    editor.getState().deshacer();
    editor.getState().deshacer();
    expect(editor.getState().estado.porKey[tabla]._type).toBe('tabla');
  });
});
