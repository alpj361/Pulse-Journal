import {
  fuentesDe,
  horaGt,
  kmTexto,
  minutosDe,
  normRuta,
  prepararIncidentes,
  puntoALoLargo,
  relatoDe,
  rutaDe,
  tiemposClave,
  ubicarIncidente,
  vigente,
} from '../incidentesTrafico';

const AHORA = Date.parse('2026-10-14T12:00:00Z');

describe('reportes de tráfico', () => {
  test('una ruta con cero a la izquierda es la misma', () => {
    expect(normRuta('CA-02 OCCIDENTE')).toBe('ca-2 occidente');
    expect(normRuta('CA-2 Occidente')).toBe('ca-2 occidente');
    expect(normRuta('RN-01')).toBe('rn-1');
  });

  test('CA-9 se decide por el relato, y si no se puede saber no elige lado', () => {
    expect(rutaDe({ ruta: 'CA-9', descripcion: 'ruta al Pacífico, Villa Nueva' })).toBe('ca-9 sur');
    expect(rutaDe({ ruta: 'CA-9 Norte', descripcion: 'km 116' })).toBe('ca-9 norte');
    expect(rutaDe({ ruta: 'CA-9', descripcion: 'contenedor volcado' })).toBe('ca-9');
  });

  test('habilitado y finalizado no se muestran; un fin ya pasado tampoco', () => {
    expect(vigente({ estado: 'habilitado' }, AHORA)).toBe(false);
    expect(vigente({ estado: 'finalizado' }, AHORA)).toBe(false);
    expect(vigente({ estado: 'activo', fin: '2026-10-14T11:00:00Z' }, AHORA)).toBe(false);
    expect(vigente({ estado: 'activo', fin: null }, AHORA)).toBe(true);
  });

  test('se alterna el paso es efecto, y un desvío con nombre de lugar no es ruta alterna', () => {
    const paso = relatoDe('Se alterna el paso vehicular. Debido a trabajos de COVIAL.');
    expect(paso.efecto.toLowerCase()).toContain('alterna el paso');
    expect(paso.alternas).toBeNull();
    expect(paso.causa.toLowerCase()).toContain('trabajos');

    const lugar = relatoDe('Entre La Cumbre y el desvío Chagüite seguimos el hundimiento.');
    expect(lugar.alternas).toBeNull();

    const desvio = relatoDe('Hay cierre total. Ruta alterna por Calzada Roosevelt.');
    expect(desvio.alternas.toLowerCase()).toContain('calzada roosevelt');
  });

  test('las fuentes salen del enlace y del texto, aunque el https venga partido', () => {
    const fuentes = fuentesDe({
      fuente: 'x:ProvialOficial',
      url: 'https://x.com/ProvialOficial/status/1',
      descripcion: 'Bloqueo. https:// provial.gob.gt/mapa https://x.com/ProvialOficial/status/1',
    });
    expect(fuentes.map((f) => f.etiqueta)).toEqual(['Provial', 'Provial']);
    expect(fuentes[0].url).toBe('https://x.com/ProvialOficial/status/1');
    expect(fuentes[1].url).toBe('https://provial.gob.gt/mapa');
    expect(fuentesDe({ fuente: 'x:COVIAL_CIV', descripcion: 'sin enlace' })).toEqual([
      { url: null, etiqueta: 'COVIAL' },
    ]);
    expect(fuentesDe({ fuente: 'x:muniguate', url: 'https://x.com/muniguate/status/2', descripcion: '' })[0].etiqueta).toBe('Muni');
  });

  test('un punto propio gana, y el kilómetro cae sobre el tramo que lo cubre', () => {
    const tramos = [
      {
        id: 't1',
        clave: 'norte-riohondo-ida',
        desde: 'El Rancho',
        hacia: 'Río Hondo',
        geometria: [
          [14.0, -90.0],
          [15.0, -89.0],
        ],
      },
    ];
    const rutas = [{ tramo_id: 't1', ruta: 'CA-9 Norte', km_desde: 85, km_hasta: 135 }];
    const propio = ubicarIncidente({ lat: 14.64, lng: -90.51, ruta: 'CA-9 Norte', km: 116 }, { tramos, rutas });
    expect(propio).toEqual({ lat: 14.64, lng: -90.51, preciso: true });

    const porKm = ubicarIncidente({ ruta: 'CA-9 Norte', km: 110, descripcion: 'puente' }, { tramos, rutas });
    expect(porKm.preciso).toBe(false);
    expect(porKm.lat).toBeGreaterThan(14.4);
    expect(porKm.lat).toBeLessThan(14.6);

    const vuelta = {
      id: 't2',
      clave: 'norte-riohondo-vuelta',
      geometria: [
        [15.0, -89.0],
        [14.0, -90.0],
      ],
    };
    const ida = ubicarIncidente(
      { ruta: 'CA-9 Norte', km: 135, descripcion: '' },
      {
        tramos: [tramos[0], vuelta],
        rutas: [
          rutas[0],
          { tramo_id: 't2', ruta: 'CA-9 Norte', km_desde: 85, km_hasta: 135 },
        ],
      }
    );
    expect(ida.lat).toBeCloseTo(15, 5);
  });

  test('El Incienso se marca aunque el reporte no traiga coordenadas', () => {
    const punto = ubicarIncidente(
      { descripcion: 'Bloqueo en el puente El Incienso, zona 7.', tipo: 'bloqueo' },
      {}
    );
    expect(punto.preciso).toBe(false);
    expect(punto.lat).toBeCloseTo(14.64735, 4);
    expect(punto.lng).toBeCloseTo(-90.52769, 4);
  });

  test('lo que no se puede poner en el mapa igual queda en la lista, con su fuente', () => {
    const { ubicados, sueltos } = prepararIncidentes(
      [
        { id: 'a', estado: 'activo', tipo: 'bloqueo', descripcion: 'algo lejos sin lugar', fuente: 'x:ProvialOficial', url: 'https://x.com/ProvialOficial/status/9', inicio: '2026-10-14T15:00:00Z' },
        { id: 'b', estado: 'habilitado', tipo: 'bloqueo', descripcion: 'puente El Incienso', fuente: 'provial_bloqueos' },
        { id: 'a', estado: 'activo', tipo: 'bloqueo', descripcion: 'duplicado', fuente: 'x:ProvialOficial' },
      ],
      { ahora: AHORA }
    );
    expect(ubicados).toHaveLength(0);
    expect(sueltos).toHaveLength(1);
    expect(sueltos[0].fuentes[0].url).toContain('status/9');
    expect(sueltos[0].cuando).toBe('9:00');
  });

  test('dos reportes en el mismo punto no se tapan', () => {
    const { ubicados } = prepararIncidentes(
      [
        { id: '1', estado: 'activo', tipo: 'accidente', lat: 14.6, lng: -90.5, descripcion: 'uno', fuente: 'x:ProvialOficial', url: 'https://x.com/a' },
        { id: '2', estado: 'activo', tipo: 'cierre', lat: 14.6, lng: -90.5, descripcion: 'dos', fuente: 'x:COVIAL_CIV', url: 'https://x.com/b' },
      ],
      { ahora: AHORA }
    );
    expect(ubicados[0].lat).toBe(14.6);
    expect(ubicados[1].lat).not.toBe(ubicados[0].lat);
  });

  test('el punto a la mitad de un tramo recto queda en el medio', () => {
    const medio = puntoALoLargo(
      [
        [14, -90],
        [16, -90],
      ],
      0.5
    );
    expect(medio.lat).toBeCloseTo(15, 5);
    expect(medio.lng).toBeCloseTo(-90, 5);
  });

  test('los tiempos son los de la ciudad que más se demoran', () => {
    const lista = tiemposClave([
      { id: '1', ambito: 'ciudad', con_trafico_s: 600, demora_s: 60, desde: 'A', hacia: 'B' },
      { id: '2', ambito: 'pais', con_trafico_s: 9000, demora_s: 4000, desde: 'C', hacia: 'D' },
      { id: '3', ambito: 'ciudad', con_trafico_s: 1200, demora_s: 500, desde: 'E', hacia: 'F' },
      { id: '4', ambito: 'ciudad', con_trafico_s: null, desde: 'G', hacia: 'H' },
    ]);
    expect(lista.map((t) => t.id)).toEqual(['3', '1']);
    expect(minutosDe(1200)).toBe(20);
    expect(kmTexto('178.000')).toBe('178');
    expect(kmTexto('188.500')).toBe('188.5');
  });

  test('la hora es la de Guatemala, no la del teléfono', () => {
    expect(horaGt('2026-10-14T15:07:00Z', AHORA)).toBe('9:07');
    expect(horaGt('2026-10-13T15:07:00Z', AHORA)).toBe('ayer 9:07');
  });
});
