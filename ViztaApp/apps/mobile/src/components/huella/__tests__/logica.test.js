import {
  enCurso,
  enfriamientoRestante,
  falta,
  fechaPublicacion,
  motivoDeError,
  nombreLectura,
  porClase,
  respaldoCorto,
  situacion,
  validarCorreccion,
} from '../logica';

describe('situacion: estado del trabajo, separado del perfil', () => {
  test('con huella vigente', () => expect(situacion({ estado: 'listo', huella: { id: 'h' } })).toBe('vigente'));
  test('sin calcular', () => expect(situacion({ estado: 'sin_calcular', huella: null })).toBe('sin_calcular'));
  test('pendiente o procesando se sondea', () => {
    expect(situacion({ estado: 'pendiente', huella: null })).toBe('calculando');
    expect(enCurso({ estado: 'procesando', huella: null })).toBe(true);
  });
  test('desactualizada: se recalcula y no se muestra la anterior', () => {
    expect(situacion({ estado: 'pendiente', huella: null, desactualizada: true })).toBe('recalculando');
  });
  test('error', () => expect(situacion({ estado: 'error', huella: null })).toBe('fallo'));
  test('listo sin huella (invalidada entre lecturas) se vuelve a pedir', () =>
    expect(situacion({ estado: 'listo', huella: null, desactualizada: true })).toBe('calculando'));
});

describe('lecturas', () => {
  const tema = (t, posts, estado = 'lectura_inicial') => ({ clase: 'tema_editorial', tema: t, estado, respaldo: { posts } });
  test('por clase: posturas, temas y narrativas, sin clases vacías', () => {
    const g = porClase([tema('agua', 1), { clase: 'narrativa_publicada', tema: 'x', respaldo: { posts: 1 } }, tema('luz', 3)]);
    expect(g.map((x) => x.clase)).toEqual(['tema_editorial', 'narrativa_publicada']);
    expect(g[0].lecturas.map((l) => l.tema)).toEqual(['luz', 'agua']);
  });
  test('los patrones van primero', () => {
    const g = porClase([tema('a', 9), tema('b', 4, 'patron_respaldado')]);
    expect(g[0].lecturas[0].tema).toBe('b');
  });
  test('nombre: un tema es solo el tema; una postura dice sentido y hacia', () => {
    expect(nombreLectura({ clase: 'tema_editorial', tema: 'Agua' })).toBe('Agua');
    expect(nombreLectura({ clase: 'postura_atribuida', tema: 'Agua', sentido: 'en_contra', hacia: 'EMPAGUA' })).toBe('Agua · en contra EMPAGUA');
    expect(nombreLectura({ clase: 'narrativa_publicada', tema: 'libertad religiosa', sentido: 'a_favor', hacia: 'Libertad religiosa' })).toBe(
      'libertad religiosa · a favor'
    );
  });
  test('respaldo corto', () => {
    expect(respaldoCorto({ posts: 1, dias: 0 })).toBe('1 publicación');
    expect(respaldoCorto({ posts: 4, dias: 12 })).toBe('4 publicaciones · 12 días');
  });
  test('qué falta para ser patrón', () => {
    expect(
      falta({ estado: 'lectura_inicial', evidencia_necesaria: { posts_adicionales_minimos: 3, requiere_fechas: true, requiere_identidad: true } })
    ).toEqual(['3 publicaciones más', 'fechas de publicación', 'confirmar la cuenta']);
    expect(falta({ clase: 'narrativa_publicada', evidencia_necesaria: { requiere_atribucion: true, posts_adicionales_minimos: null } })).toEqual([
      'confirmar quién lo dijo',
    ]);
    expect(falta({ estado: 'patron_respaldado', evidencia_necesaria: { requiere_fechas: true } })).toEqual([]);
  });
  test('sin fecha de publicación no se inventa', () => {
    expect(fechaPublicacion(null)).toBe('fecha desconocida');
    expect(fechaPublicacion('no-fecha')).toBe('fecha desconocida');
  });
});

describe('acciones', () => {
  test('descartar exige comentario; hasta 2000', () => {
    expect(validarCorreccion({ decision: 'descartar', comentario: ' ' })).toBeTruthy();
    expect(validarCorreccion({ decision: 'descartar', comentario: 'era del invitado' })).toBeNull();
    expect(validarCorreccion({ decision: 'aceptar' })).toBeNull();
    expect(validarCorreccion({ decision: 'aceptar', comentario: 'x'.repeat(2001) })).toBeTruthy();
    expect(validarCorreccion({ decision: 'otra' })).toBeTruthy();
  });
  test('enfriamiento de 30 s', () => {
    expect(enfriamientoRestante(null)).toBe(0);
    expect(enfriamientoRestante(1000, 11000)).toBe(20);
    expect(enfriamientoRestante(1000, 40000)).toBe(0);
  });
  test('cada estado HTTP tiene su mensaje', () => {
    for (const s of [0, 401, 403, 404, 409, 422, 503]) expect(motivoDeError({ status: s })).toBeTruthy();
    expect(motivoDeError({ status: 409 })).toMatch(/cambió/);
  });
});

describe('diseño: pasos y avance', () => {
  const { pasosPatron, avanceTema } = require('../logica');
  const perfil = {
    autor: { usuario_confirmado: true },
    reglas: { tema_editorial: { posts_patron: 4, dias_patron: 7 } },
    cobertura: { posts: 5, con_fecha: 0, dias: 0 },
    lecturas: [{ clase: 'tema_editorial', respaldo: { posts: 2 } }],
  };
  test('pasos con su estado', () => {
    const p = pasosPatron(perfil);
    expect(p.map((x) => x.ok)).toEqual([false, false, false, true]);
    expect(p[0].detalle).toBe('El tema con más publicaciones tiene 2');
    expect(p[1].detalle).toBe('Sin fechas de publicación no se puede medir');
    expect(p[2].detalle).toBe('5 de 5 no tienen fecha');
  });
  test('una sola publicación no tiene tiempo que medir', () => {
    expect(pasosPatron({ ...perfil, cobertura: { posts: 1, con_fecha: 1, dias: 0 } })[1].detalle).toBe('Con una sola publicación no hay tiempo que medir');
  });
  test('la huella se llena con lo que más cuesta juntar', () => {
    const { llenadoHuella } = require('../logica');
    expect(llenadoHuella(null)).toBe(0);
    expect(llenadoHuella({ ...perfil, estado: 'patron_respaldado' })).toBe(1);
    // 2 de 4 publicaciones (0.225) + cuenta confirmada (0.1); sin fechas ni tiempo.
    expect(llenadoHuella(perfil)).toBe(0.33);
  });
  test('avance de un tema', () => expect(avanceTema({ respaldo: { posts: 1 } }, perfil)).toEqual({ tiene: 1, meta: 4, avance: 0.25 }));
});
