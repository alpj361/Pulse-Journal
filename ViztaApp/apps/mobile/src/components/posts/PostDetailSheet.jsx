import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  FadeIn,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { X, Eye, ExternalLink, Play, Plus, Check } from 'lucide-react-native';
import { INK, MOTION, RADIUS } from '../theme';
import { PAPEL } from '../codex/Papel';
import { MONO } from '../codex/mono';
import { TYPE_ACCENT, normalizeTipo } from '../codex/tipos';
import ItemDetailSheet from '../codex/ItemDetailSheet';
import MorphingInfinity from '../MorphingInfinity';
import pedirAnalisis from './analizarPost';
import useAnalisisPost from './useAnalisisPost';
import CarruselPost from './CarruselPost';
import SugerenciaHablante from './SugerenciaHablante';
import { anotarTexto } from './anotar';
import { agregarConexion, guardarFact, guardarMaterial, mencionesDe } from './capaPost';
import pedirDetalle from './detalleMaterial';
import IconoMaterial from '../codex/IconoMaterial';
import { MATERIAL, ORDEN_MATERIALES, materialDe } from '../codex/materiales';
import { Apoyo, Aprender, Bloque, Cifras, GuardarHecho, Listas, LoDice, LoQueSeVe, Postura, QuienAparece, Recetas, partirHechos } from './SeccionesAnalisis';
import { armarPiezas, norm } from './piezas';
import { Pieza, Refs, Saltos } from './Saltos';
import { supabase } from '../../utils/supabase';
import { registrarAvisos } from '../../utils/notificaciones';
import { roce, toque, agarre, falla } from '../../utils/haptics';
import { EV, evento } from '../../utils/analitica';

// Lo mismo que el servidor (`CORTADO_MS` en `routes/analisisPost.js`), más un
// margen: si la app ofrece reintentar antes, el servidor contesta «ya está».
const ANALISIS_CORTADO_MS = 6 * 60 * 1000 + 15000;
const COLOR_OJO = TYPE_ACCENT.Actor;

/** El orden de las secciones: de quién y dónde, a qué pasó y con qué. */
// Los tipos que son «alguien»: van en «quién aparece», no en chips.
const TIPOS_QUIEN = ['Actor', 'Entidad'];
const ORDEN_TIPOS = ['Actor', 'Entidad', 'Territorio', 'Evento', 'Historia', 'Objeto', 'Artefacto', 'Source'];

const PLURAL = {
  Actor: 'actores',
  Entidad: 'entidades',
  Territorio: 'territorios',
  Evento: 'eventos',
  Historia: 'historias',
  Objeto: 'objetos',
  Artefacto: 'artefactos',
  Source: 'fuentes',
};

const COLUMNAS_FICHA = 'id, name, tipo, description, aliases, tags, details, geo, thumbnail_url, created_at';

/** El tipo con el que se muestra una mención: el del Codex si ya está vinculada. */
const tipoDe = (m) => normalizeTipo(m?.codex?.tipo || m?.tipo);
/** Solo material: una película, un libro, un lugar que tu Codex no tiene como elemento. */
const esRef = (m) => tipoDe(m) === 'Ref';
// Un Ref se pinta con el color de su material; lo demás, con el de su tipo. Un
// Territorio que además es lugar sigue siendo del color de los territorios: su
// material se nota en el ícono.
const colorDe = (m) => (esRef(m) && materialDe(m) ? MATERIAL[m.material].color : TYPE_ACCENT[tipoDe(m)] || INK.body);

const NOMBRE_FUENTE = { tmdb: 'TMDB', openlibrary: 'Open Library', musicbrainz: 'MusicBrainz', apple_maps: 'Apple Maps', wikidata: 'Wikidata' };

/**
 * Ficha de un post.
 *
 * Un post no es un item del Codex como los demás y por eso no usa
 * `ItemDetailSheet`. Aquel muestra campos: nombre, tipo de dato, progresiones,
 * relaciones. Un post no tiene campos — tiene un video, lo que dice el video y
 * lo que se puede sacar de eso. Meterlo en la ficha genérica dejaba la
 * transcripción escondida entre «detalles» junto a la URL del thumbnail.
 *
 * Así que acá hay tres cosas y en este orden: qué se ve, qué dice, y qué se
 * puede sacar. El botón del ojo es lo tercero — abre el análisis, que lee la
 * transcripción y devuelve lo mencionado, los hechos y cómo se relacionan.
 *
 * El resultado se puede mirar de dos formas: **anotado**, el texto original con
 * lo reconocido pintado encima, y **organizado**, las mismas cosas por tipo.
 * Anotado sirve para verificar (¿de dónde sacó eso?); organizado, para decidir
 * qué se guarda. Ninguna de las dos sola alcanza.
 *
 * **Todo el análisis es una capa del post.** Nada pasa al Codex por haber sido
 * reconocido: lo vinculado ya estaba ahí, y lo demás espera a que el usuario lo
 * pida —guardar un hecho, o el + de una relación—. En el texto, lo que ya
 * está en tu Codex va subrayado; lo que solo aparece en este post, solo con su
 * color.
 *
 * **Los materiales van aparte.** Una película, un libro o un lugar que el post
 * cita no es parte del modelo analítico: llega como `Ref`, con el color y el
 * ícono de su clase, ya identificado contra su base (TMDB, Open Library,
 * MusicBrainz, Apple Maps) desde el análisis. Sostenerlo trae más —sinopsis,
 * reparto, o la web—, y guardarlo lo lleva al Codex como Ref, o como el tipo
 * que propuso el análisis si es un lugar que querés como territorio.
 */
export default function PostDetailSheet({ post, onClose, onActualizado, topInset = 0, bottomInset = 0 }) {
  const { width: W } = useWindowDimensions();

  // Un caso de muestra (`casosDeMuestra`): nada sale del teléfono. El ojo
  // devuelve lo que el caso trae guardado, sin pedir ni cobrar nada.
  const muestra = post?._muestra || null;

  const [rota, setRota] = useState(false);
  /**
   * El análisis lo trae el servidor, no esta pantalla.
   *
   * `analisis` no es estado local que se llena al volver un `await`: es lo que
   * hay en la fila, mirado en vivo. Por eso cerrar la app a mitad no pierde
   * nada — y por eso abrir el post en otro teléfono muestra lo mismo.
   */
  const {
    analisis: analisisRemoto,
    estado,
    error: errorRemoto,
    hablante: hablanteRemoto,
    reconocimiento: reconocimientoRemoto,
  } = useAnalisisPost(muestra ? null : post?.id, post?.details);

  /**
   * Lo que se acaba de guardar desde acá, mientras llega por la fila en vivo.
   *
   * Sin esto, tocar guardar o el + no cambiaba nada en pantalla hasta que
   * Realtime trajera la fila de vuelta. El parche manda solo mientras la fila
   * remota todavía no trae los mismos vínculos; si llega un análisis nuevo
   * —otro `analyzed_at`—, gana el remoto aunque el parche sea más reciente.
   */
  const [parche, setParche] = useState(null);

  // Quién habla: lo recién confirmado o descartado desde acá manda mientras la
  // fila en vivo no lo trae. Sin esto, tocar «Sí, es» dejaba la tarjeta puesta
  // hasta que Realtime devolviera la fila.
  const hablante = parche?.hablante ?? hablanteRemoto;
  const reconocimiento = parche?.reconocimiento ?? reconocimientoRemoto;
  const analisis = useMemo(() => {
    const p = parche?.analysis;
    if (!p) return analisisRemoto;
    if (!analisisRemoto) return p;
    if (analisisRemoto.analyzed_at !== p.analyzed_at) return analisisRemoto;
    return firma(analisisRemoto) === firma(p) ? analisisRemoto : p;
  }, [parche, analisisRemoto]);

  // Solo el viaje de ida: pedirlo. La espera la cuenta `estado`.
  const [pidiendo, setPidiendo] = useState(false);
  const [error, setError] = useState(null);

  // Está trabajando el servidor, o estamos por avisarle.
  const cargando = pidiendo || estado === 'procesando';
  const [vista, setVista] = useState('anotado');
  const [verTodo, setVerTodo] = useState(false);

  const [elegida, setElegida] = useState(null); // texto de la mención tocada
  const [ocupado, setOcupado] = useState(null); // la acción en curso
  const [errorAccion, setErrorAccion] = useState(null);
  const [itemAbierto, setItemAbierto] = useState(null);
  // Lo que se pidió sosteniendo un material, mientras llega por la fila en vivo:
  // { [texto]: { cargando } | { datos } | { error } }.
  const [detalles, setDetalles] = useState({});

  const d = parche || post?.details || {};
  const uri = post?.thumbnail_url || d.thumbnail_url || d.images?.[0];

  /**
   * Todas las imágenes del post, sin repetir.
   *
   * Un carrusel llega entero en `details.images`; la portada suele ser la
   * primera de esa misma lista, así que se junta todo y se deduplica en vez de
   * anteponerla a ciegas — si no, la primera imagen salía dos veces.
   */
  const imagenes = [...new Set([uri, ...(d.images || [])].filter(Boolean))];
  const autor = d.author_name || d.author || (post?.name || '').match(/^@([^—]+)/)?.[1]?.trim();
  const esVideo = post?.tags?.includes('reel') || post?.tags?.includes('video') || d.is_reel;
  const transcripcion = d.transcription;

  // El caption sin el «@autor — » que el nombre trae adelante.
  const descripcion = (post?.description || '').replace(/^@[^—]+—\s*/, '').trim();

  // El texto que se anota es el mismo que se manda a analizar.
  const textoBase = transcripcion || descripcion;

  const menciones = useMemo(() => mencionesDe(analisis), [analisis]);
  const tramos = useMemo(() => (analisis ? anotarTexto(textoBase, menciones) : []), [analisis, textoBase, menciones]);
  const tiposPresentes = useMemo(
    () => ORDEN_TIPOS.filter((t) => menciones.some((m) => tipoDe(m) === t)),
    [menciones]
  );
  const refs = useMemo(() => {
    const puesto = (m) => (ORDEN_MATERIALES.includes(m.material) ? ORDEN_MATERIALES.indexOf(m.material) : 99);
    return menciones.filter(esRef).sort((a, b) => puesto(a) - puesto(b));
  }, [menciones]);
  const materialesPresentes = useMemo(
    () => ORDEN_MATERIALES.filter((k) => refs.some((m) => m.material === k)),
    [refs]
  );
  // Un análisis viejo guarda los hechos como texto suelto: sin cita ni forma de
  // guardarlos, así que solo la forma nueva los muestra.
  const hechos = (analisis?.hechos || []).filter((h) => h && typeof h === 'object');
  // Cada dato con su sección dueña: un hecho que cuenta una cifra vive en
  // «cifras», una persona en «quién aparece», y así. Ver `piezas.js`.
  const piezas = useMemo(() => armarPiezas(analisis, menciones, tipoDe), [analisis, menciones]);
  const { comprobables, afirmaciones } = useMemo(() => partirHechos(piezas.hechos), [piezas]);
  // Hay hechos comprobables aunque todos se hayan ido a «cifras».
  const afirmaComprobable = comprobables.length > 0 || piezas.cifras.some((c) => c.hecho);
  // Las personas y organizaciones tienen su sección; el resto sigue en chips.
  // Una fuente que ya está en «en qué se apoya» tampoco se repite como chip.
  const enChips = (m) =>
    !TIPOS_QUIEN.includes(tipoDe(m)) &&
    !(tipoDe(m) === 'Source' && piezas.fuentes.some((f) => norm(f.nombre) === norm(m.texto)));
  const tiposEnChips = tiposPresentes.filter((t) => menciones.some((m) => tipoDe(m) === t && enChips(m)));
  const scroll = useRef(null);
  // Una referencia tocada desde «aprender» apunta a una pieza de «organizado».
  const alOrganizado = useCallback(() => setVista('organizado'), []);
  const contenido = useRef(null);
  const relaciones = analisis?.relaciones || [];
  const temas = (analisis?.temas || []).filter((t) => typeof t === 'string');
  const narrativa = analisis?.narrativa || analisis?.contexto || analisis?.resumen || '';
  const mencionElegida = elegida ? menciones.find((m) => m.texto === elegida) || null : null;
  const vistaReal = !analisis || (vista === 'aprender' && !analisis.aprender) ? 'anotado' : vista;

  const extraer = async () => {
    if (cargando) return;
    if (analisis) {
      roce();
      setVista((v) => (v === 'anotado' ? 'organizado' : 'anotado'));
      return;
    }
    setPidiendo(true);
    setError(null);
    if (muestra) {
      setTimeout(() => {
        toque();
        setParche({ ...d, ...muestra.alVer });
        setVista('organizado');
        setPidiendo(false);
      }, 900);
      return;
    }
    try {
      await pedirAnalisis(post);
      toque();
      // La lista tiene que saber que este post quedó analizándose: así lo
      // sigue escuchando y lo muestra terminado aunque se cierre esta hoja.
      onActualizado?.({ ...post, details: { ...d, analysis_estado: 'procesando' } });
      // Y es el momento de ofrecer el aviso de cuando esté.
      registrarAvisos();
      // Se manda al pedirlo y no al terminar: el final puede llegar con la app
      // cerrada, y un evento que solo se emite cuando alguien está mirando
      // contaría de menos justo los análisis largos.
      evento(EV.POST_ANALIZADO, { con_transcripcion: !!transcripcion });
    } catch (e) {
      falla();
      setError(e.message || 'No se pudo extraer');
    } finally {
      setPidiendo(false);
    }
  };

  // Un análisis que lleva demasiado «en curso» ya no lo está haciendo nadie
  // (el servidor se reinició a la mitad). Se nota con un reloj propio: el
  // estado no cambia solo, así que sin esto la hoja esperaría para siempre.
  const [colgado, setColgado] = useState(false);
  useEffect(() => {
    setColgado(false);
    if (estado !== 'procesando' || muestra) return undefined;
    const desde = new Date(d.analysis_desde || Date.now()).getTime();
    const falta = Math.max(0, desde + ANALISIS_CORTADO_MS - Date.now());
    const reloj = setTimeout(() => setColgado(true), falta);
    return () => clearTimeout(reloj);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado, d.analysis_desde]);

  /** Volver a pedirlo, después de un fallo o de uno que se quedó colgado. */
  const reintentar = async () => {
    if (pidiendo) return;
    roce();
    setPidiendo(true);
    setError(null);
    setColgado(false);
    try {
      await pedirAnalisis(post);
      onActualizado?.({ ...post, details: { ...d, analysis_estado: 'procesando', analysis_desde: new Date().toISOString(), analysis_error: null } });
      registrarAvisos();
    } catch (e) {
      falla();
      setError(e.message || 'No se pudo analizar');
    } finally {
      setPidiendo(false);
    }
  };

  // El análisis que llegó solo se avisa hacia arriba, para que la lista lo
  // tenga sin volver a consultarlo.
  useEffect(() => {
    // Con el análisis ya llegado, la marca de «analizándose» se va con él: si
    // quedara, la tarjeta de la lista seguiría diciendo que está en curso.
    if (analisis && !muestra) onActualizado?.({ ...post, details: { ...d, analysis: analisis, analysis_estado: null } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analisis]);

  const elegir = useCallback((m) => {
    roce();
    setElegida((e) => (e === m.texto ? null : m.texto));
  }, []);

  const aplicar = (details) => {
    setParche(details);
    onActualizado?.({ ...post, details });
  };

  /**
   * Abrir en la ficha del Codex.
   *
   * Se pide la fila completa: la ficha dibuja exactamente el objeto que recibe,
   * y con lo poco que guarda el vínculo diría «Ningún campo tiene dato» sobre
   * un actor con la ficha llena. `_source` le dice que el item es del universo;
   * sin esa marca sus campos se guardaban en otra tabla.
   */
  const abrirEnCodex = async (codex) => {
    if (!codex?.id) return;
    roce();
    const { data, error: e } = await supabase
      .from('codex_universe_items')
      .select(COLUMNAS_FICHA)
      .eq('id', codex.id)
      .maybeSingle();
    if (e || !data) {
      falla();
      setErrorAccion('No se pudo abrir en tu Codex.');
      return;
    }
    setItemAbierto({ ...data, _source: 'universe' });
  };

  /**
   * Sostener un material: lo que su base sabe de él.
   *
   * Abre su ficha y pide el detalle al servidor, que lo guarda con la mención:
   * la segunda vez ya viene en el análisis y no se consulta nada. Sostener algo
   * que no es material no hace nada todavía.
   */
  const sostener = async (m) => {
    if (!materialDe(m) || muestra) return;
    agarre();
    setElegida(m.texto);
    const previo = detalles[m.texto];
    if (m.detalle || previo?.datos || previo?.cargando) return;
    setDetalles((x) => ({ ...x, [m.texto]: { cargando: true } }));
    try {
      const datos = await pedirDetalle(post.id, m.texto);
      setDetalles((x) => ({ ...x, [m.texto]: { datos } }));
    } catch (e) {
      falla();
      setDetalles((x) => ({ ...x, [m.texto]: { error: e.message || 'No se pudo buscar más.' } }));
    }
  };

  /** Guardar un material en el Codex: como Ref, o como el tipo que se pide. */
  const guardarRef = async (mencion, comoTipo = null) => {
    if (ocupado || muestra) return;
    setOcupado(`material:${mencion.texto}`);
    setErrorAccion(null);
    try {
      const { details } = await guardarMaterial({ post: { ...post, details: d }, mencion, comoTipo });
      toque();
      aplicar(details);
    } catch (e) {
      falla();
      setErrorAccion(e.message || 'No se pudo guardar.');
    } finally {
      setOcupado(null);
    }
  };

  const guardarHecho = async (hecho) => {
    if (ocupado || muestra) return;
    if (hecho.fact_id) {
      abrirEnCodex({ id: hecho.fact_id });
      return;
    }
    setOcupado(`hecho:${hecho.texto}`);
    setErrorAccion(null);
    try {
      const details = await guardarFact({ post: { ...post, details: d }, analisis, hecho });
      toque();
      aplicar(details);
    } catch (e) {
      falla();
      setErrorAccion(e.message || 'No se pudo guardar el hecho.');
    } finally {
      setOcupado(null);
    }
  };

  const conectar = async (relacion) => {
    if (ocupado || muestra || relacion.relation_id) return;
    setOcupado(claveRelacion(relacion));
    setErrorAccion(null);
    try {
      const { details } = await agregarConexion({ post: { ...post, details: d }, analisis, relacion });
      toque();
      aplicar(details);
    } catch (e) {
      falla();
      setErrorAccion(e.message || 'No se pudo agregar la conexión.');
    } finally {
      setOcupado(null);
    }
  };

  const fecha = post?.created_at
    ? new Date(post.created_at).toLocaleDateString('es-GT', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  const ficha = mencionElegida ? (
    <FichaMencion
      mencion={mencionElegida}
      // En «organizado» los hechos y las relaciones ya están en su sección;
      // acá se repetirían. En «anotado» la ficha es el único lugar donde verlos.
      hechos={vistaReal === 'organizado' ? [] : hechos.filter((h) => (h.menciones || []).includes(mencionElegida.texto))}
      relaciones={vistaReal === 'organizado' ? [] : relaciones.filter((r) => r.a === mencionElegida.texto || r.b === mencionElegida.texto)}
      menciones={menciones}
      ocupado={ocupado}
      onAbrir={abrirEnCodex}
      onMas={conectar}
      detalle={mencionElegida.detalle || detalles[mencionElegida.texto]?.datos || null}
      buscando={!!detalles[mencionElegida.texto]?.cargando}
      errorDetalle={detalles[mencionElegida.texto]?.error || null}
      guardando={ocupado === `material:${mencionElegida.texto}`}
      onGuardar={guardarRef}
    />
  ) : null;

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: PAPEL }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingTop: topInset + 12,
            paddingHorizontal: 18,
            paddingBottom: 4,
          }}
        >
          <Pressable onPress={onClose} hitSlop={12} style={{ padding: 6 }}>
            <X size={19} color={INK.faint} />
          </Pressable>
          <View style={{ flex: 1 }} />

          {d.source_url ? (
            <Pressable
              onPress={() => Linking.openURL(d.source_url).catch(() => {})}
              hitSlop={12}
              style={{ padding: 6, marginRight: 2 }}
              accessibilityRole="button"
              accessibilityLabel="Abrir el original"
            >
              <ExternalLink size={17} color={INK.faint} />
            </Pressable>
          ) : null}

          <OjoBoton onPress={extraer} cargando={cargando} activo={!!analisis} />
        </View>

        <ScrollView
          ref={scroll}
          contentContainerStyle={{ paddingHorizontal: 30, paddingTop: 18, paddingBottom: bottomInset + 44 }}
          showsVerticalScrollIndicator={false}
        >
          <Saltos scroll={scroll} contenido={contenido} porId={piezas.porId} preparar={alOrganizado}>
          <View ref={contenido} collapsable={false}>
          <View
            style={{
              width: '100%',
              height: Math.min(W * 0.9, 340),
              borderRadius: RADIUS.lg,
              overflow: 'hidden',
              backgroundColor: 'rgba(28,43,34,0.06)',
              borderWidth: 1,
              borderColor: 'rgba(28,43,34,0.08)',
            }}
          >
            {imagenes.length > 1 ? (
              /* Carrusel. Antes se pintaba solo la primera y el resto quedaba
                 en la base sin forma de verse. */
              <CarruselPost
                imagenes={imagenes}
                alto={Math.min(W * 0.9, 340)}
                insignia={null}
              />
            ) : uri && !rota ? (
              <Image source={{ uri }} onError={() => setRota(true)} resizeMode="cover" style={{ width: '100%', height: '100%' }} />
            ) : (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: MONO, fontSize: 42, color: 'rgba(28,43,34,0.14)' }}>
                  {(autor || '?').trim().charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            {esVideo ? (
              <View
                style={{
                  position: 'absolute',
                  top: 10,
                  right: 10,
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: 'rgba(12,20,15,0.45)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Play size={12} color="#fff" fill="#fff" />
              </View>
            ) : null}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 }}>
            {autor ? (
              <Text style={{ fontFamily: MONO, fontSize: 13, color: INK.title }}>{autor}</Text>
            ) : null}
            {fecha ? (
              <Text style={{ fontFamily: MONO, fontSize: 11, color: 'rgba(28,43,34,0.3)' }}>· {fecha}</Text>
            ) : null}
          </View>

          {/* Quién está a cámara, cuando la cuenta es de un grupo. Debajo del
              autor porque es la misma clase de dato: quién publicó y quién
              habla. Solo se dibuja con el flag del reconocimiento prendido. */}
          <SugerenciaHablante
            post={post}
            hablante={hablante}
            reconocimiento={reconocimiento}
            onAbrirActor={(id) => abrirEnCodex({ id })}
            onActualizado={(details) => details && aplicar(details)}
          />

          {/* Sin transcripción, el texto que se anota ES la descripción: mostrarla
              también acá sería decirla dos veces. */}
          {descripcion && transcripcion ? (
            <Bloque titulo="descripción">
              <Text style={{ fontFamily: MONO, fontSize: 13, color: INK.body, lineHeight: 21 }}>
                {descripcion}
              </Text>
            </Bloque>
          ) : null}

          {/* El error propio es el de pedirlo —sin sesión, sin texto—; el
              remoto es el del análisis que ya había arrancado y falló allá.
              Son dos momentos distintos y ninguno tapa al otro. */}
          {error || (errorRemoto && !analisis) || colgado ? (
            <Animated.View entering={FadeIn.duration(200)} style={{ marginTop: 22 }}>
              <Text style={{ fontFamily: MONO, fontSize: 12.5, color: '#B91C1C', lineHeight: 19 }}>
                {/* El motivo que escribe el servidor puede ser la respuesta
                    cruda de un proveedor: no le sirve a quien lo lee. Se dice
                    qué pasó, y al lado, cómo seguir. */}
                {error || (colgado ? 'El análisis está tardando más de lo normal.' : 'No se pudo analizar este post.')}
              </Text>
              <AccionTexto onPress={reintentar} etiqueta="Volver a analizar el post" arriba={10}>
                volver a intentar
              </AccionTexto>
            </Animated.View>
          ) : null}

          {/* Una sola sección de texto. Antes la transcripción iba en su bloque y
              «anotado» la repetía entera debajo. Ahora «anotado» es el texto:
              sin análisis se ve limpio, y con análisis el mismo texto trae lo
              reconocido pintado y aparece «organizado» al lado. */}
          {textoBase || analisis || d.vistazo ? (
            <Animated.View layout={LinearTransition.springify().damping(22)} entering={FadeIn.duration(260)}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 28, marginBottom: 4 }}>
                <Solapa activa={vistaReal === 'anotado'} onPress={() => { roce(); setVista('anotado'); }}>
                  anotado
                </Solapa>
                {analisis ? (
                  <Solapa activa={vistaReal === 'organizado'} onPress={() => { roce(); setVista('organizado'); }}>
                    organizado
                  </Solapa>
                ) : null}
                {/* Aprender va aparte: es para quien quiere entender el tema, y
                    no se mete entre las cifras y el contexto de quien no. */}
                {analisis?.aprender ? (
                  <Solapa activa={vistaReal === 'aprender'} onPress={() => { roce(); setVista('aprender'); }}>
                    aprender
                  </Solapa>
                ) : null}
              </View>

              {errorAccion ? (
                <Text style={{ fontFamily: MONO, fontSize: 12, color: '#B91C1C', lineHeight: 18, marginTop: 12 }}>
                  {errorAccion}
                </Text>
              ) : null}

              {vistaReal === 'anotado' ? (
                <View style={{ marginTop: 14 }}>
                  <Text
                    numberOfLines={verTodo ? undefined : 8}
                    style={{ fontFamily: MONO, fontSize: 13, lineHeight: 23, color: INK.body }}
                  >
                    {!analisis ? textoBase : null}
                    {tramos.map((t, i) =>
                      t.mencion ? (
                        <Text
                          key={i}
                          onPress={() => elegir(t.mencion)}
                          onLongPress={() => sostener(t.mencion)}
                          style={{
                            color: colorDe(t.mencion),
                            // Subrayado solo lo que ya está en tu Codex; lo que
                            // es solo de este post va con su color y nada más.
                            // Es lo único que los distingue en el texto, y
                            // alcanza sin sumar íconos entre palabras.
                            textDecorationLine: t.mencion.codex ? 'underline' : 'none',
                            textDecorationColor: colorDe(t.mencion),
                            backgroundColor: elegida === t.mencion.texto ? `${colorDe(t.mencion)}1F` : 'transparent',
                          }}
                        >
                          {t.texto}
                        </Text>
                      ) : (
                        <Text key={i}>{t.texto}</Text>
                      )
                    )}
                  </Text>

                  {textoBase.length > 340 ? (
                    <Pressable onPress={() => setVerTodo((v) => !v)} hitSlop={8} style={{ marginTop: 8 }}>
                      <Text style={{ fontFamily: MONO, fontSize: 12, color: 'rgba(28,43,34,0.35)' }}>
                        {verTodo ? '— menos' : '+ todo'}
                      </Text>
                    </Pressable>
                  ) : null}

                  {tiposPresentes.length || materialesPresentes.length ? (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 8, marginTop: 18 }}>
                      {tiposPresentes.map((t) => (
                        <Leyenda key={t} color={TYPE_ACCENT[t]}>
                          {PLURAL[t]}
                        </Leyenda>
                      ))}
                      {/* Los materiales con su ícono y no con un punto: es lo que
                          dice, antes de tocar nada, que esa palabra ya se
                          reconoció como película, libro o lugar. */}
                      {materialesPresentes.map((k) => (
                        <Leyenda key={k} color={MATERIAL[k].color} material={k}>
                          {MATERIAL[k].plural}
                        </Leyenda>
                      ))}
                    </View>
                  ) : null}

                  {ficha}
                </View>
              ) : vistaReal === 'aprender' ? (
                <Aprender aprender={analisis.aprender} piezas={piezas} />
              ) : (
                <View style={{ marginTop: 14 }}>
                  {narrativa ? (
                    <Text style={{ fontFamily: MONO, fontSize: 13, color: INK.title, lineHeight: 21, marginBottom: 22 }}>
                      {narrativa}
                    </Text>
                  ) : null}

                  {/* Cada sección se dibuja solo si el post la trae. El orden va
                      de quién y desde dónde, a qué dice, a en qué se apoya. */}
                  <View style={{ marginTop: narrativa ? -28 : 0 }}>
                    <LoQueSeVe vistazo={d.vistazo} />
                    <QuienAparece
                      quienes={piezas.quienes}
                      colorDe={colorDe}
                      elegida={elegida}
                      onElegir={elegir}
                      onSostener={sostener}
                      ficha={ficha}
                      relacion={(r, n) => (
                        <FilaRelacion
                          key={`${n}-${claveRelacion(r)}`}
                          relacion={r}
                          menciones={menciones}
                          ocupado={ocupado === claveRelacion(r)}
                          onMas={() => conectar(r)}
                          compacta
                        />
                      )}
                    />
                    <Postura ejes={analisis?.ejes} hablantes={analisis?.hablantes} quienDe={piezas.quienDe} quienDeVoz={piezas.quienDeVoz} resolver={piezas.resolver} />
                    <Cifras cifras={piezas.cifras} hablantes={analisis?.hablantes} quienDeVoz={piezas.quienDeVoz} ocupado={ocupado} onGuardar={guardarHecho} />

                    {[['hechos', comprobables], ['afirmaciones', afirmaciones]].map(([titulo, lista]) =>
                      lista.length ? (
                        <Bloque key={titulo} titulo={titulo} icono={titulo}>
                          {lista.map((h, i) => (
                            <FilaHecho
                              key={h.id}
                              hecho={h}
                              voz={h.hablante ? (analisis?.hablantes || []).find((v) => v.id === h.hablante) : null}
                              quienDeVoz={piezas.quienDeVoz}
                              ultima={i === lista.length - 1}
                              ocupado={ocupado === `hecho:${h.texto}`}
                              onGuardar={() => guardarHecho(h)}
                            />
                          ))}
                        </Bloque>
                      ) : null
                    )}

                    {/* Solo en análisis que ya traen fuentes: en uno anterior, «sin
                        citar» sería decir algo que no se midió. */}
                    {Array.isArray(analisis?.fuentes) ? <Apoyo fuentes={piezas.fuentes} afirma={afirmaComprobable} /> : null}

                    <Listas listas={analisis?.listas} menciones={menciones} colorDe={colorDe} onElegir={elegir} />
                    <Recetas recetas={analisis?.recetas} />
                  </View>

                  {tiposEnChips.map((t) => (
                    <View key={t} style={{ marginTop: 28 }}>
                      <Text style={{ fontFamily: MONO, fontSize: 11.5, color: TENUE, marginBottom: 9 }}>{PLURAL[t]}</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
                        {menciones
                          .filter((m) => tipoDe(m) === t && enChips(m))
                          .map((m) => (
                            <ChipMencion
                              key={m.texto}
                              mencion={m}
                              elegida={elegida === m.texto}
                              onPress={() => elegir(m)}
                              onLongPress={() => sostener(m)}
                            />
                          ))}
                      </View>
                      {/* La ficha se abre debajo de la sección de la mención
                          tocada y no al final de todo: al final quedaría a
                          varias pantallas del chip que la abrió. */}
                      {mencionElegida && tipoDe(mencionElegida) === t ? ficha : null}
                    </View>
                  ))}

                  {refs.length ? (
                    <View style={{ marginTop: 28 }}>
                      <Text style={{ fontFamily: MONO, fontSize: 11.5, color: TENUE, marginBottom: 9 }}>materiales</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
                        {refs.map((m) => (
                          <ChipMencion
                            key={m.texto}
                            mencion={m}
                            elegida={elegida === m.texto}
                            onPress={() => elegir(m)}
                            onLongPress={() => sostener(m)}
                          />
                        ))}
                      </View>
                      {mencionElegida && esRef(mencionElegida) ? ficha : null}
                    </View>
                  ) : null}

                  {/* Una relación entre dos cosas que no son personas ni
                      organizaciones no tiene fila en «quién aparece». */}
                  {piezas.relacionesSueltas.length ? (
                    <View style={{ marginTop: 20 }}>
                      {piezas.relacionesSueltas.map((r, i) => (
                        <FilaRelacion
                          key={`${i}-${claveRelacion(r)}`}
                          relacion={r}
                          menciones={menciones}
                          ocupado={ocupado === claveRelacion(r)}
                          onMas={() => conectar(r)}
                        />
                      ))}
                    </View>
                  ) : null}

                  {temas.length ? (
                    <Bloque titulo="temas" icono="temas">
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
                        {temas.map((t) => (
                          <View
                            key={t}
                            style={{
                              paddingHorizontal: 10,
                              paddingVertical: 5,
                              borderRadius: RADIUS.pill,
                              backgroundColor: 'rgba(106,84,51,0.08)',
                            }}
                          >
                            <Text style={{ fontFamily: MONO, fontSize: 12, color: '#6A5433' }}>{t}</Text>
                          </View>
                        ))}
                      </View>
                    </Bloque>
                  ) : null}
                </View>
              )}
            </Animated.View>
          ) : null}
          </View>
          </Saltos>
        </ScrollView>
      </View>

      {/* La ficha del Codex cuelga de esta hoja y no se abre al lado: iOS
          presenta un Modal a la vez, y como hermana no aparecería. */}
      {itemAbierto ? (
        <ItemDetailSheet
          item={itemAbierto}
          onClose={() => setItemAbierto(null)}
          onSaved={(guardado) => setItemAbierto((prev) => (prev ? { ...prev, ...guardado } : prev))}
          bottomInset={bottomInset}
        />
      ) : null}
    </Modal>
  );
}

const TENUE = 'rgba(28,43,34,0.35)';

/** Qué se guardó de un análisis: facts, conexiones y vínculos. Si coincide, la fila ya lo trae. */
function firma(a) {
  return JSON.stringify([
    (a?.hechos || []).map((h) => h?.fact_id || ''),
    (a?.relaciones || []).map((r) => r?.relation_id || ''),
    (a?.menciones || []).map((m) => m?.codex?.id || ''),
  ]);
}

const claveRelacion = (r) => `rel:${r.a}|${r.verbo}|${r.b}`;

/**
 * Lo que se sabe de una mención tocada, en el mismo lugar donde se la tocó.
 *
 * No abre otra hoja: una mención de la capa del post no tiene ficha propia en
 * el Codex, y lo que interesa de ella —en qué hechos aparece y con qué se
 * relaciona— está en este mismo post. Si ya está en tu Codex, desde acá se abre
 * su ficha de verdad.
 */
function FichaMencion({
  mencion,
  hechos,
  relaciones,
  menciones,
  ocupado,
  onAbrir,
  onMas,
  detalle,
  buscando,
  errorDetalle,
  guardando,
  onGuardar,
}) {
  const color = colorDe(mencion);
  const candidatos = mencion.codex ? [] : mencion.candidatos || [];
  const [portadaRota, setPortadaRota] = useState(false);

  const material = materialDe(mencion);
  const id = mencion.identidad;
  // Un material identificado se describe con lo que dijo su base —«película ·
  // 2019 · Bong Joon-ho»—; sin identificar, con la pista del análisis.
  const quien = id?.autor || id?.artista || (id?.fuente === 'apple_maps' ? id?.direccion : null);
  const linea = material
    ? [MATERIAL[material].etiqueta, id?.anio, quien, !id ? mencion.pista : null].filter(Boolean).join(' · ')
    : [tipoDe(mencion).toLowerCase(), mencion.pista].filter(Boolean).join(' · ');
  // «Joker» se estrenó como «Guasón»: se muestra solo si de verdad es otro nombre.
  const otroTitulo = id?.titulo && id.titulo.trim().toLowerCase() !== mencion.texto.trim().toLowerCase() ? id.titulo : null;

  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      style={{
        marginTop: 14,
        padding: 14,
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: `${color}33`,
        backgroundColor: `${color}0A`,
      }}
    >
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {id?.imagen && !portadaRota ? (
          <Image
            source={{ uri: id.imagen }}
            onError={() => setPortadaRota(true)}
            resizeMode="cover"
            style={{ width: 46, height: material === 'music' ? 46 : 68, borderRadius: 6, backgroundColor: `${color}14` }}
          />
        ) : null}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {material ? <IconoMaterial material={material} size={13} color={color} /> : null}
            <Text style={{ fontFamily: MONO, fontSize: 14, color, lineHeight: 20, flexShrink: 1 }}>{mencion.texto}</Text>
          </View>
          {otroTitulo ? (
            <Text style={{ fontFamily: MONO, fontSize: 12, color: INK.body, marginTop: 2, lineHeight: 17 }}>{otroTitulo}</Text>
          ) : null}
          <Text style={{ fontFamily: MONO, fontSize: 11.5, color: TENUE, marginTop: 4, lineHeight: 17 }}>{linea}</Text>
        </View>
      </View>

      {mencion.codex ? (
        <Pressable
          onPress={() => onAbrir(mencion.codex)}
          hitSlop={8}
          style={({ pressed }) => ({ marginTop: 12, opacity: pressed ? 0.5 : 1 })}
          accessibilityRole="button"
          accessibilityLabel={`Abrir ${mencion.codex.name} en tu Codex`}
        >
          <Text style={{ fontFamily: MONO, fontSize: 12.5, color: INK.title }}>abrir en tu Codex ›</Text>
        </Pressable>
      ) : null}

      {material && !mencion.codex ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 18, rowGap: 8, marginTop: 14 }}>
          {guardando ? (
            <MorphingInfinity size={15} color={INK.title} />
          ) : (
            <>
              <AccionTexto onPress={() => onGuardar(mencion)} etiqueta={`Guardar ${MATERIAL[material].etiqueta} en tu Codex`}>
                {`guardar ${MATERIAL[material].etiqueta}`}
              </AccionTexto>
              {/* Antigua recomendada como destino entra como lugar; si la
                  querés como territorio de tu Codex, se agrega así. */}
              {mencion.tipo_sugerido ? (
                <AccionTexto
                  onPress={() => onGuardar(mencion, mencion.tipo_sugerido)}
                  etiqueta={`Agregar como ${mencion.tipo_sugerido.toLowerCase()} a tu Codex`}
                >
                  {`agregar como ${mencion.tipo_sugerido.toLowerCase()}`}
                </AccionTexto>
              ) : null}
            </>
          )}
        </View>
      ) : null}

      {buscando ? (
        <Text style={{ fontFamily: MONO, fontSize: 12, color: TENUE, marginTop: 14 }}>buscando…</Text>
      ) : null}
      {errorDetalle && !detalle ? (
        <Text style={{ fontFamily: MONO, fontSize: 12, color: '#B91C1C', marginTop: 14, lineHeight: 18 }}>{errorDetalle}</Text>
      ) : null}
      {detalle ? <DetalleMaterial detalle={detalle} yaDicho={quien} /> : null}

      {id?.url ? (
        <AccionTexto onPress={() => Linking.openURL(id.url).catch(() => {})} etiqueta={`Abrir en ${NOMBRE_FUENTE[id.fuente] || 'la fuente'}`} arriba={12}>
          {`${NOMBRE_FUENTE[id.fuente] || 'fuente'} ›`}
        </AccionTexto>
      ) : null}

      {candidatos.length ? (
        <View style={{ marginTop: 12 }}>
          <Text style={{ fontFamily: MONO, fontSize: 11.5, color: TENUE, marginBottom: 6 }}>
            en tu Codex hay varios con este nombre
          </Text>
          {candidatos.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => onAbrir(c)}
              hitSlop={6}
              style={({ pressed }) => ({ paddingVertical: 5, opacity: pressed ? 0.5 : 1 })}
              accessibilityRole="button"
              accessibilityLabel={`Abrir ${c.name}`}
            >
              <Text style={{ fontFamily: MONO, fontSize: 12.5, color: INK.title }}>
                {c.name}
                <Text style={{ color: TENUE }}>{` · ${String(c.tipo || '').toLowerCase()} ›`}</Text>
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {hechos.length ? (
        <View style={{ marginTop: 14 }}>
          {hechos.map((h, i) => (
            <Text key={i} style={{ fontFamily: MONO, fontSize: 12.5, color: INK.body, lineHeight: 19, marginTop: i ? 6 : 0 }}>
              {h.texto}
            </Text>
          ))}
        </View>
      ) : null}

      {relaciones.length ? (
        <View style={{ marginTop: 10 }}>
          {relaciones.map((r, i) => (
            <FilaRelacion
              key={`${i}-${claveRelacion(r)}`}
              relacion={r}
              menciones={menciones}
              ocupado={ocupado === claveRelacion(r)}
              onMas={() => onMas(r)}
              compacta
            />
          ))}
        </View>
      ) : null}
    </Animated.View>
  );
}

/**
 * Una mención en la vista organizada.
 *
 * Con borde si ya está en tu Codex, sin borde si solo aparece en este post: la
 * misma distinción que el subrayado en el texto anotado, para que las dos
 * vistas digan lo mismo con el mismo gesto visual.
 */
function ChipMencion({ mencion, elegida, onPress, onLongPress }) {
  const color = colorDe(mencion);
  const material = materialDe(mencion);
  const cuerpo = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      {material ? <IconoMaterial material={material} size={11} color={color} /> : null}
      <Text style={{ fontFamily: MONO, fontSize: 12, color }}>{mencion.texto}</Text>
    </View>
  );
  const fondo = elegida ? `${color}24` : `${color}0D`;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
      accessibilityRole="button"
      accessibilityLabel={`${mencion.texto}, ${material ? MATERIAL[material].etiqueta : tipoDe(mencion)}${mencion.codex ? ', en tu Codex' : ''}`}
      accessibilityHint={material ? 'Mantené presionado para ver más' : undefined}
    >
      <View
        style={{
          paddingHorizontal: 10,
          paddingVertical: 5,
          borderRadius: RADIUS.pill,
          borderWidth: 1,
          borderColor: mencion.codex ? `${color}66` : 'transparent',
          backgroundColor: fondo,
        }}
      >
        {cuerpo}
      </View>
    </Pressable>
  );
}

/**
 * Un hecho del post, con su cita y su botón de guardar.
 *
 * La cita solo se muestra si de verdad está en el texto: una «cita» que el
 * modelo reescribió no es una cita, y mostrarla entre comillas diría lo
 * contrario. Guardado, el marcador se llena y tocarlo abre el Fact en el Codex.
 */
function FilaHecho({ hecho, voz = null, quienDeVoz, ultima, ocupado, onGuardar }) {
  return (
    <Pieza
      id={hecho.id}
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 14,
        paddingVertical: 12,
        borderBottomWidth: ultima ? 0 : 1,
        borderBottomColor: 'rgba(28,43,34,0.07)',
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: MONO, fontSize: 13, color: INK.title, lineHeight: 20 }}>{hecho.texto}</Text>
        {hecho.cita && hecho.cita_en_texto ? (
          <Text style={{ fontFamily: MONO, fontSize: 12, color: TENUE, lineHeight: 18, marginTop: 6 }}>
            «{hecho.cita}»
          </Text>
        ) : null}
        {/* Quién lo dijo, cuando en el post habla más de una persona. */}
        <LoDice voz={voz} quienDeVoz={quienDeVoz} />
        {/* En qué se apoya, como referencia: la fuente se lee en su sección. */}
        <Refs ids={hecho.fuentes} />
      </View>

      <GuardarHecho hecho={hecho} ocupado={ocupado} onGuardar={onGuardar} />
    </Pieza>
  );
}

/**
 * Una relación del post: «A → verbo → B», con su +.
 *
 * El + es lo único que la vuelve una conexión del Codex, y crea en el mismo
 * paso las puntas que todavía no estén. Hecha, el + pasa a ser un visto y deja
 * de responder: la conexión ya existe y tocar de nuevo no agrega nada.
 */
function FilaRelacion({ relacion, menciones, ocupado, onMas, compacta = false }) {
  const ma = menciones.find((m) => m.texto === relacion.a);
  const mb = menciones.find((m) => m.texto === relacion.b);
  const hecha = !!relacion.relation_id;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: compacta ? 6 : 10 }}>
      <Text style={{ flex: 1, fontFamily: MONO, fontSize: compacta ? 12.5 : 13, lineHeight: 20 }}>
        <Text style={{ color: colorDe(ma) }}>{relacion.a}</Text>
        <Text style={{ color: TENUE }}>{` → ${relacion.verbo} → `}</Text>
        <Text style={{ color: colorDe(mb) }}>{relacion.b}</Text>
      </Text>

      <Pressable
        onPress={onMas}
        disabled={hecha || ocupado}
        hitSlop={12}
        style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
        accessibilityRole="button"
        accessibilityLabel={
          hecha ? 'La conexión ya está en tu Codex' : `Agregar a tu Codex: ${relacion.a} ${relacion.verbo} ${relacion.b}`
        }
      >
        {ocupado ? (
          <MorphingInfinity size={15} color={INK.title} />
        ) : hecha ? (
          <Check size={16} color="#15803D" />
        ) : (
          <Plus size={17} color={INK.title} />
        )}
      </Pressable>
    </View>
  );
}

/**
 * El ojo.
 *
 * Sin análisis, invita a extraer. Con análisis, ya no hay nada que extraer, así
 * que cambia de trabajo: alterna entre las dos vistas. Se marca con un punto
 * para que se note que ya se usó — un ojo idéntico antes y después haría pensar
 * que no pasó nada.
 */
function OjoBoton({ onPress, cargando, activo }) {
  const press = useSharedValue(0);

  const animado = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - press.value * 0.08 }],
  }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        press.value = withTiming(1, MOTION.press);
      }}
      onPressOut={() => {
        press.value = withSpring(0, MOTION.tap);
      }}
      hitSlop={12}
      disabled={cargando}
      accessibilityRole="button"
      accessibilityLabel={activo ? 'Cambiar de vista del análisis' : 'Extraer detalles con IA'}
    >
      <Animated.View
        style={[
          {
            width: 34,
            height: 34,
            borderRadius: 17,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: activo ? 'rgba(75,79,166,0.12)' : 'rgba(28,43,34,0.06)',
            borderWidth: 1,
            borderColor: activo ? 'rgba(75,79,166,0.28)' : 'rgba(28,43,34,0.09)',
          },
          animado,
        ]}
      >
        {cargando ? (
          <MorphingInfinity size={16} color={INK.title} />
        ) : (
          <Eye size={16} color={activo ? COLOR_OJO : INK.title} />
        )}
      </Animated.View>
    </Pressable>
  );
}

function Solapa({ activa, onPress, children }) {
  return (
    <Pressable onPress={onPress} hitSlop={8}>
      <Text
        style={{
          fontFamily: MONO,
          fontSize: 12.5,
          color: activa ? INK.title : 'rgba(28,43,34,0.3)',
        }}
      >
        {children}
      </Text>
      <View
        style={{
          height: 1,
          marginTop: 5,
          backgroundColor: activa ? 'rgba(28,43,34,0.5)' : 'transparent',
        }}
      />
    </Pressable>
  );
}

function Leyenda({ color, material, children }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      {material ? (
        <IconoMaterial material={material} size={11} color={color} />
      ) : (
        <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: color }} />
      )}
      <Text style={{ fontFamily: MONO, fontSize: 11, color: 'rgba(28,43,34,0.35)' }}>{children}</Text>
    </View>
  );
}

/** Una acción de texto dentro de una ficha: guardar, agregar, abrir la fuente. */
function AccionTexto({ onPress, etiqueta, arriba = 0, children }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => ({ marginTop: arriba, opacity: pressed ? 0.5 : 1, alignSelf: 'flex-start' })}
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
    >
      <Text style={{ fontFamily: MONO, fontSize: 12.5, color: INK.title }}>{children}</Text>
    </Pressable>
  );
}

const minutos = (n) => (n >= 60 ? `${Math.floor(n / 60)} h ${n % 60 ? `${n % 60} min` : ''}`.trim() : `${n} min`);
const mmss = (seg) => `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, '0')}`;

/**
 * Lo que trajo sostener un material.
 *
 * De una base: sinopsis y los datos que tenga, en renglones cortos. De la web:
 * los resultados, cada uno se abre. Lo que ya dice el encabezado de la ficha
 * —el autor, el artista— no se repite acá.
 */
function DetalleMaterial({ detalle, yaDicho }) {
  const creadores = (detalle.creadores || []).filter((c) => !yaDicho || !String(yaDicho).includes(c));
  const filas = [
    creadores.length ? ['de', creadores.join(', ')] : null,
    detalle.reparto?.length ? ['con', detalle.reparto.join(', ')] : null,
    detalle.generos?.length ? ['género', detalle.generos.join(', ')] : null,
    detalle.temas?.length ? ['temas', detalle.temas.join(', ')] : null,
    detalle.temporadas ? ['temporadas', String(detalle.temporadas)] : null,
    // TMDB cuenta la duración en minutos; MusicBrainz, en segundos.
    detalle.duracion ? ['duración', detalle.fuente === 'musicbrainz' ? mmss(detalle.duracion) : minutos(detalle.duracion)] : null,
    detalle.categoria ? ['categoría', detalle.categoria] : null,
  ].filter(Boolean);

  return (
    <Animated.View entering={FadeIn.duration(200)} style={{ marginTop: 14 }}>
      {detalle.sinopsis ? (
        <Text numberOfLines={7} style={{ fontFamily: MONO, fontSize: 12.5, color: INK.body, lineHeight: 19 }}>
          {detalle.sinopsis}
        </Text>
      ) : null}

      {filas.map(([k, v]) => (
        <Text key={k} style={{ fontFamily: MONO, fontSize: 12, lineHeight: 18, marginTop: 6 }}>
          <Text style={{ color: TENUE }}>{`${k}  `}</Text>
          <Text style={{ color: INK.body }}>{v}</Text>
        </Text>
      ))}

      {(detalle.resultados || []).map((r) => (
        <Pressable
          key={r.url}
          onPress={() => Linking.openURL(r.url).catch(() => {})}
          style={({ pressed }) => ({ marginTop: 10, opacity: pressed ? 0.5 : 1 })}
          accessibilityRole="link"
          accessibilityLabel={r.titulo || r.url}
        >
          <Text numberOfLines={1} style={{ fontFamily: MONO, fontSize: 12.5, color: INK.title }}>
            {r.titulo || r.url}
          </Text>
          <Text numberOfLines={1} style={{ fontFamily: MONO, fontSize: 11, color: TENUE, marginTop: 2 }}>
            {(r.url.match(/^https?:\/\/(?:www\.)?([^/]+)/) || [])[1] || r.url}
          </Text>
        </Pressable>
      ))}
    </Animated.View>
  );
}
