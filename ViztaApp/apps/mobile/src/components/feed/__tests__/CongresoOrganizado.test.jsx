import React from 'react';
import { Text, TextInput } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { ActividadLista, Entrada } from '../CongresoOrganizado';

jest.mock('../../../utils/supabase', () => ({ supabase: {} }));
jest.mock('../../Sticker', () => () => null);
jest.mock('react-native-reanimated', () => ({
  __esModule: true, default: { View: require('react-native').View },
  Easing: { out: (v) => v, cubic: (v) => v }, useAnimatedStyle: (fn) => fn(), useSharedValue: (v) => ({ value: v }), withTiming: (v) => v,
}));
jest.mock('../TarjetasCongreso', () => {
  const { Text } = require('react-native');
  return { Titulo: Text, Rotulo: Text, Origen: () => null, RAYA: '#ddd', TINTA: '#234',
    cabezaDe: (i) => ({ titulo: i.titulo, resumen: i.summary }), rotuloDe: (i) => i.stage || null };
});
let renderer;
afterEach(() => { if (renderer) act(() => renderer.unmount()); });
const boton = (nombre) => renderer.root.findAll((n) => n.props.accessibilityLabel === nombre && typeof n.props.onPress === 'function')[0];
const texto = () => JSON.stringify(renderer.toJSON());

test('cada noticia permite leer el resumen y abrir el detalle por separado', () => {
  const onAbrir = jest.fn();
  const item = { id: 'n', titulo: 'Dictamen sobre alimentos', summary: 'La comisión emitió un dictamen con nuevas reglas. '.repeat(8), digest_date: '2026-10-24' };
  act(() => { renderer = TestRenderer.create(<Entrada item={item} onAbrir={onAbrir} />); });
  act(() => boton('leer resumen completo, Dictamen sobre alimentos').props.onPress());
  expect(boton('cerrar resumen, Dictamen sobre alimentos').props.accessibilityState.expanded).toBe(true);
  expect(onAbrir).not.toHaveBeenCalled();
  act(() => boton('abrir noticia, Dictamen sobre alimentos').props.onPress());
  expect(onAbrir).toHaveBeenCalledWith(item);
});

test('las noticias se buscan en toda la sección y la búsqueda reinicia la página', () => {
  const lista = Array.from({ length: 25 }, (_, i) => ({ id: String(i), titulo: i === 0 ? 'Tema especial' : `Tema ${i}`, summary: `Contenido de la publicación ${i}`, digest_date: '2026-10-24', comision_name: i % 2 ? 'Ambiente' : 'Finanzas' }));
  act(() => { renderer = TestRenderer.create(<ActividadLista lista={lista} clave="comisiones" onAbrir={() => {}} />); });
  expect(renderer.root.findAllByType(Entrada)).toHaveLength(20);
  act(() => boton('página 2').props.onPress());
  expect(renderer.root.findAllByType(Entrada)).toHaveLength(5);
  act(() => renderer.root.findByType(TextInput).props.onChangeText('especial'));
  expect(renderer.root.findAllByType(Entrada)).toHaveLength(1);
  expect(texto()).toContain('Tema especial');
  expect(boton('página 2')).toBeUndefined();
});

test('abre las otras noticias de un tema agrupado', () => {
  const primera = { id: 'a', titulo: 'Primera noticia', summary: 'Resumen de primera', digest_date: '2026-10-20' };
  const segunda = { id: 'b', titulo: 'Segunda noticia', summary: 'Resumen de segunda', digest_date: '2026-10-24' };
  const item = { ...segunda, _pasos: [{ fecha: primera.digest_date, item: primera }, { fecha: segunda.digest_date, item: segunda }] };
  const onAbrir = jest.fn();
  act(() => { renderer = TestRenderer.create(<Entrada item={item} onAbrir={onAbrir} />); });
  act(() => boton('noticias relacionadas, Segunda noticia').props.onPress());
  act(() => boton('abrir noticia relacionada, Primera noticia').props.onPress());
  expect(onAbrir).toHaveBeenCalledWith(primera);
});
