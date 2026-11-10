/**
 * La vista de un análisis profundo, armada con reglas fijas (Smart UI de posts).
 *
 * Del análisis de un post sale un programa de OpenUI Lang con las piezas del
 * catálogo de Vizta (`components/visual/catalogo.jsx`). Cada pieza entra solo
 * si el análisis trae con qué llenarla, y en un orden fijo: lo que dice, sus
 * cifras, quién aparece, cuándo, cómo se relacionan y en qué se apoya. Sin
 * modelos: el mismo análisis se ve siempre igual (decisión de PJ, 8-nov-2026).
 *
 * Lo que falta no se anuncia: una sección sin datos no aparece.
 */

const MAX_CIFRAS = 4;
const MAX_CITAS = 2;
const MAX_HECHOS = 5;
const MAX_ACTORES = 12; // personas y entidades
const MAX_HITOS = 8;
const MAX_RELACIONES = 6;
const MAX_FUENTES = 4;

/** Lo que hace cada voz en el video, como se lee. */
export const ROLES = { anfitrion: 'conduce', invitado: 'invitado', narrador: 'narra', entrevistador: 'entrevista', entrevistado: 'entrevistado', presentador: 'presenta' };

const s = (t) => JSON.stringify(String(t ?? '').replace(/\s+/g, ' ').trim());
// Tal cual: lo que la pieza busca después en el análisis vivo (relaciones, ids).
const exacto = (t) => JSON.stringify(String(t ?? ''));
const limpio = (t) => (typeof t === 'string' ? t.replace(/\s+/g, ' ').trim() : '');

const palabras = (t) => new Set(String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').match(/[a-z0-9]{3,}/g) || []);

/** ¿Dicen lo mismo? Si comparten casi todas sus palabras, una repite a la otra. */
export function repite(a, b) {
  const x = palabras(a);
  const y = palabras(b);
  if (!x.size || !y.size) return false;
  let comunes = 0;
  for (const w of x) if (y.has(w)) comunes += 1;
  return comunes / Math.min(x.size, y.size) >= 0.7;
}

/** Una cita de fuente que solo dice «según X» no es una cita. */
const citaQueAporta = (cita, nombre) => {
  const c = limpio(cita);
  if (c.length < 25) return false;
  return !/^seg[uú]n\b/i.test(c) && !repite(c, nombre);
};

/** La primera oración de un texto, para la bajada. */
export function primeraOracion(texto, max = 180) {
  const t = limpio(texto);
  if (!t) return '';
  const m = t.match(/^(.+?[.!?])(\s|$)/);
  const o = m ? m[1] : t;
  return o.length > max ? `${o.slice(0, max - 1).trimEnd()}…` : o;
}

/** Una cifra legible: «7 segundos», «Q1,533 millones». */
function cifraDe(c) {
  if (!c || (c.numero == null && !c.valor)) return null;
  const valor = c.valor != null && String(c.valor).trim() ? String(c.valor) : String(c.numero);
  const etiqueta = limpio(c.variable) || limpio(c.hacia);
  if (!etiqueta) return null;
  const detalle = c.variable && c.hacia ? limpio(c.hacia) : '';
  return { valor: c.moneda ? `${c.moneda}${valor}` : valor, etiqueta, detalle };
}

/**
 * El programa OpenUI de un análisis, o `null` si no hay con qué armar una vista
 * (menos de dos secciones: ahí se queda la vista de siempre). `extras.hablante`
 * es quien habla a cámara (`details.hablante`).
 */
export function programaDelAnalisis(analisis, extras = {}) {
  if (!analisis || typeof analisis !== 'object') return null;
  const lineas = [];
  const secciones = [];
  let n = 0;
  const nombre = (prefijo) => `${prefijo}${(n += 1)}`;
  const seccion = (titulo, contenido, icono) => {
    if (!contenido.length) return;
    const id = nombre('s');
    lineas.push(`${id} = Seccion(${s(titulo)}, [${contenido.join(', ')}], ${s(icono)})`);
    secciones.push(id);
  };

  // El resumen a veces llega cortado a la mitad de una palabra: entonces el título
  // es la primera oración de la narrativa.
  const resumen = limpio(analisis.resumen);
  const cortado = resumen && !/[.!?»"”)]$/.test(resumen) && resumen.length >= 120;
  // Un video que se entiende por lo que se ve (una actuación, un baile, labios
  // sincronizados con un audio ajeno): lo que es, es lo que se ve. Su texto no
  // alcanza para decirlo.
  const vistazo = extras.vistazo || analisis.vistazo || null;
  const esVisual = !!limpio(vistazo?.que_se_ve) && (vistazo?.audio_propio === false || ['actuacion', 'baile'].includes(vistazo?.actividad));
  const titulo = (esVisual && primeraOracion(vistazo.que_se_ve, 220))
    || (!cortado && resumen) || primeraOracion(analisis.narrativa || analisis.contexto) || resumen || 'El análisis';

  // Lo que dice: citas literales con quién las dijo; si no hay, los hechos. Lo
  // que repite el título no se vuelve a decir.
  const hechos = (analisis.hechos || []).filter((h) => h && typeof h === 'object' && limpio(h.texto) && !repite(h.texto, titulo) && !repite(h.cita, titulo));
  const conCita = hechos.filter((h) => limpio(h.cita) && h.cita_en_texto !== false);
  const dice = [];
  // Cada hecho va como `Hecho` con su id: en la ficha del post se guarda en el
  // Codex desde ahí. Sin id, solo se lee.
  const pieza = (h, conLaCita) => {
    // `hablante` puede ser el id de una voz («v1»): eso no es un nombre.
    const quien = limpio(h.hablante?.nombre || (typeof h.hablante === 'string' && !/^v\d+$/i.test(h.hablante) ? h.hablante : ''));
    if (!h.id) return conLaCita ? (quien ? `Cita(${s(h.cita)}, ${s(quien)})` : `Cita(${s(h.cita)})`) : `Texto(${s(h.texto)})`;
    const args = [exacto(h.id), s(h.texto)];
    if (conLaCita) args.push(s(h.cita));
    if (conLaCita && quien) args.push(s(quien));
    return `Hecho(${args.join(', ')})`;
  };
  for (const h of conCita.slice(0, MAX_CITAS)) dice.push(pieza(h, true));
  const yaCitados = new Set(conCita.slice(0, MAX_CITAS).map((h) => h.id));
  for (const h of hechos.filter((x) => !yaCitados.has(x.id)).slice(0, MAX_HECHOS)) dice.push(pieza(h, false));
  seccion('Lo que dice', dice, 'cita');

  // Las cifras: de 2 a 4 en una fila; una sola va igual, como cifra.
  const cifras = (analisis.cantidades || []).map(cifraDe).filter(Boolean).slice(0, MAX_CIFRAS);
  if (cifras.length) {
    const fila = cifras.map((c) => (c.detalle ? `Cifra(${s(c.valor)}, ${s(c.etiqueta)}, ${s(c.detalle)})` : `Cifra(${s(c.valor)}, ${s(c.etiqueta)})`));
    seccion('Las cifras', [`Cifras([${fila.join(', ')}])`], 'cifras');
  }

  // Quién aparece: quien está en el video (las voces y quien habla a cámara),
  // con lo que hace. Mencionados: las personas que solo se nombran. Entidades:
  // organizaciones. Los que están en el Codex van con su id (cara y ficha); los
  // que no, en la ficha del post se agregan. Primero las centrales.
  const clave = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const menciones = [...(analisis.menciones || [])].sort((a, b) => (a?.rol === 'central' ? 0 : 1) - (b?.rol === 'central' ? 0 : 1));
  const mencionDe = (nombre) => menciones.find((m) => clave(m?.texto) === clave(nombre)) || null;
  const persona = (texto, { id = '', tipo = '', rol = '', detalle = '', voz = '' } = {}) => {
    const args = [exacto(texto), exacto(id || ''), s(tipo), s(rol), s(detalle), exacto(voz || '')];
    while (args.length > 1 && args[args.length - 1] === '""') args.pop();
    return `Persona(${args.join(', ')})`;
  };

  const aparecen = [];
  const yaAparece = new Set();
  // Las voces de un audio prestado (labios sincronizados, el diálogo de una
  // obra) no son de quienes aparecen: no van aquí.
  const ajeno = vistazo?.audio_propio === false;
  const voces = (analisis.hablantes || []).filter((v) => v && typeof v === 'object' && !ajeno && v.identidad_metodo !== 'audio_ajeno');
  // Quien publica y aparece a cámara va primero: nunca es un «mencionado».
  const autor = limpio(extras.autor);
  const autorACamara = autor && (vistazo?.a_camara || extras.hablante?.tipo === 'persona');
  if (autorACamara && !voces.some((v) => clave(v.nombre) === clave(autor))) {
    yaAparece.add(clave(autor));
    const m = mencionDe(autor);
    aparecen.push(persona(autor, { id: m?.codex?.id, tipo: 'Actor', rol: 'autor' }));
  }
  // Lo que se dijo a mano (relaciones «aparece en» del Codex): una voz nombrada
  // o alguien que el análisis no detectó.
  const aMano = Array.isArray(extras.aparecen) ? extras.aparecen : [];
  for (const v of voces) {
    const nombrada = aMano.find((x) => x.voz && x.voz === v.id);
    const nombre = limpio(nombrada?.name) || limpio(v.nombre) || (v.es_autor ? limpio(extras.hablante?.nombre) : '');
    const rol = ROLES[v.rol] || limpio(v.rol);
    if (nombre) {
      if (yaAparece.has(clave(nombre))) continue;
      yaAparece.add(clave(nombre));
      const m = mencionDe(nombre);
      aparecen.push(persona(nombre, { id: nombrada?.id || v.persona_item_id || m?.codex?.id, tipo: 'Actor', rol, voz: v.id }));
    } else {
      // Sin nombre: se reconoce por cómo suena o se ve, y se puede decir quién es.
      aparecen.push(persona(rol ? rol.charAt(0).toUpperCase() + rol.slice(1) : 'Voz', { detalle: limpio(v.descripcion), voz: v.id }));
    }
  }
  // Sin voces separadas, quien habla a cámara (suele ser el autor).
  const habla = extras.hablante;
  if (!voces.length && habla?.tipo === 'persona' && limpio(habla.nombre) && !yaAparece.has(clave(habla.nombre))) {
    yaAparece.add(clave(habla.nombre));
    const m = mencionDe(habla.nombre);
    aparecen.push(persona(limpio(habla.nombre), { id: m?.codex?.id, tipo: 'Actor', rol: 'habla a cámara' }));
  }
  for (const x of aMano) {
    if (x.voz && voces.some((v) => v.id === x.voz)) continue;
    if (!limpio(x.name) || yaAparece.has(clave(x.name))) continue;
    yaAparece.add(clave(x.name));
    aparecen.push(persona(limpio(x.name), { id: x.id, tipo: x.tipo || 'Actor' }));
  }
  // Las demás personas que se ven a cámara y nadie identificó todavía: van con
  // «quién es» (su «voz» es `camara:N`, no una voz del audio).
  const aCamara = Number(vistazo?.personas) || 0;
  for (let i = aparecen.length; i < Math.min(aCamara, MAX_ACTORES); i += 1) {
    aparecen.push(persona('Otra persona', { rol: 'a cámara', voz: `camara:${i + 1}` }));
  }
  // En la ficha del post, la sección ofrece agregar a alguien más (`agregar`).
  if (aparecen.length) seccion('Quién aparece', [`Personas([${aparecen.slice(0, MAX_ACTORES).join(', ')}], true)`], 'actores');

  const porTipo = (tipo) => {
    const vistos = new Set();
    const lista = [];
    for (const m of menciones) {
      const t = m?.codex?.tipo || m?.tipo;
      const texto = typeof m?.texto === 'string' ? m.texto : '';
      if (t !== tipo || !texto.trim() || yaAparece.has(clave(texto))) continue;
      const k = m.codex?.id || clave(texto);
      if (vistos.has(k)) continue;
      vistos.add(k);
      lista.push(persona(texto, { id: m.codex?.id, tipo }));
    }
    return lista.slice(0, MAX_ACTORES);
  };
  const mencionados = porTipo('Actor');
  if (mencionados.length) seccion('Mencionados', [`Personas([${mencionados.join(', ')}])`], 'actor');
  const entidades = porTipo('Entidad');
  if (entidades.length) seccion('Entidades', [`Personas([${entidades.join(', ')}])`], 'entidad');

  // Cuándo: solo hitos con fecha. Los tramos del video (segundos) no son una
  // cronología y no entran.
  const hitos = (analisis.linea_tiempo || [])
    .map((h) => (h && typeof h === 'object' ? { fecha: limpio(h.fecha || h.cuando), titulo: limpio(h.titulo || h.texto || h.evento) } : null))
    .filter((h) => h && h.fecha && h.titulo)
    .slice(0, MAX_HITOS);
  if (hitos.length) seccion('Cuándo', [`LineaDeTiempo([${hitos.map((h) => `Hito(${s(h.fecha)}, ${s(h.titulo)})`).join(', ')}])`], 'tiempo');

  // Cómo se relacionan: lo que el análisis vincula, en una línea cada cosa.
  const rels = (analisis.relaciones || []).filter((r) => r && limpio(r.a) && limpio(r.b) && limpio(r.verbo)).slice(0, MAX_RELACIONES);
  if (rels.length) seccion('Cómo se relacionan', rels.map((r) => `Relacion(${exacto(r.a)}, ${exacto(r.verbo)}, ${exacto(r.b)})`), 'relaciones');

  // En qué se apoya: las fuentes que cita el post.
  const fuentes = (analisis.fuentes || []).filter((f) => f && limpio(f.nombre)).slice(0, MAX_FUENTES);
  if (fuentes.length) {
    seccion('En qué se apoya', fuentes.map((f) => (citaQueAporta(f.cita, f.nombre) ? `Cita(${s(f.cita)}, ${s(f.nombre)})` : `Texto(${s(f.nombre)})`)), 'noticias');
  }

  // Un video visual se entiende con lo que se ve y quién aparece: basta una
  // sección. Lo demás necesita al menos dos para que valga una vista.
  if (secciones.length < (esVisual ? 1 : 2)) return null;
  // Con un video visual, la narrativa salió de su texto: no va de bajada.
  const bajada = esVisual ? '' : primeraOracion(analisis.narrativa || analisis.contexto);
  const raiz = bajada && !repite(bajada, titulo)
    ? `root = Vista(${s(titulo)}, [${secciones.join(', ')}], ${s(bajada)})`
    : `root = Vista(${s(titulo)}, [${secciones.join(', ')}])`;
  return [raiz, ...lineas].join('\n');
}
