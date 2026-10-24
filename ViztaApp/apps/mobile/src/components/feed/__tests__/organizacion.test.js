import { anoDecreto, buscarRegistro, fechaRegistro, periodoDe, resultadoVotacion } from '../organizacion';

test('busca número y tema sin tildes y conserva el año del decreto', () => {
  expect(buscarRegistro('23-2026 Protección de las fuentes de agua', '23-2026 proteccion')).toBe(true);
  expect(buscarRegistro('23-2026 Protección del agua', 'movilidad')).toBe(false);
  expect(anoDecreto({ numero: '3-2024', fecha: '2025-01-01' })).toBe('2024');
  expect(anoDecreto({ fecha: '2026-01-01' })).toBe('2026');
});
test('el período usa los extremos del registro, no la primera página', () => {
  expect(periodoDe([{ fecha: '2026-10-22' }, { fecha: '2026-09-08' }])).toBe(`${fechaRegistro('2026-09-08')} – ${fechaRegistro('2026-10-22')}`);
  expect(periodoDe([])).toBeNull();
  expect(fechaRegistro('2024-01-30')).toContain('2024');
});
test('un resultado ausente no se convierte en una votación rechazada', () => {
  expect(resultadoVotacion({ resultado: 'aprobada' })).toBe('aprobada');
  expect(resultadoVotacion({ resultado: 'no_aprobada' })).toBe('no_aprobada');
  expect(resultadoVotacion({})).toBe('sin_resultado');
});
