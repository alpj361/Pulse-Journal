jest.mock('../../../utils/supabase', () => ({ supabase: {} }));
import { articulosDe, cifraDeTexto, comparables, esperaDeCache, formatoCifra, leerAnalisis, leerEstado } from '../lecturaDelAnalisis';

const seccion = (key, data, quotes = ['cita literal del texto']) => ({ key, title: key, kind: 'extracted', data, evidence: data === null ? [] : quotes.map((quote) => ({ quote })) });

const resultado = {
  sections: [
    seccion('en_una_frase', 'Crea un fondo municipal para bibliotecas.'),
    seccion('problema', [{ tipo: 'dato', texto: 'El 40 % de los municipios no tiene biblioteca.', fuente_declarada: null }]),
    seccion('que_hace', [{ accion: 'crea', que: 'El Fondo Municipal de Bibliotecas.', quien: 'Ministerio de Cultura', articulos: ['1'] }]),
    seccion('cambios_ley_vigente', null),
    seccion('quien_gana_quien_asume', [{ grupo: 'Municipalidades', efecto: 'carga', como: 'Aportarían el 1 %.', articulos: ['2', '3'] }]),
    seccion('dinero', [{ concepto: 'Aporte al fondo', tipo: 'fondo', monto: '1 % del aporte', fuente_declarada: null, articulos: [] }]),
    seccion('para_revisar', []),
    seccion('preguntas', [{ pregunta: '¿Quién audita el fondo?', a_partir_de: 'para_revisar' }]),
  ],
  limitations: ['cambios_ley_vigente: No reforma leyes vigentes.'],
};

describe('el análisis de una iniciativa', () => {
  it('deja afuera las secciones sin datos', () => {
    const a = leerAnalisis(resultado);
    expect(a.frase).toBe('Crea un fondo municipal para bibliotecas.');
    expect(a.secciones.map((s) => s.key)).toEqual(['problema', 'que_hace', 'quien_gana_quien_asume', 'dinero']);
    expect(a.preguntas).toEqual(['¿Quién audita el fondo?']);
    expect(a.escaneo).toBe(false);
  });

  it('nombra las cosas sin calificar y dice lo que el texto no da', () => {
    const a = leerAnalisis(resultado);
    const por = Object.fromEntries(a.secciones.map((s) => [s.key, s.items[0]]));
    expect(por.problema).toMatchObject({ tipo: 'dato', fuente: null, cifraDato: { valor: 40, unidad: 'porcentaje', etiqueta: null } });
    expect(por.que_hace).toMatchObject({ accion: 'crea', etiqueta: 'crea', quien: 'Ministerio de Cultura', nota: 'art. 1' });
    expect(por.quien_gana_quien_asume).toMatchObject({ titulo: 'Municipalidades', etiqueta: 'asume un costo', nota: 'arts. 2 y 3' });
    expect(por.dinero).toMatchObject({ cifra: '1 %', unidad: 'porcentaje', de: null });
  });

  it('cada dato del problema trae su cifra para dibujarla, y los planteamientos van aparte', () => {
    const a = leerAnalisis({ limitations: [], sections: [seccion('problema', [
      { tipo: 'planteamiento', texto: 'Las condiciones económicas limitan el acceso a estudios.', cifra: null, fuente_declarada: null },
      { tipo: 'dato', texto: 'El 68 % de las personas sin estudios vive en pobreza.', cifra: { valor: 68, unidad: 'porcentaje', etiqueta: 'de las personas sin estudios vive en pobreza' }, fuente_declarada: 'ENCOVI 2023' },
      { tipo: 'dato', texto: 'Uno de cada cuatro jóvenes no estudia.', fuente_declarada: 'Ministerio de Educación' },
    ])] });
    const [plan, conCifra, sinCifra] = a.secciones[0].items;
    expect(plan).toMatchObject({ tipo: 'planteamiento', cifraDato: null });
    expect(conCifra).toMatchObject({ cifraDato: { valor: 68, unidad: 'porcentaje' }, fuente: 'ENCOVI 2023' });
    expect(sinCifra.cifraDato).toBeNull();
  });

  it('sin nada que mostrar no hay análisis', () => {
    expect(leerAnalisis(null)).toBeNull();
    expect(leerAnalisis({ sections: [seccion('en_una_frase', null)], limitations: [] })).toBeNull();
  });

  it('marca la lectura de un escaneo y lleva el artículo a reformar', () => {
    const a = leerAnalisis({
      sections: [seccion('cambios_ley_vigente', [{ ley: 'Ley de Fomento del Libro', decreto: 'Decreto 30-2001', articulo: '5', operacion: 'reforma', texto_propuesto: 'Artículo 5. …' }])],
      limitations: ['Texto obtenido por OCR; las citas reflejan la transcripción y requieren cotejo con el PDF original.'],
    });
    expect(a.escaneo).toBe(true);
    expect(a.secciones[0].items[0].ley).toEqual({ decreto: 'Decreto 30-2001', articulo: '5', nombre: 'Ley de Fomento del Libro' });
  });

  it('lo que el modelo diga del OCR no marca el análisis como escaneado', () => {
    const a = leerAnalisis({ sections: resultado.sections, limitations: ['El contenido presenta errores de OCR en varias palabras.'] });
    expect(a.escaneo).toBe(false);
  });

  it('cuenta los artículos como se leen', () => {
    expect(articulosDe([])).toBeNull();
    expect(articulosDe(['4'])).toBe('art. 4');
    expect(articulosDe(['2', '5', '7'])).toBe('arts. 2, 5 y 7');
  });

  it('el estado del servidor: listo trae el análisis leído; listo vacío cuenta como fallido', () => {
    expect(leerEstado({ estado: 'listo', cache: true, result: resultado })).toMatchObject({ estado: 'listo', cache: true });
    expect(leerEstado({ estado: 'listo', cache: true, result: resultado }).analisis.frase).toBe('Crea un fondo municipal para bibliotecas.');
    expect(leerEstado({ estado: 'listo', result: { sections: [], limitations: [] } }).estado).toBe('fallido');
    expect(leerEstado({ estado: 'en_curso' })).toEqual({ estado: 'en_curso', cache: false, analisis: null });
    expect(leerEstado({ estado: 'otra cosa' }).estado).toBe('sin_pedir');
    expect(leerEstado({ estado: 'fallido', error_code: null }).estado).toBe('sin_pedir');
    expect(leerEstado({ estado: 'fallido', error_code: 'analysis_provider_failed' }).estado).toBe('fallido');
  });

  it('la caché también se espera, entre 5 y 8 segundos', () => {
    expect(esperaDeCache(() => 0)).toBe(5000);
    expect(esperaDeCache(() => 1)).toBe(8000);
  });

  it('la cifra se lee como cantidad: quetzales, porcentajes y períodos', () => {
    expect(formatoCifra(500000000, 'quetzales', 'unica')).toBe('Q500 millones');
    expect(formatoCifra(1500000, 'quetzales', null)).toBe('Q1.5 millones');
    expect(formatoCifra(1000, 'quetzales', 'mensual')).toBe('Q1,000 al mes');
    expect(formatoCifra(0.03, 'porcentaje', null)).toBe('0.03 %');
    expect(formatoCifra(10, 'salarios_minimos', 'anual')).toBe('10 salarios mínimos al año');
    expect(formatoCifra(null, 'quetzales')).toBeNull();
  });

  it('de un monto en letras se saca la cifra (análisis de antes)', () => {
    expect(cifraDeTexto('quinientos millones de quetzales (Q500,000,000.00)')).toEqual({ cantidad: 500000000, unidad: 'quetzales', periodo: null });
    expect(cifraDeTexto('mil quetzales (Q1,000.00) mensuales')).toEqual({ cantidad: 1000, unidad: 'quetzales', periodo: 'mensual' });
    expect(cifraDeTexto('cero punto cero tres porcentual (0.03%)')).toEqual({ cantidad: 0.03, unidad: 'porcentaje', periodo: null });
    expect(cifraDeTexto('hasta un diez por ciento (10%) y al menos un noventa por ciento (90%)')).toBeNull();
  });

  it('el dinero: cifra, de dónde sale, a dónde va y reparto; sin renglones de «no hay»', () => {
    const a = leerAnalisis({ limitations: [], sections: [{ key: 'dinero', title: 'Dinero', data: [
      { concepto: 'Asignación al Fondo de Becas', tipo: 'asignacion', cantidad: 0.03, unidad: 'porcentaje', periodo: null, base: 'de la recaudación del IVA', de: 'recaudación del IVA', para: 'Fondo Nacional de Becas', reparto: [{ parte: 'gestión', porcentaje: 10 }, { parte: 'becas', porcentaje: 90 }], articulos: ['8'] },
      { concepto: 'No se advierten multas en el texto', tipo: 'multa', cantidad: null, unidad: null, periodo: null, base: null, de: null, para: null, reparto: null, articulos: [] },
      { concepto: 'Transferencia', tipo: 'otro', monto: 'mil quetzales (Q1,000.00) mensuales', fuente_declarada: 'No se indica una fuente', articulos: [] },
    ], evidence: [{ quote: 'x' }] }] });
    const [uno, dos] = a.secciones[0].items;
    expect(a.secciones[0].items).toHaveLength(2);
    expect(uno).toMatchObject({ cifra: '0.03 %', base: 'de la recaudación del IVA', de: 'recaudación del IVA', para: 'Fondo Nacional de Becas', etiqueta: 'asignación' });
    expect(uno.reparto).toHaveLength(2);
    expect(dos).toMatchObject({ cifra: 'Q1,000 al mes', de: null });
  });

  it('solo se comparan montos en quetzales del mismo período', () => {
    const items = [
      { unidad: 'quetzales', cantidad: 500000000, periodo: 'unica' },
      { unidad: 'quetzales', cantidad: 250000000, periodo: 'unica' },
      { unidad: 'quetzales', cantidad: 1000, periodo: 'mensual' },
      { unidad: 'porcentaje', cantidad: 3, periodo: null },
    ];
    expect(comparables(items).map((i) => i.proporcion)).toEqual([1, 0.5]);
    expect(comparables(items.slice(2))).toEqual([]);
  });
});
