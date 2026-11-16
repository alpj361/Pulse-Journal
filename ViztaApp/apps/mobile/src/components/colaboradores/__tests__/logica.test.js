import {
  bloquesDe,
  seVe,
  conPermiso,
  esperandoAgente,
  filtrar,
  horaCorta,
  ordenar,
  porAprobar,
  previa,
  queHace,
  respuestaDe,
  unirMensajes,
  visibles,
} from '../logica';
import { puedeColaborar } from '../piezas';

// El loader de la app dibuja con Skia, que no corre en Jest.
jest.mock('../../MorphingInfinity', () => () => null);

jest.mock('../../feed/temas', () => ({
  TEMAS: new Proxy({}, { get: () => ({ lavado: ['#fff', '#eee'], tinta: '#000', marca: '#111' }) }),
}));

const yo = { tipo: 'humano', id: 'u1' };

// Como lo devuelve GET /api/colaboradores (vistaColaboradores).
const investigador = {
  id: 'c1',
  cuenta_tipo: 'agente',
  cuenta_id: 'a1',
  nombre: 'Investigador',
  permisos: { leer: true, crear: true, editar: false, eliminar: false },
  estado: 'activo',
  solicitudes_pendientes: 2,
  ultimo_mensaje: { id: 'm9', conversacion_id: 'k1', created_at: '2026-10-24T10:12:00Z', cuerpo: 'Quiere unir  su\ncronología', cifrado: false },
};

describe('la lista', () => {
  it('saca a los revocados y a uno mismo', () => {
    const lista = [investigador, { ...investigador, id: 'c2', estado: 'revocado' }, { id: 'c3', cuenta_tipo: 'humano', cuenta_id: 'u1' }];
    expect(visibles(lista, 'u1').map((c) => c.id)).toEqual(['c1']);
  });

  it('filtra por agentes o personas', () => {
    const lista = [investigador, { id: 'h', cuenta_tipo: 'humano' }];
    expect(filtrar(lista, 'agentes').map((c) => c.id)).toEqual(['c1']);
    expect(filtrar(lista, 'personas').map((c) => c.id)).toEqual(['h']);
    expect(filtrar(lista, 'todos')).toHaveLength(2);
  });

  it('ordena por el último mensaje; sin mensajes, al final', () => {
    const viejo = { id: 'v', ultimo_mensaje: { created_at: '2026-10-01T00:00:00Z' } };
    const nada = { id: 'n', ultimo_mensaje: null };
    expect(ordenar([nada, viejo, investigador]).map((c) => c.id)).toEqual(['c1', 'v', 'n']);
  });

  it('dice qué puede hacer en palabras', () => {
    expect(queHace(investigador.permisos)).toBe('consulta y propone');
    expect(queHace({ leer: true, crear: true, editar: true })).toBe('consulta, propone y edita tu cuenta');
    expect(queHace({ leer: true, crear: true, editar: true, eliminar: true })).toBe('puede todo');
    expect(queHace({})).toBe('sin acceso');
  });
  it('permisos v4.8: sin editar, lo suyo llega como propuesta', () => {
    const { destinoDe, permisosMcp, catalogoPermisos } = require('../logica');
    expect(destinoDe({ leer: true, crear: true })).toBe('propuesta');
    expect(destinoDe({ editar: true })).toBe('cuenta');
    expect(permisosMcp({ leer: true, crear: true, editar: true, eliminar: false })).toEqual({ leer: true, crear: true, modificar: true, borrar: false });
    expect(catalogoPermisos({ leer: 'del servidor' }).leer.texto).toBe('del servidor');
    expect(catalogoPermisos(null).editar.titulo).toBe('Editar tu cuenta');
  });

  it('cuenta lo que espera aprobación solo si hay algo', () => {
    expect(porAprobar(2)).toBe('2 por aprobar');
    expect(porAprobar(0)).toBeNull();
  });

  it('la previa junta espacios y no muestra lo cifrado', () => {
    expect(previa(investigador)).toBe('Quiere unir su cronología');
    expect(previa({ ultimo_mensaje: { cifrado: true, cuerpo: null } })).toBe('');
    expect(previa({ ultimo_mensaje: null })).toBe('');
  });

  it('la hora como en un chat', () => {
    const ahora = new Date(2026, 9, 24, 18, 0);
    expect(horaCorta(new Date(2026, 9, 24, 4, 7), ahora)).toBe('4:07');
    expect(horaCorta(new Date(2026, 9, 23, 22, 0), ahora)).toBe('ayer');
    expect(horaCorta(new Date(2026, 9, 19, 9, 0), ahora)).toBe('lun');
    expect(horaCorta(null, ahora)).toBe('');
  });
});

describe('el chat', () => {
  const m = (id, created_at, autor = yo) => ({ id, created_at, autor_tipo: autor.tipo, autor_id: autor.id });
  const agente = { tipo: 'agente', id: 'a1' };

  it('une páginas sin repetir, de lo viejo a lo nuevo', () => {
    const r = unirMensajes([m('b', '2'), m('a', '1')], [m('b', '2'), m('c', '3')]);
    expect(r.map((x) => x.id)).toEqual(['a', 'b', 'c']);
  });

  it('espera al agente si lo último es mío', () => {
    expect(esperandoAgente([m('a', '1', agente), m('b', '2')], yo, 'agente')).toBe(true);
    expect(esperandoAgente([m('a', '1'), m('b', '2', agente)], yo, 'agente')).toBe(false);
    expect(esperandoAgente([m('a', '1')], yo, 'humano')).toBe(false);
    expect(esperandoAgente([], yo, 'agente')).toBe(false);
  });

  it('un mensaje con cuerpo y sin bloques se muestra como texto, con sus adjuntos', () => {
    const b = bloquesDe({ cuerpo: 'Hola', adjuntos: [{ tipo: 'item', ref_id: 'i1' }] });
    expect(b.map((x) => x.type)).toEqual(['text', 'attachment']);
    expect(b[0].payload.text).toBe('Hola');
  });

  it('con bloques usa los bloques, no repite el cuerpo', () => {
    const b = bloquesDe({ cuerpo: 'Hola', blocks: [{ id: 't1', type: 'text', payload: { text: 'Hola' } }, { id: 'c', type: 'code', payload: { contenido: 'x' } }] });
    expect(b.map((x) => x.type)).toEqual(['text', 'code']);
  });

  it('lo cifrado no se muestra', () => {
    expect(bloquesDe({ ciphertext: 'zz', blocks: null })).toEqual([]);
    expect(seVe({ ciphertext: 'zz' })).toBe(false);
  });

  it('lo que todavía no existe no se dibuja ni se anuncia', () => {
    const m = { blocks: [{ id: 'v', type: 'votacion', payload: {} }, { id: 'o', type: 'openui', payload: {} }, { id: 't', type: 'text', payload: { text: 'hola' } }] };
    expect(bloquesDe(m).map((b) => b.type)).toEqual(['text']);
    expect(seVe({ blocks: [{ id: 'v', type: 'tablero', payload: {} }] })).toBe(false);
  });

  it('la respuesta de un botón es la última elegida', () => {
    const mensaje = {
      action_events: [
        { block_id: 'o1', tipo: 'click', created_at: '1', payload: { label: 'no' } },
        { block_id: 'o1', tipo: 'click', created_at: '2', payload: { label: 'sí, agregalas' } },
      ],
    };
    expect(respuestaDe(mensaje, 'o1')).toBe('sí, agregalas');
    expect(respuestaDe(mensaje, 'otro')).toBeNull();
  });
});

describe('permisos y acceso', () => {
  it('cambia un permiso sin tocar los otros', () => {
    expect(conPermiso(investigador.permisos, 'editar', true)).toEqual({ leer: true, crear: true, editar: true, eliminar: false });
  });


  it('la puerta es de alfa, beta y admin, con sesión', () => {
    expect(puedeColaborar({ id: 'u', role: 'admin' })).toBe(true);
    expect(puedeColaborar({ id: 'u', role: 'user', roles: ['user', 'Beta'] })).toBe(true);
    expect(puedeColaborar({ id: 'u', role: 'alfa' })).toBe(true);
    expect(puedeColaborar({ id: 'u', role: 'alpha' })).toBe(false);
    expect(puedeColaborar({ id: 'u', role: 'user' })).toBe(false);
    expect(puedeColaborar({ role: 'admin' })).toBe(false);
    expect(puedeColaborar(null)).toBe(false);
  });
});
