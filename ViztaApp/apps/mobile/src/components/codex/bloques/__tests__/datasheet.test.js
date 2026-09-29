import { desdeMarkdown, fusionar } from '../../../../documento';
import { aDocumento } from '../../../../documento/editor';
import { validar } from '../../../../documento/esquema';
import { crearEditor } from '../store';
import { columnasYFilas, textoDeCelda } from '../datasheets';
import { columnaTitulo, tituloDeFila } from '../HistoriaDatasheet';

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

  test('la historia como datasheet va en el documento y se puede deshacer', () => {
    const editor = crearEditor(desdeMarkdown('texto de la historia'));
    editor.getState().historiaComoDatasheet({ dataset_id: 'ds-9', nombre: 'Casos' });
    const doc = aDocumento(editor.getState().estado);
    expect(doc.datasheet).toEqual({ dataset_id: 'ds-9', nombre: 'Casos' });
    expect(validar(doc).ok).toBe(true);
    // Lo escrito como texto se conserva.
    expect(doc.paginas[0].bloques).toHaveLength(1);
    editor.getState().historiaComoDatasheet(null);
    expect(aDocumento(editor.getState().estado).datasheet).toBeUndefined();
    editor.getState().deshacer();
    expect(aDocumento(editor.getState().estado).datasheet?.dataset_id).toBe('ds-9');
    expect(validar({ ...doc, datasheet: { nombre: 'x' } }).ok).toBe(false);
  });

  test('fusión: el modo lo gana quien lo cambió', () => {
    const base = desdeMarkdown('uno');
    const suyo = { ...base, datasheet: { dataset_id: 'ds-1' } };
    expect(fusionar(base, base, suyo).datasheet).toEqual({ dataset_id: 'ds-1' });
    const nuestro = { ...base, datasheet: { dataset_id: 'ds-2' } };
    expect(fusionar(base, nuestro, suyo).datasheet).toEqual({ dataset_id: 'ds-2' });
    expect(fusionar(suyo, base, suyo).datasheet).toBeUndefined();
  });

  test('título de cada entrada', () => {
    const datos = { columnas: ['Nombre', 'Cargo'] };
    expect(columnaTitulo(datos, 'Cargo')).toBe('Cargo');
    expect(columnaTitulo(datos, 'Otra')).toBe('Nombre');
    expect(tituloDeFila({ valores: { Nombre: ' Ana ' } }, 'Nombre', 0)).toBe('Ana');
    expect(tituloDeFila({ valores: {} }, 'Nombre', 2)).toBe('Fila 3');
  });
});
