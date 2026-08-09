import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  runOnJS,
  Extrapolation,
  FadeInDown,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { X, Move, Type, Pencil, Plus, Trash2, FileText, Search } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { INK, CARD_SHADOW, GLASS, MOTION, RADIUS, RIM } from '../theme';
import MorphingInfinity from '../MorphingInfinity';
import GlassButton from '../GlassButton';
import { PASTEL, Punteado } from './Papel';
import { roce, toque } from '../../utils/haptics';
import { normalizeTipo, TYPE_ACCENT, TYPE_ORDER } from './SpacesStack';
import FreeCanvas from './FreeCanvas';
import StructuredView from './StructuredView';
import { loadSpaceItems, loadSpace, saveCanvasPatch, removeItemsFromSpace } from '../../utils/codexSpaces';

/**
 * El espacio abierto. Dos vistas:
 *
 *  · nota   — la de entrada. Un documento: el texto va suelto y los elementos
 *             apilados por tipo. El orden lo pone la pantalla.
 *  · lienzo — free canvas. Se arrastra, se escribe donde se toque y se dibuja,
 *             con las mismas coordenadas que el canvas de escritorio.
 *
 * Los cambios del lienzo se guardan con retardo: arrastrar dispara muchos
 * commits seguidos y cada uno es una lectura-modificación-escritura del jsonb.
 *
 * Entrada y salida son una sola animación, en reversa. El espacio crece desde
 * la pill que se tocó (`origen`, medida en la pila) y al cerrarse vuelve a ella.
 * Tres formas de salir:
 *
 *  · pellizcar — en el documento, directo; en el lienzo, solo cuando el zoom ya
 *    tocó el piso y el dedo sigue cerrando. Si no, cada intento de alejarse
 *    arriesgaría cerrar el espacio.
 *  · arrastrar la pill del nombre hacia abajo — el camino visible, porque un
 *    pellizco no tiene afordancia: nadie lo descubre solo.
 *  · la X.
 */
export default function SpaceView({
  space,
  origen,
  onClose,
  onOpenItem,
  onAddItems,
  topInset = 0,
  bottomInset = 0,
  children,
}) {
  const [items, setItems] = useState([]);
  const [positions, setPositions] = useState({});
  const [notas, setNotas] = useState([]);
  const [trazos, setTrazos] = useState([]);
  const [faltantes, setFaltantes] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const [vista, setVista] = useState('nota'); // 'nota' | 'lienzo'
  const [modo, setModo] = useState('mover'); // 'mover' | 'texto' | 'dibujar'
  const [notaEditando, setNotaEditando] = useState(null); // { id?, x, y, content }
  const [busqueda, setBusqueda] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  // El lienzo escribe seguido; se acumula y se manda una vez.
  const pendiente = useRef({});
  const timer = useRef(null);

  // ─── Morph de entrada y salida ──────────────────────────────────────────────
  const { width: W, height: H } = useWindowDimensions();

  // Sin origen medido (por ejemplo si se abre desde otro camino) el espacio
  // arranca desde el centro: no hay pill a la que volver, pero el crecimiento
  // se sigue leyendo.
  const desde = origen || { x: W / 2 - 90, y: H / 2 - 34, width: 180, height: 68 };

  const entrada = useSharedValue(0); // 0 = pill, 1 = pantalla completa
  const salida = useSharedValue(0); // 0 = abierto, 1 = ido
  const cerrado = useRef(false);

  // El zoom del lienzo vive acá arriba porque el gesto de salir necesita saber
  // si ya está en el piso, y eso se lee en el hilo de UI.
  const canvasScale = useSharedValue(1);

  useEffect(() => {
    entrada.value = withSpring(1, MOTION.enter);
  }, []);

  // Un solo camino recorrido en dos sentidos: `avance` va de la pill (0) a la
  // pantalla (1) al entrar, y vuelve a 0 al salir.
  const avance = () => {
    'worklet';
    return entrada.value * (1 - salida.value);
  };

  const marco = useAnimatedStyle(() => {
    const t = avance();
    return {
      left: interpolate(t, [0, 1], [desde.x, 0]),
      top: interpolate(t, [0, 1], [desde.y, 0]),
      width: interpolate(t, [0, 1], [desde.width, W]),
      height: interpolate(t, [0, 1], [desde.height, H]),
      borderRadius: interpolate(t, [0, 1], [RADIUS.xl, 0]),
      opacity: interpolate(t, [0, 0.12, 1], [0, 1, 1], Extrapolation.CLAMP),
    };
  });

  // El cuerpo entra tarde: mientras la caja crece se ve el fantasma del nombre,
  // que es lo que había en la pill. Cruzarlos evita el salto de contenido.
  const cuerpo = useAnimatedStyle(() => ({
    opacity: interpolate(avance(), [0.3, 0.72], [0, 1], Extrapolation.CLAMP),
  }));

  const fantasma = useAnimatedStyle(() => ({
    opacity: interpolate(avance(), [0.05, 0.45], [1, 0], Extrapolation.CLAMP),
  }));

  const velo = useAnimatedStyle(() => ({
    opacity: interpolate(avance(), [0, 1], [0, 0.16], Extrapolation.CLAMP),
  }));

  // Cerrar de verdad: se termina la animación y solo entonces se desmonta. Sin
  // esto el espacio desaparecía de golpe y el morph de salida no se veía nunca.
  const cerrar = useCallback(() => {
    if (cerrado.current) return;
    cerrado.current = true;
    toque();
    salida.value = withTiming(1, { duration: 240 }, (fin) => {
      if (fin) runOnJS(onClose)();
    });
  }, [onClose]);

  const soltarSalida = useCallback(() => {
    salida.value = withSpring(0, MOTION.enter);
  }, []);

  // Pellizco en el documento: no hay zoom que defender, cierra directo.
  const pinchDocumento = useMemo(
    () =>
      Gesture.Pinch()
        .onUpdate((e) => {
          if (e.scale < 1) salida.value = Math.min(1, (1 - e.scale) / 0.4);
        })
        .onEnd(() => {
          if (salida.value > 0.32) runOnJS(cerrar)();
          else runOnJS(soltarSalida)();
        }),
    [cerrar, soltarSalida]
  );

  // Arrastrar la pill del nombre hacia abajo. `activeOffsetY` deja pasar los
  // toques a los botones de al lado: el gesto no existe hasta que hay recorrido.
  const arrastrarPill = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY(10)
        .failOffsetY(-24)
        .onUpdate((e) => {
          salida.value = Math.max(0, Math.min(1, e.translationY / 240));
        })
        .onEnd((e) => {
          if (salida.value > 0.28 || e.velocityY > 900) runOnJS(cerrar)();
          else runOnJS(soltarSalida)();
        }),
    [cerrar, soltarSalida]
  );

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    setError(null);

    Promise.all([loadSpaceItems(space?.itemIds || []), loadSpace(space?.id)])
      .then(([{ items: resueltos, faltantes: f }, canvas]) => {
        if (!vivo) return;
        setItems(resueltos);
        setFaltantes(f);
        setPositions(canvas?.positions || {});
        setNotas(Array.isArray(canvas?.notes) ? canvas.notes : []);
        setTrazos(Array.isArray(canvas?.raw?.drawPaths) ? canvas.raw.drawPaths : []);
      })
      .catch((e) => vivo && setError(e.message || 'No se pudo cargar el espacio'))
      .finally(() => vivo && setCargando(false));

    return () => {
      vivo = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [space?.id]);

  const guardar = useCallback(
    (patch) => {
      pendiente.current = { ...pendiente.current, ...patch };
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(async () => {
        const cambios = pendiente.current;
        pendiente.current = {};
        setGuardando(true);
        try {
          await saveCanvasPatch(space.id, cambios);
        } catch (e) {
          setError(e.message || 'No se pudo guardar');
        } finally {
          setGuardando(false);
        }
      }, 700);
    },
    [space?.id]
  );

  const moverItem = useCallback(
    (id, x, y) => {
      setPositions((prev) => {
        const next = { ...prev, [id]: { x, y } };
        guardar({ positions: next });
        return next;
      });
    },
    [guardar]
  );

  const moverNota = useCallback(
    (id, x, y) => {
      setNotas((prev) => {
        const next = prev.map((n) => (n.id === id ? { ...n, x, y } : n));
        guardar({ notes: next });
        return next;
      });
    },
    [guardar]
  );

  const agregarPath = useCallback(
    (points) => {
      setTrazos((prev) => {
        const next = [...prev, { id: `path-${Date.now()}`, points }];
        guardar({ drawPaths: next });
        return next;
      });
    },
    [guardar]
  );

  const guardarNota = useCallback(
    (texto) => {
      const t = texto.trim();
      setNotas((prev) => {
        let next;
        if (!t) {
          next = notaEditando?.id ? prev.filter((n) => n.id !== notaEditando.id) : prev;
        } else if (notaEditando?.id) {
          next = prev.map((n) => (n.id === notaEditando.id ? { ...n, content: t } : n));
        } else {
          next = [...prev, { id: `note-${Date.now()}`, x: notaEditando.x, y: notaEditando.y, content: t }];
        }
        guardar({ notes: next });
        return next;
      });
      setNotaEditando(null);
      setModo('mover');
    },
    [notaEditando, guardar]
  );

  const quitarItems = useCallback(
    async (ids) => {
      const fuera = new Set(ids);
      setItems((prev) => prev.filter((i) => !fuera.has(i.id)));
      try {
        await removeItemsFromSpace(space.id, ids);
      } catch (e) {
        setError(e.message || 'No se pudo quitar');
      }
    },
    [space?.id]
  );

  // Búsqueda por nombre — solo aplica a la vista estructurada. En el lienzo
  // filtrar sería confuso: los nodos desaparecerían de sus posiciones.
  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => (it.name || it.titulo || '').toLowerCase().includes(q));
  }, [items, busqueda]);

  const porTipo = useMemo(() => {
    const map = new Map();
    for (const it of filtrados) {
      const t = normalizeTipo(it.tipo || it.subcategory);
      if (!map.has(t)) map.set(t, []);
      map.get(t).push(it);
    }
    return map;
  }, [filtrados]);

  const grupos = useMemo(() => {
    const orden = [...porTipo.entries()].sort((a, b) => {
      const ia = TYPE_ORDER.indexOf(a[0]);
      const ib = TYPE_ORDER.indexOf(b[0]);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
    return orden.map(([tipo, arr]) => ({
      tipo,
      data: [...arr].sort((x, y) => (x.name || '').localeCompare(y.name || '', 'es')),
    }));
  }, [porTipo]);

  const MODOS = [
    { k: 'mover', Icon: Move, label: 'Mover', pastel: PASTEL.indigo },
    { k: 'texto', Icon: Type, label: 'Texto', pastel: PASTEL.verde },
    { k: 'dibujar', Icon: Pencil, label: 'Dibujar', pastel: PASTEL.ambar },
  ];

  return (
    <Modal visible transparent animationType="none" onRequestClose={cerrar} statusBarTranslucent>
      {/* Velo sobre la pila que quedó atrás. Entra con el crecimiento, así el
          espacio se despega del Codex en vez de taparlo de golpe. */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: '#101A13' }, velo]}
      />

      <Animated.View style={[{ position: 'absolute', overflow: 'hidden' }, marco]}>
        {/* Tamaño fijo a propósito: el contenido se mide una sola vez y la caja
            de arriba solo recorta. Si el subárbol se relayoutara en cada frame
            del morph, serían decenas de tarjetas remedidas 60 veces por segundo. */}
        <View style={{ width: W, height: H, backgroundColor: '#F6F4EE' }}>
          <LinearGradient
            colors={['#F8F6F0', '#F4F3EC', '#EFF2EA']}
            locations={[0, 0.55, 1]}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.8, y: 1 }}
            style={StyleSheet.absoluteFill}
          />

          {/* Fantasma: lo que decía la pill, en el mismo lugar, mientras la caja
              crece. Es el puente que hace que se lea como una sola pieza. */}
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: 'absolute',
                left: 0,
                right: 0,
                top: 0,
                height: desde.height,
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 22,
              },
              fantasma,
            ]}
          >
            <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '700', color: INK.title }}>
              {space?.name}
            </Text>
          </Animated.View>

          <Animated.View style={[{ flex: 1 }, cuerpo]}>
            {cargando ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <MorphingInfinity size={52} color={INK.body} />
              </View>
            ) : vista === 'lienzo' ? (
              <FreeCanvas
                items={items}
                positions={positions}
                notas={notas}
                trazos={trazos}
                modo={modo}
                scale={canvasScale}
                salida={salida}
                onDismiss={cerrar}
                onSoltarSalida={soltarSalida}
                onMoveItem={moverItem}
                onMoveNote={moverNota}
                onAddNote={(x, y) => setNotaEditando({ x, y, content: '' })}
                onEditNote={(n) => setNotaEditando(n)}
                onAddPath={agregarPath}
                onOpenItem={onOpenItem}
              />
            ) : (
              // El pellizco pide dos dedos, así que no le compite al scroll de
              // un dedo del documento.
              <GestureDetector gesture={pinchDocumento}>
                <View style={{ flex: 1 }}>
                  <StructuredView
                    grupos={grupos}
                    notas={notas}
                    busqueda={busqueda}
                    topInset={topInset}
                    bottomInset={bottomInset}
                    onOpenItem={onOpenItem}
                    onEditNote={(n) => setNotaEditando(n)}
                    onNuevaNota={() => setNotaEditando({ x: 80, y: 80 + notas.length * 140, content: '' })}
                    onAddItems={onAddItems}
                    onQuitarItems={quitarItems}
                  />
                </View>
              </GestureDetector>
            )}

            {/* Píldora flotante con el nombre */}
            <View
              pointerEvents="box-none"
              style={{ position: 'absolute', top: topInset + 8, left: 0, right: 0, paddingHorizontal: 14 }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {/* La pill es también el asa: se arrastra hacia abajo para salir.
                    Es la misma pill que se tocó para entrar. */}
                <GestureDetector gesture={arrastrarPill}>
                  <View style={{ flex: 1, ...CARD_SHADOW, shadowOpacity: 0.1, borderRadius: RADIUS.lg }}>
                    <View
                      style={{
                        borderRadius: RADIUS.lg,
                        paddingVertical: 11,
                        paddingHorizontal: 18,
                        overflow: 'hidden',
                        boxShadow: RIM,
                      }}
                    >
                      <BlurView intensity={GLASS.blur} tint="light" style={StyleSheet.absoluteFill} />
                      <View style={[StyleSheet.absoluteFill, { backgroundColor: GLASS.fill }]} />
                      <Text
                        numberOfLines={1}
                        style={{ fontSize: 15, fontWeight: '800', color: INK.title, textAlign: 'center' }}
                      >
                        {space?.name}
                      </Text>
                      <Text style={{ fontSize: 10.5, color: INK.faint, textAlign: 'center', marginTop: 1 }}>
                        {guardando
                          ? 'guardando…'
                          : `${items.length} ${items.length === 1 ? 'elemento' : 'elementos'}${
                              notas.length ? ` · ${notas.length} nota${notas.length === 1 ? '' : 's'}` : ''
                            }${faltantes ? ` · ${faltantes} sin resolver` : ''}`}
                      </Text>
                    </View>
                  </View>
                </GestureDetector>

                {vista === 'nota' ? (
                  <GlassButton
                    Icon={Search}
                    activo={buscando}
                    onPress={() =>
                      setBuscando((b) => {
                        if (b) setBusqueda('');
                        return !b;
                      })
                    }
                  />
                ) : null}

                <GlassButton
                  Icon={vista === 'nota' ? Move : FileText}
                  onPress={() => setVista((v) => (v === 'nota' ? 'lienzo' : 'nota'))}
                />

                <GlassButton Icon={X} onPress={cerrar} />
              </View>

              {/* Campo de búsqueda — se despliega bajo la píldora */}
              {buscando && vista === 'nota' ? (
                <Animated.View
                  entering={FadeInDown.duration(200).springify().damping(20)}
                  style={{ marginTop: 8, ...CARD_SHADOW, shadowOpacity: 0.1, borderRadius: RADIUS.md }}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 9,
                      borderRadius: RADIUS.md,
                      paddingHorizontal: 15,
                      height: 46,
                      overflow: 'hidden',
                      boxShadow: RIM,
                    }}
                  >
                    <BlurView intensity={GLASS.blur} tint="light" style={StyleSheet.absoluteFill} />
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: GLASS.fill }]} />
                    <Search size={15} color={INK.faint} />
                    <TextInput
                      value={busqueda}
                      onChangeText={setBusqueda}
                      placeholder="Buscar por nombre…"
                      placeholderTextColor={INK.faint}
                      autoFocus
                      autoCorrect={false}
                      returnKeyType="search"
                      style={{ flex: 1, fontSize: 14.5, color: INK.title, padding: 0 }}
                    />
                    {busqueda ? (
                      <>
                        <Text style={{ fontSize: 11.5, color: INK.faint, fontWeight: '600' }}>
                          {filtrados.length}
                        </Text>
                        <TouchableOpacity onPress={() => setBusqueda('')} hitSlop={10}>
                          <X size={14} color={INK.faint} />
                        </TouchableOpacity>
                      </>
                    ) : null}
                  </View>
                </Animated.View>
              ) : null}
            </View>

            {/* Barra de modos — solo en el lienzo */}
            {vista === 'lienzo' && !cargando ? (
              <View
                pointerEvents="box-none"
                style={{ position: 'absolute', left: 0, right: 0, bottom: bottomInset + 14, alignItems: 'center' }}
              >
                {/* Una sola capa de cristal para toda la barra. Las pastillas de
                    adentro van sin blur: anidar blur dentro de blur se paga en
                    GPU y no se distingue a la vista. */}
                <View style={{ ...CARD_SHADOW, shadowOpacity: 0.14, borderRadius: RADIUS.pill }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                      borderRadius: RADIUS.pill,
                      padding: 5,
                      overflow: 'hidden',
                      boxShadow: RIM,
                    }}
                  >
                    <BlurView intensity={GLASS.blur} tint="light" style={StyleSheet.absoluteFill} />
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: GLASS.fill }]} />

                    {MODOS.map((m) => (
                      <PastillaModo
                        key={m.k}
                        Icon={m.Icon}
                        label={m.label}
                        pastel={m.pastel}
                        activo={modo === m.k}
                        onPress={() => {
                          roce();
                          setModo(m.k);
                        }}
                      />
                    ))}

                    <View style={{ width: 1, height: 22, backgroundColor: 'rgba(28,43,34,0.09)', marginHorizontal: 3 }} />

                    <TouchableOpacity
                      onPress={() => {
                        roce();
                        onAddItems?.();
                      }}
                      activeOpacity={0.8}
                      style={{ paddingHorizontal: 13, paddingVertical: 10, borderRadius: RADIUS.pill }}
                    >
                      <Plus size={17} color={INK.title} />
                    </TouchableOpacity>
                  </View>
                </View>

                {modo === 'texto' ? (
                  <Text style={{ fontSize: 11.5, color: INK.meta, marginTop: 8 }}>
                    Tocá el lienzo donde quieras escribir
                  </Text>
                ) : modo === 'dibujar' ? (
                  <Text style={{ fontSize: 11.5, color: INK.meta, marginTop: 8 }}>Arrastrá para trazar</Text>
                ) : null}
              </View>
            ) : null}
          </Animated.View>
        </View>
      </Animated.View>

        {/* Editor de nota */}
        {notaEditando ? (
          <Modal visible transparent animationType="fade" onRequestClose={() => setNotaEditando(null)}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
              <View style={{ flex: 1, backgroundColor: 'rgba(20,28,22,0.3)', justifyContent: 'center', paddingHorizontal: 24 }}>
                <Pressable style={StyleSheet.absoluteFill} onPress={() => setNotaEditando(null)} />
                <NotaEditor
                  inicial={notaEditando.content || ''}
                  onGuardar={guardarNota}
                  onCancelar={() => setNotaEditando(null)}
                  puedeBorrar={!!notaEditando.id}
                />
              </View>
            </KeyboardAvoidingView>
          </Modal>
        ) : null}

      {error ? (
        <Animated.View
          entering={FadeInDown.duration(220).springify().damping(18)}
          style={{
            position: 'absolute', left: 16, right: 16, bottom: bottomInset + 80,
            backgroundColor: 'rgba(220,38,38,0.94)', borderRadius: RADIUS.sm, padding: 12,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 12.5 }}>{error}</Text>
        </Animated.View>
      ) : null}

      {/* iOS solo presenta un Modal a la vez: los de arriba cuelgan de acá.
          Van fuera de la caja del morph para que no los recorte ni los escale. */}
      {children}
    </Modal>
  );
}

/**
 * Pastilla de la barra de modos.
 *
 * Apagada es solo el icono: una fila de tres chips todos con borde no diría cuál
 * está activo. Encendida se vuelve chip punteado pastel y saca la etiqueta.
 */
function PastillaModo({ Icon, label, activo, pastel, onPress }) {
  const press = useSharedValue(0);

  const caja = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - press.value * 0.05 }],
  }));

  const cuerpo = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: activo ? 13 : 14,
        paddingVertical: 9,
      }}
    >
      <Icon size={15} color={activo ? pastel.ink : INK.meta} />
      {activo ? (
        <Animated.Text
          entering={FadeInDown.duration(160)}
          style={{ fontSize: 12.5, fontWeight: '700', color: pastel.ink }}
        >
          {label}
        </Animated.Text>
      ) : null}
    </View>
  );

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        press.value = withTiming(1, MOTION.press);
      }}
      onPressOut={() => {
        press.value = withSpring(0, MOTION.tap);
      }}
    >
      <Animated.View style={caja}>
        {activo ? (
          <Punteado fill={pastel.fill} borde={pastel.borde} radio={RADIUS.pill}>
            {cuerpo}
          </Punteado>
        ) : (
          cuerpo
        )}
      </Animated.View>
    </Pressable>
  );
}

function NotaEditor({ inicial, onGuardar, onCancelar, puedeBorrar }) {
  const [texto, setTexto] = useState(inicial);

  return (
    <View
      style={{
        backgroundColor: '#FDFBF3',
        borderRadius: 20,
        padding: 18,
        ...CARD_SHADOW,
        shadowOpacity: 0.2,
      }}
    >
      <Text style={{ fontSize: 10.5, fontWeight: '800', color: INK.faint, letterSpacing: 0.6, marginBottom: 10 }}>
        TEXTO EN EL LIENZO
      </Text>
      <TextInput
        value={texto}
        onChangeText={setTexto}
        placeholder="Escribí acá…"
        placeholderTextColor={INK.faint}
        multiline
        autoFocus
        style={{
          fontSize: 15,
          color: INK.title,
          lineHeight: 21,
          minHeight: 90,
          textAlignVertical: 'top',
        }}
      />
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
        {puedeBorrar ? (
          <TouchableOpacity
            onPress={() => onGuardar('')}
            style={{
              width: 46, paddingVertical: 12, borderRadius: 12,
              backgroundColor: 'rgba(220,38,38,0.08)', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Trash2 size={15} color="#B91C1C" />
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          onPress={onCancelar}
          style={{
            flex: 1, paddingVertical: 12, borderRadius: 12,
            backgroundColor: 'rgba(28,43,34,0.06)', alignItems: 'center',
          }}
        >
          <Text style={{ fontSize: 13.5, fontWeight: '700', color: INK.body }}>Cancelar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => onGuardar(texto)}
          style={{
            flex: 1, paddingVertical: 12, borderRadius: 12,
            backgroundColor: '#1C2B22', alignItems: 'center',
          }}
        >
          <Text style={{ fontSize: 13.5, fontWeight: '800', color: '#FFFFFF' }}>Guardar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
