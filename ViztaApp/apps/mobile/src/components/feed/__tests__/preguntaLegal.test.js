jest.mock('../../../utils/supabase', () => ({ supabase: { auth: { getSession: jest.fn() } } }));
import { esPregunta, leerRespuestaLegal, partesDeRespuesta } from '../buscadorLegal';

describe('preguntar a la ley', () => {
  it('reconoce una pregunta y no confunde palabras sueltas ni un artículo', () => {
    expect(esPregunta('¿Me pueden despedir si estoy embarazada?')).toBe(true);
    expect(esPregunta('qué pasa si no pago la pensión')).toBe(true);
    expect(esPregunta('es legal cobrar por estacionar')).toBe(true);
    expect(esPregunta('puedo fumar')).toBe(true);
    expect(esPregunta('esta permitido la zoofilia? tiene pena de carcel')).toBe(true);
    expect(esPregunta('esta permitido portar armas')).toBe(true);
    expect(esPregunta('manejar ebrio tiene multa')).toBe(true);
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
      estado: 'respondida', ambito: 'ley', texto: 'Lo dice el artículo 130 [1].', seguimiento: [],
      fuentes: [{ tipo: 'articulo', clave: 'a130', articuloId: 'a130', normaId: 'n1', numero: '130', ley: 'Código de Trabajo', decreto: 'Decreto 1441' }],
    });
    expect(leerRespuestaLegal({
      success: true, estado: 'respondida', ambito: 'iniciativas', respuesta: 'La iniciativa 6187 propone [1].',
      fuentes: [{ tipo: 'iniciativa', numero: 6187, titulo: 'Ley contra la crueldad animal', etapa: 'en comision' }],
      seguimiento: [{ pregunta: '¿Qué sanciona la ley vigente?', tipo: 'ley' }, { pregunta: '¿Hay otras iniciativas?', tipo: 'iniciativas' }, { pregunta: '' }],
    })).toEqual({
      estado: 'respondida', ambito: 'iniciativas', texto: 'La iniciativa 6187 propone [1].',
      fuentes: [{ tipo: 'iniciativa', clave: 'ini-6187', numero: 6187, titulo: 'Ley contra la crueldad animal', etapa: 'en comision' }],
      seguimiento: [{ pregunta: '¿Qué sanciona la ley vigente?', ambito: 'ley' }, { pregunta: '¿Hay otras iniciativas?', ambito: 'iniciativas' }],
    });
    expect(leerRespuestaLegal({ success: true, estado: 'fuera_de_tema', respuesta: 'Solo leyes.', fuentes: [] })).toMatchObject({ estado: 'fuera_de_tema', fuentes: [] });
    expect(leerRespuestaLegal({ success: false, code: 'legal_unavailable' })).toBeNull();
    expect(leerRespuestaLegal({ success: true, estado: 'otra' })).toBeNull();
  });
});

import { leyesPrimero } from '../buscadorLegal';

describe('resultados del buscador: leyes primero', () => {
  const normas = [
    { id: 'n18', titulo: 'Protocolo con Corea', decreto: 'Decreto 18-2025', tipo: 'decreto', estado: 'vigente' },
    { id: 'n20', titulo: 'Ley pendiente', decreto: 'Decreto 20-2025', tipo: 'decreto', estado: 'pendiente_sancion' },
  ];
  const iniciativas = new Map([
    [6491, { numero: 6491, titulo: 'Protocolo con Corea', estado: 'aprobado', decreto_resultante: '18-2025' }],
    [6500, { numero: 6500, titulo: 'Ley pendiente', estado: 'aprobado', decreto_resultante: '20-2025' }],
    [6600, { numero: 6600, titulo: 'Propuesta', estado: 'en_comision', decreto_resultante: null }],
  ]);
  const ini = (numero) => ({ tipo: 'iniciativa', clave: `iniciativa-${numero}`, numero, partes: [] });

  it('una iniciativa que ya es ley en vigor aparece como la ley; si no está vigente, sigue como iniciativa', () => {
    const r = leyesPrimero([ini(6491), ini(6500), ini(6600)], iniciativas, normas);
    expect(r.map((x) => `${x.tipo}:${x.normaId || x.numero}`)).toEqual(['ley:n18', 'iniciativa:6500', 'iniciativa:6600']);
    expect(r[0]).toMatchObject({ decreto: 'Decreto 18-2025', deIniciativa: 6491 });
  });

  it('las leyes y artículos van antes que las iniciativas, y la ley no se repite', () => {
    const r = leyesPrimero([ini(6600), { tipo: 'articulo', clave: 'a1', normaId: 'n9' }, ini(6491), { tipo: 'ley', clave: 'ley-n18', normaId: 'n18' }], iniciativas, normas);
    expect(r.map((x) => x.clave)).toEqual(['a1', 'ley-n18', 'iniciativa-6600']);
  });
});
