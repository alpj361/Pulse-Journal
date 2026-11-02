import { delDia, delFeed, fechaCorta, fechasDe, proximas, rangoDe, semanasDelMes } from '../fechasClaves';

jest.mock('../../../utils/supabase', () => ({ supabase: {} }));

// Filas como las guarda el dataset «Fechas claves».
const fila = (id, values) => ({ id, values });
const fechas = fechasDe([
  fila('c', { fecha: '2027-03-29', fecha_fin: '2027-06-25', titulo: 'Campaña electoral', tipo: 'electoral', tema: 'elecciones', estado: 'prevista' }),
  fila('b', { fecha: '2026-11-03', titulo: 'Sesión ordinaria', tipo: 'sesion', tema: 'congreso', estado: 'prevista' }),
  fila('a', { fecha: '2026-11-03', hora: '08:00', titulo: 'Reunión sobre el veto', tipo: 'reunion', tema: 'congreso', estado: 'prevista' }),
  fila('d', { fecha: '2026-11-01', titulo: 'Día de Todos los Santos', tipo: 'asueto', tema: 'pais', estado: 'confirmada' }),
  fila('x', { fecha: 'pronto', titulo: 'Sin día' }),
]);

test('las filas del dataset quedan en orden de día y hora, y las que no tienen día no entran', () => {
  expect(fechas.map((f) => f.id)).toEqual(['d', 'a', 'b', 'c']);
  expect(fechas[2]).toMatchObject({ prevista: true, fin: null });
  expect(fechas[3].fin).toBe('2027-06-25');
});

test('cada feed ve sus temas: el Congreso, lo suyo; Guatemala, todo', () => {
  expect(delFeed(fechas, 'congreso').map((f) => f.id)).toEqual(['a', 'b']);
  expect(delFeed(fechas, 'pais')).toHaveLength(4);
  expect(delFeed(fechas, 'observatorio')).toHaveLength(0);
});

test('un rango toca todos sus días, y lo que ya empezó sigue entre las próximas', () => {
  expect(delDia(fechas, '2027-05-10').map((f) => f.id)).toEqual(['c']);
  expect(delDia(fechas, '2026-11-03')).toHaveLength(2);
  expect(proximas(fechas, '2027-04-01').map((f) => f.id)).toEqual(['c']);
  expect(rangoDe(fechas[3])).toBe('del 29 de marzo al 25 de junio');
  expect(fechaCorta('2026-11-03')).toBe('3 nov');
});

test('el mes empieza el lunes: noviembre de 2026 arranca en domingo', () => {
  const semanas = semanasDelMes(2026, 10);
  expect(semanas[0]).toEqual([null, null, null, null, null, null, '2026-11-01']);
  expect(semanas.flat().filter(Boolean)).toHaveLength(30);
  expect(semanas.every((s) => s.length === 7)).toBe(true);
});
