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
