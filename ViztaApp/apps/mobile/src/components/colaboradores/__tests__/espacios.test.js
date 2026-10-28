import { itemsDelEspacio, itemsPorTipo } from '../logica';

describe('lo de un espacio', () => {
  test('los dashboards van arriba y lo repetido una sola vez', () => {
    const grupos = itemsPorTipo([
      { id: 'a1', tipo: 'actor', titulo: 'Karin Herrera' },
      { id: 'd1', origen_tabla: 'artifacts', artifact_id: 'd1', tipo: 'dashboard', titulo: 'Denuncias' },
      { id: 'e1', tipo: 'entidad', titulo: 'TSE' },
      { id: 'a1', tipo: 'actor', titulo: 'Karin Herrera' },
    ]);
    expect(grupos.map((g) => g.titulo)).toEqual(['Dashboards', 'Actores', 'Entidades']);
    expect(grupos[1].items).toHaveLength(1);
  });

  test('elegir un espacio deja sus dashboards', () => {
    const items = [{ id: 'd1', origen_tabla: 'artifacts', tipo: 'dashboard' }, { id: 'x' }];
    expect(itemsDelEspacio(items, { item_ids: ['d1'] }).map((i) => i.id)).toEqual(['d1']);
  });
});

describe('resumenPlano con HTML de WordPress', () => {
  const { resumenPlano } = require('../logica');
  test('quita etiquetas, entidades y el pie «The post … appeared first on …»', () => {
    const html =
      '<p>El presidente volverá a ofrecer una conferencia [&#8230;]</p>\n<p>The post <a href="https://lahora.gt/x">Después de 8 días</a> appeared first on <a href="https://lahora.gt">La Hora</a>.</p>';
    expect(resumenPlano(html)).toBe('El presidente volverá a ofrecer una conferencia…');
  });
});

describe('tareas quietas', () => {
  const { conTareasVivas, estadoTarea } = require('../logica');
  const ahora = Date.parse('2026-10-28T07:00:00Z');
  const vieja = { id: 'a', estado: 'en_curso', titulo: 'Organizar fichas', updated_at: '2026-10-27T08:24:29Z' };
  const nueva = { id: 'b', estado: 'en_curso', titulo: 'Leer dictámenes', updated_at: '2026-10-28T06:40:00Z' };
  test('una tarea en curso sin avance hace más de una hora no va como «haciendo ahora»', () => {
    expect(conTareasVivas({ haciendo_ahora: vieja, items: [vieja] }, ahora).haciendo_ahora).toBeNull();
    expect(conTareasVivas({ haciendo_ahora: nueva, items: [nueva] }, ahora).haciendo_ahora).toBe(nueva);
  });
  test('en la lista dice «empezada», no «haciendo»', () => {
    expect(estadoTarea(vieja, ahora)).toBe('empezada');
    expect(estadoTarea(nueva, ahora)).toBe('haciendo');
    expect(estadoTarea({ estado: 'pendiente' }, ahora)).toBe('pendiente');
  });
});

describe('adjuntoDe', () => {
  const { adjuntoDe } = require('../logica');
  test('un dashboard va como artifact, con su id de artifact', () => {
    expect(adjuntoDe({ id: 'x', origen_tabla: 'artifacts', artifact_id: 'a1', titulo: 'Zona 6' })).toEqual({
      tipo: 'artifact',
      ref_id: 'a1',
      meta: { titulo: 'Zona 6', tipo: 'dashboard', clave: 'dashboard' },
    });
  });
  test('lo demás va como item, con su tipo', () => {
    expect(adjuntoDe({ id: 'i1', name: 'ONU', tipo: 'Actor' })).toEqual({ tipo: 'item', ref_id: 'i1', meta: { titulo: 'ONU', tipo: 'actor', clave: 'actor' } });
  });
});

describe('nuevosDesde', () => {
  const { nuevosDesde } = require('../logica');
  const avisos = [
    { tipo: 'mensaje', created_at: '2026-10-28T08:00:00Z' },
    { tipo: 'mensaje', created_at: '2026-10-28T10:00:00Z' },
    { tipo: 'mensaje', created_at: '2026-10-28T11:00:00Z', leida_at: '2026-10-28T11:05:00Z' },
  ];
  test('sin haberlos abierto cuenta todo lo sin leer', () => expect(nuevosDesde(avisos, null)).toBe(2));
  test('después de abrirlos solo cuenta lo que llegó luego', () => {
    expect(nuevosDesde(avisos, Date.parse('2026-10-28T09:00:00Z'))).toBe(1);
    expect(nuevosDesde(avisos, Date.parse('2026-10-28T12:00:00Z'))).toBe(0);
  });
});
