import { TYPE_ORDER, normalizeTipo } from '../codex/tipos';

/**
 * Colaboradores: lo que se calcula sin red (STA-259).
 *
 * Funciones puras para la lista, el chat y los permisos. Viven aparte de las
 * pantallas para poder probarlas sin montar nada.
 */

export const PERMISOS = ['leer', 'crear', 'editar', 'eliminar'];

/** Los colaboradores que se muestran: sin los revocados y sin uno mismo. */
export function visibles(colaboradores, miId) {
  return (colaboradores || []).filter(
    (c) => c && c.estado !== 'revocado' && !(c.cuenta_tipo === 'humano' && c.cuenta_id === miId)
  );
}

/** Filtro de la lista: «todos», «agentes» o «personas». */
export function filtrar(colaboradores, filtro) {
  if (filtro === 'agentes') return colaboradores.filter((c) => c.cuenta_tipo === 'agente');
  if (filtro === 'personas') return colaboradores.filter((c) => c.cuenta_tipo === 'humano');
  return colaboradores;
}

/** Los que tienen algo nuevo arriba; el resto, por su último mensaje. */
export function ordenar(colaboradores) {
  const clave = (c) => c.ultimo_mensaje?.created_at || '';
  return colaboradores.slice().sort((a, b) => String(clave(b)).localeCompare(String(clave(a))));
}

/**
 * Qué puede hacer, en palabras: «lee y crea», «lee, crea y edita», «puede todo».
 * Sin ningún permiso, «sin acceso».
 */
export function queHace(permisos) {
  const p = permisos || {};
  if (PERMISOS.every((k) => p[k])) return 'puede todo';
  const verbos = { leer: 'lee', crear: 'crea', editar: 'edita', eliminar: 'borra' };
  const lista = PERMISOS.filter((k) => p[k]).map((k) => verbos[k]);
  if (!lista.length) return 'sin acceso';
  if (lista.length === 1) return lista[0];
  return `${lista.slice(0, -1).join(', ')} y ${lista[lista.length - 1]}`;
}

/** Cuenta corta de lo que espera aprobación: «2 por aprobar». */
export const porAprobar = (n) => (n > 0 ? `${n} por aprobar` : null);

const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

/**
 * La hora de la fila, como en un chat: «4:12» hoy, «ayer», el día de la semana
 * dentro de los siete días, y la fecha después.
 */
export function horaCorta(fecha, ahora = new Date()) {
  if (!fecha) return '';
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return '';
  const inicio = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dias = Math.round((inicio(ahora) - inicio(d)) / 86400000);
  if (dias <= 0) return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  if (dias === 1) return 'ayer';
  if (dias < 7) return DIAS[d.getDay()];
  return d.toLocaleDateString('es-GT', { day: 'numeric', month: 'short' });
}

/** ¿Lo escribió esta cuenta? */
export const esMio = (mensaje, yo) =>
  !!mensaje && !!yo && mensaje.autor_tipo === yo.tipo && mensaje.autor_id === yo.id;

/**
 * ¿El agente todavía no contestó? El último mensaje es mío y el otro es un
 * agente: lo lee cuando se conecte. El backend no lo dice por conversación
 * (duda 9 del README), así que se deduce del chat.
 */
export function esperandoAgente(mensajes, yo, otroTipo) {
  if (otroTipo !== 'agente' || !mensajes?.length) return false;
  return esMio(mensajes[mensajes.length - 1], yo);
}

/** Junta páginas sin repetir: lo viejo arriba, lo nuevo abajo. */
export function unirMensajes(previos, nuevos) {
  const porId = new Map();
  for (const m of [...(previos || []), ...(nuevos || [])]) if (m?.id) porId.set(m.id, m);
  return [...porId.values()].sort((a, b) => {
    const c = String(a.created_at).localeCompare(String(b.created_at));
    return c !== 0 ? c : String(a.id).localeCompare(String(b.id));
  });
}

/** El bloque que respondió un botón: la etiqueta elegida, si hay un click. */
export function respuestaDe(mensaje, blockId) {
  const ev = (mensaje?.action_events || [])
    .filter((e) => e.block_id === blockId && e.tipo === 'click')
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
  return ev ? ev.payload?.label || ev.payload?.action || 'listo' : null;
}

/**
 * Los bloques que la app sabe mostrar. Votación, línea de tiempo, tablero,
 * OpenUI y lo cifrado todavía no existen en la app: no se muestran ni se
 * anuncian. Cuando entren, se suman acá y en Bloques.jsx.
 */
export const SE_VEN = ['text', 'code', 'attachment', 'artifact_ref', 'seguimiento_ref'];

/**
 * Los bloques de un mensaje que se dibujan. Un mensaje sin bloques pero con
 * cuerpo se muestra como texto; los adjuntos sueltos, como adjuntos.
 */
export function bloquesDe(mensaje) {
  if (!mensaje || mensaje.ciphertext) return [];
  const bloques = Array.isArray(mensaje.blocks) ? mensaje.blocks.filter((b) => b && SE_VEN.includes(b.type)) : [];
  const salida = bloques.length
    ? bloques
    : mensaje.cuerpo
      ? [{ id: 'cuerpo', type: 'text', payload: { text: mensaje.cuerpo } }]
      : [];
  const sueltos = (mensaje.adjuntos || []).map((a, i) => ({ id: `adj${i}`, type: 'attachment', payload: a }));
  return [...salida, ...sueltos];
}

/** ¿Tiene algo que mostrar? Un mensaje que solo trae lo que no existe, no sale. */
export const seVe = (mensaje) => bloquesDe(mensaje).length > 0;

/** Un permiso cambiado, sin tocar los otros. */
export const conPermiso = (permisos, clave, valor) => ({ ...(permisos || {}), [clave]: !!valor });

/** El primer renglón de la fila: lo último que se dijo, o nada. */
export function previa(colaborador) {
  const u = colaborador?.ultimo_mensaje;
  if (!u) return '';
  return u.cuerpo ? String(u.cuerpo).replace(/\s+/g, ' ').trim() : '';
}

/** «nota», «enlace»…: el tipo de un ítem del Codex, en minúscula. */
export const tipoItem = (item) => String(item?.tipo || 'ítem').toLowerCase();

// ─── Solicitudes y merge (fase 2) ────────────────────────────────────────────

const MERGE = ['merge_item', 'merge_investigacion'];
export const esMerge = (s) => MERGE.includes(s?.tipo);

/** El parche de una solicitud: el backend acepta `payload.parche` o el payload entero. */
export const parcheDe = (s) => s?.payload?.parche || s?.payload || {};

/** Cómo se llama cada campo en pantalla. */
export const ETIQUETA_CAMPO = {
  titulo: 'título',
  title: 'título',
  descripcion: 'descripción',
  description: 'descripción',
  etiquetas: 'etiquetas',
  proyecto: 'proyecto',
  url: 'enlace',
  status: 'estado',
  name: 'nombre',
  tags: 'etiquetas',
  subcategory: 'subcategoría',
  details: 'campos de la ficha',
  content: 'contenido',
};

/**
 * Los campos que propone una solicitud, de cualquiera de sus formas:
 * `{ parche: { campos: { x: { valor } } } }` (merge de documentos),
 * `{ campos: {…} }`, o la del PR #56 con `antes` y `despues` / `cambios`
 * (objeto por campo o lista `[{ campo, antes, despues }]`).
 */
export function cambiosDeSolicitud(s) {
  const p = s?.payload || {};
  const antes = p.antes && typeof p.antes === 'object' ? p.antes : {};
  const iguales = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  const fila = (campo, despues, previo = antes[campo]) => ({ campo, antes: previo ?? null, despues, cambia: !iguales(previo, despues) });
  if (Array.isArray(p.cambios)) {
    return p.cambios.filter((c) => c && c.campo).map((c) => fila(c.campo, c.despues ?? c.valor, c.antes ?? antes[c.campo]));
  }
  const propuesto = p.despues || (p.cambios && typeof p.cambios === 'object' ? p.cambios : null);
  if (propuesto && typeof propuesto === 'object') return Object.entries(propuesto).map(([k, v]) => fila(k, v));
  const campos = p.parche?.campos || p.campos;
  if (campos && typeof campos === 'object') {
    return Object.entries(campos).map(([k, v]) => fila(k, v && typeof v === 'object' && 'valor' in v ? v.valor : v));
  }
  return [];
}

const ALIAS = { name: 'titulo', titulo: 'name', description: 'descripcion', descripcion: 'description', tags: 'etiquetas', etiquetas: 'tags', content: 'contenido', contenido: 'content' };

/**
 * La clave con que `/aprobar` reconoce un campo: la del parche
 * (`parche.campos`). Si en `despues` vino con otro nombre (`name` / `titulo`),
 * se traduce; si el parche no lo tiene, va tal cual.
 */
export function claveParaAprobar(s, campo) {
  const p = s?.payload || {};
  const delParche = Object.keys(p.parche?.campos || p.campos || {});
  if (!delParche.length || delParche.includes(campo)) return campo;
  return delParche.includes(ALIAS[campo]) ? ALIAS[campo] : campo;
}

/** ¿La solicitud ya trae el antes? Entonces no hace falta pedir la vista previa. */
export const traeAntes = (s) => !!(s?.payload?.antes && typeof s.payload.antes === 'object');

/** «título y descripción»: los campos que toca un parche, en palabras. */
export function camposEnPalabras(parcheOSolicitud) {
  const claves = parcheOSolicitud?.payload
    ? cambiosDeSolicitud(parcheOSolicitud).map((c) => c.campo)
    : Object.keys(parcheOSolicitud?.campos || {});
  const nombres = [...new Set(claves.map((c) => ETIQUETA_CAMPO[c] || c))];
  if (nombres.length <= 1) return nombres[0] || '';
  return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
}

/** Días que le quedan a una solicitud: «vence hoy», «vence en 2 días», «30 días». */
export function venceEn(venceAt, ahora = new Date()) {
  if (!venceAt) return '';
  const dias = Math.ceil((new Date(venceAt).getTime() - ahora.getTime()) / 86400000);
  if (!Number.isFinite(dias)) return '';
  if (dias <= 0) return 'vence hoy';
  if (dias === 1) return 'vence mañana';
  if (dias <= 7) return `vence en ${dias} días`;
  return `${dias} días`;
}

/** «venció el 20 sep». */
export const vencio = (s) =>
  `venció el ${new Date(s?.vence_at || s?.resuelta_at || Date.now()).toLocaleDateString('es-GT', { day: 'numeric', month: 'short' })}`;

/**
 * Reparte las solicitudes: lo que me piden y está abierto, lo que pedí, y lo
 * que me pedían y venció. Lo aprobado o rechazado ya no se muestra.
 */
export function repartirSolicitudes(solicitudes, yo) {
  const mia = (s) => s.destinatario_tipo === yo.tipo && s.destinatario_id === yo.id;
  const pedida = (s) => s.solicitante_tipo === yo.tipo && s.solicitante_id === yo.id;
  const nuevas = (a, b) => String(b.created_at).localeCompare(String(a.created_at));
  const lista = solicitudes || [];
  return {
    tePiden: lista.filter((s) => mia(s) && s.estado === 'pendiente').sort(nuevas),
    pediste: lista.filter((s) => pedida(s) && s.estado === 'pendiente').sort(nuevas),
    vencidas: lista.filter((s) => mia(s) && s.estado === 'vencida').sort(nuevas),
  };
}

/** Etiquetas antes y después: cuáles quedan, cuáles se suman, cuáles se van. */
export function difEtiquetas(antes, despues) {
  const a = Array.isArray(antes) ? antes.map(String) : [];
  const d = Array.isArray(despues) ? despues.map(String) : [];
  return [
    ...d.map((t) => ({ texto: t, estado: a.includes(t) ? 'queda' : 'suma' })),
    ...a.filter((t) => !d.includes(t)).map((t) => ({ texto: t, estado: 'quita' })),
  ];
}

/** Los cambios que de verdad cambian algo. */
export const cambiosReales = (cambios) => (cambios || []).filter((c) => c.cambia !== false);

// ─── Avisos (fase 2) ─────────────────────────────────────────────────────────

/** Los avisos que tienen a dónde llevar. Compartido llega con su pantalla. */
export const AVISOS_QUE_SE_VEN = ['mensaje', 'solicitud', 'solicitud_aprobada', 'solicitud_rechazada', 'seguimiento', 'seguimiento_hallazgo'];

export const noLeidos = (avisos) =>
  (avisos || []).filter((a) => AVISOS_QUE_SE_VEN.includes(a.tipo) && !a.leida_at).length;

/** «HOY», «ESTA SEMANA», «ANTES». */
export function grupoDe(fecha, ahora = new Date()) {
  const d = new Date(fecha);
  const inicio = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dias = Math.round((inicio(ahora) - inicio(d)) / 86400000);
  if (dias <= 0) return 'HOY';
  if (dias < 7) return 'ESTA SEMANA';
  return 'ANTES';
}

/** Agrupa avisos en orden, sin repetir el rótulo. */
export function agruparAvisos(avisos, ahora = new Date()) {
  const grupos = [];
  for (const a of avisos || []) {
    if (!AVISOS_QUE_SE_VEN.includes(a.tipo)) continue;
    const g = grupoDe(a.created_at, ahora);
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.titulo === g) ultimo.avisos.push(a);
    else grupos.push({ titulo: g, avisos: [a] });
  }
  return grupos;
}

// ─── Su Codex: tipos del universo y documentos ───────────────────────────────

/** Cómo se nombra cada tipo: [singular, plural]. `Source` es «fuente» en la app. */
const NOMBRES_TIPO = {
  actor: ['actor', 'actores'],
  entidad: ['entidad', 'entidades'],
  source: ['fuente', 'fuentes'],
  fuente: ['fuente', 'fuentes'],
  evidencia: ['evidencia', 'evidencias'],
  evento: ['evento', 'eventos'],
  historia: ['historia', 'historias'],
  snippet: ['fragmento', 'fragmentos'],
  documento: ['documento', 'documentos'],
  nota: ['nota', 'notas'],
  enlace: ['enlace', 'enlaces'],
  'investigación': ['investigación', 'investigaciones'],
  investigacion: ['investigación', 'investigaciones'],
  territorio: ['territorio', 'territorios'],
  concepto: ['concepto', 'conceptos'],
  objeto: ['objeto', 'objetos'],
  artefacto: ['artefacto', 'artefactos'],
  memoria: ['memoria', 'memorias'],
};

/** La clave de tipo de un ítem, en minúscula: `Actor` y `actor` son lo mismo. */
export const claveTipo = (item) => String(item?.tipo || item?.item_type || 'ítem').toLowerCase();

/** «fuente», «actores»… */
export const nombreTipo = (clave, plural = false) => {
  const n = NOMBRES_TIPO[clave];
  if (n) return n[plural ? 1 : 0];
  return plural ? `${clave}s` : clave;
};

/** Los filtros de Su Codex: solo los tipos que hay, con cuántos, el más común primero. */
export function filtrosDeTipos(items) {
  const cuenta = new Map();
  for (const it of items || []) {
    const k = claveTipo(it);
    cuenta.set(k, (cuenta.get(k) || 0) + 1);
  }
  return [...cuenta.entries()].sort((a, b) => b[1] - a[1]).map(([clave, n]) => ({ clave, etiqueta: nombreTipo(clave, true), n }));
}

/**
 * El cuerpo de un ítem para leerlo: el contenido si lo hay, si no la
 * descripción. Un documento sin archivo se lee así, no se busca en Storage.
 */
export const cuerpoDe = (item) => {
  const c = item?.content ?? item?.details?.Contenido ?? null;
  return String(c || item?.descripcion || item?.description || '').trim();
};

/**
 * Los campos de una ficha que se pueden leer como texto: textos, números y
 * listas de textos. El contenido va aparte; lo anidado no se muestra.
 */
export function camposLegibles(details) {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return [];
  return Object.entries(details)
    .filter(([k]) => k !== 'Contenido')
    .map(([k, v]) => {
      if (typeof v === 'string' && v.trim()) return { clave: k, valor: v.trim(), enlace: /^https?:\/\//i.test(v.trim()) };
      if (typeof v === 'number' || typeof v === 'boolean') return { clave: k, valor: String(v) };
      if (Array.isArray(v) && v.length && v.every((x) => typeof x === 'string' || typeof x === 'number')) {
        return { clave: k, valor: v.join(', ') };
      }
      return null;
    })
    .filter(Boolean);
}

/**
 * El cuerpo sin su primer encabezado: un documento suele abrir con su título
 * en `# …`, y la ficha ya lo muestra arriba. Repetirlo obliga a leerlo dos veces.
 */
export const sinTituloRepetido = (texto) => String(texto || '').replace(/^\s*#{1,2}\s+[^\n]*\n+/, '').trim();

/** Un renglón de resumen sin marcas de markdown: «# Dossier **x**» → «Dossier x». */
export const resumenPlano = (texto) =>
  String(texto || '')
    // Algunas fuentes mandan el extracto en HTML («<p>…</p>»).
    .replace(/<[^>]{0,200}>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '')
    .replace(/[*_`~]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();

// ─── Lo que sigue el agente ──────────────────────────────────────────────────

/** «3 nuevas · 1 importante», o nada si no hay nada nuevo. */
export function resumenSeguimiento(s) {
  const partes = [];
  if (s?.nuevos > 0) partes.push(`${s.nuevos} ${s.nuevos === 1 ? 'nueva' : 'nuevas'}`);
  if (s?.importantes > 0) partes.push(`${s.importantes} ${s.importantes === 1 ? 'importante' : 'importantes'}`);
  return partes.join(' · ');
}

/** Cuánto hay sin ver entre todos los temas. */
export const nuevosEnTotal = (seguimientos) => (seguimientos || []).reduce((n, s) => n + (s.nuevos > 0 ? s.nuevos : 0), 0);

/** De dónde salió un hallazgo, en palabras. */
const FUENTE = {
  noticias: 'noticia',
  congreso_items: 'Congreso',
  iniciativas: 'iniciativa',
  pc_items: 'Poder Ciudadano',
  trending_tweets: 'redes',
};
export const fuenteDe = (h) => h?.fuente_nombre || FUENTE[h?.fuente_tipo] || h?.fuente_tipo || '';

/** «miró hace 2 h», «miró ayer»: cuándo revisó por última vez. */
export function cuandoMiro(fecha, ahora = new Date()) {
  if (!fecha) return '';
  const min = Math.round((ahora.getTime() - new Date(fecha).getTime()) / 60000);
  if (!Number.isFinite(min)) return '';
  if (min < 60) return `miró hace ${Math.max(min, 1)} min`;
  if (min < 60 * 24) return `miró hace ${Math.round(min / 60)} h`;
  if (min < 60 * 48) return 'miró ayer';
  return `miró el ${new Date(fecha).toLocaleDateString('es-GT', { day: 'numeric', month: 'short' })}`;
}

/** Cuándo avisa un tema, en palabras. */
export const MODOS_AVISO = [
  { clave: 'urgentes', texto: 'lo urgente' },
  { clave: 'todos', texto: 'todo' },
  { clave: 'silencio', texto: 'nada' },
];

/** El colaborador de un aviso de seguimiento: por su fila o por la cuenta del agente. */
export const colaboradorDeAviso = (lista, payload) =>
  (lista || []).find((c) => (payload?.colaborador_id && c.id === payload.colaborador_id) || (payload?.agente_id && c.cuenta_id === payload.agente_id)) || null;

/**
 * Un tema como lo usa la app, venga como venga (PR #57 manda el monitor con
 * sus números dentro de `stats`). «importantes» son los fuertes entre lo
 * nuevo: «fuerte» solo, sin lo nuevo, marca casi todo y no distingue.
 */
export function normalizarSeguimiento(m) {
  const st = m?.stats || {};
  const nuevos = Number(m?.nuevos ?? st.nuevos_desde_visto_count ?? 0) || 0;
  const fuertes = Number(st.strong_count ?? 0) || 0;
  return {
    ...m,
    nuevos,
    importantes: m?.importantes != null ? Number(m.importantes) || 0 : nuevos > 0 ? Math.min(fuertes, nuevos) : 0,
    total: Number(m?.total ?? st.total_hallazgos ?? 0) || 0,
    revisado_at: m?.revisado_at || m?.last_scanned_at || null,
    ultimo_hallazgo_at: m?.ultimo_hallazgo_at || st.ultimo_hallazgo_at || null,
    modo_aviso: m?.modo_aviso || st.modo_aviso || 'urgentes',
    // `null` mientras el backend no deja elegir la hora: entonces mira a la
    // hora de todos (HORA_DE_TODOS).
    horas: Array.isArray(m?.horas) ? m.horas.filter(esHora).sort() : null,
  };
}

/** Un hallazgo como lo usa la app: enlace y veredicto con sus nombres de base. */
export const normalizarHallazgo = (h) => ({
  ...h,
  url: h?.url || h?.source_url || null,
  veredicto: h?.veredicto ?? h?.user_verdict ?? null,
});

/**
 * El título de un hallazgo: el de la fuente, si no el extracto, si no qué
 * palabras del tema menciona («Menciona Foppa, Campo Marte»), y como último
 * recurso de dónde viene. Nunca «Sin título»: algo encontró, y se dice qué.
 */
export function tituloHallazgo(h) {
  if (h?.titulo) return String(h.titulo);
  const extracto = resumenPlano(h?.extracto);
  if (extracto) return extracto;
  const terminos = (h?.terminos || h?.matched_terms || []).filter(Boolean).map(String);
  if (terminos.length) return `Menciona ${[...new Set(terminos)].slice(0, 3).join(', ')}`;
  const fuente = fuenteDe(h);
  return fuente === 'redes' ? 'Una publicación en redes' : fuente ? `Algo en ${fuente}` : 'Algo sobre este tema';
}

// --- Cuándo mira y cómo se entera ------------------------------------------

/** La hora a la que miran todos los temas mientras no se puede elegir (21:30 en Guatemala). */
export const HORA_DE_TODOS = '21:30';

/** Las horas que se ofrecen para elegir; se pueden marcar hasta `MAX_HORAS`. */
export const HORAS_PARA_ELEGIR = ['06:00', '07:00', '09:00', '12:00', '15:00', '18:00', '21:30', '23:00'];
export const MAX_HORAS = 4;

export const esHora = (h) => typeof h === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(h);

/** «21:30» → «9:30 pm»; «07:00» → «7 am». */
export function horaLegible(h) {
  if (!esHora(h)) return '';
  const [hh, mm] = h.split(':').map(Number);
  const sufijo = hh < 12 ? 'am' : 'pm';
  const doce = hh % 12 || 12;
  return mm ? `${doce}:${String(mm).padStart(2, '0')} ${sufijo}` : `${doce} ${sufijo}`;
}

/** «a las 7 am y 9:30 pm» · «a la 1 pm». */
export function horasEnPalabras(horas) {
  const lista = (horas || []).filter(esHora).sort().map(horaLegible);
  if (!lista.length) return '';
  const unidas = lista.length === 1 ? lista[0] : `${lista.slice(0, -1).join(', ')} y ${lista[lista.length - 1]}`;
  return `${/^1(:| )/.test(lista[0]) && lista.length === 1 ? 'a la' : 'a las'} ${unidas}`;
}

/** Marcar o desmarcar una hora: queda al menos una y no más de `MAX_HORAS`. */
export function alternarHora(horas, h) {
  const ya = new Set((horas || []).filter(esHora));
  if (ya.has(h)) {
    if (ya.size === 1) return [...ya];
    ya.delete(h);
  } else {
    if (ya.size >= MAX_HORAS || !esHora(h)) return [...ya].sort();
    ya.add(h);
  }
  return [...ya].sort();
}

/** Cuándo mira, para la fila de avisos del tema: «Mira a las 9:30 pm». */
export function cuandoMiraTexto(s) {
  if (s?.estado === 'pausado') return 'En pausa: no mira';
  return `Mira ${horasEnPalabras(s?.horas?.length ? s.horas : [HORA_DE_TODOS])}`;
}

/** Si el tema te avisa: todo lo que no es «silencio». */
export const avisaDe = (modo) => !!modo && modo !== 'silencio';

/** Los avisos que un agente conectado puede recibir, en palabras. */
export const EVENTOS_DE_AGENTE = [
  { clave: 'hallazgos.nuevos', texto: 'Cuando encuentra algo', meta: 'en lo que sigue' },
  { clave: 'mensaje.nuevo', texto: 'Cuando le escribís', meta: 'para que conteste sin esperar' },
  { clave: 'solicitud.respondida', texto: 'Cuando respondés lo que pidió', meta: 'aprobado o no' },
];

// --- Ficha del agente --------------------------------------------------------

/** Cómo se dice el estado de una tarea. */
export const ESTADO_TAREA = { en_curso: 'haciendo', pendiente: 'pendiente', pausada: 'en pausa', completada: 'hecha' };

/** Las tareas que siguen abiertas, la que hace primero; y cuántas ya hizo. */
export function repartirTareas(datos) {
  const items = datos?.items || [];
  const orden = { en_curso: 0, pendiente: 1, pausada: 2 };
  const ahoraId = datos?.haciendo_ahora?.id;
  const abiertas = items
    .filter((t) => t.estado !== 'completada' && t.id !== ahoraId)
    .sort((a, b) => (orden[a.estado] ?? 3) - (orden[b.estado] ?? 3) || String(b.updated_at || '').localeCompare(String(a.updated_at || '')));
  const hechas = items.filter((t) => t.estado === 'completada');
  return { ahora: datos?.haciendo_ahora || null, abiertas, hechas };
}

/** Qué hace ahora, para debajo de su nombre en el chat. */
export const haciendoAhora = (datos) => (datos?.haciendo_ahora?.titulo ? String(datos.haciendo_ahora.titulo) : null);

export const TIPO_FUENTE = { medio: 'medio', red: 'red social', oficial: 'oficial', bot: 'cuenta automática', web: 'sitio web' };

/** Las fuentes, las que más usa primero. */
export const ordenarFuentes = (items) =>
  [...(items || [])].sort((a, b) => (Number(b.usos_count) || 0) - (Number(a.usos_count) || 0) || String(a.nombre || '').localeCompare(String(b.nombre || '')));

/** «medio · la usó 12 veces». */
export function metaFuente(f) {
  const usos = Number(f?.usos_count) || 0;
  const veces = usos === 1 ? 'la usó una vez' : usos > 1 ? `la usó ${usos} veces` : null;
  return [TIPO_FUENTE[f?.tipo] || null, veces].filter(Boolean).join(' · ');
}

/** Tocar «confiable» o «no confiable»: si ya estaba, vuelve a sin calificar. */
export const siguienteConfiabilidad = (actual, tocada) => (actual === tocada ? 'sin_calificar' : tocada);

export const TIPO_MEMORIA = { personaje: 'cómo es', contexto: 'contexto', regla: 'regla', hallazgo: 'hallazgo' };

/** Los Espacios del agente, el que tocó último primero. */
export const ordenarEspacios = (datos) =>
  [...(datos?.espacios || [])].sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')));

/** «4 recuerdos · 12 cosas guardadas». */
export function metaEspacio(e) {
  const r = (e?.recuerdos || []).length;
  const i = Number(e?.items_count) || 0;
  return [
    r ? `${r} ${r === 1 ? 'recuerdo' : 'recuerdos'}` : null,
    i ? `${i} ${i === 1 ? 'cosa guardada' : 'cosas guardadas'}` : null,
  ].filter(Boolean).join(' · ');
}


/**
 * «2 pendientes · 1 hecha», para el perfil. Lo que hace ahora ya está en su
 * propia tarjeta arriba: acá no se repite.
 */
export function resumenTareas(datos) {
  const { abiertas, hechas } = repartirTareas(datos);
  const pendientes = abiertas.filter((t) => t.estado !== 'pausada').length;
  return [
    pendientes ? `${pendientes} ${pendientes === 1 ? 'pendiente' : 'pendientes'}` : null,
    hechas.length ? `${hechas.length} ${hechas.length === 1 ? 'hecha' : 'hechas'}` : null,
  ].filter(Boolean).join(' · ') || (datos?.haciendo_ahora ? 'nada más pendiente' : 'sin tareas');
}

/** «12 fuentes · 3 confiables · 1 no confiable». */
export function resumenFuentes(datos) {
  const items = datos?.items || [];
  if (!items.length) return 'todavía ninguna';
  const si = items.filter((f) => f.confiabilidad === 'confiable').length;
  const no = items.filter((f) => f.confiabilidad === 'no_confiable').length;
  return [
    `${items.length} ${items.length === 1 ? 'fuente' : 'fuentes'}`,
    si ? `${si} ${si === 1 ? 'confiable' : 'confiables'}` : null,
    no ? `${no} no ${no === 1 ? 'confiable' : 'confiables'}` : null,
  ].filter(Boolean).join(' · ');
}

/** «3 espacios». */
export function resumenEspacios(datos) {
  const n = (datos?.espacios || []).length;
  return n ? `${n} ${n === 1 ? 'espacio' : 'espacios'}` : 'todavía ninguno';
}

export const FILTROS_FUENTES = [
  { clave: null, texto: 'todas' },
  { clave: 'sin_calificar', texto: 'sin calificar' },
  { clave: 'confiable', texto: 'confiables' },
  { clave: 'no_confiable', texto: 'no confiables' },
];

export const filtrarFuentes = (items, filtro) =>
  filtro ? (items || []).filter((f) => (f.confiabilidad || 'sin_calificar') === filtro) : items || [];

const PLURAL_TIPO = {
  Actor: 'Actores', Entidad: 'Entidades', Territorio: 'Territorios', Evento: 'Eventos', Concepto: 'Conceptos',
  Documento: 'Documentos', Evidencia: 'Evidencias', Historia: 'Historias', Objeto: 'Objetos', Artefacto: 'Artefactos',
  Ref: 'Referencias', Snippet: 'Fragmentos', Post: 'Publicaciones',
};

/** Lo de un Espacio agrupado por tipo, en el orden del Codex: actores primero. */
export function itemsPorTipo(items) {
  const grupos = new Map();
  for (const it of items || []) {
    const tipo = normalizeTipo(it?.tipo || it?.subcategory);
    if (!grupos.has(tipo)) grupos.set(tipo, []);
    grupos.get(tipo).push(it);
  }
  const orden = (t) => {
    const i = TYPE_ORDER.indexOf(t);
    return i === -1 ? TYPE_ORDER.length : i;
  };
  return [...grupos.entries()]
    .sort((a, b) => orden(a[0]) - orden(b[0]) || a[0].localeCompare(b[0]))
    .map(([tipo, lista]) => ({ tipo, titulo: PLURAL_TIPO[tipo] || tipo, items: lista }));
}

/** Sus Espacios como los pinta el carrusel del Codex (`name`, `itemIds`). */
export const espaciosParaCarrusel = (datos) =>
  ordenarEspacios(datos).map((e) => ({
    ...e,
    name: e.nombre,
    cover: e.cover || e.portada_url || null,
    coverPath: e.cover_path || e.coverPath || null,
    itemIds: Array.isArray(e.item_ids) ? e.item_ids : Array.from({ length: Number(e.items_count) || 0 }),
  }));

/** Una fuente (un artículo, un documento citado) tiene su propia ficha. */
export const esFuente = (item) => ['source', 'fuente'].includes(claveTipo(item));

/** El enlace de una fuente: el suyo o el de sus campos. */
export const enlaceDeFuente = (item) => {
  const d = item?.details || {};
  const url = item?.url || d['URL de la fuente'] || d.url || d.URL || null;
  return typeof url === 'string' && /^https?:\/\//i.test(url.trim()) ? url.trim() : null;
};

/** «lahora.gt» de un enlace, para decir de qué medio es. */
export const dominioDe = (url) => {
  const m = /^https?:\/\/(?:www\.)?([^/]+)/i.exec(String(url || ''));
  return m ? m[1] : null;
};

/** Los campos de una fuente que la ficha ya dice arriba no se repiten abajo. */
export const camposDeFuente = (details) =>
  camposLegibles(details).filter((c) => !['URL de la fuente', 'Notas de la fuente', 'Fecha de publicación'].includes(c.clave));

/** Un documento o fragmento (texto largo con formato) se lee, no se ficha. */
export const esDocumento = (item) => item?.origen_tabla === 'codex_items' || ['snippet', 'documento', 'document', 'nota'].includes(claveTipo(item));

/**
 * Lo que recuerda en cada Espacio, como un ítem más de «Todo lo que guardó»
 * (tipo `memoria`). Con `espacioId`, solo las de ese Espacio.
 */
export function memoriasComoItems(espacios, espacioId = null) {
  const out = [];
  for (const e of espacios || []) {
    if (espacioId && e.id !== espacioId) continue;
    for (const r of e.recuerdos || []) {
      out.push({
        id: `memoria-${r.id}`,
        recuerdo_id: r.id,
        origen_tabla: 'memoria',
        tipo: 'memoria',
        titulo: r.titulo || 'Recuerdo',
        descripcion: r.contenido || '',
        content: r.contenido || '',
        clase: r.tipo || null,
        espacio_id: e.id,
        espacio_nombre: e.nombre || e.name || null,
        updated_at: r.updated_at || e.updated_at || null,
      });
    }
  }
  return out;
}

/**
 * Lo guardado que es de un Espacio: lo suyo que está en `item_ids` y lo de
 * otros (`items_fuera`). `null` si el backend todavía no dice qué tiene.
 */
export function itemsDelEspacio(items, espacio) {
  if (!espacio || !Array.isArray(espacio.item_ids)) return null;
  const ids = new Set(espacio.item_ids.map(String));
  const propios = (items || []).filter((it) => ids.has(String(it.id)));
  const ya = new Set(propios.map((it) => String(it.id)));
  const fuera = (espacio.items_fuera || []).filter((it) => it?.id && !ya.has(String(it.id)));
  return [...propios, ...fuera];
}
