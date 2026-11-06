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
  test('aprobado solo con votos; sin conteo es nota', () => {
    expect(claseDe({ card_type: 'hemiciclo', stage: 'aprobado', votes: { favor: 134 } })).toBe('aprobacion');
    expect(claseDe({ stage: 'aprobado', card_type: 'timeline', titulo: 'UNA SEMANA DE DECISIONES CLAVES' })).toBe('noticia');
    expect(claseDe({ stage: 'aprobado', origin: 'jefes_bloque', votes: { favor: null } })).toBe('pleno');
  });
  test('citación por etapa o por título; la interpelación manda', () => {
    expect(claseDe({ stage: 'citacion', titulo: 'CUESTIONA ALZA EN LOS PRECIOS DEL GAS PROPANO' })).toBe('citacion');
    expect(claseDe({ stage: 'otro', titulo: 'CITACIÓN A PNC REPORTA 58 AGENTES CONSIGNADOS' })).toBe('citacion');
    expect(claseDe({ stage: 'citacion', titulo: 'Interpelan al ministro de Comunicaciones' })).toBe('interpelacion');
  });
  test('interpelación solo si la nota trata de ella, no si la sesión o el resumen la mencionan', () => {
    expect(claseDe({ origin: 'pleno', titulo: 'Abelardo Pinto acudió al Congreso el 5 de noviembre para su interpelación' })).toBe('interpelacion');
    expect(claseDe({ origin: 'jefes_bloque', titulo: 'Proyecto de Orden del Día de la 57ª Sesión Ordinaria', summary: 'Agenda propuesta: acta anterior, interpelaciones a Desarrollo Social, Trabajo y Salud' })).toBe('pleno');
    expect(claseDe({ origin: 'pleno', titulo: 'Sesión 57 cerrada por falta de quórum; interpelación al Mides pendiente' })).toBe('pleno');
    expect(claseDe({ origin: 'pleno', titulo: '57ª Sesión Ordinaria / interpelación — 5 de noviembre de 2026' })).toBe('pleno');
    expect(claseDe({ stage: 'otro', origin: 'otro', titulo: 'PIDEN PROHIBIR PROMOCIONES POLÍTICAS EN ESCUELAS', summary: 'pidió la interpelación de la ministra' })).toBe('noticia');
    expect(claseDe({ stage: 'interpelacion', titulo: 'Comparece la ministra de Educación' })).toBe('interpelacion');
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
