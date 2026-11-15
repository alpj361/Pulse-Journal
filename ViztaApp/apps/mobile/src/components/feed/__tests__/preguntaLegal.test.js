jest.mock('../../../utils/supabase', () => ({ supabase: { auth: { getSession: jest.fn() } } }));
import { esPregunta, leerRespuestaLegal, partesDeRespuesta } from '../buscadorLegal';

describe('preguntar a la ley', () => {
  it('reconoce una pregunta y no confunde palabras sueltas ni un artículo', () => {
    expect(esPregunta('¿Me pueden despedir si estoy embarazada?')).toBe(true);
    expect(esPregunta('qué pasa si no pago la pensión')).toBe(true);
    expect(esPregunta('es legal cobrar por estacionar')).toBe(true);
    expect(esPregunta('puedo fumar')).toBe(true);
    expect(esPregunta('despido embarazada')).toBe(false);
    expect(esPregunta('art 102 constitución')).toBe(false);
    expect(esPregunta('código de trabajo')).toBe(false);
    expect(esPregunta('esta ley de bancos')).toBe(false);
    expect(esPregunta('¿y?')).toBe(false);
  });

  it('corta la respuesta en texto y citas', () => {
    expect(partesDeRespuesta('Lo prohíbe el artículo 151 [1]. La sanción, el 272 [1, 2].')).toEqual([
      { texto: 'Lo prohíbe el artículo 151 ' }, { citas: [1] }, { texto: '. La sanción, el 272 ' }, { citas: [1, 2] }, { texto: '.' },
    ]);
    expect(partesDeRespuesta('Sin citas.')).toEqual([{ texto: 'Sin citas.' }]);
  });

  it('lee la respuesta del servidor y deja afuera lo que no entiende', () => {
    expect(leerRespuestaLegal({
      success: true, mode: 'legal', estado: 'respondida', respuesta: 'Lo dice el artículo 130 [1].',
      fuentes: [{ articulo_id: 'a130', norma_id: 'n1', articulo: 'Art. 130', norma: 'Código de Trabajo', decreto: 'Decreto 1441' }, { norma: 'sin id' }],
    })).toEqual({
      estado: 'respondida', texto: 'Lo dice el artículo 130 [1].',
      fuentes: [{ articuloId: 'a130', normaId: 'n1', numero: '130', ley: 'Código de Trabajo', decreto: 'Decreto 1441' }],
    });
    expect(leerRespuestaLegal({ success: true, estado: 'fuera_de_tema', respuesta: 'Solo leyes.', fuentes: [] })).toMatchObject({ estado: 'fuera_de_tema', fuentes: [] });
    expect(leerRespuestaLegal({ success: false, code: 'legal_unavailable' })).toBeNull();
    expect(leerRespuestaLegal({ success: true, estado: 'otra' })).toBeNull();
  });
});
