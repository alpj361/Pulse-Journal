import React from 'react';
import { Linking, Pressable, Text, TextInput } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { supabase } from '../../../utils/supabase';
import { ListaIniciativas, ListaLeyes, ListaVotaciones, Iniciativa, registroCompleto, resumenDe } from '../LegislativoCongreso';

jest.mock('../../../utils/supabase', () => ({ supabase: { from: jest.fn() } }));
jest.mock('../TarjetasCongreso', () => {
  const { Text } = require('react-native');
  return { VotacionCongreso: ({ votacion }) => <Text>{votacion.asunto}</Text>, Camino: ({ etapa }) => <Text>{etapa}</Text>, Titulo: Text, Rotulo: Text, RAYA: '#ddd', TINTA: '#234' };
});

const registro = Array.from({ length: 45 }, (_, i) => ({
  numero: 7000 - i, titulo: `Ley de prueba ${i}`, estado_actual: 'conocio_pleno',
  url_pdf: `https://congreso.gob.gt/${i}.pdf`, eventos_timeline: [],
}));
const decretos = Array.from({ length: 83 }, (_, i) => ({ numero: `${83 - i}-${i < 23 ? 2026 : i < 53 ? 2025 : 2024}`, fecha: `${i < 23 ? 2026 : i < 53 ? 2025 : 2024}-09-01`, resumen: `Ley de prueba ${i}`, pdf_url: i < 3 ? null : `https://congreso.gob.gt/${i}.pdf` }));
const votaciones = Array.from({ length: 82 }, (_, i) => ({ id: String(i).padStart(3, '0'), fecha: i < 2 ? '2026-10-22' : '2026-09-08', asunto: `Votación sobre asunto ${i}`, resultado: i < 54 ? 'aprobada' : 'no_aprobada' }));
const notas = [{ id: 'n', iniciativa_numero: 6960, stage: 'dictamen', digest_date: '2026-10-24', summary: 'Resumen que explica los cambios de prueba de la propuesta.', url: 'https://congreso.gob.gt/nota' }];
let renderer, cliente;
const texto = () => JSON.stringify(renderer.toJSON());
const boton = (etiqueta) => renderer.root.findAll((n) => n.props.accessibilityLabel === etiqueta && typeof n.props.onPress === 'function')[0];
async function esperar() { await act(async () => { await new Promise((r) => setTimeout(r, 20)); }); }

beforeEach(() => {
  supabase.from.mockImplementation((tabla) => {
    const rows = tabla === 'iniciativas_app_view' ? registro : tabla === 'congreso_items_app_view' ? notas : tabla === 'pc_congreso_decretos_view' ? decretos : tabla === 'votaciones' ? votaciones : [{ id: 's', titulo: 'Una propuesta anunciada', estado: 'anunciada', fuentes: [] }];
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
  expect(texto()).toContain('No se pudo abrir. Prueba de nuevo.');
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


test('prefiere el resumen de la noticia y conserva el objetivo como respaldo', () => {
  const ini = { numero: 1, titulo: 'Ley del agua', eventos_timeline: [{ detalle: { objetivo: 'Establecer reglas para las municipalidades.' } }] };
  const notas = new Map([['1', [{ summary: 'La propuesta protege las fuentes de agua y modifica las obligaciones municipales.' }]]]);
  expect(resumenDe(ini, notas)).toBe(notas.get('1')[0].summary);
  expect(resumenDe(ini, new Map())).toBe('Establecer reglas para las municipalidades.');
});


test('omite el resumen semanal y elige la noticia del río Pinula', () => {
  const ini = { numero: 6863, titulo: 'Ley de Mitigación de Riesgos del Río Pinula' };
  const especifica = 'La iniciativa 6863 mitiga los riesgos del río Pinula y asigna recursos a familias afectadas.';
  const notas = new Map([['6863', [
    { titulo: 'LO MÁS DESTACADO DE LA SEMANA', summary: 'El Congreso juramentó a la presidenta de la Corte Suprema.' },
    { titulo: 'PROPUESTA ATENDERÁ A LAS FAMILIAS AFECTADAS', summary: especifica },
  ]]]);
  expect(resumenDe(ini, notas)).toBe(especifica);
  expect(resumenDe({ numero: 6842, titulo: 'Ley de Horarios Escalonados para la Movilidad Urbana' }, new Map([['6842', [
    { summary: 'La iniciativa 6842 del Presupuesto 2027 asigna recursos al Minfin y a la SAT.' },
  ]]]))).toBeNull();
});

test('abre el resumen completo sin abrir el recorrido', () => {
  const resumen = 'La propuesta cambia las obligaciones municipales y protege las fuentes de agua. '.repeat(8);
  act(() => { renderer = TestRenderer.create(<Iniciativa ini={registro[0]} resumen={resumen} />); });
  const expansion = boton('leer resumen completo, iniciativa 7000');
  expect(expansion.props.accessibilityState.expanded).toBe(false);
  act(() => expansion.props.onPress());
  expect(boton('cerrar resumen, iniciativa 7000').props.accessibilityState.expanded).toBe(true);
  expect(renderer.root.findAll((n) => n.props.children === resumen && n.props.numberOfLines === undefined).length).toBeGreaterThan(0);
});


async function montarRegistro(Componente) {
  await act(async () => { renderer = TestRenderer.create(<QueryClientProvider client={cliente}><Componente /></QueryClientProvider>); });
  await esperar();
}

test('leyes: busca todo el registro, filtra por año y cambia de página', async () => {
  await montarRegistro(ListaLeyes);
  expect(texto()).toContain('Ley de prueba 0');
  expect(texto()).toContain('Documento aún no disponible.');
  act(() => boton('página 5').props.onPress());
  expect(texto()).not.toContain('Ley de prueba 0');
  expect(texto()).toContain('Ley de prueba 82');
  act(() => boton('2026, 23').props.onPress());
  expect(texto()).toContain('Ley de prueba 0');
  act(() => renderer.root.findByType(TextInput).props.onChangeText('83-2026'));
  expect(texto()).toContain('Ley de prueba 0');
  expect(texto()).not.toContain('Ley de prueba 1');
});

test('votaciones: consulta el historial independiente de los días del tablero', async () => {
  await montarRegistro(ListaVotaciones);
  expect(boton('todas, 82')).toBeDefined();
  expect(boton('página 5')).toBeDefined();
  act(() => boton('página 5').props.onPress());
  expect(texto()).toContain('Votación sobre asunto 3');
  expect(texto()).toContain('Votación sobre asunto 2');
  expect(texto()).not.toContain('Votación sobre asunto 81');
  act(() => boton('aprobadas, 54').props.onPress());
  expect(boton('página 3')).toBeDefined();
  expect(boton('página 5')).toBeUndefined();
});
