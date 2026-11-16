jest.mock('../../../utils/supabase', () => ({ supabase: { auth: { getSession: jest.fn() } } }));
import { deSnippet, leerTrabajo, pasoPorTiempo, referencias } from '../casoLegal';

const recuperado = [
  { ref: 'A1', tipo: 'articulo', articulo_id: 'a151', norma_id: 'n1', articulo: 'Art. 151', norma: 'Código de Trabajo' },
  { ref: 'I1', tipo: 'iniciativa', numero: 6001, titulo: 'Licencia', etapa: 'en comision' },
];

describe('analizar un caso', () => {
  it('las referencias del buscador se leen por su clave', () => {
    const m = referencias(recuperado);
    expect(m.get('A1')).toEqual({ ref: 'A1', tipo: 'articulo', articuloId: 'a151', normaId: 'n1', numero: '151', ley: 'Código de Trabajo' });
    expect(m.get('I1')).toMatchObject({ tipo: 'iniciativa', numero: 6001, etapa: 'en comision' });
  });

  it('el trabajo listo trae resumen y secciones en orden, sin referencias inventadas ni listas vacías', () => {
    const r = leerTrabajo({
      id: 'job1', status: 'completed',
      metadata: { source_metadata: { recuperado } },
      result: {
        summary: 'Despido de una trabajadora embarazada.',
        sections: [
          { key: 'fundamentos', data: [{ afirmacion: 'Lo prohíbe el 151.', refs: ['A1', 'A9'] }] },
          { key: 'hechos', data: [{ tipo: 'hecho', texto: 'La despidieron.' }] },
          { key: 'leyes_aplicables', data: [{ ref: 'A1', por_que: 'Toca el despido.' }, { ref: 'A7', por_que: 'No existe.' }] },
          { key: 'contradicciones', data: [] },
          { key: 'iniciativas_relacionadas', data: null },
        ],
        limitations: ['contradicciones: No se encontró contenido para esta sección.', 'El caso es breve.'],
      },
    });
    expect(r.estado).toBe('listo');
    expect(r.resumen).toBe('Despido de una trabajadora embarazada.');
    expect(r.secciones.map((s) => s.key)).toEqual(['hechos', 'leyes_aplicables', 'fundamentos']);
    expect(r.secciones[1].items).toHaveLength(1);
    expect(r.secciones[2].items[0].refs).toEqual(['A1']);
    expect(r.limitaciones).toEqual(['El caso es breve.']);
  });

  it('en curso o fallido no trae secciones', () => {
    expect(leerTrabajo({ id: 'j', status: 'processing' })).toEqual({ estado: 'en_curso', id: 'j', error: null });
    expect(leerTrabajo({ id: 'j', status: 'failed', error_code: 'analysis_no_budget' })).toMatchObject({ estado: 'fallido', error: 'analysis_no_budget' });
  });

  it('una nota se lee con su análisis legal si lo tiene', () => {
    expect(deSnippet({ id: 's1', name: ' Mi caso ', updated_at: 't', analisis: { analysis_id: 'job1', fecha: 'f' }, origen: 'd1' }))
      .toEqual({ id: 's1', titulo: 'Mi caso', actualizado: 't', analisis: { id: 'job1', fecha: 'f' }, documento: 'd1' });
    expect(deSnippet({ id: 's2', name: '', analisis: null }).titulo).toBe('Nota sin título');
  });

  it('el paso que se muestra avanza con el tiempo', () => {
    expect([0, 5, 6, 15, 16, 60].map(pasoPorTiempo)).toEqual([0, 0, 1, 1, 2, 2]);
  });
});
