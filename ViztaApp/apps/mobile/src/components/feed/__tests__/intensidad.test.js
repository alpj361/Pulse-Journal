import { cifrasDe, intensidadDelDia } from '../intensidad';

describe('cifrasDe', () => {
  it('lee números en palabras y dígitos', () => {
    expect(cifrasDe('Ataque armado en Campo Marte deja dos muertos y cinco heridos')).toMatchObject({ muertos: 2, heridos: 5 });
    expect(cifrasDe('Capturan a dos personas por el ataque')).toMatchObject({ capturados: 2 });
  });
  it('una mención sin número cuenta 1', () => {
    expect(cifrasDe('Asesinan a exfiscal del MP').muertos).toBe(1);
  });
  it('las cifras acumuladas del año no cuentan', () => {
    expect(cifrasDe('Las lluvias durante 2026 han dejado al menos 22 personas muertas.').muertos).toBe(0);
  });
});

describe('intensidadDelDia', () => {
  const foppa = {
    id: 'f',
    titulo: 'Ataque armado deja dos muertos',
    fecha_evento_ts: '2026-10-17T10:57:00-06:00',
    fuentes: { independientes: 19 },
    desarrollos: [
      ...Array.from({ length: 20 }, (_, i) => ({ ts: `2026-10-17T${String(10 + (i % 12)).padStart(2, '0')}:00:00-06:00`, fuente: `M${i % 8}` })),
      ...Array.from({ length: 24 }, (_, i) => ({ ts: `2026-10-18T${String(8 + (i % 12)).padStart(2, '0')}:00:00-06:00`, fuente: `N${i % 7}` })),
    ],
  };
  it('las víctimas cuentan el día del hecho, no el siguiente', () => {
    expect(intensidadDelDia([foppa], '2026-10-17').datos.victimas.muertos).toBe(2);
    expect(intensidadDelDia([foppa], '2026-10-18').datos.victimas.muertos).toBe(0);
  });
  it('los medios se cuentan por día', () => {
    expect(intensidadDelDia([foppa], '2026-10-17').datos.grandes).toBe(1);
    expect(intensidadDelDia([foppa], '2026-10-18').datos.top.veces).toBe(24);
  });
});

describe('cifrasDe no confunde edades ni lugares', () => {
  it('«hombre de 21 años resultó herido» es 1 herido', () => {
    expect(cifrasDe('Un hombre de 21 años resultó herido de bala en la zona 5').heridos).toBe(1);
  });
  it('«kilómetro 44 … una persona herida» es 1', () => {
    expect(cifrasDe('Un derrape dejó una persona herida en el kilómetro 44').heridos).toBe(1);
  });
});
