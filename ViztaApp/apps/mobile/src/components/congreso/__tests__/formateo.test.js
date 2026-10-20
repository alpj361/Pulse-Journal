jest.mock('../../../utils/supabase', () => ({ supabase: {} }));
jest.mock('../../feed/congreso', () => ({ titular: (t) => t }));

import {
  anioActual,
  claveVoto,
  etiquetaEstado,
  etiquetaResultado,
  etiquetaTipoCc,
  etiquetaVoto,
  fechaCorta,
} from '../formateo';

describe('formateo de Congreso y CC', () => {
  test('fechaCorta arma día mes año', () => {
    expect(fechaCorta('2026-10-13')).toBe('13 oct 2026');
    expect(fechaCorta(null)).toBe('');
  });

  test('etiquetaEstado cubre los estados reales', () => {
    expect(etiquetaEstado('conocio_pleno')).toBe('Conoció el pleno');
    expect(etiquetaEstado('presentada')).toBe('Presentada');
  });

  test('votos del Congreso se normalizan', () => {
    expect(claveVoto('A FAVOR')).toBe('a_favor');
    expect(claveVoto('EN CONTRA')).toBe('en_contra');
    expect(claveVoto('AUSENTE')).toBe('ausente');
    expect(claveVoto('LICENCIA')).toBe('licencia');
    expect(etiquetaVoto('A FAVOR')).toBe('A favor');
  });

  test('resultado y tipo de CC', () => {
    expect(etiquetaResultado('aprobada')).toBe('Aprobada');
    expect(etiquetaResultado('no_aprobada')).toBe('No aprobada');
    expect(etiquetaTipoCc('SENTENCIA')).toBe('Sentencia');
    expect(etiquetaTipoCc('AUTO')).toBe('Auto');
  });

  test('anioActual es un número de cuatro dígitos', () => {
    expect(anioActual()).toBeGreaterThan(2020);
  });
});
