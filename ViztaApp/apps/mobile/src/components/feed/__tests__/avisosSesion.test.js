import { avisosDe, claveSesion, numeroDeSesion } from '../avisosSesion';

jest.mock('../../../utils/supabase', () => ({ supabase: { from: jest.fn() } }));

test('el editorial va primero y manda sobre el automático del mismo tipo', () => {
  const fila = {
    aviso_editorial: { clase: 'editorial', tipo: 'sin_acta', pill: 'Sin acta', texto: 'El acta se publica el lunes.' },
    avisos_automaticos: [
      { clase: 'automatico', tipo: 'sin_acta', pill: 'Sin acta', texto: 'Pasaron más de 3 días y no hay acta oficial.' },
      { clase: 'automatico', tipo: 'solo_prensa', pill: 'Solo prensa', texto: 'El dato viene solo de prensa.' },
    ],
  };
  expect(avisosDe(fila).map((a) => `${a.tipo}:${a.clase}`)).toEqual(['sin_acta:editorial', 'solo_prensa:automatico']);
});

test('un editorial vencido no se muestra; sin avisos, lista vacía', () => {
  const fila = { aviso_editorial: { tipo: 'sin_quorum', pill: 'Sin quórum', texto: 'x', hasta: '2026-11-01T00:00:00Z' }, avisos_automaticos: [] };
  expect(avisosDe(fila, new Date('2026-11-06'))).toEqual([]);
  expect(avisosDe({ aviso_editorial: null, avisos_automaticos: [] })).toEqual([]);
  expect(avisosDe({ avisos_automaticos: [{ tipo: 'trasladada', pill: null }] })).toEqual([]);
});

test('la sesión de una votación se encuentra por fecha y número', () => {
  expect(numeroDeSesion('ordinaria · sesión 57')).toBe('57');
  expect(numeroDeSesion('Sesión Solemne')).toBeNull();
  expect(claveSesion('2026-11-05', '57')).toBe('2026-11-05|57');
  expect(claveSesion('2026-11-05', null)).toBeNull();
});
