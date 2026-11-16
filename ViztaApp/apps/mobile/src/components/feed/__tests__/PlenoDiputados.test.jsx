import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { VotosDelPleno } from '../PlenoDiputados';
import { traerVotos } from '../congreso';
import { traerDiputados } from '../diputados';

jest.mock('../../../utils/supabase', () => ({ supabase: {} }));
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  const anim = { duration: () => anim, springify: () => anim, damping: () => anim, stiffness: () => anim };
  return { __esModule: true, default: { View }, FadeIn: anim, ZoomIn: anim };
});
jest.mock('../congreso', () => ({ traerVotos: jest.fn() }));
jest.mock('../diputados', () => ({ ...jest.requireActual('../diputados'), traerDiputados: jest.fn() }));

const diputado = (nombre, sigla, distrito) => ({ id: nombre, nombre, sigla, distrito, foto: null });
let renderer;
let cliente;
const texto = () => JSON.stringify(renderer.toJSON());
const boton = (etiqueta) => renderer.root.findAll((n) => String(n.props.accessibilityLabel || '').startsWith(etiqueta) && typeof n.props.onPress === 'function')[0];

beforeEach(() => {
  traerDiputados.mockResolvedValue([
    diputado('Allan Estuardo Rodríguez Reyes', 'VAMOS', 'Sololá'),
    diputado('Luis Alberto Rodríguez Reyes', 'VAMOS', 'Sololá'),
    diputado('Karla Betzaida Cardona Arreaga', 'UNE', 'Huehuetenango'),
  ]);
  traerVotos.mockResolvedValue([
    { diputado: 'Allan Estuardo Rodríguez Reyes', bloque: 'VAMOS', voto: 'EN CONTRA' },
    { diputado: 'Rodríguez Reyes Luis Alberto', bloque: 'VAMOS', voto: 'A FAVOR' },
    { diputado: 'Luis Alberto Rodríguez Reyes', bloque: 'VAMOS', voto: 'A FAVOR' },
    { diputado: 'Karla Betzaida Cardona Arreaga', bloque: 'UNE', voto: 'A FAVOR' },
  ]);
});
afterEach(() => { act(() => renderer.unmount()); cliente.clear(); });

test('las bancadas van primero y, al abrir una, se ve quién votó qué y su ficha', async () => {
  cliente = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  await act(async () => {
    renderer = TestRenderer.create(<QueryClientProvider client={cliente}><VotosDelPleno votacionId="v1" /></QueryClientProvider>);
  });
  await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
  // El voto repetido con el nombre al revés cuenta una vez.
  expect(boton('Vamos, 2, 1 a favor, 1 en contra')).toBeTruthy();
  expect(boton('Allan Estuardo')).toBeUndefined();
  // Un voto muestra las fotos de quienes votaron así.
  act(() => boton('1 en contra, ver sus fotos').props.onPress());
  expect(boton('Allan Estuardo Rodríguez Reyes, Vamos, En contra')).toBeTruthy();
  expect(boton('Karla Betzaida')).toBeUndefined();
  // Una bancada, las de los suyos; volver a tocar el voto lo cierra.
  act(() => boton('1 en contra, ver sus fotos').props.onPress());
  act(() => boton('Vamos, 2').props.onPress());
  expect(boton('Luis Alberto Rodríguez Reyes, Vamos, A favor')).toBeTruthy();
  // La foto abre la ficha completa, con su bancada, su distrito y su voto.
  act(() => boton('Allan Estuardo Rodríguez Reyes, Vamos, En contra').props.onPress());
  expect(texto()).toContain('Vamos · Sololá');
  expect(texto()).toContain('En contra');
});
