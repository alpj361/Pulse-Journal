import {
  cuerpoDe,
  diaCorto,
  desarrollosDe,
  etiquetaMedios,
  fechaISO,
  filaDe,
  horaGT,
  lineaActualizada,
  marcaTiempo,
  ocultaTextoPorTitular,
  urlHttp,
} from '../desarrollos';

const TITULO = 'Ataque en Campo Marte deja dos muertos, incluido Solórzano Foppa';

function entrada(parcial) {
  return {
    id: 'dev_news:1',
    ts: '2026-10-17T20:33:50-06:00',
    tipo: 'desarrollo',
    texto: TITULO,
    detalle: 'La PNC indicó que dos sospechosos fingieron ser repartidores.',
    fuente: 'Prensa Libre',
    fuentes: ['Prensa Libre'],
    url: 'https://www.prensalibre.com/nota',
    corregido: false,
    correccion: null,
    ...parcial,
  };
}

const cardHistoria = {
  titulo: TITULO,
  resumen: 'Un ataque armado en Campo Marte dejó dos personas fallecidas.',
  bajada: 'Un ataque armado en Campo Marte dejó dos personas fallecidas.',
  ultima_actualizacion: '2026-10-17T20:33:50-06:00',
  fuentes: { independientes: 12, contrastada: true, casas: ['Prensa Libre'] },
  desarrollos: [
    entrada({ id: 'dev_news:nuevo' }),
    entrada({
      id: 'dev_news:reacciones',
      ts: '2026-10-17T18:20:57-06:00',
      tipo: 'reacciones',
      texto: 'Condenas y pedidos de esclarecimiento',
      detalle: null,
      fuente: 'PDH',
      actores: ['Karin Herrera', 'PDH', 'Colegio de Abogados'],
      url: 'https://x.com/PDHgt/status/1',
    }),
    entrada({
      id: 'dev_news:base',
      ts: '2026-10-17T12:01:24-06:00',
      tipo: 'hecho_base',
      texto: 'Reportan ataque armado en Campo Marte',
      detalle: null,
      fuente: 'Soy502',
      url: 'https://x.com/soy_502/status/1',
    }),
  ],
};

describe('desarrollosDe', () => {
  test('sin campo, o vacío, la card no tiene línea de tiempo', () => {
    expect(desarrollosDe(undefined)).toEqual([]);
    expect(desarrollosDe({})).toEqual([]);
    expect(desarrollosDe({ desarrollos: null })).toEqual([]);
    expect(desarrollosDe({ desarrollos: 'no-es-array' })).toEqual([]);
    expect(desarrollosDe({ desarrollos: [] })).toEqual([]);
  });

  test('una card vieja del fixture —sin desarrollos— no se rompe', () => {
    const cardVieja = {
      id: 'card_news_2111513083999047969_1792260017742',
      titulo: TITULO,
      resumen: 'Según reportes, un ataque armado en las canchas del Campo Marte.',
      entidades: ['Juan Francisco Solórzano Foppa'],
      source_ids: ['tweet:2111513083999047969'],
    };
    expect(desarrollosDe(cardVieja)).toEqual([]);
    expect(lineaActualizada(cardVieja)).toBeNull();
    expect(etiquetaMedios(cardVieja)).toBeNull();
  });

  test('descarta entradas sin texto y no muta el original', () => {
    const conTexto = [
      entrada({ texto: '' }),
      entrada({ texto: '   ' }),
      entrada({ id: 'dev_news:ok', texto: 'Capturan a dos sospechosos' }),
      null,
    ];
    const salida = desarrollosDe({ desarrollos: conTexto });
    expect(salida).toHaveLength(1);
    expect(salida[0].texto).toBe('Capturan a dos sospechosos');
    expect(conTexto).toHaveLength(4);
  });

  test('detalle null no se convierte en texto', () => {
    const [dev] = desarrollosDe({
      desarrollos: [entrada({ detalle: null })],
    });
    expect(dev.detalle).toBeNull();
  });

  test('reacciones conserva actores y el cuerpo los lista', () => {
    const [dev] = desarrollosDe({
      desarrollos: [
        entrada({
          tipo: 'reacciones',
          texto: 'Condenas',
          actores: ['Karin Herrera', '  ', 'PDH', null, 'Colegio de Abogados'],
        }),
      ],
    });
    expect(dev.actores).toEqual(['Karin Herrera', 'PDH', 'Colegio de Abogados']);
    expect(cuerpoDe(dev)).toBe('Karin Herrera, PDH, Colegio de Abogados');
    expect(dev).not.toHaveProperty('source_ids');
    expect(dev).not.toHaveProperty('ids_fundidos');
  });

  test('corregidos nunca se ocultan: quedan marcados con el texto de la corrección', () => {
    const [dev] = desarrollosDe({
      desarrollos: [
        entrada({
          corregido: true,
          correccion: 'La cifra inicial era de tres muertos.',
        }),
      ],
    });
    expect(dev.corregido).toBe(true);
    expect(dev.correccion).toBe('La cifra inicial era de tres muertos.');
    expect(dev.texto).toBe(TITULO);
  });

  test('una URL que no es http(s) no se ofrece como enlace', () => {
    expect(urlHttp('javascript:alert(1)')).toBeNull();
    expect(urlHttp('ftp://archivos.ejemplo.com/nota')).toBeNull();
    expect(urlHttp('data:text/html,hola')).toBeNull();
    expect(urlHttp('/nota-interna')).toBeNull();
    expect(urlHttp('')).toBeNull();
    expect(urlHttp(null)).toBeNull();
    expect(urlHttp('https://www.prensalibre.com/nota')).toBe('https://www.prensalibre.com/nota');
    expect(urlHttp('http://elperiodico.com.gt/x')).toBe('http://elperiodico.com.gt/x');

    const [dev] = desarrollosDe({
      desarrollos: [entrada({ url: 'javascript:void(0)' })],
    });
    expect(dev.url).toBeNull();
    expect(dev.fuente).toBe('Prensa Libre');
  });

  test('ordena del más nuevo al más viejo aunque vengan al revés', () => {
    const ids = desarrollosDe({
      desarrollos: [
        entrada({ id: 'viejo', ts: '2026-10-17T08:00:00-06:00', texto: 'Hecho base' }),
        entrada({ id: 'medio', ts: '2026-10-17T14:00:00-06:00', texto: 'Capturas' }),
        entrada({ id: 'nuevo', ts: '2026-10-17T20:33:50-06:00', texto: 'Último' }),
      ],
    }).map((d) => d.id);
    expect(ids).toEqual(['nuevo', 'medio', 'viejo']);
  });
});

describe('horaGT', () => {
  test('lee la hora del ISO de Guatemala, sin Intl', () => {
    expect(horaGT('2026-10-17T20:33:50-06:00')).toBe('8:33 p. m.');
    expect(horaGT('2026-10-17T08:05:00-06:00')).toBe('8:05 a. m.');
    expect(horaGT('2026-10-17T00:00:00-06:00')).toBe('12:00 a. m.');
    expect(horaGT('2026-10-17T12:00:00-06:00')).toBe('12:00 p. m.');
    expect(horaGT('2026-10-17T23:59:01.123-06:00')).toBe('11:59 p. m.');
  });

  test('si el string no trae hora, no se inventa', () => {
    expect(horaGT(null)).toBeNull();
    expect(horaGT('')).toBeNull();
    expect(horaGT('2026-10-17')).toBeNull();
    expect(horaGT('anoche')).toBeNull();
  });
});

describe('filaDe', () => {
  test('la entrada más nueva no repite el titular', () => {
    const lista = desarrollosDe(cardHistoria);
    const primera = filaDe(lista[0], cardHistoria, 0);
    expect(primera.hora).toBe('8:33 p. m.');
    expect(primera.texto).toBeNull();
    expect(primera.medio).toBe('Prensa Libre');
    expect(primera.detalle).toBeTruthy();
    expect(ocultaTextoPorTitular(lista[0], cardHistoria.titulo, 0)).toBe(true);
  });

  test('reacciones lista actores, no el código de tipo', () => {
    const lista = desarrollosDe(cardHistoria);
    const reacciones = lista.find((d) => d.tipo === 'reacciones');
    const fila = filaDe(reacciones, cardHistoria, 1);
    expect(fila.texto).toBe('Karin Herrera, PDH, Colegio de Abogados');
    expect(JSON.stringify(fila)).not.toMatch(/reacciones/);
    expect(fila.detalle).toBeNull();
  });

  test('una corrección se ve: la palabra y el texto, sin esconder la entrada', () => {
    const [dev] = desarrollosDe({
      desarrollos: [
        entrada({
          texto: 'Tres muertos en Campo Marte',
          corregido: true,
          correccion: 'Fueron dos las personas fallecidas.',
        }),
      ],
    });
    const fila = filaDe(dev, { titulo: TITULO }, 0);
    expect(fila.texto).toBe('Tres muertos en Campo Marte');
    expect(fila.corregido).toBe(true);
    expect(fila.correccion).toBe('Fueron dos las personas fallecidas.');
  });
});

describe('lineaActualizada y medios', () => {
  test('el feed solo dice cuándo se actualizó si hay desarrollos', () => {
    expect(lineaActualizada(cardHistoria)).toBe('actualizada 8:33 p. m.');
    expect(lineaActualizada({ ...cardHistoria, desarrollos: [] })).toBeNull();
    expect(etiquetaMedios(cardHistoria)).toBe('12 medios');
    expect(etiquetaMedios({ fuentes: { independientes: 1 } })).toBe('1 medio');
    expect(etiquetaMedios({ fuentes: { independientes: 0 } })).toBeNull();
    expect(etiquetaMedios({ fuentes: { independientes: '12' } })).toBeNull();
  });

  test('si la historia cruza días, el feed sigue diciendo solo la hora', () => {
    expect(
      lineaActualizada({
        ...cardHistoria,
        ultima_actualizacion: '2026-10-17T20:33:50-06:00',
        desarrollos: [
          entrada({ ts: '2026-10-17T20:33:50-06:00' }),
          entrada({ id: 'ayer', ts: '2026-10-16T08:33:00-06:00', texto: 'Ayer' }),
        ],
      })
    ).toBe('actualizada 8:33 p. m.');
  });
});

describe('día corto en historias de varios días', () => {
  test('la fecha se lee del ISO, sin Date ni Intl', () => {
    expect(fechaISO('2026-10-16T20:33:50-06:00')).toBe('2026-10-16');
    expect(fechaISO('2026-01-06T08:05:00-06:00')).toBe('2026-01-06');
    expect(fechaISO('anoche')).toBeNull();
    expect(diaCorto('2026-10-16T20:33:50-06:00')).toBe('16 oct');
    expect(diaCorto('2026-01-06T08:05:00-06:00')).toBe('6 ene');
  });

  test('si el día no es el de la entrada más nueva, se antepone el día corto', () => {
    const ref = '2026-10-17T20:33:50-06:00';
    expect(marcaTiempo(ref, ref)).toBe('8:33 p. m.');
    expect(marcaTiempo('2026-10-17T08:05:00-06:00', ref)).toBe('8:05 a. m.');
    expect(marcaTiempo('2026-10-16T20:33:50-06:00', ref)).toBe('16 oct, 8:33 p. m.');
    expect(marcaTiempo('2026-10-16T08:33:00-06:00', ref)).toBe('16 oct, 8:33 a. m.');
    expect(marcaTiempo('2026-01-06T08:05:00-06:00', ref)).toBe('6 ene, 8:05 a. m.');
  });

  test('en la fila, el día va cuando no es el de la más nueva', () => {
    const card = {
      titulo: TITULO,
      desarrollos: [
        entrada({ id: 'hoy', ts: '2026-10-17T20:33:50-06:00' }),
        entrada({ id: 'manana', ts: '2026-10-17T09:00:00-06:00', texto: 'Misma mañana' }),
        entrada({ id: 'ayer', ts: '2026-10-16T20:33:50-06:00', texto: 'Un día antes' }),
      ],
    };
    const lista = desarrollosDe(card);
    expect(filaDe(lista[0], card, 0).hora).toBe('8:33 p. m.');
    expect(filaDe(lista[1], card, 1).hora).toBe('9:00 a. m.');
    expect(filaDe(lista[2], card, 2).hora).toBe('16 oct, 8:33 p. m.');
  });
});
