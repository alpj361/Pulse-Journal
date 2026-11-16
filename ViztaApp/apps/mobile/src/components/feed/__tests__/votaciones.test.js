import { agruparVotaciones, enFiltro, legible, nombreDeLey, nombrePasos, pasoCorto, tipoVotacion } from '../votaciones';

// Asuntos tal como los escribe el registro del Congreso.
const LEY = 'del Proyecto de Decreto Que Dispone Aprobar la Iniciativa de Ley 6852';
const v = (id, asunto, extra = {}) => ({ id, fecha: '2026-09-22', asunto, resultado: 'aprobada', a_favor: 140, ...extra });
const dia = [
  v('1', 'Aprobación del Orden del Día', { resultado: 'no_aprobada', a_favor: 51 }),
  v('2', 'Aprobación de Actas de Sesiones Anteriores', { resultado: 'no_aprobada' }),
  v('3', 'Aprobación de Moción Privilegiada Para Alterar El Orden del Día (urgencia Nacional 6852)'),
  v('4', `Aprobación En Único Debate ${LEY}`, { iniciativa_numero: 6852 }),
  v('5', `Aprobación del Preámbulo ${LEY}`, { iniciativa_numero: 6852 }),
  v('6', `Aprobación del Artículo 1 ${LEY}`, { iniciativa_numero: 6852 }),
  v('7', `Aprobación de Enmienda Por Sustitución Total Al Artículo 9 ${LEY}`, { iniciativa_numero: 6852 }),
  v('8', `Aprobación de la Redacción Final ${LEY}`, { iniciativa_numero: 6852 }),
];

test('cada votación recibe su tipo por la fórmula del asunto', () => {
  expect(tipoVotacion(dia[0]).tipo).toBe('tramite');
  expect(tipoVotacion(dia[1]).tipo).toBe('tramite');
  // La urgencia de una ley con número es un paso de esa ley, no trámite.
  expect(tipoVotacion(dia[2])).toEqual({ tipo: 'ley', decide: false });
  expect(tipoVotacion(dia[3])).toEqual({ tipo: 'ley', decide: true });
  expect(tipoVotacion(dia[5])).toEqual({ tipo: 'ley', decide: false });
  expect(tipoVotacion(v('x', 'Aprobación de Moción Privilegiada Urgencia Nacional')).tipo).toBe('tramite');
  expect(tipoVotacion(v('x', 'Aprobación Para Limitar El Tiempo del Uso de la Palabra')).tipo).toBe('tramite');
  expect(tipoVotacion(v('x', 'Elección de Planilla Única')).tipo).toBe('eleccion');
  expect(tipoVotacion(v('x', 'Aprobación de Proyecto de Acuerdo Elección de Junta Directiva Para El Periodo Legislativo 2027-2028')).tipo).toBe('eleccion');
  expect(tipoVotacion(v('x', 'Aprobación de Proyecto de Punto Resolutivo (san Miguel Petapa)')).tipo).toBe('acuerdo');
  expect(tipoVotacion(v('x', 'Aprobación de las Objeciones y Observaciones Presentadas En Contra del Decreto 21-2026', { decreto: '21-2026' })).tipo).toBe('ley');
});

test('una ley es un grupo, con el debate arriba y el resto plegado', () => {
  const grupos = agruparVotaciones(dia);
  // El trámite del día va en un solo grupo, todo plegado.
  expect(grupos.map((g) => g.tipo)).toEqual(['ley', 'tramite']);
  expect(grupos[1].principal).toBeNull();
  expect(nombrePasos(grupos[1])).toBe('2 votaciones');
  const ley = grupos[0];
  expect(ley.iniciativa).toBe(6852);
  expect(ley.principal.id).toBe('4');
  expect(ley.pasos.map((p) => p.id)).toEqual(['3', '5', '6', '7', '8']);
  expect(nombrePasos(ley)).toBe('5 votaciones más de esta ley');
});

test('sin debate ese día, la ley se encabeza con la última votación', () => {
  const [g] = agruparVotaciones([dia[5], dia[7]]);
  expect(g.principal.id).toBe('8');
  expect(g.pasos.map((p) => p.id)).toEqual(['6']);
});

test('los pasos de una ley van en el orden en que se discute', () => {
  const mezclados = [dia[7], dia[6], v('9', `Aprobación del Artículo 9 Con la Enmienda Incorporada ${LEY}`, { iniciativa_numero: 6852 }), dia[5], dia[4], dia[2], dia[3],
    v('10', `Aprobación del Capítulo I Que Consta de los Artículos 1 Al 12 Inclusive ${LEY}`, { iniciativa_numero: 6852 })];
  const [g] = agruparVotaciones(mezclados);
  expect(g.principal.id).toBe('4');
  expect(g.pasos.map((p) => p.id)).toEqual(['3', '5', '6', '7', '9', '10', '8']);
});

test('una elección junta a los candidatos del mismo cargo y encabeza quien ganó', () => {
  const cargo = 'Como Jefe de la Contraloría General de Cuentas Para El Período Constitucional 2026-2030';
  const grupos = agruparVotaciones([
    v('a', `Elección de Jorge Castellanos ${cargo}`, { resultado: 'no_aprobada', a_favor: 20 }),
    v('b', `Elección de Elfego Castañon ${cargo}`, { a_favor: 154 }),
    v('c', `Elección Oscar Hernández ${cargo}`, { resultado: 'no_aprobada', a_favor: 13 }),
  ]);
  expect(grupos).toHaveLength(1);
  expect(grupos[0].principal.id).toBe('b');
  expect(nombrePasos(grupos[0])).toBe('otros 2 candidatos');
});

test('los grupos salen del día más nuevo y, dentro del día, lo que decide primero', () => {
  const grupos = agruparVotaciones([
    v('t', 'Aprobación del Orden del Día', { fecha: '2026-10-27' }),
    v('a', 'Aprobación de Proyecto de Acuerdo (jefe de la Contraloria General de Cuentas)', { fecha: '2026-10-06' }),
    v('l', `Aprobación En Tercer Debate ${LEY}`, { fecha: '2026-10-27', iniciativa_numero: 6852 }),
  ]);
  expect(grupos.map((g) => (g.principal || g.pasos[0]).id)).toEqual(['l', 't', 'a']);
});

test('los filtros son tipos, sin uno que valga más', () => {
  const grupos = agruparVotaciones(dia);
  expect(grupos.filter((g) => enFiltro(g, 'ley'))).toHaveLength(1);
  expect(grupos.filter((g) => enFiltro(g, 'tramite'))).toHaveLength(1);
  expect(grupos.filter((g) => enFiltro(g, 'todas'))).toHaveLength(2);
});

test('los pasos y las leyes se leen sin la fórmula del Congreso', () => {
  expect(pasoCorto(dia[5].asunto)).toBe('Artículo 1');
  expect(pasoCorto(dia[6].asunto)).toBe('Enmienda por sustitución total al artículo 9');
  expect(pasoCorto(dia[7].asunto)).toBe('Redacción final');
  // El término del Congreso: lo que se aprueba en único debate es de urgencia nacional.
  expect(pasoCorto(dia[3].asunto)).toBe('Urgencia nacional');
  expect(pasoCorto(`Aprobación En Tercer Debate ${LEY}`)).toBe('Tercer debate');
  expect(pasoCorto(dia[2].asunto)).toBe('Moción de urgencia nacional');
  expect(pasoCorto('Aprobación del Título Ii Que Consta de los Artículos 12 Al 15 Inclusive Con la Enmienda Incorporada del Proyecto de Decreto Que Dispone Apro'))
    .toBe('Título II que consta de los artículos 12 al 15 inclusive con la enmienda incorporada');
  expect(legible('Aprobación del Orden del Día')).toBe('Aprobación del orden del día');
  expect(nombreDeLey('Iniciativa que dispone aprobar Ley de Exención Tributaria Temporal de Emergencia al Consumidor de Combustibles.'))
    .toBe('Ley de Exención Tributaria Temporal de Emergencia al Consumidor de Combustibles');
});

test('la sesión va al lado de la fecha, como la nombra el Congreso', () => {
  const { fechaYSesion, sesionLegible } = require('../votaciones');
  expect(sesionLegible('ordinaria · sesión 54')).toBe('Sesión ordinaria 54');
  expect(fechaYSesion('27 oct 2026', 'ordinaria · sesión 54')).toBe('27 oct 2026 · Sesión ordinaria 54');
  expect(fechaYSesion('27 oct 2026', null)).toBe('27 oct 2026');
});
