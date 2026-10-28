import {
  AVISOS_QUE_SE_VEN,
  agruparAvisos,
  camposEnPalabras,
  cambiosReales,
  difEtiquetas,
  esMerge,
  noLeidos,
  parcheDe,
  repartirSolicitudes,
  venceEn,
} from '../logica';

const yo = { tipo: 'humano', id: 'u1' };
const agente = { tipo: 'agente', id: 'a1' };

// Como las devuelve GET /api/colaboraciones/solicitudes.
const sol = (id, extra) => ({
  id,
  tipo: 'merge_item',
  solicitante_tipo: agente.tipo,
  solicitante_id: agente.id,
  destinatario_tipo: yo.tipo,
  destinatario_id: yo.id,
  estado: 'pendiente',
  created_at: `2026-10-2${id}T10:00:00Z`,
  vence_at: '2026-11-20T10:00:00Z',
  payload: { parche: { campos: { titulo: { valor: 'Nuevo' }, descripcion: { valor: 'x' } } } },
  ...extra,
});

describe('solicitudes', () => {
  it('reparte lo que me piden, lo que pedí y lo vencido; lo resuelto no sale', () => {
    const r = repartirSolicitudes(
      [
        sol('1'),
        sol('2', { estado: 'aprobada' }),
        sol('3', { estado: 'vencida' }),
        sol('4', { solicitante_tipo: 'humano', solicitante_id: 'u1', destinatario_tipo: 'agente', destinatario_id: 'a1' }),
      ],
      yo
    );
    expect(r.tePiden.map((s) => s.id)).toEqual(['1']);
    expect(r.vencidas.map((s) => s.id)).toEqual(['3']);
    expect(r.pediste.map((s) => s.id)).toEqual(['4']);
  });

  it('el parche puede venir en payload.parche o en el payload', () => {
    expect(parcheDe(sol('1')).campos.titulo.valor).toBe('Nuevo');
    expect(parcheDe({ payload: { campos: { url: { valor: 'u' } } } }).campos.url.valor).toBe('u');
  });

  it('dice qué campos toca', () => {
    expect(camposEnPalabras(parcheDe(sol('1')))).toBe('título y descripción');
    expect(camposEnPalabras({ campos: { titulo: {}, etiquetas: {}, url: {} } })).toBe('título, etiquetas y enlace');
  });

  it('cuánto falta para que venza', () => {
    const ahora = new Date('2026-10-24T10:00:00Z');
    expect(venceEn('2026-11-23T10:00:00Z', ahora)).toBe('30 días');
    expect(venceEn('2026-10-26T10:00:00Z', ahora)).toBe('vence en 2 días');
    expect(venceEn('2026-10-25T09:00:00Z', ahora)).toBe('vence mañana');
    expect(venceEn('2026-10-24T08:00:00Z', ahora)).toBe('vence hoy');
  });

  it('solo los merges se abren campo por campo', () => {
    expect(esMerge(sol('1'))).toBe(true);
    expect(esMerge({ tipo: 'merge_investigacion' })).toBe(true);
    expect(esMerge({ tipo: 'permiso' })).toBe(false);
  });

  it('etiquetas: las que quedan, las que se suman y las que se van', () => {
    expect(difEtiquetas(['violencia', 'homicidio'], ['violencia', 'Campo Marte'])).toEqual([
      { texto: 'violencia', estado: 'queda' },
      { texto: 'Campo Marte', estado: 'suma' },
      { texto: 'homicidio', estado: 'quita' },
    ]);
  });

  it('un campo que queda igual no cuenta como cambio', () => {
    expect(cambiosReales([{ campo: 'titulo', cambia: true }, { campo: 'url', cambia: false }]).map((c) => c.campo)).toEqual(['titulo']);
  });
});

describe('avisos', () => {
  const ahora = new Date(2026, 9, 24, 18, 0);
  const aviso = (id, tipo, fecha, leida) => ({ id, tipo, created_at: fecha.toISOString(), leida_at: leida ? fecha.toISOString() : null, payload: {} });

  it('agrupa por día y deja fuera lo que no tiene pantalla', () => {
    const g = agruparAvisos(
      [
        aviso('1', 'mensaje', new Date(2026, 9, 24, 9)),
        aviso('2', 'compartido', new Date(2026, 9, 24, 8)),
        aviso('3', 'solicitud', new Date(2026, 9, 21, 9)),
        aviso('4', 'solicitud_aprobada', new Date(2026, 8, 1, 9)),
      ],
      ahora
    );
    expect(g.map((x) => [x.titulo, x.avisos.map((a) => a.id)])).toEqual([
      ['HOY', ['1']],
      ['ESTA SEMANA', ['3']],
      ['ANTES', ['4']],
    ]);
    expect(AVISOS_QUE_SE_VEN).not.toContain('compartido');
  });

  it('cuenta los no leídos que se ven', () => {
    expect(
      noLeidos([aviso('1', 'mensaje', ahora), aviso('2', 'mensaje', ahora, true), aviso('3', 'compartido', ahora)])
    ).toBe(1);
  });
});

describe('su Codex', () => {
  const { filtrosDeTipos, nombreTipo, cuerpoDe, camposLegibles, sinTituloRepetido, resumenPlano } = require('../logica');

  it('filtra por los tipos que hay, con sus nombres de la app', () => {
    const items = [{ tipo: 'Actor' }, { tipo: 'actor' }, { tipo: 'Source' }, { tipo: 'documento' }, { tipo: 'Snippet' }];
    expect(filtrosDeTipos(items)[0]).toEqual({ clave: 'actor', etiqueta: 'actores', n: 2 });
    expect(nombreTipo('source')).toBe('fuente');
    expect(nombreTipo('snippet', true)).toBe('fragmentos');
  });

  it('un documento sin archivo se lee por su contenido', () => {
    expect(cuerpoDe({ storage_path: null, content: '# T\n\nTexto', descripcion: 'x' })).toBe('# T\n\nTexto');
    expect(cuerpoDe({ details: { Contenido: 'del snippet' } })).toBe('del snippet');
    expect(cuerpoDe({ descripcion: 'solo descripción' })).toBe('solo descripción');
  });

  it('los campos de la ficha se leen como texto; lo anidado no', () => {
    const c = camposLegibles({ Confiabilidad: 4, 'URL de la fuente': 'https://x.gt/a', Periodo: { de: 1 }, 'Términos clave': ['a', 'b'], Contenido: 'no' });
    expect(c).toEqual([
      { clave: 'Confiabilidad', valor: '4' },
      { clave: 'URL de la fuente', valor: 'https://x.gt/a', enlace: true },
      { clave: 'Términos clave', valor: 'a, b' },
    ]);
  });

  it('no repite el título ni muestra marcas en el resumen', () => {
    expect(sinTituloRepetido('# Dossier\n\nCuerpo')).toBe('Cuerpo');
    expect(sinTituloRepetido('Sin encabezado')).toBe('Sin encabezado');
    expect(resumenPlano('# Dossier **verificado** de [MP](https://mp.gob.gt)')).toBe('Dossier verificado de MP');
  });
});

describe('propuestas del PR #56', () => {
  const { cambiosDeSolicitud, camposEnPalabras, traeAntes } = require('../logica');

  it('lee antes y despues por campo', () => {
    const s = { payload: { antes: { name: 'Bernardo Arévalo', tags: ['MP'] }, despues: { name: 'Bernardo Arévalo de León', tags: ['MP'] } } };
    expect(traeAntes(s)).toBe(true);
    expect(cambiosDeSolicitud(s)).toEqual([
      { campo: 'name', antes: 'Bernardo Arévalo', despues: 'Bernardo Arévalo de León', cambia: true },
      { campo: 'tags', antes: ['MP'], despues: ['MP'], cambia: false },
    ]);
    expect(camposEnPalabras(s)).toBe('nombre y etiquetas');
  });

  it('acepta cambios como lista', () => {
    const s = { payload: { antes: { description: 'a' }, cambios: [{ campo: 'description', despues: 'b' }] } };
    expect(cambiosDeSolicitud(s)).toEqual([{ campo: 'description', antes: 'a', despues: 'b', cambia: true }]);
  });

  it('sigue leyendo el parche viejo de documentos', () => {
    const s = { payload: { parche: { campos: { titulo: { valor: 'Nuevo' } } } } };
    expect(traeAntes(s)).toBe(false);
    expect(cambiosDeSolicitud(s)).toEqual([{ campo: 'titulo', antes: null, despues: 'Nuevo', cambia: true }]);
    expect(camposEnPalabras(s)).toBe('título');
  });
});

describe('aprobar por campo', () => {
  const { claveParaAprobar } = require('../logica');
  it('manda la clave del parche aunque despues use otro nombre', () => {
    const s = { payload: { parche: { campos: { titulo: { valor: 'x' }, tags: { valor: [] } } }, despues: { name: 'x', tags: [] } } };
    expect(claveParaAprobar(s, 'name')).toBe('titulo');
    expect(claveParaAprobar(s, 'tags')).toBe('tags');
    expect(claveParaAprobar({ payload: {} }, 'details')).toBe('details');
  });
});

describe('lo que sigue el agente', () => {
  const { resumenSeguimiento, nuevosEnTotal, fuenteDe, cuandoMiro } = require('../logica');
  it('resume lo nuevo y lo importante', () => {
    expect(resumenSeguimiento({ nuevos: 3, importantes: 1 })).toBe('3 nuevas · 1 importante');
    expect(resumenSeguimiento({ nuevos: 1, importantes: 0 })).toBe('1 nueva');
    expect(resumenSeguimiento({ nuevos: 0 })).toBe('');
    expect(nuevosEnTotal([{ nuevos: 2 }, { nuevos: 0 }, { nuevos: 5 }])).toBe(7);
  });
  it('nombra la fuente sin jerga', () => {
    expect(fuenteDe({ fuente_tipo: 'trending_tweets' })).toBe('redes');
    expect(fuenteDe({ fuente_tipo: 'noticias', fuente_nombre: 'Prensa Libre' })).toBe('Prensa Libre');
  });
  it('dice cuándo miró', () => {
    const ahora = new Date('2026-10-25T12:00:00Z');
    expect(cuandoMiro('2026-10-25T10:00:00Z', ahora)).toBe('miró hace 2 h');
    expect(cuandoMiro('2026-10-24T09:00:00Z', ahora)).toBe('miró ayer');
  });
});

describe('temas como llegan del PR #57', () => {
  const { normalizarSeguimiento, normalizarHallazgo } = require('../logica');
  it('saca lo nuevo y lo importante de stats', () => {
    const s = normalizarSeguimiento({ id: 'm', tema: 'Menkos', last_scanned_at: 't', stats: { nuevos_desde_visto_count: 98, strong_count: 90, total_hallazgos: 98 } });
    expect([s.nuevos, s.importantes, s.total, s.revisado_at, s.modo_aviso]).toEqual([98, 90, 98, 't', 'urgentes']);
    expect(normalizarSeguimiento({ stats: { nuevos_desde_visto_count: 0, strong_count: 804 } }).importantes).toBe(0);
  });
  it('el hallazgo trae enlace y veredicto', () => {
    expect(normalizarHallazgo({ source_url: 'u', user_verdict: 'no_es' })).toMatchObject({ url: 'u', veredicto: 'no_es' });
  });
});

describe('título de un hallazgo', () => {
  const { tituloHallazgo } = require('../logica');
  it('nunca dice «Sin título»', () => {
    expect(tituloHallazgo({ titulo: 'MP captura a 7' })).toBe('MP captura a 7');
    expect(tituloHallazgo({ extracto: '**Foppa** en Campo Marte' })).toBe('Foppa en Campo Marte');
    expect(tituloHallazgo({ matched_terms: ['Foppa', 'Campo Marte', 'Foppa'] })).toBe('Menciona Foppa, Campo Marte');
    expect(tituloHallazgo({ fuente_tipo: 'trending_tweets' })).toBe('Una publicación en redes');
  });
});
