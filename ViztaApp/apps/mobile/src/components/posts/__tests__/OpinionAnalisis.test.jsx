import React from 'react';
import { Text, TextInput } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import OpinionAnalisis from '../OpinionAnalisis';

jest.mock('../../../utils/supabase', () => ({
  supabase: { auth: { getSession: jest.fn(async () => ({ data: { session: { access_token: 'tk' } } })) } },
}));
jest.mock('../../../utils/servicios', () => ({ EXTRACTORW_URL: 'https://api.test' }));
jest.mock('../../../utils/analitica', () => ({ EV: { POST_OPINION: 'post_opinion' }, evento: jest.fn() }));
jest.mock('../../MorphingInfinity', () => () => null);

const POST = { id: 'p1', details: { analysis: { hechos: [] } } };

function respuesta(json, ok = true, status = 200) {
  return Promise.resolve({ ok, status, json: () => Promise.resolve(json) });
}

const porEtiqueta = (r, etiqueta) => r.root.findAll((n) => n.props.accessibilityLabel === etiqueta && typeof n.props.onPress === 'function')[0];
const cuerpoDe = (llamada) => JSON.parse(llamada[1].body);

beforeEach(() => {
  global.fetch = jest.fn(() => respuesta({ success: true, estado: 'recibido' }));
});

test('pulgar arriba manda el voto y queda marcado', async () => {
  let r;
  await act(async () => {
    r = TestRenderer.create(<OpinionAnalisis post={POST} />);
  });
  await act(async () => porEtiqueta(r, 'Me sirvió').props.onPress());
  expect(global.fetch).toHaveBeenCalledWith('https://api.test/api/analisis-post/feedback', expect.anything());
  expect(cuerpoDe(global.fetch.mock.calls[0])).toEqual({ postId: 'p1', voto: 'arriba', tipo: null, texto: '' });
  expect(porEtiqueta(r, 'Me sirvió').props.accessibilityState).toEqual({ selected: true });
});

test('pulgar abajo pregunta qué pasó; «se equivocó» manda la corrección y avisa que se corrige', async () => {
  global.fetch = jest.fn(() => respuesta({ success: true, estado: 'procesando' }));
  const onCorrigiendo = jest.fn();
  let r;
  await act(async () => {
    r = TestRenderer.create(<OpinionAnalisis post={POST} onCorrigiendo={onCorrigiendo} />);
  });
  await act(async () => porEtiqueta(r, 'No me sirvió').props.onPress());
  expect(r.root.findAllByType(Text).some((t) => t.props.children === '¿Qué pasó?')).toBe(true);
  await act(async () => r.root.findByType(TextInput).props.onChangeText('Es una escena de película, no su opinión'));
  await act(async () => porEtiqueta(r, 'corregir').props.onPress());
  expect(cuerpoDe(global.fetch.mock.calls[0])).toEqual({ postId: 'p1', voto: 'abajo', tipo: 'modelo', texto: 'Es una escena de película, no su opinión' });
  expect(onCorrigiendo).toHaveBeenCalled();
  expect(porEtiqueta(r, 'No me sirvió').props.accessibilityState).toEqual({ selected: true });
});

test('«le falta algo a Vizta» se manda como reporte, sin rehacer el análisis', async () => {
  const onCorrigiendo = jest.fn();
  let r;
  await act(async () => {
    r = TestRenderer.create(<OpinionAnalisis post={POST} onCorrigiendo={onCorrigiendo} />);
  });
  await act(async () => porEtiqueta(r, 'No me sirvió').props.onPress());
  const opcion = r.root.findAll((n) => n.props.accessibilityRole === 'radio' && typeof n.props.onPress === 'function')[1];
  await act(async () => opcion.props.onPress());
  await act(async () => r.root.findByType(TextInput).props.onChangeText('No entiende los memes'));
  await act(async () => porEtiqueta(r, 'enviar').props.onPress());
  expect(cuerpoDe(global.fetch.mock.calls[0])).toMatchObject({ voto: 'abajo', tipo: 'funcion', texto: 'No entiende los memes' });
  expect(onCorrigiendo).not.toHaveBeenCalled();
});

test('si el servidor no deja (tope de correcciones), se dice por qué y no se marca', async () => {
  global.fetch = jest.fn(() => respuesta({ success: false, code: 'tope_correcciones', message: 'Este post ya se corrigió varias veces hoy.' }, false, 429));
  let r;
  await act(async () => {
    r = TestRenderer.create(<OpinionAnalisis post={POST} />);
  });
  await act(async () => porEtiqueta(r, 'No me sirvió').props.onPress());
  await act(async () => r.root.findByType(TextInput).props.onChangeText('Sigue mal'));
  await act(async () => porEtiqueta(r, 'corregir').props.onPress());
  expect(r.root.findAllByType(Text).some((t) => t.props.children === 'Este post ya se corrigió varias veces hoy.')).toBe(true);
  expect(porEtiqueta(r, 'No me sirvió').props.accessibilityState).toEqual({ selected: false });
});
