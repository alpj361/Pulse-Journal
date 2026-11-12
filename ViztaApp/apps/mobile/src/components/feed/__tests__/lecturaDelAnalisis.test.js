jest.mock('../../../utils/supabase', () => ({ supabase: {} }));
import { articulosDe, leerAnalisis } from '../lecturaDelAnalisis';

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
    expect(por.problema.nota).toBe('sin fuente');
    expect(por.que_hace).toMatchObject({ etiqueta: 'crea', nota: 'Ministerio de Cultura · art. 1' });
    expect(por.quien_gana_quien_asume).toMatchObject({ titulo: 'Municipalidades', etiqueta: 'asume un costo', nota: 'arts. 2 y 3' });
    expect(por.dinero).toMatchObject({ cifra: '1 % del aporte', nota: 'no dice de dónde sale' });
  });

  it('sin nada que mostrar no hay análisis', () => {
    expect(leerAnalisis(null)).toBeNull();
    expect(leerAnalisis({ sections: [seccion('en_una_frase', null)], limitations: [] })).toBeNull();
  });

  it('marca la lectura de un escaneo y lleva el artículo a reformar', () => {
    const a = leerAnalisis({
      sections: [seccion('cambios_ley_vigente', [{ ley: 'Ley de Fomento del Libro', decreto: 'Decreto 30-2001', articulo: '5', operacion: 'reforma', texto_propuesto: 'Artículo 5. …' }])],
      limitations: ['Texto obtenido por OCR; las citas reflejan la transcripción.'],
    });
    expect(a.escaneo).toBe(true);
    expect(a.secciones[0].items[0].ley).toEqual({ decreto: 'Decreto 30-2001', articulo: '5', nombre: 'Ley de Fomento del Libro' });
  });

  it('cuenta los artículos como se leen', () => {
    expect(articulosDe([])).toBeNull();
    expect(articulosDe(['4'])).toBe('art. 4');
    expect(articulosDe(['2', '5', '7'])).toBe('arts. 2, 5 y 7');
  });
});
