import { useState } from 'react';
import { TextInput } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { aMarkdown, desdeMarkdown } from '../../../../documento';
import EditorBloques from '../EditorBloques';
import { crearEditor } from '../store';
import { crearRastreo } from '../useRastreoBloques';
import useEditorDeNota from '../useEditorDeNota';

jest.mock('../../../../utils/supabase', () => ({
  supabase: {
    rpc: jest.fn(async () => ({ data: [], error: null })),
    auth: { getSession: async () => ({ data: { session: { user: { id: 'u' } } } }) },
    from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ in: async () => ({ data: [] }) }) }) }) }),
  },
}));
jest.mock('../../../../utils/haptics', () => ({ roce: jest.fn(), toque: jest.fn() }));
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));

const campos = (r) => r.root.findAllByType(TextInput);
const textoDe = (input) => {
  const hijos = [].concat(input.props.children || []);
  return hijos.map((h) => (typeof h === 'string' ? h : h?.props?.children || '')).join('');
};

describe('EditorBloques', () => {
  test('un campo por bloque, Enter parte y borrar al inicio une', () => {
    const editor = crearEditor(desdeMarkdown('# Hola\n- uno'));
    const rastreo = crearRastreo();
    let r;
    act(() => {
      r = TestRenderer.create(
        <EditorBloques editor={editor} rastreo={rastreo} indice={new Map()} escribiendo marcador="x" />,
      );
    });
    expect(campos(r)).toHaveLength(2);
    expect(textoDe(campos(r)[0])).toBe('Hola');

    const key = editor.getState().estado.orden[1];
    act(() => {
      campos(r)[1].props.onSelectionChange({ nativeEvent: { selection: { start: 3, end: 3 } } });
      campos(r)[1].props.onChangeText('uno dos');
    });
    expect(textoDe(campos(r)[1])).toBe('uno dos');
    expect(aMarkdown(editor.getState().documento())).toBe('# Hola\n- uno dos');

    act(() => {
      campos(r)[1].props.onSelectionChange({ nativeEvent: { selection: { start: 7, end: 7 } } });
      campos(r)[1].props.onSubmitEditing();
    });
    expect(campos(r)).toHaveLength(3);
    expect(aMarkdown(editor.getState().documento())).toBe('# Hola\n- uno dos\n- ');

    // Borrar al principio de la viñeta vacía: primero deja de ser viñeta,
    // después se une con la de arriba.
    act(() => {
      campos(r)[2].props.onSelectionChange({ nativeEvent: { selection: { start: 0, end: 0 } } });
      campos(r)[2].props.onKeyPress({ nativeEvent: { key: 'Backspace' } });
    });
    expect(aMarkdown(editor.getState().documento())).toBe('# Hola\n- uno dos\n');
    act(() => {
      campos(r)[2].props.onKeyPress({ nativeEvent: { key: 'Backspace' } });
    });
    expect(campos(r)).toHaveLength(2);
    expect(editor.getState().foco?.key ?? key).toBe(key);

    // Deshacer vuelve atrás de a un paso.
    act(() => editor.getState().deshacer());
    expect(campos(r)).toHaveLength(3);
  });

  test('leyendo no se puede escribir', () => {
    const editor = crearEditor(desdeMarkdown('hola'));
    let r;
    act(() => {
      r = TestRenderer.create(<EditorBloques editor={editor} rastreo={crearRastreo()} indice={new Map()} escribiendo={false} />);
    });
    expect(campos(r)[0].props.editable).toBe(false);
  });

  test('pinta el formato sin marcadores', () => {
    const editor = crearEditor(desdeMarkdown('a **b** ==c=='));
    let r;
    act(() => {
      r = TestRenderer.create(<EditorBloques editor={editor} rastreo={crearRastreo()} indice={new Map()} escribiendo />);
    });
    expect(textoDe(campos(r)[0])).toBe('a b c');
  });
});

describe('useEditorDeNota', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  // Uno solo para toda la prueba, como el de la hoja: un índice nuevo en cada
  // render sería un índice que cambia en cada render.
  const INDICE = new Map();

  function Hoja({ inicial, alListo }) {
    const [cuerpo, setCuerpo] = useState(inicial);
    const edicion = useEditorDeNota({ activo: true, cuerpo, setCuerpo, notaId: null, indice: INDICE });
    alListo({ cuerpo, setCuerpo, edicion });
    return null;
  }

  test('carga desde el cuerpo y le devuelve el markdown con una pausa', () => {
    let hoja;
    act(() => {
      TestRenderer.create(<Hoja inicial={'# Título\ntexto'} alListo={(h) => (hoja = h)} />);
    });
    const { editor } = hoja.edicion;
    expect(aMarkdown(editor.getState().documento())).toBe('# Título\ntexto');

    const key = editor.getState().estado.orden[1];
    act(() => {
      editor.getState().seleccionar(key, 5);
      editor.getState().escribir(key, 'texto nuevo');
    });
    // Todavía no: la hoja no se vuelve a pintar en cada tecla.
    expect(hoja.cuerpo).toBe('# Título\ntexto');
    act(() => jest.advanceTimersByTime(350));
    expect(hoja.cuerpo).toBe('# Título\ntexto nuevo');

    // Lo que devolvió el editor no lo recarga: el historial sigue ahí.
    expect(editor.getState().puedeDeshacer()).toBe(true);

    // Un cambio de afuera —otra nota, Vizta— sí lo recarga.
    act(() => hoja.setCuerpo('otra cosa'));
    expect(aMarkdown(editor.getState().documento())).toBe('otra cosa');
    expect(editor.getState().puedeDeshacer()).toBe(false);
  });

  test('prefiere el documento guardado si coincide con el texto', () => {
    let hoja;
    act(() => {
      TestRenderer.create(<Hoja inicial="" alListo={(h) => (hoja = h)} />);
    });
    const doc = desdeMarkdown('hola');
    doc.paginas[0].bloques[0].children[0].marks = ['underline'];
    act(() => {
      hoja.edicion.alAbrir({ id: 'n1', details: { documento: doc } });
      hoja.setCuerpo('hola');
    });
    // El subrayado no tiene markdown: si vino del documento, está.
    expect(hoja.edicion.editor.getState().documento().paginas[0].bloques[0].children[0].marks).toEqual(['underline']);

    // Si la base cambió el texto en otro lado, el documento quedó viejo.
    act(() => {
      hoja.edicion.alAbrir({ id: 'n2', details: { documento: doc } });
      hoja.setCuerpo('hola distinta');
    });
    expect(aMarkdown(hoja.edicion.editor.getState().documento())).toBe('hola distinta');
  });
});
