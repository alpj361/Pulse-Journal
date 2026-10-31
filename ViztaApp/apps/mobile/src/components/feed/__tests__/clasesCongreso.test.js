import { claseDe, diputadoDe, mayoriaDe, repartirActores } from '../clasesCongreso';

// Formas reales de congreso_items_app_view (30-oct) y de la tabla diputados.
const diputados = [
  { nombre: 'Ronald Yomelfy Portillo Cordón', bloque: 'VAMOS' },
  { nombre: 'Julio César Portillo Paz', bloque: 'CABAL' },
  { nombre: 'José Alberto Chic Cardona', bloque: 'VOS' },
  { nombre: 'Carlos Napoleon Rojas Alarcón', bloque: 'VAMOS' },
  { nombre: 'Sonia Marina Gutierrez Raguay', bloque: 'WUM' },
];

describe('claseDe', () => {
  test('lo aprobado, por etapa, por hemiciclo o por votos', () => {
    expect(claseDe({ stage: 'aprobado', card_type: 'timeline' })).toBe('aprobacion');
    expect(claseDe({ card_type: 'hemiciclo', votes: { favor: 134 } })).toBe('aprobacion');
  });
  test('citación por etapa o por título; la interpelación manda', () => {
    expect(claseDe({ stage: 'citacion', titulo: 'CUESTIONA ALZA EN LOS PRECIOS DEL GAS PROPANO' })).toBe('citacion');
    expect(claseDe({ stage: 'otro', titulo: 'CITACIÓN A PNC REPORTA 58 AGENTES CONSIGNADOS' })).toBe('citacion');
    expect(claseDe({ stage: 'citacion', titulo: 'Interpelan al ministro de Comunicaciones' })).toBe('interpelacion');
  });
  test('iniciativa: presentada, o con número en el camino de una ley', () => {
    expect(claseDe({ stage: 'iniciativa_presentada', card_type: 'timeline' })).toBe('iniciativa');
    expect(claseDe({ stage: 'dictamen', iniciativa_numero: '6512' })).toBe('iniciativa');
    expect(claseDe({ stage: 'en_comision', origin: 'comision' })).toBe('comision');
  });
  test('elección, pleno y el resto noticia', () => {
    expect(claseDe({ stage: 'eleccion', card_type: 'ficha' })).toBe('eleccion');
    expect(claseDe({ stage: 'otro', origin: 'pleno', titulo: 'CONGRESO CELEBRA LA 55ª. SESIÓN ORDINARIA' })).toBe('pleno');
    expect(claseDe({ stage: null, origin: null, titulo: 'TRADICIÓN Y RIQUEZA CULTURAL' })).toBe('noticia');
  });
});

describe('quién es quién', () => {
  test('el nombre corto del monitor calza con el completo, si es uno solo', () => {
    expect(diputadoDe('Ronald Portillo', diputados)?.bloque).toBe('VAMOS');
    expect(diputadoDe('diputado Napoleón Rojas', diputados)?.bloque).toBe('VAMOS');
    expect(diputadoDe('Portillo', diputados)).toBeNull();
    expect(diputadoDe('Juan Rodas', diputados)).toBeNull();
  });
  test('reparte diputados, instituciones y personas; los bloques y lo genérico no', () => {
    const r = repartirActores(
      ['Ronald Portillo', 'Vamos', 'bloque VOS', 'Juan Rodas', 'Policía Nacional Civil (PNC)', 'Fegua', 'MSPAS', '160 diputados', 'Congreso de la República', 'Winaq'],
      diputados,
    );
    expect(r.diputados).toEqual([{ nombre: 'Ronald Portillo', bloque: 'Vamos' }]);
    expect(r.instituciones.map((x) => x.nombre)).toEqual(['Policía Nacional Civil (PNC)', 'Fegua', 'MSPAS']);
    expect(r.personas.map((x) => x.nombre)).toEqual(['Juan Rodas']);
  });
  test('qué alcanzó una votación', () => {
    expect(mayoriaDe(134)).toMatch(/dos tercios/);
    expect(mayoriaDe(90)).toMatch(/alcanzó la mayoría absoluta/);
    expect(mayoriaDe(60)).toMatch(/no llegó/);
    expect(mayoriaDe(null)).toBeNull();
  });
});
