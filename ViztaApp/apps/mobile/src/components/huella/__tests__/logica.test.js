import {
  delAutor,
  enCurso,
  enfriamientoRestante,
  faltaDe,
  fechaPublicacion,
  fechasCubiertas,
  hayQueSondear,
  llenadoHuella,
  motivoDeError,
  nivelDimension,
  postsDe,
  quienHabla,
  repartir,
  revisionDeVoz,
  situacion,
  validarMotivo,
} from '../logica';

// Formas tomadas de la respuesta real de Tan/Gente (revisión 9, 29-oct).
const terminada = {
  estado: 'evidencia_insuficiente',
  estado_trabajo: 'listo',
  elegibilidad: 'evidencia_insuficiente',
  terminal: true,
  huella: null,
  base_id: '52f08bf2-9c9d-46cf-ae23-d0c59851706f',
};
const ev = (post_id, extra = {}) => ({ observacion_id: `o-${post_id}`, post_id, fecha: '2026-09-29T00:31:17.000Z', voz_local: null, atribuida_al_autor: false, cita: null, ...extra });

describe('situacion: el trabajo, separado de la suficiencia', () => {
  test('terminada con evidencia insuficiente es un resultado, no una espera', () => {
    expect(situacion(terminada)).toBe('lista');
    expect(enCurso(terminada)).toBe(false);
    expect(hayQueSondear(terminada)).toBe(false);
  });
  test('con huella respaldada también', () => expect(situacion({ ...terminada, estado: 'parcial', huella: { dimensiones: [] } })).toBe('lista'));
  test('sin calcular', () => expect(situacion({ estado: 'sin_calcular', estado_trabajo: 'sin_calcular', huella: null })).toBe('sin_calcular'));
  test('pendiente o procesando se sondea', () => {
    expect(situacion({ estado: 'pendiente', estado_trabajo: 'pendiente', huella: null })).toBe('calculando');
    expect(enCurso({ estado: 'procesando', huella: null })).toBe(true);
    expect(hayQueSondear({ estado: 'procesando', huella: null })).toBe(true);
  });
  test('desactualizada: se recalcula y no se muestra la anterior', () => {
    expect(situacion({ estado: 'pendiente', huella: null, desactualizada: true })).toBe('recalculando');
  });
  test('error', () => expect(situacion({ estado: 'error', huella: null })).toBe('fallo'));
  test('listo sin base (invalidada entre lecturas) se vuelve a pedir', () => {
    const r = { estado: 'listo', huella: null, desactualizada: true };
    expect(situacion(r)).toBe('calculando');
    expect(hayQueSondear(r)).toBe(true);
  });
});

describe('llenado y niveles', () => {
  const breve = {
    dimensiones: [
      { clave: 'seleccion_editorial', nivel: 'impresion_inicial' },
      { clave: 'voces', nivel: 'impresion_inicial' },
      { clave: 'posiciones', nivel: 'impresion_inicial' },
      { clave: 'argumentos', nivel: 'sin_observaciones' },
      { clave: 'evolucion', nivel: 'sin_observaciones' },
    ],
  };
  test('Tan/Gente: tres impresiones iniciales llenan poco', () => expect(llenadoHuella(breve)).toBe(0.15));
  test('todo respaldado llena entera', () =>
    expect(llenadoHuella({ dimensiones: breve.dimensiones.map((d) => ({ ...d, nivel: 'huella_respaldada' })) })).toBe(1));
  test('sin lectura breve, vacía', () => expect(llenadoHuella(null)).toBe(0));
  test('nivel por dimensión, con respaldo si falta', () => {
    expect(nivelDimension(breve, 'posiciones')).toBe('impresion_inicial');
    expect(nivelDimension(breve, 'otra')).toBe('sin_observaciones');
  });
});

describe('tarjetas', () => {
  const tema = (titulo, posts) => ({ id: titulo, clase: 'referencia_tematica', titulo, evidencia: posts.map((p) => ev(p)) });
  const decl = (id, extra = {}) => ({ id, clase: 'declaracion_observada', nivel: 'impresion_inicial', evidencia: [ev(id, { cita: 'una frase', ...extra })] });

  test('se reparten por pestaña; los temas con más publicaciones primero', () => {
    const { temas, declaraciones } = repartir([tema('Justicia', ['a']), tema('Agua', ['a', 'b']), decl('d1'), { id: 'x', clase: 'otra' }]);
    expect(temas.map((t) => t.titulo)).toEqual(['Agua', 'Justicia']);
    expect(declaraciones.map((t) => t.id)).toEqual(['d1']);
  });
  test('las lecturas que reúnen fuentes van antes que las declaraciones sueltas', () => {
    const lectura = { id: 'l', clase: 'lectura_por_dimension', nivel: 'en_formacion', evidencia: [ev('a'), ev('b')] };
    expect(repartir([decl('d1'), lectura]).declaraciones[0].id).toBe('l');
  });
  test('de la cuenta solo si todas sus citas lo están', () => {
    expect(delAutor(decl('d', { atribuida_al_autor: true }))).toBe(true);
    expect(delAutor(decl('d'))).toBe(false);
    expect(delAutor({ evidencia: [] })).toBe(false);
  });
  test('fechas cubiertas, por publicación', () => {
    expect(fechasCubiertas([tema('A', ['a', 'b']), { evidencia: [ev('c', { fecha: null })] }])).toEqual({ con: 2, total: 3 });
  });
  test('ids de publicación únicos para traer títulos', () => expect(postsDe([tema('A', ['b', 'a']), tema('B', ['a'])])).toEqual(['a', 'b']));
  test('lo que falta, en palabras', () => {
    expect(faltaDe({ faltantes: ['atribucion_insuficiente', 'respaldo_pendiente', 'desconocido'] })).toEqual(['saber quién lo dice', 'comprobarla en su contexto']);
  });
});

describe('quién habla', () => {
  test('sin voz ni atribución', () => expect(quienHabla(ev('a')).texto).toBe('No se sabe quién lo dijo'));
  test('voz local sin identificar', () => expect(quienHabla(ev('a', { voz_local: 'H2' })).texto).toBe('Voz H2 · sin identificar'));
  test('atribuida por el análisis', () => expect(quienHabla(ev('a', { atribuida_al_autor: true })).tono).toBe('verde'));
  test('la revisión humana manda', () => {
    expect(quienHabla(ev('a', { voz_local: 'H1' }), { relacion: 'voz_de_cuenta', rol: 'anfitrion' })).toMatchObject({ texto: 'Lo dijo la cuenta', confirmado: true });
    expect(quienHabla(ev('a', { voz_local: 'H1', atribuida_al_autor: true }), { relacion: 'tercero', rol: 'invitado' }).texto).toBe('Lo dijo un invitado');
  });
  test('la revisión se busca por publicación y voz', () => {
    const identidad = { config: { voces: { p1: { H1: { relacion: 'tercero', rol: 'invitado' } } } } };
    expect(revisionDeVoz(identidad, 'p1', 'H1')).toMatchObject({ rol: 'invitado' });
    expect(revisionDeVoz(identidad, 'p1', 'H2')).toBeNull();
    expect(revisionDeVoz(identidad, 'p1', null)).toBeNull();
  });
  test('el motivo pide al menos 8 caracteres', () => {
    expect(validarMotivo('corto')).toMatch(/al menos 8/);
    expect(validarMotivo('se presenta al inicio')).toBeNull();
  });
});

describe('acciones y textos', () => {
  test('enfriamiento de 30 s', () => {
    expect(enfriamientoRestante(1000, 1000)).toBe(30);
    expect(enfriamientoRestante(1000, 31000)).toBe(0);
    expect(enfriamientoRestante(null)).toBe(0);
  });
  test('fecha desconocida no se inventa', () => {
    expect(fechaPublicacion(null)).toBe('sin fecha');
    expect(fechaPublicacion('no-fecha')).toBe('sin fecha');
  });
  test('errores por código antes que por estado', () => {
    expect(motivoDeError({ status: 422, code: 'voz_sin_insumo' })).toMatch(/voz no está identificada/);
    expect(motivoDeError({ status: 503, code: 'huella_desactivada' })).toMatch(/desactivados/);
    expect(motivoDeError({ status: 422 })).toBe('Este tipo de ficha no tiene huella de autor.');
    expect(motivoDeError({ status: 0 })).toBe('Sin conexión a internet.');
  });
});
