import { deQueSeHabla, diaDeCard, frase, medirDia, puntuar } from '../termometro';

const card = (o) => ({ titulo: 't', impacto_score: '50', fuentes: { independientes: 1 }, ...o });

describe('termómetro', () => {
  it('el día de una historia es su último movimiento', () => {
    expect(diaDeCard({ primera_vez: '2026-10-18T04:01:00+00:00', ultima_actualizacion: '2026-10-18T20:26:54-06:00' })).toBe('2026-10-18');
  });

  it('cuenta violencia, accidentes y gobierno por subcategoría y título', () => {
    const m = medirDia(
      [
        card({ titulo: 'Ataque armado en zona 5' }),
        card({ titulo: 'Volcadura en la CA-9' }),
        card({ titulo: 'Congreso aprueba iniciativa' }),
        card({ titulo: 'Mixco gana 3-1' }),
      ],
      '2026-10-18'
    );
    expect([m.volumen, m.violencia, m.accidentes, m.gobierno]).toEqual([4, 1, 1, 1]);
  });

  it('50 es el promedio de los días anteriores; el primer día no tiene puntaje', () => {
    const dias = puntuar([
      { dia: '2026-10-01', volumen: 10, violencia: 2, accidentes: 1, gobierno: 1, polarizacion: 0, novedad: 100 },
      { dia: '2026-10-02', volumen: 20, violencia: 2, accidentes: 1, gobierno: 1, polarizacion: 0, novedad: 100 },
    ]);
    expect(dias[0].puntos.volumen).toBeNull();
    expect(dias[1].puntos.volumen).toBe(100);
    expect(dias[1].puntos.violencia).toBe(50);
    expect(dias[1].base).toBe(1);
  });

  it('de qué se habla: % del peso y si es nueva o sube', () => {
    const hoy = [card({ id: 'a', impacto_score: '90', fuentes: { independientes: 10 } }), card({ id: 'b' })];
    const ayer = [card({ id: 'a', impacto_score: '40' }), card({ id: 'c', impacto_score: '90' })];
    const t = deQueSeHabla(hoy, ayer);
    expect(t[0].id).toBe('a');
    expect(t[0].rumbo).toBe('sube');
    expect(t[1].rumbo).toBe('nueva');
  });

  it('frases literales', () => {
    expect(frase('novedad', { novedad: 100 })).toBe('Todas son historias nuevas');
    expect(frase('violencia', { violencia: 3, volumen: 20 })).toBe('3 de 20 noticias son de violencia');
  });
});

