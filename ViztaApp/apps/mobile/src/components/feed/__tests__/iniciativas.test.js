import { coincide, enlaceDe, etapaDe, paginasVisibles, paradaDe } from '../iniciativas';
import { filtrarDias, opcionesCongreso } from '../filtros';
import { monto } from '../cifras';
jest.mock('../../../utils/supabase', () => ({ supabase: {} }));

test('cruza las etapas sin retroceder ni inventar un avance', () => {
  const ini = { estado_actual: 'conocio_pleno', eventos_timeline: [{ tipo: 'dictamen' }] };
  expect(etapaDe(ini, [{ stage: 'tercer_debate' }, { stage: 'iniciativa_presentada' }])).toBe('tercer_debate');
  expect(etapaDe({ estado_actual: 'aprobada' }, [{ stage: 'en_comision' }])).toBe('aprobado');
  expect(etapaDe({ decreto_resultante: '3-2026' })).toBe('aprobado');
  expect(etapaDe({ estado_actual: 'desconocido' }, [{ stage: 'eleccion' }])).toBeNull();
  expect(paradaDe('segundo_debate')).toBe('debate');
});
test('busca número y palabras sin tildes', () => {
  const ini = { numero: 6869, titulo: 'Protección del volcán de Agua' };
  expect(coincide(ini, '6869 volcan')).toBe(true);
  expect(coincide(ini, 'agua proteccion')).toBe(true);
  expect(coincide(ini, '68')).toBe(true);
  expect(coincide(ini, 'alquiler')).toBe(false);
});
test('prefiere PDF, ficha y finalmente una fuente identificada', () => {
  const ini = { url_pdf: 'https://congreso.gob.gt/a.pdf', url_ficha: 'https://congreso.gob.gt/ficha', fuente_presentacion_url: 'https://congreso.gob.gt/nota' };
  expect(enlaceDe(ini).tipo).toBe('PDF');
  expect(enlaceDe({ ...ini, url_pdf: null }).tipo).toBe('ficha');
  expect(enlaceDe({ fuente_presentacion_url: ini.fuente_presentacion_url }).tipo).toBe('fuente');
  expect(enlaceDe({ url_pdf: 'javascript:alert(1)' })).toBeNull();
  expect(enlaceDe({}, [{ iniciativa_url: ini.url_ficha }]).tipo).toBe('ficha');
});
test.each([1, 2, 3, 13, 25, 26])('página %i de 26: extremos y vecinas', (actual) => {
  const paginas = paginasVisibles(actual, 26);
  expect(paginas[0]).toBe(1);
  expect(paginas[paginas.length - 1]).toBe(26);
  expect(paginas).toContain(actual);
  expect(paginas.length).toBeLessThanOrEqual(7);
});
test('lista chica sin saltos', () => expect(paginasVisibles(1, 3)).toEqual([1, 2, 3]));
const dias = [{ fecha: '2026-10-24', items: [
  { id: 'n', tipo: 'noticiero' }, { id: 'c', stage: 'dictamen' }, { id: 'p', stage: 'primer_debate' }, { id: 'f', stage: 'otro' },
], votaciones: [{ id: 'v' }] }];
test('los filtros separan noticias y votaciones sin modificar los datos', () => {
  expect(filtrarDias(dias, 'votaciones')[0].items).toEqual([]);
  expect(filtrarDias(dias, 'pleno')[0].items.map((i) => i.id)).toEqual(['p']);
  expect(filtrarDias(dias, 'comisiones')[0].votaciones).toEqual([]);
  expect(opcionesCongreso(dias).map((o) => o.cuenta)).toEqual([4, 1, 1, 1, 1]);
  expect(dias[0].items).toHaveLength(4);
  expect(filtrarDias([], 'pleno')).toEqual([]);
});
test('los montos conservan la escala y normalizan quetzales', () => {
  expect(monto(40000000, 'quetzales (Q)')).toBe('Q40 millones');
  expect(monto(643000000, 'GTQ')).toBe('Q643 millones');
  expect(monto(1375, 'millones de Q')).toBe('Q1.375 mil millones');
  expect(monto(15900000, 'quetzales')).toBe('Q15.9 millones');
  expect(monto(49.86, '%')).toBe('49.86%');
  expect(monto(5000, 'afiliados')).toContain('afiliados');
  expect(monto(null, 'Q')).toBeNull();
  expect(monto('', 'Q')).toBeNull();
});
