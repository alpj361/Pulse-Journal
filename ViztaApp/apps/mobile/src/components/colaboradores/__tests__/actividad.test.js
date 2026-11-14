import { accionDe, agruparAcciones, idsDeAgente, textoDeGrupo } from '../actividad';

jest.mock('../../../utils/supabase', () => ({ supabase: {} }));

const recursos = new Map([
  ['i1', { tabla: 'codex_universe_items', titulo: 'Juan Pérez', tipo: 'persona' }],
  ['i2', { tabla: 'codex_universe_items', titulo: 'Ministerio Público', tipo: 'organizacion' }],
  ['e1', { tabla: 'spaces', titulo: 'Caso USAC' }],
  ['d1', { tabla: 'artifacts', titulo: 'Votaciones de octubre', tipo: 'dashboard' }],
]);
const fila = (id, accion, recurso_id, min, extra = {}) => ({
  id, accion, recurso: extra.recurso || 'codex', recurso_id, detalle: { exito: true, operacion: extra.operacion || null },
  creado_at: new Date(Date.UTC(2026, 10, 1, 20, min)).toISOString(),
});

test('cada acción dice qué verbo y sobre qué; lo que no se puede nombrar no se cuenta', () => {
  expect(accionDe(fila('a', 'crear', 'i1', 0), recursos)).toMatchObject({ verbo: 'crear', clase: 'elemento', titulo: 'Juan Pérez', ref: { tabla: 'codex_universe_items', id: 'i1' } });
  expect(accionDe(fila('b', 'crear', 'i1', 0, { operacion: 'add_item_to_space', recurso: 'workspace' }), recursos)).toMatchObject({ verbo: 'sumar' });
  expect(accionDe(fila('c', 'modificar', 'e1', 0, { recurso: 'workspace' }), recursos)).toMatchObject({ verbo: 'editar', clase: 'espacio' });
  expect(accionDe(fila('d', 'modificar', null, 0, { recurso: 'data_ops' }), recursos)).toBeNull();
  expect(accionDe(fila('e', 'borrar', 'x9', 0), recursos)).toMatchObject({ verbo: 'borrar', clase: 'elemento', ref: null });
});

test('las seguidas del mismo tipo van en una línea, salvo que un mensaje las corte', () => {
  const acciones = [fila('1', 'crear', 'i1', 0), fila('2', 'crear', 'i2', 3), fila('3', 'modificar', 'i1', 4), fila('4', 'modificar', 'e1', 6, { recurso: 'workspace' })]
    .map((f) => accionDe(f, recursos));
  const grupos = agruparAcciones(acciones);
  // Editar lo que acaba de crear no se cuenta aparte.
  expect(grupos.map((g) => [g.verbo, g.clase, g.cosas.length])).toEqual([['crear', 'elemento', 2], ['editar', 'espacio', 1]]);
  expect(textoDeGrupo(grupos[0])).toBe('Creó 2 elementos en tu Codex');
  expect(textoDeGrupo(grupos[1])).toBe('Editó el espacio «Caso USAC»');
  const cortadas = agruparAcciones(acciones.slice(0, 2), [new Date(Date.UTC(2026, 10, 1, 20, 1)).toISOString()]);
  expect(cortadas).toHaveLength(2);
  expect(textoDeGrupo(cortadas[0])).toBe('Creó «Juan Pérez» en tu Codex');
});

test('los textos de sumar, dashboards y borrados', () => {
  const g = (verbo, clase, cosas) => ({ verbo, clase, cosas });
  expect(textoDeGrupo(g('sumar', 'elemento', [{ titulo: 'Juan Pérez' }]))).toBe('Sumó «Juan Pérez» a un espacio');
  expect(textoDeGrupo(g('crear', 'dashboard', [{ titulo: 'Votaciones de octubre' }]))).toBe('Creó el dashboard «Votaciones de octubre»');
  expect(textoDeGrupo(g('borrar', 'elemento', [{ titulo: null }]))).toBe('Borró un elemento de tu Codex');
});

test('un agente aparece por su cuenta o por su fila; una persona no tiene actividad de agente', () => {
  expect(idsDeAgente({ id: 'c1', cuenta_id: 'a1', cuenta_tipo: 'agente' })).toEqual(['a1', 'c1']);
  expect(idsDeAgente({ id: 'c2', cuenta_tipo: 'humano' })).toEqual([]);
});
