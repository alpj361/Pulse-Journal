import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Linking,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { X, Pencil, ExternalLink, Plus, Trash2, ChevronDown } from 'lucide-react-native';
import { INK, GLASS, CARD_SHADOW, RADIUS } from '../theme';
import MorphingInfinity from '../MorphingInfinity';
import { roce } from '../../utils/haptics';
import { getCodexSchema, collectFields, canonicalTipo, presetFor, FIELD_TYPES } from '../../utils/codexSchema';
import useCamposEditables from './useCamposEditables';
import useVinculos from './useVinculos';
import FieldInput, { inputStyle } from './FieldInput';
import { normalizeTipo, TYPE_ACCENT, TYPE_ORDER } from './tipos';
import { esReconocible, PISO } from './menciones';
import GeoTerritorio from './GeoTerritorio';
import { normalizarGeo, etiquetaNivel } from './geo';
import PortadaEspacio from './PortadaEspacio';
import { supabase } from '../../utils/supabase';

/**
 * Ficha de item.
 *
 * Tres ideas tomadas de las referencias, y una decisión propia:
 *
 *  · Portada de ancho completo con el nombre encima (CREME / MUBI). Un item no
 *    tenía identidad visual — era un cuadradito con iniciales. Ahora hereda el
 *    mismo shader que los espacios, sembrado con su id, o la imagen que traiga
 *    en `thumbnail_url`.
 *  · Rótulos de sección en versalitas (MUBI), y CON DATOS / POR COMPLETAR como
 *    los dos bloques del detalle, igual que en ThePulse.
 *
 * Se edita acá mismo, no en otro modal. Abrir una segunda hoja encima para
 * cambiar un campo obligaba a cerrar, volver y buscar dónde estabas; y en iOS,
 * con un modal sobre otro, la ficha quedaba tapada justo cuando hace falta
 * verla. El lápiz de la esquina alterna entre leer y editar sobre el mismo
 * cuerpo: los renglones se vuelven campos en el lugar.
 *
 * La decisión propia: «Por completar» se muestra como fichas de catálogo, no
 * como filas con «sin dato». Una lista de veinte renglones vacíos en un teléfono
 * es una pared de nada; en chips se lee de un vistazo qué falta y cada uno abre
 * el editor en ese campo.
 */

const NOTA = {
  menciones: 'referencias externas registradas',
  relaciones: 'relaciones semánticas (silogismos)',
  progresion: 'línea de tiempo del item',
};

/** Rótulo de sección en versalitas, con la regla al costado. */
function Etiqueta({ children, nota, accion }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 26, marginBottom: 12 }}>
      <Text style={{ fontSize: 11, fontWeight: '800', color: INK.title, letterSpacing: 1.1 }}>
        {String(children).toUpperCase()}
      </Text>
      {nota ? (
        <Text numberOfLines={1} style={{ fontSize: 11, color: INK.faint, flexShrink: 1 }}>
          — {nota}
        </Text>
      ) : null}
      <View style={{ flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(28,43,34,0.14)' }} />
      {accion}
    </View>
  );
}

/** Insignia del tipo de dato. Antes era texto suelto y se leía como parte del valor. */
function Insignia({ children }) {
  return (
    <View
      style={{
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 6,
        backgroundColor: 'rgba(28,43,34,0.06)',
      }}
    >
      <Text style={{ fontSize: 9.5, fontWeight: '700', color: INK.faint, letterSpacing: 0.2 }}>
        {children}
      </Text>
    </View>
  );
}

function FilaCampo({ label, value, type, accent, onPress }) {
  const esLink = type === 'link' && value;

  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(28,43,34,0.08)',
      }}
    >
      {/* Sin insignia de tipo: leyendo, «texto» o «dropdown» no dice nada sobre
          el dato — es información del esquema, y solo importa al editarlo. */}
      <Text style={{ fontSize: 11.5, fontWeight: '700', color: INK.meta, marginBottom: 5 }}>{label}</Text>
      {esLink ? (
        <TouchableOpacity
          onPress={() => Linking.openURL(value).catch(() => {})}
          activeOpacity={0.7}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
        >
          <Text numberOfLines={2} style={{ flex: 1, fontSize: 14, color: accent, fontWeight: '600' }}>
            {value}
          </Text>
          <ExternalLink size={13} color={accent} />
        </TouchableOpacity>
      ) : (
        <Text style={{ fontSize: 14.5, color: INK.title, lineHeight: 21 }}>{value}</Text>
      )}
    </Pressable>
  );
}

function Vacio({ children }) {
  return (
    <View style={{ paddingVertical: 26, alignItems: 'center' }}>
      <Text style={{ fontSize: 13.5, color: INK.meta, textAlign: 'center' }}>{children}</Text>
    </View>
  );
}


/**
 * Menciones, en dos bloques separados.
 *
 * Prensa y Codex no son lo mismo y no se comparan: que a alguien lo nombren en
 * cuarenta noticias habla de su exposición pública; que aparezca en cuarenta
 * fichas del Codex habla del trabajo de investigación que hay hecho sobre él.
 * Sumarlos en un solo número mezclaría dos cosas que se leen distinto, así que
 * cada bloque lleva su propio conteo.
 */
function MencionesTab({ menciones, accent }) {
  const prensa = menciones.filter((m) => m.fuente === 'news' || m.fuente === 'card');
  const codex = menciones.filter((m) => m.fuente === 'snippet' || m.fuente === 'actor');

  if (!menciones.length) {
    return (
      <>
        <Etiqueta nota={NOTA.menciones}>Menciones</Etiqueta>
        <Vacio>No aparece en ninguna noticia, tarjeta, snippet ni ficha de otro actor.</Vacio>
      </>
    );
  }

  return (
    <>
      <Etiqueta nota={`${prensa.length} ${prensa.length === 1 ? 'aparición' : 'apariciones'}`}>
        En prensa
      </Etiqueta>
      {prensa.length === 0 ? (
        <Text style={{ fontSize: 13, color: INK.faint, paddingVertical: 8 }}>
          Sin apariciones en noticias ni tarjetas.
        </Text>
      ) : (
        prensa.slice(0, 40).map((m, i) => (
          <FilaMencion
            key={`${m.fuente}-${m.ref_id}`}
            m={m}
            i={i}
            color={m.fuente === 'card' ? '#B45309' : '#1B5E8F'}
            etiqueta={m.fuente === 'card' ? 'tarjeta' : m.origen}
          />
        ))
      )}
      {prensa.length > 40 ? (
        <Text style={{ fontSize: 12, color: INK.faint, marginTop: 10, textAlign: 'center' }}>
          y {prensa.length - 40} apariciones más
        </Text>
      ) : null}

      <Etiqueta nota={`${codex.length} ${codex.length === 1 ? 'ficha' : 'fichas'}`}>
        En el Codex
      </Etiqueta>
      {codex.length === 0 ? (
        <Text style={{ fontSize: 13, color: INK.faint, paddingVertical: 8 }}>
          Ningún snippet ni ficha de otro actor lo nombra.
        </Text>
      ) : (
        codex.slice(0, 40).map((m, i) => (
          <FilaMencion
            key={`${m.fuente}-${m.ref_id}`}
            m={m}
            i={i}
            color={m.fuente === 'snippet' ? '#5A6B60' : accent}
            etiqueta={m.origen}
          />
        ))
      )}
      {codex.length > 40 ? (
        <Text style={{ fontSize: 12, color: INK.faint, marginTop: 10, textAlign: 'center' }}>
          y {codex.length - 40} fichas más
        </Text>
      ) : null}
    </>
  );
}

function FilaMencion({ m, i, color, etiqueta }) {
  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(i, 8) * 30).duration(240)}
      style={{
        flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 11,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(28,43,34,0.07)',
      }}
    >
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color, marginTop: 6 }} />
      <View style={{ flex: 1 }}>
        <Text numberOfLines={2} style={{ fontSize: 13.5, color: INK.title, lineHeight: 19 }}>
          {m.titulo || 'Sin título'}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
          {etiqueta ? (
            <Text style={{ fontSize: 11, color: INK.faint, fontWeight: '600' }}>{etiqueta}</Text>
          ) : null}
          {m.fecha ? <Text style={{ fontSize: 11, color: INK.faint }}>· {m.fecha}</Text> : null}
        </View>
      </View>
    </Animated.View>
  );
}

/**
 * Elegir el otro extremo de una relación.
 *
 * Una relación necesita un item real del universo, no un nombre escrito a mano:
 * `object_id` es una uuid NOT NULL. Así que acá se busca y se elige, y hasta que
 * haya uno elegido no hay relación que guardar.
 */
function BuscadorItem({ accent, onBuscar, onElegir }) {
  const [q, setQ] = useState('');
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    // Se espera a que el dedo pare: sin esto sería una consulta por tecla.
    const t = setTimeout(async () => {
      if (q.trim().length < 2) return setResultados([]);
      setBuscando(true);
      setResultados(await onBuscar(q));
      setBuscando(false);
    }, 320);
    return () => clearTimeout(t);
  }, [q, onBuscar]);

  return (
    <View style={{ gap: 8 }}>
      <View
        style={{
          flexDirection: 'row', alignItems: 'center', gap: 8,
          paddingVertical: 13, paddingHorizontal: 14, borderRadius: RADIUS.md,
          borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(28,43,34,0.18)',
        }}
      >
        <Plus size={14} color={INK.title} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Relacionar con… (buscá un item)"
          placeholderTextColor={INK.faint}
          style={{ flex: 1, fontSize: 13, color: INK.title, padding: 0 }}
        />
        {buscando ? <MorphingInfinity size={16} color={INK.faint} /> : null}
      </View>

      {resultados.length > 0 ? (
        <Animated.View entering={FadeIn.duration(180)} style={{ gap: 6 }}>
          {resultados.map((it) => (
            <TouchableOpacity
              key={it.id}
              onPress={() => {
                roce();
                onElegir(it);
                setQ('');
                setResultados([]);
              }}
              activeOpacity={0.75}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 8,
                paddingVertical: 11, paddingHorizontal: 13, borderRadius: RADIUS.sm,
                backgroundColor: '#FFFFFF',
              }}
            >
              <View
                style={{
                  width: 6, height: 6, borderRadius: 3,
                  backgroundColor: TYPE_ACCENT[normalizeTipo(it.tipo)] || INK.faint,
                }}
              />
              <Text numberOfLines={1} style={{ flex: 1, fontSize: 13.5, color: INK.title, fontWeight: '600' }}>
                {it.name}
              </Text>
              <Insignia>{normalizeTipo(it.tipo)}</Insignia>
            </TouchableOpacity>
          ))}
        </Animated.View>
      ) : null}
    </View>
  );
}

export default function ItemDetailSheet({ item, onClose, onSaved, creando = false, bottomInset = 0 }) {
  // Los items del universo que vienen de la pila llevan `id` prefijado
  // (`universe_<uuid>`) y el uuid real en `_sourceId`; los que vienen del
  // espacio traen el uuid directo. Las consultas necesitan el uuid.
  const dbId = item?._sourceId || item?.id;
  const { width: W } = useWindowDimensions();

  const [schema, setSchema] = useState(null);
  const [tab, setTab] = useState('detalle');

  const [editando, setEditando] = useState(creando);
  const [tipoAbierto, setTipoAbierto] = useState(null); // campo con el menú de tipos abierto
  const [catalogoAbierto, setCatalogoAbierto] = useState(false);
  const [nuevoCampo, setNuevoCampo] = useState('');
  const [nombreEd, setNombreEd] = useState(item?.name || item?.titulo || '');
  const [descEd, setDescEd] = useState(item?.description || item?.descripcion || '');
  // Los alias se editan como una línea separada por comas y no como una lista de
  // chips: son dos o tres, se escriben de corrido, y una lista con su botón de
  // agregar convierte treinta segundos de tipeo en cinco toques.
  // `undefined` mientras nadie lo toque, para que guardar un cambio de nombre no
  // reescriba la geometría. Ver `useCamposEditables.guardar`.
  const [geoEd, setGeoEd] = useState(undefined);
  const [aliasEd, setAliasEd] = useState(
    (Array.isArray(item?.aliases) ? item.aliases.filter(Boolean) : []).join(', ')
  );

  const [tipoNuevo, setTipoNuevo] = useState(normalizeTipo(item?.tipo || item?.subcategory));
  const [tipoMenu, setTipoMenu] = useState(false);
  // Al crear, el tipo se elige acá; después queda fijo — cambiarlo con datos ya
  // cargados movería el item a otro catálogo y dejaría campos sin significado.
  const tipo = creando ? tipoNuevo : normalizeTipo(item?.tipo || item?.subcategory);
  // `wiki_items` no tiene columna de alias. Mostrar el campo ahí sería ofrecer
  // algo que al guardar se pierde sin decir nada.
  const admiteAlias = creando || item?._source === 'universe' || !!item?._sourceId;
  // Lo geográfico solo tiene sentido para Territorios: es el único tipo que se
  // dibuja en el mapa.
  const esTerritorio = tipo === 'Territorio';
  const accent = TYPE_ACCENT[tipo] || INK.body;

  const ed = useCamposEditables(item, tipo);
  const vinc = useVinculos(dbId);
  const { progresiones, relaciones, menciones } = vinc;
  const soportaProgresion = tipo !== 'Post' && tipo !== 'Snippet';

  useEffect(() => {
    let vivo = true;
    getCodexSchema().then((s) => vivo && setSchema(s));
    return () => { vivo = false; };
  }, []);

  // Relaciones y progresiones se cargan al abrir su pestaña, no antes.
  useEffect(() => {
    if (tab === 'relaciones' && relaciones === null) vinc.cargarRelaciones();
  }, [tab, relaciones, vinc]);

  useEffect(() => {
    if (tab === 'progresion' && progresiones === null) vinc.cargarProgresiones();
  }, [tab, progresiones, vinc]);

  useEffect(() => {
    if (tab === 'menciones' && menciones === null) vinc.cargarMenciones();
  }, [tab, menciones, vinc]);

  const canon = schema ? canonicalTipo(tipo, schema) : null;
  const catalogo = useMemo(() => (schema ? presetFor(tipo, schema) : []), [schema, tipo]);

  const { conDato, sinDato, extra } = useMemo(
    () => (schema ? collectFields(item, schema, tipo) : { conDato: [], sinDato: [], extra: [] }),
    [item, schema, tipo]
  );

  // ThePulse agrupa por «tiene valor», sin importar si el campo viene del preset
  // o es extra. Se replica.
  const conDatos = [...conDato, ...extra];

  /**
   * La descripción, salvo que sea el relleno de la importación.
   *
   * Los 22 departamentos —no los 336 municipios— llegaron con
   * `description: "Departamento de {nombre}"` puesto por el importador, no
   * escrito por nadie. No dice nada que el título y la etiqueta de nivel de
   * abajo («Departamento» + el cheque) no digan ya: es plantilla, no contenido.
   *
   * La comparación es exacta a propósito — contra el nivel y la primera parte
   * del nombre de este item puntual, no una palabra suelta — para no esconder
   * por error una descripción real que alguien haya escrito y que empiece
   * igual, como «Departamento de alto riesgo por…».
   */
  const descripcionCruda = item?.description || item?.descripcion;
  const tags = Array.isArray(item?.tags) ? item.tags.filter(Boolean) : [];
  const aliases = Array.isArray(item?.aliases) ? item.aliases.filter(Boolean) : [];
  const nombre = item?.name || item?.titulo || 'Sin nombre';

  const geoResumen = esTerritorio ? normalizarGeo(geoEd ?? item?.geo) : null;
  const nivelResumen = geoResumen ? etiquetaNivel(geoResumen) : null;
  const esRellenoImportacion =
    nivelResumen &&
    descripcionCruda?.trim() === `${nivelResumen} de ${nombre.split(',')[0].trim()}`;
  const descripcion = esRellenoImportacion ? null : descripcionCruda;

  // Un item que todavía no existe no puede tener vínculos: sus pestañas
  // consultarían por un id que no hay.
  const tabs = creando ? [{ k: 'detalle', label: 'Detalle' }] : [
    { k: 'detalle', label: 'Detalle' },
    ...(soportaProgresion ? [{ k: 'progresion', label: 'Progresión', badge: progresiones?.length }] : []),
    { k: 'menciones', label: 'Menciones', badge: menciones?.length || undefined },
    { k: 'relaciones', label: 'Relaciones', badge: relaciones?.length || undefined },
  ];

  const ALTO_PORTADA = 208;

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(20,28,22,0.4)', justifyContent: 'flex-end' }}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View
          style={{
            height: '93%',
            backgroundColor: '#F7F8F5',
            borderTopLeftRadius: 30,
            borderTopRightRadius: 30,
            overflow: 'hidden',
            ...CARD_SHADOW,
            shadowOffset: { width: 0, height: -8 },
            shadowOpacity: 0.16,
          }}
        >
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: bottomInset + (editando ? 104 : 34) }}
            showsVerticalScrollIndicator={false}
            // [0] portada, [1] pestañas, [2] contenido. El índice tiene que ser
            // estable: `React.Children.toArray` descarta los hijos que rinden
            // null, así que cualquier bloque condicional acá arriba corre la
            // numeración y termina fijando el elemento equivocado — que fue justo
            // lo que dejó el contenido clavado y sin scroll.
            stickyHeaderIndices={[1]}
          >
            {/* ── Portada ── */}
            <View style={{ height: ALTO_PORTADA, width: W }}>
              <PortadaEspacio
                space={{ id: dbId, cover: item?.thumbnail_url || item?.avatar }}
                ancho={W}
                alto={ALTO_PORTADA}
                radius={0}
                style={{ width: W, height: ALTO_PORTADA }}
              />

              {/* El velo hace legible el texto sin tapar la textura: opaco abajo,
                  transparente a media altura. */}
              <LinearGradient
                colors={['rgba(12,18,14,0.05)', 'rgba(12,18,14,0.35)', 'rgba(12,18,14,0.86)']}
                locations={[0, 0.45, 1]}
                style={StyleSheet.absoluteFill}
              />

              {/* Esquina derecha: el lápiz alterna leer/editar, y la × cierra.
                  Sutiles los dos — sobre la portada no compiten con el nombre. */}
              <View style={{ position: 'absolute', top: 14, right: 16, flexDirection: 'row', gap: 8 }}>
                {creando ? null : (
                <Pressable
                  onPress={() => {
                    roce();
                    setEditando((e) => !e);
                    setTipoAbierto(null);
                    setCatalogoAbierto(false);
                  }}
                  hitSlop={12}
                  style={{
                    width: 32, height: 32, borderRadius: 16,
                    backgroundColor: editando ? 'rgba(255,255,255,0.92)' : 'rgba(12,18,14,0.34)',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Pencil size={14} color={editando ? accent : 'rgba(255,255,255,0.85)'} />
                </Pressable>
                )}
                <Pressable
                  onPress={onClose}
                  hitSlop={12}
                  style={{
                    width: 32, height: 32, borderRadius: 16,
                    backgroundColor: 'rgba(12,18,14,0.34)',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <X size={16} color="rgba(255,255,255,0.85)" />
                </Pressable>
              </View>

              <View style={{ position: 'absolute', left: 20, right: 20, bottom: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                  <Pressable
                    onPress={creando ? () => { roce(); setTipoMenu((v) => !v); } : undefined}
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: 5,
                      paddingHorizontal: 9, paddingVertical: 3.5, borderRadius: 7,
                      backgroundColor: 'rgba(255,255,255,0.92)',
                    }}
                  >
                    <Text style={{ fontSize: 10, fontWeight: '800', color: accent, letterSpacing: 0.6 }}>
                      {tipo.toUpperCase()}
                    </Text>
                    {creando ? <ChevronDown size={11} color={accent} /> : null}
                  </Pressable>
                </View>

                <Text
                  numberOfLines={3}
                  style={{
                    fontSize: 27, fontWeight: '800', letterSpacing: -0.7, lineHeight: 32,
                    color: creando && !nombreEd.trim() ? 'rgba(255,255,255,0.5)' : '#FFFFFF',
                  }}
                >
                  {creando ? nombreEd.trim() || 'Nuevo elemento' : nombre}
                </Text>

                {/* Los otros nombres van pegados al nombre y no abajo con los
                    datos: son parte de quién es esto —el «también llamado» de
                    una enciclopedia— y no un campo más.

                    Dos renglones y no uno: con tres alias, uno solo cortaba el
                    último a la mitad. Y a 0.82 en vez de 0.66 porque la portada
                    puede ser una foto clara, y ahí el blanco tenue desaparecía. */}
                {aliases.length > 0 ? (
                  <Text
                    numberOfLines={2}
                    style={{ fontSize: 12.5, lineHeight: 17, color: 'rgba(255,255,255,0.82)', marginTop: 5 }}
                  >
                    también: {aliases.join(', ')}
                  </Text>
                ) : null}
              </View>
            </View>

            {/* ── Pestañas (pegajosas) ── */}
            <View style={{ backgroundColor: '#F7F8F5', paddingTop: 10 }}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 20, gap: 6, alignItems: 'center' }}
                style={{ flexGrow: 0, height: 46 }}
              >
                {tabs.map((t) => {
                  const on = tab === t.k;
                  return (
                    <TouchableOpacity
                      key={t.k}
                      onPress={() => {
                        roce();
                        setTab(t.k);
                      }}
                      activeOpacity={0.75}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 5,
                        paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.pill,
                        backgroundColor: on ? '#FFFFFF' : 'rgba(28,43,34,0.05)',
                        ...(on ? { ...CARD_SHADOW, shadowOpacity: 0.08, shadowRadius: 8 } : null),
                      }}
                    >
                      <Text style={{ fontSize: 12.5, fontWeight: on ? '800' : '600', color: on ? INK.title : INK.meta }}>
                        {t.label}
                      </Text>
                      {t.badge ? (
                        <Text style={{ fontSize: 10.5, fontWeight: '700', color: INK.faint }}>{t.badge}</Text>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(28,43,34,0.07)' }} />
            </View>

            <View style={{ paddingHorizontal: 20 }}>
              {/* Elegir el tipo al crear. Snippet no está: se escribe, no se
                  llena, y tiene su propia superficie desde «Añadir». */}
              {creando && tipoMenu ? (
                <Animated.View
                  entering={FadeInDown.duration(220).springify().damping(20)}
                  style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, paddingHorizontal: 20, paddingTop: 16 }}
                >
                  {TYPE_ORDER.filter((t) => t !== 'Snippet' && t !== 'Post').map((t) => {
                    const on = t === tipo;
                    return (
                      <TouchableOpacity
                        key={t}
                        onPress={() => {
                          roce();
                          setTipoNuevo(t);
                          setTipoMenu(false);
                        }}
                        activeOpacity={0.75}
                        style={{
                          paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.pill,
                          backgroundColor: on ? TYPE_ACCENT[t] : 'rgba(28,43,34,0.05)',
                        }}
                      >
                        <Text style={{ fontSize: 12.5, fontWeight: '700', color: on ? '#FFFFFF' : INK.body }}>
                          {t}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </Animated.View>
              ) : null}

              {/* ── Detalle ── */}
              {tab === 'detalle' ? (
                !schema ? (
                  <MorphingInfinity size={40} color={INK.meta} style={{ alignSelf: 'center', marginVertical: 40 }} />
                ) : (
                  <Animated.View entering={FadeIn.duration(220)}>
                    {editando ? (
                      <View style={{ marginTop: 18, gap: 10 }}>
                        <TextInput
                          value={nombreEd}
                          onChangeText={setNombreEd}
                          placeholder="Nombre"
                          placeholderTextColor={INK.faint}
                          style={[inputStyle, { fontSize: 17, fontWeight: '700' }]}
                        />
                        <TextInput
                          value={descEd}
                          onChangeText={setDescEd}
                          placeholder="Qué es, y de dónde salió el dato"
                          placeholderTextColor={INK.faint}
                          multiline
                          style={[inputStyle, { minHeight: 88, textAlignVertical: 'top', paddingTop: 11 }]}
                        />

                        {admiteAlias ? (
                          <View>
                            <TextInput
                              value={aliasEd}
                              onChangeText={setAliasEd}
                              placeholder="Otros nombres, separados por coma"
                              placeholderTextColor={INK.faint}
                              // Sin autocapitalizar: con «words» el teclado
                              // convertía «presidente de la república» en
                              // «Presidente De La República». El resaltado no
                              // distingue mayúsculas, pero el alias se muestra
                              // tal cual se guardó.
                              autoCapitalize="none"
                              style={inputStyle}
                            />
                            <Text style={{ fontSize: 11.5, color: INK.meta, lineHeight: 17, marginTop: 6, marginLeft: 2 }}>
                              {avisoAlias(aliasEd)}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    ) : descripcion ? (
                      <Text style={{ fontSize: 14.5, color: INK.body, lineHeight: 22, marginTop: 18 }}>
                        {descripcion}
                      </Text>
                    ) : null}

                    {/* Lo geográfico va acá arriba y no al final de los campos:
                        para un Territorio, si aparece o no en el mapa es lo
                        primero que se quiere saber, y los tres que hoy no tienen
                        geometría no lo dicen en ningún lado. */}
                    {esTerritorio ? (
                      <GeoTerritorio
                        item={item}
                        nombre={editando ? nombreEd : nombre}
                        editando={editando}
                        geoEd={geoEd}
                        onCambiar={setGeoEd}
                      />
                    ) : null}

                    {/* En edición se ocultan: repiten lo de abajo y corren el resto
                        fuera del pliegue. */}
                    {!editando && tags.length > 0 ? (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 }}>
                        {tags.map((t, i) => (
                          <View
                            key={i}
                            style={{
                              paddingHorizontal: 10, paddingVertical: 4.5, borderRadius: 8,
                              backgroundColor: 'rgba(28,43,34,0.05)',
                            }}
                          >
                            <Text style={{ fontSize: 11.5, color: INK.body, fontWeight: '600' }}>{t}</Text>
                          </View>
                        ))}
                      </View>
                    ) : null}


                    {!canon ? (
                      <Text style={{ fontSize: 12, color: INK.faint, marginTop: 16, fontStyle: 'italic' }}>
                        El tipo «{tipo}» no está en el catálogo: no hay preset. Se muestra lo guardado.
                      </Text>
                    ) : null}

                    {editando ? (
<>
                    {/* ── Editando ── */}
                    <Etiqueta
                      nota="tocá el lápiz para volver a leer"
                      accion={
                        <TouchableOpacity
                          onPress={() => {
                            roce();
                            setCatalogoAbierto((v) => !v);
                          }}
                          activeOpacity={0.75}
                          style={{
                            flexDirection: 'row', alignItems: 'center', gap: 5,
                            paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.pill,
                            backgroundColor: catalogoAbierto ? accent : 'rgba(28,43,34,0.06)',
                          }}
                        >
                          <Plus size={12} color={catalogoAbierto ? '#FFFFFF' : INK.title} />
                          <Text style={{ fontSize: 11.5, fontWeight: '700', color: catalogoAbierto ? '#FFFFFF' : INK.title }}>
                            campo
                          </Text>
                        </TouchableOpacity>
                      }
                    >
                      Campos
                    </Etiqueta>

                    {/* El catálogo va acá arriba y no al final de la lista: con
                        doce campos, un bloque al pie queda fuera del pliegue y
                        la única forma de encontrarlo es scrollear a ciegas. */}
                    {catalogoAbierto ? (
                      <Animated.View
                        entering={FadeInDown.duration(220).springify().damping(20)}
                        style={{
                          padding: 13, marginBottom: 16, borderRadius: RADIUS.md,
                          backgroundColor: 'rgba(28,43,34,0.035)',
                          gap: 10,
                        }}
                      >
                        <Text style={{ fontSize: 11, color: INK.faint, lineHeight: 16 }}>
                          Del catálogo de {canon || tipo}. Son una guía, no un requisito.
                        </Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 12 }}>
                          {ed.disponibles.map((f) => (
                            <TouchableOpacity
                              key={f.label}
                              onPress={() => {
                                roce();
                                ed.agregarCampo(f);
                              }}
                              activeOpacity={0.75}
                              style={{
                                flexDirection: 'row', alignItems: 'center', gap: 6,
                                paddingHorizontal: 11, paddingVertical: 8, borderRadius: 10,
                                borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(28,43,34,0.18)',
                              }}
                            >
                              <Plus size={11} color={INK.body} />
                              <Text style={{ fontSize: 12.5, color: INK.body, fontWeight: '600' }}>{f.label}</Text>
                              <Insignia>{f.type}</Insignia>
                            </TouchableOpacity>
                          ))}
                        </View>

                        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                          <TextInput
                            value={nuevoCampo}
                            onChangeText={setNuevoCampo}
                            placeholder="o creá uno nuevo…"
                            placeholderTextColor={INK.faint}
                            style={[inputStyle, { flex: 1 }]}
                            onSubmitEditing={() => {
                              const l = nuevoCampo.trim();
                              if (!l) return;
                              ed.agregarCampo({ label: l, type: 'texto', extra: true });
                              setNuevoCampo('');
                            }}
                          />
                          <TouchableOpacity
                            onPress={() => {
                              const l = nuevoCampo.trim();
                              if (!l) return;
                              roce();
                              ed.agregarCampo({ label: l, type: 'texto', extra: true });
                              setNuevoCampo('');
                            }}
                            disabled={!nuevoCampo.trim()}
                            style={{
                              paddingHorizontal: 15, paddingVertical: 13, borderRadius: RADIUS.sm,
                              backgroundColor: nuevoCampo.trim() ? accent : 'rgba(28,43,34,0.08)',
                            }}
                          >
                            <Plus size={15} color={nuevoCampo.trim() ? '#FFFFFF' : INK.faint} />
                          </TouchableOpacity>
                        </View>
                      </Animated.View>
                    ) : null}

                    {!ed.schema ? (
                      <MorphingInfinity size={36} color={INK.meta} style={{ alignSelf: 'center', marginVertical: 26 }} />
                    ) : (
                      <>
                        {ed.campos.length === 0 ? (
                          <Text style={{ fontSize: 13, color: INK.faint, marginBottom: 14 }}>
                            Este item no tiene campos todavía. Agregá uno del catálogo de abajo.
                          </Text>
                        ) : null}

                        {ed.campos.map((f) => (
                          <View key={f._k} style={{ marginBottom: 16 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 7 }}>
                              {/* La etiqueta es un dato del campo, no una constante. */}
                              <TextInput
                                value={f.label}
                                onChangeText={(t) => ed.renombrarCampo(f._k, t)}
                                placeholder="nombre del campo"
                                placeholderTextColor={INK.faint}
                                style={{ flex: 1, fontSize: 12.5, fontWeight: '700', color: INK.body, padding: 0 }}
                              />
                              <TouchableOpacity
                                onPress={() => setTipoAbierto((k) => (k === f._k ? null : f._k))}
                                activeOpacity={0.7}
                                style={{
                                  flexDirection: 'row', alignItems: 'center', gap: 4,
                                  paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7,
                                  backgroundColor: tipoAbierto === f._k ? `${accent}22` : 'rgba(28,43,34,0.06)',
                                }}
                              >
                                <Text style={{ fontSize: 10, fontWeight: '700', color: tipoAbierto === f._k ? accent : INK.faint }}>
                                  {f.type}
                                </Text>
                                <ChevronDown size={10} color={tipoAbierto === f._k ? accent : INK.faint} />
                              </TouchableOpacity>
                              <TouchableOpacity onPress={() => ed.quitarCampo(f._k)} hitSlop={8}>
                                <Trash2 size={13} color={INK.faint} />
                              </TouchableOpacity>
                            </View>

                            {/* Los 25 tipos de dato del catálogo. */}
                            {tipoAbierto === f._k ? (
                              <Animated.View
                                entering={FadeIn.duration(180)}
                                style={{
                                  flexDirection: 'row', flexWrap: 'wrap', gap: 5,
                                  padding: 10, marginBottom: 9, borderRadius: 12,
                                  backgroundColor: 'rgba(28,43,34,0.04)',
                                }}
                              >
                                {(ed.schema?.fieldTypes || FIELD_TYPES).map((t) => {
                                  const on = t === f.type;
                                  return (
                                    <TouchableOpacity
                                      key={t}
                                      onPress={() => {
                                        roce();
                                        ed.cambiarTipo(f._k, t);
                                        setTipoAbierto(null);
                                      }}
                                      activeOpacity={0.75}
                                      style={{
                                        paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8,
                                        backgroundColor: on ? accent : '#FFFFFF',
                                        borderWidth: 1, borderColor: on ? accent : 'rgba(28,43,34,0.09)',
                                      }}
                                    >
                                      <Text style={{ fontSize: 11, fontWeight: '600', color: on ? '#FFFFFF' : INK.body }}>
                                        {t}
                                      </Text>
                                    </TouchableOpacity>
                                  );
                                })}
                              </Animated.View>
                            ) : null}

                            <FieldInput
                              field={f}
                              value={ed.values[f.label]}
                              onChange={(v) => ed.setField(f.label, v)}
                              accent={accent}
                            />
                          </View>
                        ))}

                        {ed.error ? (
                          <Text style={{ fontSize: 12.5, color: '#B91C1C', marginTop: 14 }}>{ed.error}</Text>
                        ) : null}
                      </>
                    )}
</>
                    ) : (
<>
                    {/* Sin encabezado: si lo único que se lista es lo que tiene
                        dato, rotularlo «con datos» no distingue nada de nada. */}
                    {conDatos.length > 0 ? (
                      conDatos.map((f, i) => (
                        <FilaCampo key={`c${i}`} {...f} accent={accent} onPress={() => setEditando(true)} />
                      ))
                    ) : (
                      <Vacio>Ningún campo tiene dato todavía.</Vacio>
                    )}

                    {true ? (
                      <Pressable
                        onPress={() => {
                          roce();
                          setEditando(true);
                          setCatalogoAbierto(true);
                        }}
                        style={({ pressed }) => ({
                          flexDirection: 'row', alignItems: 'center', gap: 9,
                          marginTop: 22, paddingVertical: 15, paddingHorizontal: 16, borderRadius: RADIUS.md,
                          backgroundColor: 'rgba(28,43,34,0.04)',
                          opacity: pressed ? 0.7 : 1,
                        })}
                      >
                        <Plus size={16} color={INK.title} />
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 13.5, fontWeight: '700', color: INK.title }}>Más campos</Text>
                          <Text style={{ fontSize: 11.5, color: INK.faint, marginTop: 2 }}>
                            {catalogo.length
                              ? `agrega del catálogo de ${canon} o crea uno nuevo`
                              : 'crea un campo nuevo'}
                          </Text>
                        </View>
                      </Pressable>
                    ) : null}
</>
                    )}
                  </Animated.View>
                )
              ) : null}

              {/* ── Progresión ── */}
              {tab === 'progresion' ? (
                <>
                  <Etiqueta nota={editando ? 'agregá hitos a la línea de tiempo' : NOTA.progresion}>
                    Progresión
                  </Etiqueta>

                  {progresiones === null ? (
                    <MorphingInfinity size={36} color={INK.meta} style={{ alignSelf: 'center', marginVertical: 30 }} />
                  ) : editando ? (
                    <>
                      {progresiones.map((pr) => (
                        <View
                          key={pr.id}
                          style={{
                            backgroundColor: '#FFFFFF', borderRadius: RADIUS.md, padding: 14,
                            marginBottom: 9, gap: 8,
                          }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <TextInput
                              value={pr.fecha || ''}
                              onChangeText={(t) => vinc.setProgresion(pr.id, { fecha: t })}
                              placeholder="fecha"
                              placeholderTextColor={INK.faint}
                              style={{ width: 96, fontSize: 12, color: INK.meta, fontWeight: '600', padding: 0 }}
                            />
                            <View style={{ flex: 1 }} />
                            <TouchableOpacity onPress={() => vinc.delProgresion(pr.id)} hitSlop={8}>
                              <Trash2 size={13} color={INK.faint} />
                            </TouchableOpacity>
                          </View>
                          <TextInput
                            value={pr.titulo || ''}
                            onChangeText={(t) => vinc.setProgresion(pr.id, { titulo: t })}
                            placeholder="Qué pasó (obligatorio)"
                            placeholderTextColor={INK.faint}
                            style={{ fontSize: 14.5, fontWeight: '700', color: INK.title, padding: 0 }}
                          />
                          <TextInput
                            value={pr.descripcion || ''}
                            onChangeText={(t) => vinc.setProgresion(pr.id, { descripcion: t })}
                            placeholder="Detalle"
                            placeholderTextColor={INK.faint}
                            multiline
                            style={{ fontSize: 13, color: INK.body, lineHeight: 19, padding: 0 }}
                          />
                          <TextInput
                            value={pr.fuente || ''}
                            onChangeText={(t) => vinc.setProgresion(pr.id, { fuente: t })}
                            placeholder="Fuente"
                            placeholderTextColor={INK.faint}
                            autoCapitalize="none"
                            style={{ fontSize: 11.5, color: INK.faint, padding: 0 }}
                          />
                        </View>
                      ))}

                      <TouchableOpacity
                        onPress={() => {
                          roce();
                          vinc.addProgresion();
                        }}
                        activeOpacity={0.8}
                        style={{
                          flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
                          paddingVertical: 13, borderRadius: RADIUS.md,
                          borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(28,43,34,0.18)',
                        }}
                      >
                        <Plus size={14} color={INK.title} />
                        <Text style={{ fontSize: 13, fontWeight: '700', color: INK.title }}>Hito</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
{progresiones.length === 0 ? (
                    <Vacio>Sin progresiones registradas.</Vacio>
                  ) : (
                    progresiones.map((p) => (
                      <View key={p.id} style={{ flexDirection: 'row', gap: 12, paddingVertical: 10 }}>
                        <View style={{ alignItems: 'center', width: 10, paddingTop: 5 }}>
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: accent }} />
                          <View style={{ flex: 1, width: 1.5, backgroundColor: 'rgba(28,43,34,0.10)', marginTop: 4 }} />
                        </View>
                        <View style={{ flex: 1, paddingBottom: 6 }}>
                          {p.fecha ? (
                            <Text style={{ fontSize: 11, color: INK.faint, fontWeight: '600', marginBottom: 2 }}>{p.fecha}</Text>
                          ) : null}
                          <Text style={{ fontSize: 14, fontWeight: '700', color: INK.title }}>{p.titulo}</Text>
                          {p.descripcion ? (
                            <Text style={{ fontSize: 13, color: INK.body, lineHeight: 19, marginTop: 3 }}>{p.descripcion}</Text>
                          ) : null}
                          {p.fuente ? (
                            <Text style={{ fontSize: 11, color: INK.faint, marginTop: 4 }}>{p.fuente}</Text>
                          ) : null}
                        </View>
                      </View>
                    ))
                  )}
                    </>
                  )}
                </>
              ) : null}

              {/* ── Menciones ── */}
              {tab === 'menciones' ? (
                <>
                  {menciones === null ? (
                    <>
                      <Etiqueta nota={NOTA.menciones}>Menciones</Etiqueta>
                      <MorphingInfinity size={36} color={INK.meta} style={{ alignSelf: 'center', marginVertical: 30 }} />
                    </>
                  ) : (
                    <MencionesTab menciones={menciones} accent={accent} />
                  )}
                </>
              ) : null}

              {/* ── Relaciones ── */}
              {tab === 'relaciones' ? (
                <>
                  <Etiqueta nota={editando ? 'este item — verbo — otro item' : NOTA.relaciones}>
                    Relaciones
                  </Etiqueta>

                  {relaciones === null ? (
                    <MorphingInfinity size={36} color={INK.meta} style={{ alignSelf: 'center', marginVertical: 30 }} />
                  ) : editando ? (
                    <>
                      {relaciones.map((r) => (
                        <View
                          key={r.id}
                          style={{
                            backgroundColor: '#FFFFFF', borderRadius: RADIUS.md, padding: 14,
                            marginBottom: 9, gap: 9,
                          }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Text style={{ fontSize: 12, color: INK.faint, fontWeight: '600' }}>
                              {r.esSujeto ? 'este item' : r.otro?.name || 'otro item'}
                            </Text>
                            <View style={{ flex: 1 }} />
                            <TouchableOpacity onPress={() => vinc.delRelacion(r.id)} hitSlop={8}>
                              <Trash2 size={13} color={INK.faint} />
                            </TouchableOpacity>
                          </View>

                          {/* El verbo es lo único obligatorio además del otro extremo. */}
                          <TextInput
                            value={r.verb || ''}
                            onChangeText={(t) => vinc.setRelacion(r.id, { verb: t })}
                            placeholder="verbo — financia, dirige, pertenece a…"
                            placeholderTextColor={INK.faint}
                            style={[inputStyle, { fontSize: 13.5 }]}
                          />

                          <Text style={{ fontSize: 13, fontWeight: '700', color: accent }}>
                            {r.esSujeto ? r.otro?.name || 'otro item' : 'este item'}
                          </Text>

                          <TextInput
                            value={r.note || ''}
                            onChangeText={(t) => vinc.setRelacion(r.id, { note: t })}
                            placeholder="Nota"
                            placeholderTextColor={INK.faint}
                            multiline
                            style={{ fontSize: 12.5, color: INK.body, lineHeight: 18, padding: 0 }}
                          />
                          <TextInput
                            value={r.date || ''}
                            onChangeText={(t) => vinc.setRelacion(r.id, { date: t })}
                            placeholder="Fecha"
                            placeholderTextColor={INK.faint}
                            style={{ fontSize: 11.5, color: INK.faint, padding: 0 }}
                          />
                        </View>
                      ))}

                      <BuscadorItem accent={accent} onBuscar={vinc.buscarItems} onElegir={vinc.addRelacion} />
                    </>
                  ) : (
                    <>
{relaciones.length === 0 ? (
                    <Vacio>Sin relaciones registradas.</Vacio>
                  ) : (
                    relaciones.map((r, i) => {
                      const otroTipo = normalizeTipo(r.otro?.tipo);
                      const otroAccent = TYPE_ACCENT[otroTipo] || INK.meta;
                      return (
                        <Animated.View
                          key={r.id}
                          entering={FadeInDown.delay(Math.min(i, 6) * 40).duration(280)}
                          style={{
                            backgroundColor: GLASS.fill, borderRadius: 14, borderWidth: 1,
                            borderColor: GLASS.rim, padding: 14, marginBottom: 8,
                          }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                            <Text style={{ fontSize: 12, color: INK.faint, fontWeight: '600' }}>
                              {r.esSujeto ? 'este item' : r.otro?.name || 'otro item'}
                            </Text>
                            <View
                              style={{
                                paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7,
                                backgroundColor: 'rgba(28,43,34,0.06)',
                              }}
                            >
                              <Text style={{ fontSize: 11.5, fontWeight: '700', color: INK.title }}>{r.verb}</Text>
                            </View>
                            <Text style={{ fontSize: 13, fontWeight: '700', color: r.esSujeto ? otroAccent : INK.faint }}>
                              {r.esSujeto ? r.otro?.name || 'otro item' : 'este item'}
                            </Text>
                          </View>
                          {r.note ? (
                            <Text style={{ fontSize: 12.5, color: INK.body, lineHeight: 18, marginTop: 6 }}>{r.note}</Text>
                          ) : null}
                          {r.date ? (
                            <Text style={{ fontSize: 11, color: INK.faint, marginTop: 4 }}>{r.date}</Text>
                          ) : null}
                        </Animated.View>
                      );
                    })
                  )}
                    </>
                  )}
                </>
              ) : null}
            </View>
          </ScrollView>

          {/* Barra de guardado. Fija abajo y solo en edición: mientras se lee no
              hay nada que confirmar, y un botón que no hace nada es ruido. */}
          {editando ? (
            <Animated.View
              entering={FadeInDown.duration(240).springify().damping(20)}
              style={{
                position: 'absolute', left: 0, right: 0, bottom: 0,
                flexDirection: 'row', gap: 9,
                paddingHorizontal: 20, paddingTop: 12, paddingBottom: bottomInset + 14,
                backgroundColor: 'rgba(247,248,245,0.97)',
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: 'rgba(28,43,34,0.10)',
              }}
            >
              <Pressable
                onPress={() => {
                  // Creando no hay estado de lectura al que volver: cancelar es
                  // descartar el borrador y cerrar.
                  if (creando) return onClose();
                  setEditando(false);
                  setTipoAbierto(null);
                }}
                style={({ pressed }) => ({
                  paddingHorizontal: 20, paddingVertical: 14, borderRadius: RADIUS.md,
                  backgroundColor: 'rgba(28,43,34,0.06)',
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text style={{ fontSize: 14, fontWeight: '700', color: INK.body }}>Cancelar</Text>
              </Pressable>

              <Pressable
                onPress={async () => {
                  if (!nombreEd.trim() || ed.guardando) return;
                  const guardado = await ed.guardar({
                    name: nombreEd,
                    description: descEd,
                    ...(admiteAlias ? { aliases: partirAlias(aliasEd) } : {}),
                    ...(geoEd !== undefined ? { geo: geoEd } : {}),
                    ...(creando ? { tipo } : {}),
                  });
                  if (!guardado) return;

                  if (creando) {
                    onSaved?.(guardado);
                    onClose();
                    return;
                  }

                  // Los vínculos van a otras dos tablas; se guardan en la misma
                  // acción para que «Guardar» signifique una sola cosa.
                  const vinculosOk = await vinc.guardar();
                  if (!vinculosOk) return;
                  setEditando(false);
                  setTipoAbierto(null);
                  setGeoEd(undefined);
                  onSaved?.(guardado);
                }}
                disabled={ed.guardando || !nombreEd.trim()}
                style={({ pressed }) => ({
                  flex: 1, alignItems: 'center', justifyContent: 'center',
                  paddingVertical: 14, borderRadius: RADIUS.md,
                  backgroundColor: nombreEd.trim() ? accent : 'rgba(28,43,34,0.12)',
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                {ed.guardando ? (
                  <MorphingInfinity size={20} color="#FFFFFF" />
                ) : (
                  <Text style={{ fontSize: 14.5, fontWeight: '800', color: nombreEd.trim() ? '#FFFFFF' : INK.faint }}>
                    {creando ? 'Crear' : 'Guardar'}
                  </Text>
                )}
              </Pressable>
            </Animated.View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

// ─── Alias ────────────────────────────────────────────────────────────────────

/** La línea de comas a lista limpia, sin repetidos ni espacios sueltos. */
function partirAlias(texto) {
  const vistos = new Set();
  const salida = [];
  for (const parte of String(texto || '').split(',')) {
    const a = parte.trim();
    if (!a) continue;
    const clave = a.toLowerCase();
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    salida.push(a);
  }
  return salida;
}

/**
 * Qué va a pasar de verdad con lo que se escribió.
 *
 * El resaltado de las notas ignora los términos de menos de cuatro caracteres —
 * si no, un alias como «CC» pintaría cada «cc» de cualquier oración. Esa regla
 * es invisible: sin este aviso se escribe un alias corto, no se pinta nunca, y
 * no hay forma de darse cuenta de por qué. Se pregunta a la misma función que
 * usa el índice, así que no pueden decir cosas distintas.
 */
function avisoAlias(texto) {
  const lista = partirAlias(texto);
  if (!lista.length) return 'Otros nombres por los que se lo reconoce al escribir una nota.';

  const cortos = lista.filter((a) => !esReconocible(a));
  if (!cortos.length) {
    return lista.length === 1
      ? 'Se resalta en tus notas, igual que el nombre.'
      : `Los ${lista.length} se resaltan en tus notas, igual que el nombre.`;
  }
  if (cortos.length === lista.length) {
    return cortos.length === 1
      ? `«${cortos[0]}» es muy corto para reconocerse: hacen falta ${PISO} letras.`
      : `Ninguno se va a reconocer: hacen falta ${PISO} letras.`;
  }
  return `${cortos.map((a) => `«${a}»`).join(', ')} no se va a reconocer: hacen falta ${PISO} letras.`;
}
