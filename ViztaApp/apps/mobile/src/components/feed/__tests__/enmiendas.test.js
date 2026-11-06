import { delAsunto, enlaceAlMomento, esEnmienda, partesResaltadas, tramiteDe } from '../enmiendas';
import { articulosDichos, indexarBiblioteca, nombreDelEstado } from '../estadoDeLeyes';

jest.mock('../../../utils/supabase', () => ({ supabase: { from: jest.fn(), rpc: jest.fn(), auth: { getSession: jest.fn() } } }));

test('una enmienda es la votación de la enmienda, no la del título que ya la incorporó', () => {
  expect(esEnmienda('Aprobación de enmienda por sustitución total del artículo 31 del proyecto de decreto que dispone aprobar la iniciativa de ley 6347')).toBe(true);
  expect(esEnmienda('Aprobación de enmienda por adición de punto nuevo al dictamen y proyecto de acuerdo')).toBe(true);
  expect(esEnmienda('Aprobación del título iv que consta de los capítulos i al iii con las enmiendas incorporadas del proyecto de decreto')).toBe(false);
  expect(esEnmienda('Aprobación del Artículo 3 Con la Enmienda Incorporada del Proyecto de Decreto')).toBe(false);
  expect(esEnmienda('Aprobación del orden del día')).toBe(false);
});

test('del asunto sale lo que dice: tipo, artículo e iniciativa; lo que no dice queda vacío', () => {
  expect(delAsunto('Aprobación de enmienda por sustitución total del artículo 31 del proyecto de decreto que dispone aprobar la iniciativa de ley 6347'))
    .toEqual({ clase: 'por sustitución total', articulo: '31', iniciativa: 6347 });
  expect(delAsunto('Aprobación de enmienda por adición de punto nuevo al dictamen y proyecto de acuerdo'))
    .toEqual({ clase: 'por adición', articulo: null, iniciativa: null });
});

test('lo resaltado de la explicación, y el enlace al momento del video', () => {
  expect(partesResaltadas('Amplió de **30 minutos a 3 horas** el plazo')).toEqual([
    { texto: 'Amplió de ', marca: false }, { texto: '30 minutos a 3 horas', marca: true }, { texto: ' el plazo', marca: false },
  ]);
  expect(enlaceAlMomento('https://www.youtube.com/watch?v=UW', 17204.6)).toBe('https://www.youtube.com/watch?v=UW&t=17204s');
  expect(enlaceAlMomento(null, 10)).toBeNull();
});

test('el trámite: comisión aparte del pleno, la fuente oficial antes que la prensa y sin repetir', () => {
  const { comision, pleno } = tramiteDe([
    { tipo: 'aprobada', fecha: '2026-11-03', fuente_tipo: 'noticia' },
    { tipo: 'aprobada', fecha: '2026-11-03', fuente_tipo: 'acta' },
    { tipo: 'en_comision', fecha: '2024-03-05', detalle: { comision: 'Comisión de Asuntos de Seguridad Nacional' } },
    { tipo: 'dictamen_favorable', fecha: '2026-10-08', fuente_tipo: 'noticia' },
    { tipo: 'presentada', fecha: '2024-02-27' },
    { tipo: 'algo_raro', fecha: '2026-01-01' },
  ]);
  expect(comision.map((p) => p.tipo)).toEqual(['presentada', 'en_comision', 'dictamen_favorable']);
  expect(comision[1].comision).toBe('Comisión de Asuntos de Seguridad Nacional');
  expect(comision[2].prensa).toBe(true);
  expect(pleno).toEqual([expect.objectContaining({ tipo: 'aprobada', prensa: false })]);
});

test('el estado de un decreto sale de la biblioteca; sin ficha, sin confirmar', () => {
  const biblioteca = indexarBiblioteca({
    normas: [
      { id: 'cp', titulo: 'Código Penal', decreto: 'Decreto 17-73', estado: 'vigente', indexado: true },
      { id: 'd2', titulo: 'Reformas al Código Penal', decreto: 'Decreto 2-2025', estado: 'vigente', indexado: true },
      { id: 'v', titulo: 'Reformas al CPP', decreto: 'Decreto 23-2026', estado: 'vetado', indexado: true },
      { id: 'vs', titulo: 'Ley contra la Violencia Sexual', decreto: '9-2009', estado: 'vigente', indexado: true },
    ],
    reformas: [
      { decreto_id: 'd2', norma_destino_id: 'cp', numero_destino: '327 G' },
      { decreto_id: 'd2', norma_destino_id: 'cp', numero_destino: '327 B' },
      { decreto_id: 'd2', norma_destino_id: 'cp', numero_destino: '327 F' },
      { decreto_id: 'd2', norma_destino_id: 'otra', numero_destino: '1' },
    ],
  });
  expect(biblioteca.get('17-73').estado).toBe('reformada');
  expect(biblioteca.get('23-2026').estado).toBe('vetado');
  expect(biblioteca.get('9-2009').estado).toBe('vigente');
  const cambios = biblioteca.get('2-2025').cambia;
  expect(cambios).toHaveLength(1); // la ley que no está en la biblioteca no se nombra
  expect(cambios[0]).toMatchObject({ nombre: 'Código Penal', articulos: ['327 B', '327 F', '327 G'] });
  expect(biblioteca.get('26-2026')).toBeUndefined();
  expect(nombreDelEstado(undefined)).toBe('estado sin confirmar');
  expect(nombreDelEstado('reformada')).toBe('vigente · reformada');
  expect(nombreDelEstado('vetado')).toBe('vetada');
  expect(articulosDichos(['327 B', '327 F', '327 G'])).toBe('arts. 327 B, 327 F y 327 G');
  expect(articulosDichos(['5'])).toBe('art. 5');
});

describe('el camino de un decreto', () => {
  // eslint-disable-next-line global-require
  const { caminoDelDecreto, delDecreto } = require('../estadoDeLeyes');
  const pasos = (c) => c.pasos.map((p) => `${p.clave}${p.hecho ? '✓' : '·'}`).join(' ');

  test('aprobado y enviado: espera la sanción, con su plazo', () => {
    const c = caminoDelDecreto({ estado: 'pendiente_sancion', eventos: [
      { tipo: 'aprobada', fecha: '2026-10-27', fuente_tipo: 'noticia' },
      { tipo: 'pendiente_sancion', fecha: '2026-11-02', fuente_tipo: 'listado' },
    ] });
    expect(pasos(c)).toBe('aprobado✓ ejecutivo✓ sancionado· publicado· vigor·');
    expect(c.pasos[c.actual].clave).toBe('sancionado');
    expect(c.pasos[0]).toMatchObject({ fecha: '2026-10-27', prensa: true });
    expect(c.explicacion).toBe('En manos del Ejecutivo desde el 2 nov 2026: tiene 15 días para sancionarlo o vetarlo.');
  });

  test('vetado: el camino termina en el veto', () => {
    const c = caminoDelDecreto({ estado: 'vetado', eventos: [{ tipo: 'aprobada', fecha: '2026-09-29' }, { tipo: 'vetada', fecha: '2026-10-28' }] });
    expect(pasos(c)).toBe('aprobado✓ ejecutivo✓ vetado✓');
    expect(c.vetado).toBe(true);
    expect(c.pasos[2]).toMatchObject({ veto: true, fecha: '2026-10-28' });
    expect(c.explicacion).toMatch(/dos tercios/);
  });

  test('vigencia diferida: publicado, en vigor en su fecha; vigente, todo pasó', () => {
    const d = caminoDelDecreto({ estado: 'vigencia_diferida', fechaVigencia: '2027-01-01', hoy: '2026-11-06', eventos: [{ tipo: 'sancionada', fecha: '2026-05-14' }] });
    expect(pasos(d)).toBe('aprobado✓ ejecutivo✓ sancionado✓ publicado✓ vigor·');
    expect(d.explicacion).toMatch(/entra en vigor el 1 ene 2027/);
    const v = caminoDelDecreto({ estado: 'vigente', fechaVigencia: '2026-10-01' });
    expect(pasos(v)).toBe('aprobado✓ ejecutivo✓ sancionado✓ publicado✓ vigor✓');
    expect(v.explicacion).toMatch(/Vigente desde el 1 oct 2026/);
  });

  test('las iniciativas de un decreto, aunque sean varias', () => {
    const r = delDecreto('Decreto 23-2026', [
      { numero: 6493, decreto_resultante: '23-2026', eventos_timeline: [{ tipo: 'vetada', fecha: '2026-10-28' }] },
      { numero: 6719, decreto_resultante: '23-2026', eventos_timeline: [] },
      { numero: 1, decreto_resultante: '2-2026' },
    ]);
    expect(r.iniciativas.map((i) => i.numero)).toEqual([6493, 6719]);
    expect(r.eventos).toHaveLength(1);
  });
});
