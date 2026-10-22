import { desarrollosDe, fechaHechoDe, seguimientoDe } from '../desarrollos';

describe('seguimientoDe', () => {
  it('sin campo o con tipo desconocido no dice nada', () => {
    expect(seguimientoDe({})).toBeNull();
    expect(seguimientoDe({ seguimiento: { tipo: 'otra' } })).toBeNull();
    expect(seguimientoDe({ es_seguimiento: false })).toBeNull();
    expect(seguimientoDe({ es_seguimiento: true })).toBe('Seguimiento');
  });
  it('retoma y seguimiento con su fecha', () => {
    expect(seguimientoDe({ seguimiento: { tipo: 'seguimiento', desde: '2026-10-03T08:00:00-06:00' } })).toBe('Seguimiento · desde 3 oct');
    expect(seguimientoDe({ seguimiento: { tipo: 'retoma' } })).toBe('Retoma');
  });
});

describe('fechaHechoDe', () => {
  it('no verificada lo dice', () => {
    expect(fechaHechoDe({ fecha_evento_base: 'no_verificada', fecha_evento_ts: '2026-10-17T10:57:36-06:00' })).toEqual({ texto: 'Fecha del hecho sin confirmar', verificada: false });
    expect(fechaHechoDe({ fecha_evento: 'fecha no verificada' }).verificada).toBe(false);
  });
  it('con fecha, día y hora de Guatemala', () => {
    expect(fechaHechoDe({ fecha_evento_ts: '2026-10-17T10:57:36-06:00', fecha_evento_base: 'hecho_base' }).texto).toBe('Pasó el sábado 17 de oct, 10:57 a. m.');
  });
  it('sin fecha, nada', () => {
    expect(fechaHechoDe({})).toBeNull();
  });
});

describe('opinión en desarrollos', () => {
  it('se conserva la marca', () => {
    const [d] = desarrollosDe({ desarrollos: [{ texto: 'x', ts: '2026-10-18T10:00:00-06:00', opinion: true }] });
    expect(d.opinion).toBe(true);
  });
});

describe('fuentes del 19-oct', () => {
  const { fuentesDe } = require('../encuadres');
  it('cuenta medios sin cuentas oficiales cuando viene independientes_casas', () => {
    const f = { casas: ['@soy_502', 'Soy502', '@PNCdeGuatemala'], independientes_casas: ['Soy502'], independientes: 1 };
    expect(fuentesDe({ fuentes: f }).casas).toEqual(['Soy502']);
    expect(fuentesDe({ fuentes: { casas: ['A', 'B'] } }).casas).toEqual(['A', 'B']);
  });
});
