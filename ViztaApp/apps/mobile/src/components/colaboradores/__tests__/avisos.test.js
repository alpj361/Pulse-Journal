import {
  HORA_DE_TODOS,
  MAX_HORAS,
  alternarHora,
  horaLegible,
  horasEnPalabras,
  avisaDe,
  cuandoMiraTexto,
  normalizarSeguimiento,
} from '../logica';

describe('cuándo mira', () => {
  test('horas en palabras', () => {
    expect(horaLegible('21:30')).toBe('9:30 pm');
    expect(horaLegible('07:00')).toBe('7 am');
    expect(horaLegible('12:00')).toBe('12 pm');
    expect(horaLegible('00:15')).toBe('12:15 am');
    expect(horaLegible('25:00')).toBe('');
    expect(horasEnPalabras(['21:30', '07:00'])).toBe('a las 7 am y 9:30 pm');
    expect(horasEnPalabras(['13:00'])).toBe('a la 1 pm');
    expect(horasEnPalabras(['06:00', '12:00', '18:00'])).toBe('a las 6 am, 12 pm y 6 pm');
  });

  test('alternar hora: queda al menos una y no más del máximo', () => {
    expect(alternarHora(['21:30'], '07:00')).toEqual(['07:00', '21:30']);
    expect(alternarHora(['21:30'], '21:30')).toEqual(['21:30']);
    const llenas = ['06:00', '07:00', '09:00', '12:00'].slice(0, MAX_HORAS);
    expect(alternarHora(llenas, '23:00')).toEqual(llenas);
    expect(alternarHora(['07:00', '21:30'], '07:00')).toEqual(['21:30']);
  });

  test('cuándo mira y si avisa', () => {
    expect(cuandoMiraTexto({ horas: null })).toBe(`Mira ${horasEnPalabras([HORA_DE_TODOS])}`);
    expect(cuandoMiraTexto({ horas: ['07:00', '21:30'] })).toBe('Mira a las 7 am y 9:30 pm');
    expect(cuandoMiraTexto({ estado: 'pausado' })).toMatch(/^En pausa/);
    expect(avisaDe('urgentes')).toBe(true);
    expect(avisaDe('todos')).toBe(true);
    expect(avisaDe('silencio')).toBe(false);
  });

  test('normalizar: horas solo si el backend las manda', () => {
    expect(normalizarSeguimiento({ id: 'a' }).horas).toBeNull();
    expect(normalizarSeguimiento({ id: 'a', horas: ['21:30', 'x', '07:00'] }).horas).toEqual(['07:00', '21:30']);
  });
});

test('el extracto en HTML se ve como texto', () => {
  const { resumenPlano } = require('../logica');
  expect(resumenPlano('<p>Pantaleón publicó &amp; dijo</p>')).toBe('Pantaleón publicó & dijo');
});

describe('ficha del agente', () => {
  const L = require('../logica');
  test('tareas: la de ahora aparte, abiertas en orden, hechas al final', () => {
    const r = L.repartirTareas({
      haciendo_ahora: { id: 'a', titulo: 'Revisar Foppa' },
      items: [
        { id: 'a', estado: 'en_curso' },
        { id: 'b', estado: 'pausada' },
        { id: 'c', estado: 'pendiente' },
        { id: 'd', estado: 'completada' },
      ],
    });
    expect(r.ahora.id).toBe('a');
    expect(r.abiertas.map((t) => t.id)).toEqual(['c', 'b']);
    expect(r.hechas.map((t) => t.id)).toEqual(['d']);
    expect(L.haciendoAhora({ haciendo_ahora: { titulo: 'Revisar Foppa' } })).toBe('Revisar Foppa');
    expect(L.haciendoAhora(null)).toBeNull();
  });

  test('fuentes: orden, texto y calificación', () => {
    expect(L.ordenarFuentes([{ nombre: 'b', usos_count: 1 }, { nombre: 'a', usos_count: 9 }]).map((f) => f.nombre)).toEqual(['a', 'b']);
    expect(L.metaFuente({ tipo: 'medio', usos_count: 12 })).toBe('medio · la usó 12 veces');
    expect(L.metaFuente({ tipo: 'bot', usos_count: 1 })).toBe('cuenta automática · la usó una vez');
    expect(L.siguienteConfiabilidad('confiable', 'confiable')).toBe('sin_calificar');
    expect(L.siguienteConfiabilidad('sin_calificar', 'no_confiable')).toBe('no_confiable');
  });

  test('espacios: el último primero y su conteo', () => {
    const e = L.ordenarEspacios({ espacios: [{ id: 1, updated_at: '2026-10-01' }, { id: 2, updated_at: '2026-10-20' }] });
    expect(e.map((x) => x.id)).toEqual([2, 1]);
    expect(L.metaEspacio({ recuerdos: [{}, {}], items_count: 1 })).toBe('2 recuerdos · 1 cosa guardada');
    expect(L.metaEspacio({})).toBe('');
  });
});

describe('perfil del agente', () => {
  const L = require('../logica');
  test('resúmenes de las tres puertas', () => {
    expect(L.resumenTareas({ haciendo_ahora: { id: 'a', titulo: 'Revisar Foppa' }, items: [{ id: 'b', estado: 'pendiente' }, { id: 'c', estado: 'pausada' }] })).toBe('haciendo «Revisar Foppa» · 1 pendiente');
    expect(L.resumenTareas({ items: [] })).toBe('sin tareas');
    expect(L.resumenFuentes({ items: [{ confiabilidad: 'confiable' }, { confiabilidad: 'no_confiable' }, {}] })).toBe('3 fuentes · 1 confiable · 1 no confiable');
    expect(L.resumenFuentes({ items: [] })).toBe('todavía ninguna');
    expect(L.resumenEspacios({ espacios: [{}, {}] })).toBe('2 espacios');
  });
  test('filtrar fuentes', () => {
    const items = [{ confiabilidad: 'confiable' }, {}, { confiabilidad: 'no_confiable' }];
    expect(L.filtrarFuentes(items, 'sin_calificar')).toHaveLength(1);
    expect(L.filtrarFuentes(items, null)).toHaveLength(3);
  });
});
