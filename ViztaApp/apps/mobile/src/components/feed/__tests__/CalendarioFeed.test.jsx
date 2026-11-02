import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CalendarioFeed, { marcasDelDia, tramoDelDia } from '../CalendarioFeed';
import { fechasDe, traerDiasConPublicaciones, traerFechasClaves } from '../fechasClaves';

jest.mock('../../../utils/supabase', () => ({ supabase: {} }));
jest.mock('../../../utils/haptics', () => ({ roce: () => {} }));
jest.mock('expo-blur', () => ({ BlurView: () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  const anim = { duration: () => anim, springify: () => anim, damping: () => anim, stiffness: () => anim, mass: () => anim };
  return { __esModule: true, default: { View }, FadeIn: anim, SlideInDown: anim };
});
jest.mock('../fechasClaves', () => ({ ...jest.requireActual('../fechasClaves'), traerFechasClaves: jest.fn(), traerDiasConPublicaciones: jest.fn() }));

const fechas = fechasDe([
  { id: 's', values: { fecha: '2026-11-03', titulo: 'Sesión ordinaria', tipo: 'sesion', tema: 'congreso', estado: 'prevista' } },
  { id: 'c', values: { fecha: '2026-10-07', fecha_fin: '2026-11-07', titulo: 'Concurso del TSE', tipo: 'electoral', tema: 'congreso' } },
]);

test('lo de un día va en círculo; lo que dura varios días, como tramo', () => {
  expect(marcasDelDia(fechas, '2026-11-03').map((f) => f.id)).toEqual(['s']);
  expect(marcasDelDia(fechas, '2026-11-07')).toEqual([]);
  expect(tramoDelDia(fechas, '2026-11-05').id).toBe('c');
  expect(tramoDelDia(fechas, '2026-11-08')).toBeNull();
});

test('tocar un día solo lo muestra; el feed se filtra con el botón de adentro', async () => {
  traerFechasClaves.mockResolvedValue(fechas);
  traerDiasConPublicaciones.mockResolvedValue([]);
  const onElegir = jest.fn();
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  let r;
  await act(async () => {
    r = TestRenderer.create(<QueryClientProvider client={cliente}><CalendarioFeed feed="congreso" dia={null} onElegir={onElegir} /></QueryClientProvider>);
  });
  const boton = (inicio) => r.root.findAll((n) => String(n.props.accessibilityLabel || '').startsWith(inicio) && typeof n.props.onPress === 'function')[0];
  await act(async () => { boton('Calendario de fechas claves').props.onPress(); });
  // El mes abre en el de hoy; se va directo a noviembre de 2026 por la fila de la fecha.
  act(() => boton('Sesión ordinaria').props.onPress());
  expect(onElegir).not.toHaveBeenCalled();
  expect(JSON.stringify(r.toJSON())).toContain('MARTES, 3 DE NOVIEMBRE');
  act(() => boton('filtrar el feed por este día').props.onPress());
  expect(onElegir).toHaveBeenCalledWith('2026-11-03');
  act(() => r.unmount());
  cliente.clear();
});
