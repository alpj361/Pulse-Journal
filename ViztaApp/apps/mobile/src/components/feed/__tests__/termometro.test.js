jest.mock('../../../utils/supabase', () => ({ supabase: { auth: { getSession: jest.fn() } } }));
jest.mock('../../../utils/servicios', () => ({ EXTRACTORW_URL: 'https://x' }));

import { contraLoNormal, deQueSeHabla, formaDia, frase, frasesIntensidad, fraseVictimas, puntosDe, colorDe } from '../termometro';

// El 19-oct tal como lo devuelve GET /api/termometro.
const DIA = {
  fecha: '2026-10-19',
  parcial: false,
  datos_parciales: false,
  intensidad: 83,
  componentes: { seguimiento: 32, amplitud: 33.3, alto_impacto: 17.4, max_desarrollos_dia: 23, historias_alto_impacto: 2 },
  indicadores: { volumen: 72, nuevas: 69, violencia: 4, gobierno_congreso: 1, accidentes: 10, clima: 12, opinion_pct: 1 },
  violencia_victimas: { muertos: 3, heridos: 0, desaparecidos: 0, capturados: 9, victimas_sin_cifra: 1 },
  comparacion: { disponible: false, base_dias: 0, minimo_dias: 7, promedios: null },
  top_historias: [{ historia: 'foppa', titulo: 'Velatorio de exfiscal', desarrollos_dia: 23, medios_dia: 11 }],
};

describe('termómetro', () => {
  const d = formaDia(DIA);

  it('da forma al día del servidor', () => {
    expect([d.dia, d.intensidad, d.violencia, d.gobierno, d.clima, d.volumen]).toEqual(['2026-10-19', 83, 4, 1, 12, 72]);
  });

  it('sin 7 días comparables no hay puntaje contra lo normal, solo el conteo', () => {
    expect(puntosDe('violencia', d)).toBeNull();
    expect(puntosDe('intensidad', d)).toBe(83);
  });

  it('con promedio, 50 es lo normal y 100 el doble o más', () => {
    const con = formaDia({ ...DIA, comparacion: { disponible: true, promedios: { violencia: 2, volumen: 144 } } });
    expect(puntosDe('violencia', con)).toBe(100);
    expect(puntosDe('volumen', con)).toBe(25);
    expect(contraLoNormal(0, 0)).toBe(50);
  });

  it('el rojo solo en violencia y accidentes', () => {
    expect(colorDe(90, 'violencia')).toBe('#C0453B');
    expect(colorDe(90, 'gobierno')).not.toBe('#C0453B');
  });

  it('las frases dicen los números', () => {
    expect(fraseVictimas(d.victimas)).toBe('3 muertos, 9 capturados y casos sin cifra');
    expect(frase('violencia', d)).toBe('4 historias nuevas de violencia: 3 muertos, 9 capturados y casos sin cifra');
    expect(frase('volumen', d)).toBe('72 noticias, 69 nuevas');
    expect(frasesIntensidad(d)[0]).toEqual(['Seguimiento', 32, 'Velatorio de exfiscal: 23 veces en el día']);
  });

  it('de qué se habla: rumbo contra el día anterior', () => {
    const ayer = formaDia({ ...DIA, top_historias: [{ historia: 'foppa', titulo: 'x', desarrollos_dia: 25, medios_dia: 13 }] });
    expect(deQueSeHabla(d, ayer)[0].rumbo).toBe('baja');
    expect(deQueSeHabla(d, null)[0].rumbo).toBe('nueva');
  });
});
