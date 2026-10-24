import React from 'react';
import { Linking, Pressable, Text, TextInput } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { supabase } from '../../../utils/supabase';
import { ListaIniciativas, Iniciativa, registroCompleto, resumenDe } from '../LegislativoCongreso';

jest.mock('../../../utils/supabase', () => ({ supabase: { from: jest.fn() } }));
jest.mock('../TarjetasCongreso', () => {
  const { Text } = require('react-native');
  return { Camino: ({ etapa }) => <Text>{etapa}</Text>, Titulo: Text, Rotulo: Text, RAYA: '#ddd', TINTA: '#234' };
});

const registro = Array.from({ length: 45 }, (_, i) => ({
  numero: 7000 - i, titulo: `Ley de prueba ${i}`, estado_actual: 'conocio_pleno',
  url_pdf: `https://congreso.gob.gt/${i}.pdf`, eventos_timeline: [],
}));
const notas = [{ id: 'n', iniciativa_numero: 6960, stage: 'dictamen', digest_date: '2026-10-24', summary: 'Resumen que explica los cambios de la propuesta.', url: 'https://congreso.gob.gt/nota' }];
let renderer, cliente;
const texto = () => JSON.stringify(renderer.toJSON());
const boton = (etiqueta) => renderer.root.findAll((n) => n.props.accessibilityLabel === etiqueta && typeof n.props.onPress === 'function')[0];
async function esperar() { await act(async () => { await new Promise((r) => setTimeout(r, 20)); }); }

beforeEach(() => {
  supabase.from.mockImplementation((tabla) => {
    const rows = tabla === 'iniciativas_app_view' ? registro : tabla === 'congreso_items_app_view' ? notas : [{ id: 's', titulo: 'Una propuesta anunciada', estado: 'anunciada', fuentes: [] }];
    const query = {
      select: () => query, order: () => query, not: () => query, is: () => query,
      range: jest.fn((a, b) => Promise.resolve({ data: rows.slice(a, b + 1), error: null })),
      limit: () => Promise.resolve({ data: rows, error: null }),
    };
    return query;
  });
  cliente = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
});
afterEach(() => { if (renderer) act(() => renderer.unmount()); renderer = null; cliente.clear(); jest.restoreAllMocks(); });

async function montar() {
  await act(async () => { renderer = TestRenderer.create(<QueryClientProvider client={cliente}><ListaIniciativas /></QueryClientProvider>); });
  await esperar();
}

test('cambia de página reemplazando las 20 cards y busca fuera de la página visible', async () => {
  await montar();
  expect(renderer.root.findAllByType(Iniciativa)).toHaveLength(20);
  expect(texto()).toContain('Ley de prueba 0');
  expect(texto()).not.toContain('Ley de prueba 40');
  act(() => boton('página 3').props.onPress());
  expect(renderer.root.findAllByType(Iniciativa)).toHaveLength(5);
  expect(texto()).not.toContain('Ley de prueba 0');
  expect(texto()).toContain('Ley de prueba 40');
  expect(boton('siguiente').props.disabled).toBe(true);
  act(() => renderer.root.findByType(TextInput).props.onChangeText('7000'));
  expect(renderer.root.findAllByType(Iniciativa)).toHaveLength(1);
  expect(texto()).toContain('Ley de prueba 0');
});

test('filtra por la etapa documentada en una nota y pliega las sin número', async () => {
  await montar();
  expect(texto()).not.toContain('Una propuesta anunciada');
  const plegable = renderer.root.findAll((n) => n.props.accessibilityState?.expanded === false && !n.props.accessibilityLabel && typeof n.props.onPress === 'function')[0];
  act(() => plegable.props.onPress());
  expect(texto()).toContain('Una propuesta anunciada');
  act(() => boton('dictamen, 1').props.onPress());
  expect(renderer.root.findAllByType(Iniciativa)).toHaveLength(1);
  expect(texto()).toContain('Ley de prueba 40');
  expect(texto()).toContain('Resumen que explica');
});

test('el PDF abre desde la card cerrada y muestra el error si falla', async () => {
  jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('falló'));
  act(() => { renderer = TestRenderer.create(<Iniciativa ini={registro[0]} />); });
  const link = boton('documento de la iniciativa, iniciativa 7000');
  expect(link).toBeDefined();
  await act(async () => { link.props.onPress(); });
  expect(Linking.openURL).toHaveBeenCalledWith(registro[0].url_pdf);
  expect(texto()).toContain('No se pudo abrir. Probá de nuevo.');
});

test('un resumen útil de la nota reemplaza al objetivo que repite el título', () => {
  const ini = { numero: 1, titulo: 'Protección del agua', eventos_timeline: [{ detalle: { objetivo: 'Protección del agua' } }] };
  expect(resumenDe(ini, new Map([['1', [{ summary: 'Protección del agua con nuevas obligaciones para las municipalidades.' }]]])))
    .toContain('obligaciones');
});

test('recorre más de un lote sin perder iniciativas', async () => {
  const filas = Array.from({ length: 512 }, (_, numero) => ({ numero }));
  const range = jest.fn((a, b) => Promise.resolve({ data: filas.slice(a, b + 1) }));
  const query = { select: () => query, order: () => query, range };
  supabase.from.mockReturnValue(query);
  expect(await registroCompleto('iniciativas_app_view', 'numero', 'numero')).toHaveLength(512);
  expect(range.mock.calls).toEqual([[0, 249], [250, 499], [500, 749]]);
});

test('un fallo de consulta se propaga en vez de devolver un registro incompleto', async () => {
  const query = { select: () => query, order: () => query, range: () => Promise.resolve({ error: new Error('sin conexión') }) };
  supabase.from.mockReturnValue(query);
  await expect(registroCompleto('x', 'numero', 'numero')).rejects.toThrow('sin conexión');
});
