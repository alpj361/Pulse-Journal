/**
 * Reportes de tráfico listos para el mapa.
 *
 * La tabla trae el relato y, casi nunca, un punto. El punto se arma en este
 * orden: coordenadas si existen, si no el kilómetro sobre el tramo que cubre
 * esa ruta (`trafico_tramo_rutas` + la geometría del tramo), si no un lugar
 * que el texto nombra y que ya está en un extremo de tramo o en el puñado de
 * hitos de abajo. Lo que no se puede poner en el mapa igual se muestra: un
 * reporte sin punto sigue siendo un reporte.
 *
 * Causa, efecto y ruta alterna no son columnas. Salen del texto cuando el
 * texto las dice. «Se alterna el paso» es un efecto —un sentido a la vez—, no
 * una ruta alterna.
 */

/** Puente El Incienso, Anillo Periférico. Structurae: 14°38'50.45"N 90°31'39.67"W. */
const HITO_INCIENSO = { lat: 14.64735, lng: -90.52769 };

const TIPOS = {
  bloqueo: { etiqueta: 'bloqueo', icono: 'bloqueo' },
  accidente: { etiqueta: 'accidente', icono: 'accidente' },
  colision: { etiqueta: 'accidente', icono: 'accidente' },
  protesta: { etiqueta: 'protesta', icono: 'protesta' },
  cierre: { etiqueta: 'cierre', icono: 'cierre' },
  obra: { etiqueta: 'obra', icono: 'obra' },
  trabajos: { etiqueta: 'obra', icono: 'obra' },
  derrumbe: { etiqueta: 'derrumbe', icono: 'derrumbe' },
  varado: { etiqueta: 'vehículo varado', icono: 'accidente' },
};

export function tipoDe(tipo) {
  return TIPOS[String(tipo || '').toLowerCase()] || { etiqueta: tipo || 'reporte', icono: 'reporte' };
}

export function vigente(inc, ahora = Date.now()) {
  if (!inc || inc.estado !== 'activo') return false;
  if (!inc.fin) return true;
  const fin = new Date(inc.fin).getTime();
  return !Number.isFinite(fin) || fin > ahora;
}

function sinAcento(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/** «CA-02» y «CA-2» son la misma ruta. El sentido (norte, sur) se conserva. */
export function normRuta(s) {
  const t = sinAcento(s).replace(/[_/]+/g, ' ').replace(/\s+/g, ' ').trim();
  const m = t.match(/\b(ca|rn|rd)\s*-?\s*0*(\d+)(?:\s+(norte|sur|oriente|occidente))?\b/);
  if (!m) return t;
  return `${m[1]}-${m[2]}${m[3] ? ` ${m[3]}` : ''}`;
}

function textoDe(inc) {
  return sinAcento(
    [inc?.descripcion, inc?.municipio, inc?.departamento, inc?.ruta, inc?.raw?.jurisdiccion, inc?.raw?.ruta]
      .filter(Boolean)
      .join(' ')
  );
}

/**
 * CA-9 a secas es norte o sur según el relato. Si no se puede saber, queda
 * «ca-9» y el que ubica no elige un lado al azar.
 */
export function rutaDe(inc) {
  const texto = textoDe(inc);
  let base = normRuta(inc?.ruta || inc?.raw?.ruta || '');
  if (!base || !/^(ca|rn|rd)-/.test(base)) {
    const m = texto.match(/\b(ca|rn|rd)\s*-?\s*0*(\d+)(?:\s+(norte|sur|oriente|occidente))?\b/);
    base = m ? normRuta(`${m[1]}-${m[2]}${m[3] ? ` ${m[3]}` : ''}`) : base;
  }
  if (base === 'ca-9' || base === 'ca-1' || base === 'ca-2') {
    const sur = texto.includes('pacifico') || texto.includes(' sur') || texto.includes('villa nueva');
    const norte = texto.includes('atlantico') || texto.includes(' norte');
    const occidente = texto.includes('occidente');
    const oriente = texto.includes('oriente') && !occidente;
    if (base === 'ca-9' && norte && !sur) return 'ca-9 norte';
    if (base === 'ca-9' && sur && !norte) return 'ca-9 sur';
    if (base === 'ca-1' && occidente) return 'ca-1 occidente';
    if (base === 'ca-1' && oriente) return 'ca-1 oriente';
    if (base === 'ca-2' && occidente) return 'ca-2 occidente';
    if (base === 'ca-2' && oriente) return 'ca-2 oriente';
  }
  return base;
}

export function kmDe(km) {
  if (km == null || km === '') return null;
  const n = Number(km);
  if (!Number.isFinite(n)) return null;
  return n;
}

export function kmTexto(km) {
  const n = kmDe(km);
  if (n == null) return null;
  const redondo = Math.round(n * 10) / 10;
  return Number.isInteger(redondo) ? String(redondo) : String(redondo);
}

function haversine(a, b) {
  const R = 6371000;
  const r = Math.PI / 180;
  const dLat = (b[0] - a[0]) * r;
  const dLng = (b[1] - a[1]) * r;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Un punto a `fraccion` (0–1) del largo de la línea, no del índice. */
export function puntoALoLargo(geometria, fraccion) {
  const pts = (Array.isArray(geometria) ? geometria : []).filter(
    (p) => Array.isArray(p) && Number.isFinite(Number(p[0])) && Number.isFinite(Number(p[1]))
  );
  if (!pts.length) return null;
  if (pts.length === 1) return { lat: Number(pts[0][0]), lng: Number(pts[0][1]) };
  const f = Math.min(1, Math.max(0, Number(fraccion) || 0));
  const dist = [0];
  for (let i = 1; i < pts.length; i += 1) dist[i] = dist[i - 1] + haversine(pts[i - 1], pts[i]);
  const total = dist[dist.length - 1];
  if (total <= 0) return { lat: Number(pts[0][0]), lng: Number(pts[0][1]) };
  const objetivo = f * total;
  for (let i = 1; i < pts.length; i += 1) {
    if (dist[i] + 0.01 < objetivo) continue;
    const span = dist[i] - dist[i - 1] || 1;
    const t = (objetivo - dist[i - 1]) / span;
    return {
      lat: Number(pts[i - 1][0]) + (Number(pts[i][0]) - Number(pts[i - 1][0])) * t,
      lng: Number(pts[i - 1][1]) + (Number(pts[i][1]) - Number(pts[i - 1][1])) * t,
    };
  }
  const ultimo = pts[pts.length - 1];
  return { lat: Number(ultimo[0]), lng: Number(ultimo[1]) };
}

function contieneFrase(texto, frase) {
  if (!frase || frase.length < 6) return false;
  let desde = 0;
  while (desde <= texto.length) {
    const i = texto.indexOf(frase, desde);
    if (i < 0) return false;
    const antes = i === 0 || /[^a-z0-9]/.test(texto[i - 1]);
    const despues = i + frase.length === texto.length || /[^a-z0-9]/.test(texto[i + frase.length]);
    if (antes && despues) return true;
    desde = i + 1;
  }
  return false;
}

function anclasDe(tramos) {
  const anclas = [{ nombre: 'puente el incienso', punto: HITO_INCIENSO, largo: 18 }, { nombre: 'el incienso', punto: HITO_INCIENSO, largo: 11 }];
  for (const t of tramos || []) {
    const geo = t.geometria;
    if (!Array.isArray(geo) || geo.length < 2) continue;
    const inicio = { lat: Number(geo[0][0]), lng: Number(geo[0][1]) };
    const fin = { lat: Number(geo[geo.length - 1][0]), lng: Number(geo[geo.length - 1][1]) };
    for (const [nombre, punto] of [
      [t.desde, inicio],
      [t.hacia, fin],
    ]) {
      const n = sinAcento(nombre);
      if (n.length >= 6 && Number.isFinite(punto.lat)) anclas.push({ nombre: n, punto, largo: n.length });
    }
  }
  return anclas;
}

function porKilometro(inc, tramos, rutas) {
  const ruta = rutaDe(inc);
  const km = kmDe(inc.km);
  if (!ruta || km == null || !/^(ca|rn|rd)-/.test(ruta)) return null;
  const porId = new Map((tramos || []).map((t) => [t.id, t]));
  const cands = (rutas || []).filter((r) => {
    if (normRuta(r.ruta) !== ruta) return false;
    const desde = Number(r.km_desde);
    const hasta = Number(r.km_hasta);
    return Number.isFinite(desde) && Number.isFinite(hasta) && km >= desde && km <= hasta && porId.has(r.tramo_id);
  });
  if (!cands.length) return null;
  const ancho = (r) => Number(r.km_hasta) - Number(r.km_desde);
  const menor = Math.min(...cands.map(ancho));
  const mismo = cands.filter((r) => ancho(r) === menor);
  const elegido =
    mismo.find((r) => /-ida$|entrada$/.test(porId.get(r.tramo_id)?.clave || '')) || mismo[0];
  const tramo = porId.get(elegido.tramo_id);
  const span = ancho(elegido);
  const fraccion = span > 0 ? (km - Number(elegido.km_desde)) / span : 0.5;
  const punto = puntoALoLargo(tramo.geometria, fraccion);
  return punto ? { ...punto, preciso: false } : null;
}

export function ubicarIncidente(inc, { tramos = [], rutas = [] } = {}) {
  const lat = Number(inc?.lat);
  const lng = Number(inc?.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
    return { lat, lng, preciso: true };
  }
  const porKm = porKilometro(inc, tramos, rutas);
  if (porKm) return porKm;
  const texto = textoDe(inc);
  let mejor = null;
  for (const a of anclasDe(tramos)) {
    if (contieneFrase(texto, a.nombre) && (!mejor || a.largo > mejor.largo)) mejor = a;
  }
  return mejor ? { ...mejor.punto, preciso: false } : null;
}

function limpiarUrl(cruda) {
  return String(cruda || '')
    .replace(/\s+/g, '')
    .replace(/[),.;]+$/g, '');
}

function etiquetaDeFuente(fuente) {
  const f = String(fuente || '');
  if (f === 'provial_bloqueos' || f === 'x:ProvialOficial') return 'Provial';
  if (f === 'x:COVIAL_CIV') return 'COVIAL';
  if (/muni|pmt/i.test(f)) return 'Muni';
  if (f.startsWith('x:')) return `@${f.slice(2)}`;
  return f || 'fuente';
}

function etiquetaDeUrl(url, fuente) {
  const u = sinAcento(url);
  if (u.includes('provial.gob.gt')) return 'Provial';
  if (u.includes('covial')) return 'COVIAL';
  if (u.includes('muniguate') || u.includes('muni')) return 'Muni';
  if (u.includes('x.com/') || u.includes('twitter.com/')) return etiquetaDeFuente(fuente);
  return 'noticia';
}

/**
 * Las fuentes son obligatorias en la ficha. Si no hay enlace, queda el nombre
 * de quien lo dijo: esconder el origen no es una opción.
 */
export function fuentesDe(inc) {
  const vistos = new Set();
  const lista = [];
  const agregar = (url, etiqueta) => {
    const limpia = limpiarUrl(url);
    if (!/^https?:\/\//i.test(limpia)) return;
    if (vistos.has(limpia)) return;
    vistos.add(limpia);
    lista.push({ url: limpia, etiqueta: etiqueta || etiquetaDeUrl(limpia, inc?.fuente) });
  };

  agregar(inc?.url, etiquetaDeFuente(inc?.fuente));
  const texto = `${inc?.descripcion || ''} ${inc?.raw?.url || ''}`;
  const halladas = texto.match(/https?:\/\/\s*[^\s<>"']+/gi) || [];
  for (const cruda of halladas) agregar(cruda, etiquetaDeUrl(cruda, inc?.fuente));

  if (!lista.length) lista.push({ url: null, etiqueta: etiquetaDeFuente(inc?.fuente) });
  return lista;
}

function frase(captura) {
  if (!captura) return null;
  const t = String(captura).replace(/\s+/g, ' ').trim();
  if (t.length < 4) return null;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Causa, efecto y desvío, solo cuando el texto los dice. */
export function relatoDe(descripcion) {
  const texto = String(descripcion || '').replace(/\s+/g, ' ').trim();
  if (!texto) return { causa: null, efecto: null, alternas: null };

  // «Desvío Chagüite» es un lugar, no un desvío recomendado. Solo cuenta
  // cuando el texto dice por dónde ir.
  const alterna =
    texto.match(/(?:ruta|v[ií]a|camino)\s+altern[ao]s?\s*[:\-]?\s*([^.]{4,140})/i) ||
    texto.match(/desv[ií]o\s+(?:por|hacia|recomendado)\s*[:\-]?\s*([^.]{4,140})/i);
  const causa = texto.match(/debido a\s+([^.]{4,160})/i);
  const efecto = texto.match(
    /((?:se alterna el paso|alterna el paso|reducci[oó]n de carriles|tr[aá]nsito detenido|paso cerrado|solo daños materiales)[^.]*)/i
  );

  return {
    causa: frase(causa?.[1]),
    efecto: frase(efecto?.[1]),
    alternas: frase(alterna?.[1]),
  };
}

export function lugarDe(inc) {
  const km = kmTexto(inc?.km);
  const partes = [inc?.ruta, km != null ? `km ${km}` : null, inc?.municipio, inc?.sentido].filter(Boolean);
  return partes.join(' · ');
}

/** Hora de Guatemala (UTC−6), sin depender de la zona del teléfono. */
export function horaGt(iso, ahora = Date.now()) {
  if (!iso) return null;
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) return null;
  const gt = (t) => new Date(t - 6 * 3600 * 1000);
  const r = gt(ms);
  const hoy = gt(ahora);
  const hora = `${r.getUTCHours()}:${String(r.getUTCMinutes()).padStart(2, '0')}`;
  const mismoDia = r.getUTCFullYear() === hoy.getUTCFullYear() && r.getUTCMonth() === hoy.getUTCMonth() && r.getUTCDate() === hoy.getUTCDate();
  return mismoDia ? hora : `ayer ${hora}`;
}

function fichaDe(inc, ahora) {
  const tipo = tipoDe(inc.tipo);
  return {
    id: inc.id,
    tipo: tipo.etiqueta,
    icono: tipo.icono,
    lugar: lugarDe(inc),
    descripcion: String(inc.descripcion || '').trim(),
    ...relatoDe(inc.descripcion),
    cuando: horaGt(inc.inicio || inc.ultima_vez, ahora),
    fuentes: fuentesDe(inc),
  };
}

function separarCoincidentes(pines) {
  const usados = new Map();
  return pines.map((p) => {
    const clave = `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`;
    const n = usados.get(clave) || 0;
    usados.set(clave, n + 1);
    if (!n) return p;
    const ang = (n * 2 * Math.PI) / 6;
    const radio = 0.00035 * (1 + Math.floor((n - 1) / 6));
    return { ...p, lat: p.lat + Math.sin(ang) * radio, lng: p.lng + Math.cos(ang) * radio };
  });
}

export function prepararIncidentes(filas, { tramos = [], rutas = [], ahora = Date.now() } = {}) {
  const vistos = new Set();
  const ubicados = [];
  const sueltos = [];
  for (const inc of filas || []) {
    if (!vigente(inc, ahora) || !inc?.id || vistos.has(inc.id)) continue;
    vistos.add(inc.id);
    const ficha = fichaDe(inc, ahora);
    const punto = ubicarIncidente(inc, { tramos, rutas });
    if (punto) ubicados.push({ ...ficha, ...punto });
    else sueltos.push(ficha);
  }
  return { ubicados: separarCoincidentes(ubicados), sueltos };
}

/** Unos pocos recorridos de la ciudad, los que más se demoran ahora. */
export function tiemposClave(tramos, n = 3) {
  return (tramos || [])
    .filter((t) => (t.ambito || 'ciudad') === 'ciudad' && Number(t.con_trafico_s) > 0)
    .slice()
    .sort((a, b) => (Number(b.demora_s) || 0) - (Number(a.demora_s) || 0) || (Number(b.con_trafico_s) || 0) - (Number(a.con_trafico_s) || 0))
    .slice(0, n);
}

export function minutosDe(segundos) {
  const n = Number(segundos);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.round(n / 60));
}

/** Centro de la capital cuando la cámara del Codex está demasiado lejos para ver calles. */
export function regionInicial(vista, ancho, alto) {
  const cerca =
    vista &&
    Number(vista.zoom) >= 11 &&
    vista.lat > 13.4 &&
    vista.lat < 17.9 &&
    vista.lng < -88.1 &&
    vista.lng > -92.4;
  const c = cerca ? vista : { lat: 14.62, lng: -90.52, zoom: 12 };
  const latitudeDelta = 360 / 2 ** Number(c.zoom || 12);
  const relacion = ancho > 0 && alto > 0 ? ancho / alto : 0.55;
  return {
    latitude: c.lat,
    longitude: c.lng,
    latitudeDelta,
    longitudeDelta: latitudeDelta * relacion,
  };
}

export function lineaDeTramo(geometria) {
  if (!Array.isArray(geometria)) return [];
  return geometria
    .map((p) => ({ latitude: Number(p?.[0]), longitude: Number(p?.[1]) }))
    .filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude));
}
