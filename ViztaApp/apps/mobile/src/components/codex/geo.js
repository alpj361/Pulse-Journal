/**
 * El contrato geográfico v2 de un Territorio, del lado del teléfono.
 *
 * Todo lo que lee o escribe `codex_universe_items.geo` pasa por acá. La razón es
 * que el contrato tiene tres pares de campos que dicen casi lo mismo —
 * `spatial_role` y `boundary_type`, `geometry.coordinates` y `coordinates`,
 * `source.catalog_id` y `curation.canonical_boundary_id`— y cada pantalla que
 * los interprete por su cuenta va a elegir un par distinto. Ahí es donde la
 * ficha muestra «punto» y el mapa dibuja un polígono.
 *
 * **La forma la manda la geometría, no la etiqueta.** `spatial_role` dice qué
 * significa el elemento; `geometry.type` dice cómo se dibuja. Son cosas
 * distintas y se consultan por separado: un `frontier` sin polígono no se
 * dibuja, por más que su rol diga que es una frontera.
 */

/** Los cuatro roles del contrato, en el orden en que se ofrecen. */
export const ROLES = [
  { clave: 'frontier', etiqueta: 'Frontera', ayuda: 'Un límite o jurisdicción: un departamento, un municipio, una zona.' },
  { clave: 'area', etiqueta: 'Área', ayuda: 'Una cobertura o zona de influencia que definís vos.' },
  { clave: 'location', etiqueta: 'Punto', ayuda: 'Un lugar preciso: una dirección, un sitio, un POI.' },
  { clave: 'route', etiqueta: 'Recorrido', ayuda: 'Una trayectoria: una ruta, un traslado, un límite lineal.' },
];

export const ETIQUETA_ESTADO = {
  user_defined: 'propia',
  candidate: 'pendiente',
  verified: 'verificada',
  official: 'oficial',
  superseded: 'reemplazada',
  rejected: 'descartada',
};

/**
 * Normaliza cualquier `geo` a la forma v2.
 *
 * Los registros ya están migrados, pero esta función existe igual por dos
 * motivos que no se van a ir: el `geo` que escribe esta app tiene que poder
 * releerse sin sorpresas, y los tres campos legacy siguen presentes en las filas
 * viejas. Deducir el rol de `boundary_type` o de la geometría es exactamente lo
 * que evita que un territorio migrado a medias desaparezca de la pantalla.
 */
export function normalizarGeo(crudo) {
  const geo = crudo && typeof crudo === 'object' ? crudo : {};
  const geometry = geometriaDe(geo);

  return {
    schema_version: 2,
    spatial_role: rolDe(geo, geometry),
    frontier: geo.frontier === true || rolDe(geo, geometry) === 'frontier',
    geometry,
    anchor: anclaDe(geo, geometry),
    source: {
      kind: geo.source?.kind || (geo.boundary_id ? 'boundary_catalog' : 'manual'),
      catalog_id: geo.source?.catalog_id ?? geo.boundary_id ?? null,
      external_id: geo.source?.external_id ?? null,
      provider: geo.source?.provider ?? null,
      country_code: geo.source?.country_code ?? null,
      admin_code: geo.source?.admin_code ?? null,
      snapshot: geo.source?.snapshot ?? null,
    },
    curation: {
      status: geo.curation?.status || (geo.boundary_id ? 'official' : 'user_defined'),
      canonical_boundary_id: geo.curation?.canonical_boundary_id ?? geo.boundary_id ?? null,
      // El backend no lo está mandando aunque el estado sea `official`. Se deduce
      // de la procedencia: si la geometría vino del catálogo, es la canónica.
      geometry_mode:
        geo.curation?.geometry_mode ||
        (geo.source?.kind === 'boundary_catalog' ? 'canonical' : 'original'),
      matched_at: geo.curation?.matched_at ?? null,
    },
    // Jerarquía y códigos postales: solo las fronteras los tienen. Colgárselos a
    // un POI o a un área sería inventar una posición territorial que el contrato
    // dice explícitamente que no existe para ellos.
    hierarchy: rolDe(geo, geometry) === 'frontier' ? jerarquiaDe(geo) : null,
    postal_codes: rolDe(geo, geometry) === 'frontier' ? postalesDe(geo) : [],

    // Legacy. Ya no se usa para nada: el nivel vive en `hierarchy.level`.
    boundary_type: geo.boundary_type ?? null,
  };
}

function jerarquiaDe(geo) {
  const h = geo.hierarchy;
  if (!h || !Number.isFinite(Number(h.level))) return null;
  return {
    version: Number(h.version) || 1,
    level: Number(h.level),
    parent_id: h.parent_id ?? null,
    path: Array.isArray(h.path) ? h.path : [],
    profile_id: h.profile_id ?? null,
    profile_version: Number(h.profile_version) || 1,
    display_label: h.display_label ?? null,
  };
}

/**
 * Los códigos postales, siempre como objetos.
 *
 * El contrato admite las dos formas durante la transición: `["01057"]` y
 * `[{code:"01057", country_code:"GT", …}]`. Normalizarlos acá evita que cada
 * pantalla tenga que preguntarse si lo que tiene en la mano es un string o un
 * objeto — que es como se termina renderizando `[object Object]`.
 */
function postalesDe(geo) {
  const lista = Array.isArray(geo.postal_codes) ? geo.postal_codes : [];
  return lista
    .map((p) => (typeof p === 'string' ? { code: p } : p))
    .filter((p) => p && p.code)
    .map((p) => ({
      code: String(p.code),
      country_code: p.country_code ?? null,
      system: p.system ?? null,
      relation: p.relation ?? null,
    }));
}

/** El nivel territorial. Solo las fronteras tienen uno. */
export function nivelDe(geo) {
  return geo?.spatial_role === 'frontier' ? (geo.hierarchy?.level ?? null) : null;
}

/**
 * Cómo se llama el nivel, en palabras.
 *
 * `display_label` viene resuelto desde el backend y es lo primero que se mira.
 * El respaldo es el perfil del país —«Departamento» para el 2 en GT— y recién
 * al final un genérico. Nunca se deduce de la palabra que traiga el nombre del
 * territorio: «Zona 1» no es un nivel, es un nombre.
 */
export function etiquetaNivel(geo, perfil) {
  const n = nivelDe(geo);
  if (n === null) return null;
  return geo.hierarchy?.display_label || perfil?.[n] || `Nivel ${n}`;
}

/**
 * La geometría, sintetizando el punto legacy si hace falta.
 *
 * Las filas viejas guardan el punto en `coordinates: {lat,lng}` y no en un
 * `geometry` GeoJSON. El contrato dice que sin `geometry` no se dibuja, y
 * tomarlo al pie de la letra haría desaparecer del mapa a elementos que hoy se
 * ven: la regla vigente es «con que tenga un punto alcanza para ser un pin».
 * Convertirlo acá cuesta una línea y evita una regresión que nadie relacionaría
 * con la migración.
 *
 * Los tres territorios sin geometría **ni** coordenadas siguen sin dibujarse,
 * que es lo que el contrato pide de verdad.
 */
function geometriaDe(geo) {
  if (geo.geometry && geo.geometry.type) return geo.geometry;

  const lat = Number(geo.coordinates?.lat);
  const lng = Number(geo.coordinates?.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return { type: 'Point', coordinates: [lng, lat] };
  }
  return null;
}

function rolDe(geo, geometry) {
  if (geo.spatial_role) return geo.spatial_role;

  const t = geometry?.type;
  if (t === 'Point' || geo.boundary_type === 'point' || geo.boundary_type === 'place') return 'location';
  if (geo.frontier || geo.boundary_id || ['departamento', 'municipio', 'zona'].includes(geo.boundary_type || '')) {
    return 'frontier';
  }
  if (t === 'Polygon' || t === 'MultiPolygon') return 'area';
  if (t === 'LineString' || t === 'MultiLineString') return 'route';
  return null;
}

/** El punto que representa al elemento; para cámara y etiquetas, nunca para dibujar un pin sobre un polígono. */
function anclaDe(geo, geometry) {
  if (geo.anchor && Number.isFinite(Number(geo.anchor.lat))) {
    return { lat: Number(geo.anchor.lat), lng: Number(geo.anchor.lng) };
  }
  if (geometry?.type === 'Point' && Array.isArray(geometry.coordinates)) {
    const [lng, lat] = geometry.coordinates;
    if (Number.isFinite(Number(lat))) return { lat: Number(lat), lng: Number(lng) };
  }
  if (geo.coordinates && Number.isFinite(Number(geo.coordinates.lat))) {
    return { lat: Number(geo.coordinates.lat), lng: Number(geo.coordinates.lng) };
  }
  return null;
}

/** Cómo se dibuja. Decide la geometría, no el rol. */
export function representacionDe(geo) {
  switch (geo?.geometry?.type) {
    case 'Point':
      return 'pin';
    case 'Polygon':
    case 'MultiPolygon':
      return 'poligono';
    case 'LineString':
    case 'MultiLineString':
      return 'recorrido';
    default:
      return null;
  }
}

/**
 * El par `{lat,lng}` de un elemento.
 *
 * GeoJSON guarda `[lng, lat]` y medio mundo lo lee al revés — un punto en
 * Guatemala leído invertido cae en el Índico. La conversión vive acá para que
 * nadie tenga que acordarse.
 */
export function puntoDe(geo) {
  if (geo?.geometry?.type === 'Point' && Array.isArray(geo.geometry.coordinates)) {
    const [lng, lat] = geo.geometry.coordinates;
    return { lat, lng };
  }
  return geo?.anchor ?? null;
}

/** Cuántos vértices tiene un polígono, para poder decir algo concreto en pantalla. */
export function cuentaVertices(geometry) {
  const anillos =
    geometry?.type === 'Polygon'
      ? geometry.coordinates
      : geometry?.type === 'MultiPolygon'
        ? geometry.coordinates.flat()
        : geometry?.type === 'LineString'
          ? [geometry.coordinates]
          : geometry?.type === 'MultiLineString'
            ? geometry.coordinates
            : [];
  return anillos.reduce((n, a) => n + (Array.isArray(a) ? a.length : 0), 0);
}

// ─── Constructores ───────────────────────────────────────────────────────────
// Escribir el `geo` a mano en cada pantalla es cómo se terminan guardando
// objetos a los que les falta `schema_version`, o con `frontier` en desacuerdo
// con `spatial_role`. Estas tres funciones son las únicas que arman uno.

/** Un punto puesto a mano. */
export function geoDePunto({ lat, lng, base }) {
  const previo = normalizarGeo(base);
  return {
    ...previo,
    spatial_role: 'location',
    frontier: false,
    geometry: { type: 'Point', coordinates: [Number(lng), Number(lat)] },
    anchor: { lat: Number(lat), lng: Number(lng) },
    source: { ...previo.source, kind: 'manual', catalog_id: null },
    curation: {
      status: 'user_defined',
      canonical_boundary_id: null,
      geometry_mode: 'original',
      matched_at: null,
    },
  };
}

/** Copiado de un límite oficial: la geometría canónica pasa a ser la del item. */
export function geoDeLimite({ limite, base }) {
  const previo = normalizarGeo(base);
  return {
    ...previo,
    spatial_role: 'frontier',
    frontier: true,
    geometry: limite.geometry,
    anchor: limite.centroid
      ? { lat: Number(limite.centroid.lat), lng: Number(limite.centroid.lng) }
      : previo.anchor,
    source: {
      kind: 'boundary_catalog',
      catalog_id: limite.boundary_id,
      external_id: null,
      provider: limite.source_name || null,
      country_code: limite.country_code || null,
      admin_code: limite.admin_code || null,
      snapshot: null,
    },
    curation: {
      status: 'official',
      canonical_boundary_id: limite.boundary_id,
      geometry_mode: 'canonical',
      matched_at: new Date().toISOString(),
    },
    boundary_type: limite.level || previo.boundary_type,
  };
}

/**
 * Vinculado a un límite oficial conservando el polígono propio.
 *
 * El estado queda en `verified` y no en `official`: alguien dijo a qué límite
 * corresponde —eso es lo verificado— pero la geometría que se dibuja sigue
 * siendo la que trazó esa persona. Marcarlo `official` haría que el mapa lo
 * pinte con borde sólido y prometa una precisión que el polígono no tiene.
 */
export function geoVinculado({ limite, base }) {
  const previo = normalizarGeo(base);
  return {
    ...previo,
    spatial_role: 'frontier',
    frontier: true,
    curation: {
      status: 'verified',
      canonical_boundary_id: limite.boundary_id,
      geometry_mode: 'original',
      matched_at: new Date().toISOString(),
    },
    boundary_type: limite.level || previo.boundary_type,
  };
}

/** Cambia el rol sin tocar la geometría. */
export function conRol(base, rol) {
  const previo = normalizarGeo(base);
  return { ...previo, spatial_role: rol, frontier: rol === 'frontier' };
}
