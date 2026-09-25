import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import { ChevronLeft, FilePlus2, Layers, Maximize2, NotebookText, Plus } from 'lucide-react-native';
import { INK, MOTION, RADIUS } from '../theme';
import { MONO } from './mono';
import { TENUE, RESALTADOR } from './piezasCarpeta';
import { TYPE_ACCENT, TYPE_ORDER, normalizeTipo } from './tipos';
import SpaceCarousel from './SpaceCarousel';
import GrafoEspacio from './GrafoEspacio';
import AgregarAlEspacio from './AgregarAlEspacio';
import GrafoPantallaCompleta from './GrafoPantallaCompleta';
import useGrafoEspacio from './useGrafoEspacio';
import { portadaDe } from './PortadaEspacio';
import { addItemsToSpace, listSpaces } from '../../utils/codexSpaces';
import { roce, toque } from '../../utils/haptics';
import { useEspacioElegidoStore } from '../../state/espacioElegidoStore';

/**
 * Espacios — la otra mitad de la hoja.
 *
 * La hoja tenía un solo oficio: escribir. El switch de arriba le agrega el
 * segundo, que es **mirar lo que ya hay**. No son dos pantallas distintas
 * pegadas: es la misma superficie de papel contestando dos preguntas, «¿qué
 * quiero anotar?» y «¿qué tengo?».
 *
 * Por qué esta pantalla existe: el coverflow de espacios vivía en la pestaña
 * del Codex, y esa pestaña quedó sin puerta cuando se fue la barra de abajo —
 * el único camino que le quedaba era restaurar «dónde me quedé», y el único que
 * graba ese lugar es ella misma. O sea que desde el teléfono **no se podía
 * abrir un espacio**. Esto lo devuelve.
 *
 * Tiene dos estados y una sola animación entre ellos:
 *
 *  · **la casa** — el saludo y tus espacios como carátulas.
 *  · **un espacio** — su grafo, y lo que se puede hacer adentro.
 *
 * Al elegir uno, su color se desprende de la carátula y se va a la esquina,
 * donde se queda como la marca de dónde estás. Es un solo objeto viajando, y
 * eso es lo que hace que se lea como **entrar** y no como que una pantalla
 * reemplazó a la otra: el color que estabas mirando sigue ahí, más chico.
 */
export default function Espacios({
  bottomInset = 0,
  onAbrirEspacio,
  onNuevoEspacio,
  onNuevaNota,
  onAbrirItem,
  onAbrirNota,
  recarga = 0,
  // La lupa de la hoja: en Espacios busca en el Codex para sumar al espacio
  // abierto. El panel vive acá porque acá está el espacio.
  indice = null,
  buscando = false,
  onCerrarBusqueda,
  // Avisa hacia arriba qué espacio está abierto: la lupa solo tiene sentido
  // adentro de uno.
  onElegido,
}) {
  const { width: W } = useWindowDimensions();

  const [espacios, setEspacios] = useState(null); // null = cargando
  const [error, setError] = useState(null);
  const [elegido, setElegido] = useState(null);
  const [filtro, setFiltro] = useState('todo');

  // Dónde estaba la carátula, para que el color salga de ahí y no de la nada.
  const cajaCarrusel = useRef(null);
  const [origen, setOrigen] = useState(null);

  const vuelo = useSharedValue(0); // 0 = en la carátula, 1 = en la esquina

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const es = await listSpaces();
        if (!vivo) return;
        setEspacios(es || []);
        // Lo abierto se refresca con lo recién leído: si una nota acaba de
        // entrar al espacio, el grafo tiene que contarla.
        setElegido((prev) => (prev ? (es || []).find((e) => e.id === prev.id) || prev : prev));
      } catch (e) {
        if (vivo) {
          setError(e.message || 'No se pudieron traer tus espacios');
          setEspacios([]);
        }
      }
    })();
    return () => {
      vivo = false;
    };
  }, [recarga]);

  // 420 de alto y no 330: con todos los nodos como puntos, los nombres son lo
  // que se queda sin lugar, y medido sobre «Crisis de gasolina 2026» pasan de
  // 18 a 23 de 33 con esos 90 puntos más.
  const marco = { ancho: W, alto: 420 };
  const { grafo, armarPara, items, cargando: armando, error: errorGrafo, incompleto } = useGrafoEspacio(
    elegido,
    marco,
    recarga
  );
  const [completo, setCompleto] = useState(false);
  const asociados = elegido
    ? (items || []).filter((it) => normalizeTipo(it.tipo) !== 'Post')
    : [];

  /**
   * Solo los tipos que este espacio tiene. Ofrecer «artefactos» en uno que no
   * tiene ninguno es mandar a una lista vacía, y el filtro no existiría si no
   * hubiera al menos dos clases que separar.
   */
  const filtros = useMemo(() => {
    const vistos = new Set(asociados.map((it) => normalizeTipo(it.tipo)));
    const tipos = TYPE_ORDER.filter((t) => t !== 'Post' && vistos.has(t));
    for (const t of vistos) {
      if (t !== 'Post' && t !== 'Otros' && !tipos.includes(t)) tipos.push(t);
    }
    if (tipos.length < 2) return [];
    return [{ id: 'todo', label: 'todo' }, ...tipos.map((t) => ({ id: t, label: etiquetaTipo(t) }))];
  }, [asociados]);

  const visibles = filtro === 'todo' ? asociados : asociados.filter((it) => normalizeTipo(it.tipo) === filtro);

  useEffect(() => {
    setFiltro('todo');
  }, [elegido?.id]);

  useEffect(() => {
    if (filtro !== 'todo' && !filtros.some((f) => f.id === filtro)) setFiltro('todo');
  }, [filtros, filtro]);

  /**
   * Volver al espacio en el que estabas. Una sola vez por montaje, cuando ya
   * llegó la lista y el recuerdo terminó de leerse del disco. Sin vuelo: no
   * estás entrando, ya estabas adentro.
   */
  const elegir = useEspacioElegidoStore((st) => st.elegir);
  const restaurado = useRef(false);
  useEffect(() => {
    if (restaurado.current || !espacios?.length) return undefined;
    const intentar = () => {
      restaurado.current = true;
      const id = useEspacioElegidoStore.getState().espacioId;
      const espacio = id ? espacios.find((e) => e.id === id) : null;
      if (!espacio) return;
      setOrigen({ x: 0, y: 0, ancho: 0, alto: 0 });
      vuelo.value = 1;
      setElegido(espacio);
    };
    if (useEspacioElegidoStore.persist.hasHydrated()) {
      intentar();
      return undefined;
    }
    return useEspacioElegidoStore.persist.onFinishHydration(intentar);
  }, [espacios, vuelo]);

  useEffect(() => {
    onElegido?.(elegido || null);
  }, [elegido, onElegido]);

  /**
   * Sumar un elemento al espacio abierto. Lo usan el grafo —lo que la historia
   * nombra desde afuera— y la lupa. Con el id en la lista del espacio el grafo
   * se vuelve a armar, y lo que era de afuera pasa a ser un miembro más.
   */
  const sumarAlEspacio = async (item) => {
    if (!elegido?.id || !item?.id) return;
    try {
      await addItemsToSpace(elegido.id, [item.id]);
      roce();
      const sumar = (e) =>
        e?.id === elegido.id && !(e.itemIds || []).includes(item.id)
          ? { ...e, itemIds: [...(e.itemIds || []), item.id] }
          : e;
      setElegido(sumar);
      setEspacios((lista) => (lista || []).map(sumar));
    } catch (e) {
      console.warn('[espacio] no se pudo agregar', e?.message || e);
    }
  };

  /**
   * Lo que se puede hacer desde el grafo, igual en la hoja y en pantalla
   * completa. Lo que abre otra cosa —una ficha, la historia— primero sale de la
   * pantalla completa: es un modal, y lo nuevo quedaría abajo, sin verse.
   */
  const salirYEntonces = (fn) => (...args) => {
    setCompleto(false);
    fn?.(...args);
  };
  const accionesGrafo = {
    onAbrirItem: salirYEntonces(onAbrirItem),
    onAbrirHistoria: salirYEntonces(() => onAbrirEspacio?.(elegido, null)),
    // Crear el concepto abre la ficha nueva ya con su nombre y tipo; no se
    // guarda hasta que la confirmes.
    onCrearConcepto: salirYEntonces((c) =>
      onAbrirItem?.({ _nuevo: true, tipo: 'Concepto', name: c.nombre, description: '', details: {} })
    ),
    onAgregar: sumarAlEspacio,
  };

  const entrar = (espacio) => {
    toque();
    elegir(espacio.id);
    setOrigen(cajaCarrusel.current);
    setElegido(espacio);
    // El resorte y no un `timing`: el color llega a la esquina y se acomoda,
    // como algo que se posa. Con una curva pareja parece que lo arrastraron.
    vuelo.value = 0;
    vuelo.value = withSpring(1, MOTION.enter);
  };

  const volver = () => {
    roce();
    vuelo.value = withTiming(0, { duration: 240 });
    setCompleto(false);
    elegir(null);
    setElegido(null);
  };

  const paleta = elegido ? portadaDe(elegido.id).colores : null;
  const color = paleta ? paleta[1] : INK.title;

  // El viaje. Sale del centro de donde estaba el carrusel —la carátula activa
  // siempre está centrada, así que ese punto es su centro— y aterriza en la
  // esquina, chiquito, donde queda como marca.
  const DESTINO = { x: 30, y: 22, lado: 13 };
  const estiloVuelo = useAnimatedStyle(() => {
    const o = origen;
    if (!o) return { opacity: 0 };

    const ladoSale = Math.min(232, Math.round(W * 0.56));
    const saleX = o.x + o.ancho / 2 - ladoSale / 2;
    const saleY = o.y + o.alto / 2 - ladoSale / 2;

    const t = vuelo.value;
    const lado = interpolate(t, [0, 1], [ladoSale, DESTINO.lado]);

    return {
      opacity: t > 0.001 ? 1 : 0,
      width: lado,
      height: lado,
      borderRadius: interpolate(t, [0, 1], [20, 3]),
      transform: [
        { translateX: interpolate(t, [0, 1], [saleX, DESTINO.x]) },
        { translateY: interpolate(t, [0, 1], [saleY, DESTINO.y]) },
      ],
    };
  });

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        // A diferencia del pager, esto no se mete debajo de la barra: la barra ya
        // se llevó el inset de arriba y acá solo hace falta el aire que la separa
        // del saludo.
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: 14, paddingBottom: bottomInset + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {elegido ? (
          <Animated.View
            entering={FadeIn.duration(260).delay(120)}
            style={{ paddingHorizontal: 30, marginBottom: 22, minHeight: 34, justifyContent: 'center' }}
          >
            <Pressable
              onPress={volver}
              hitSlop={10}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                opacity: pressed ? 0.5 : 1,
              })}
              accessibilityRole="button"
              accessibilityLabel={`Volver a tus espacios desde ${elegido.name}`}
            >
              {/* El hueco que ocupa el color que viene viajando. Queda vacío a
                  propósito: el cuadrito de verdad es el que está volando, y si
                  acá hubiera otro se verían dos. */}
              <View style={{ width: DESTINO.lado, height: DESTINO.lado }} />
              <Text numberOfLines={1} style={{ fontFamily: MONO, fontSize: 15, color: INK.title, flex: 1 }}>
                {elegido.name}
              </Text>
              <ChevronLeft size={15} color="rgba(28,43,34,0.34)" />
            </Pressable>
          </Animated.View>
        ) : (
          /* El saludo. Es lo único de la app que habla en voz alta, y por eso
             está solo: rodeado de controles dejaría de ser un saludo y pasaría a
             ser el título de una pantalla. */
          <Animated.View entering={FadeIn.duration(260)} style={{ paddingHorizontal: 30, marginBottom: 30 }}>
            <Text style={{ fontFamily: MONO, fontSize: 26, color: INK.title, letterSpacing: -0.6 }}>
              {saludoDe(new Date())}
            </Text>
            {error ? (
              <Text style={{ fontFamily: MONO, fontSize: 12, color: '#B91C1C', marginTop: 9, lineHeight: 19 }}>
                {error}
              </Text>
            ) : null}
          </Animated.View>
        )}

        {elegido ? (
          <Animated.View entering={FadeIn.duration(340).delay(180)}>
            <GrafoEspacio
              grafo={grafo}
              ancho={marco.ancho}
              alto={marco.alto}
              cargando={armando}
              error={errorGrafo}
              {...accionesGrafo}
            />
            {/* Agrandar: el mismo grafo en toda la pantalla. Arriba a la
                derecha, donde el dibujo casi nunca llega, para no tapar nodos. */}
            {grafo?.nodos?.length && !armando ? (
              <Pressable
                onPress={() => {
                  toque();
                  setCompleto(true);
                }}
                hitSlop={10}
                style={({ pressed }) => ({
                  position: 'absolute',
                  top: 4,
                  right: 22,
                  padding: 6,
                  opacity: pressed ? 0.5 : 1,
                })}
                accessibilityRole="button"
                accessibilityLabel="Ver el grafo en pantalla completa"
              >
                <Maximize2 size={16} color="rgba(28,43,34,0.45)" />
              </Pressable>
            ) : null}
            {/* Un grafo al que le faltan conexiones parece completo: se dice. */}
            {incompleto && !armando ? (
              <Text style={{ fontFamily: MONO, fontSize: 11.5, color: 'rgba(28,43,34,0.35)', marginTop: 8 }}>
                no se pudieron leer todas las conexiones.
              </Text>
            ) : null}
          </Animated.View>
        ) : (
          <>
            <Rotulo texto="tus espacios" />
            {espacios === null ? (
              <ActivityIndicator size="small" color={INK.faint} style={{ marginTop: 24, marginBottom: 40 }} />
            ) : (
              <Animated.View
                exiting={FadeOut.duration(160)}
                onLayout={(e) => {
                  const { x, y, width, height } = e.nativeEvent.layout;
                  cajaCarrusel.current = { x, y, ancho: width, alto: height };
                }}
                style={{ marginBottom: 34 }}
              >
                <SpaceCarousel spaces={espacios} onOpenSpace={entrar} onNewSpace={onNuevoEspacio} />
              </Animated.View>
            )}
          </>
        )}

        <Rotulo texto="crear" />

        <View style={{ paddingHorizontal: 30, gap: 10 }}>
          <Accion
            Icono={FilePlus2}
            texto="una nota"
            detalle={elegido ? `se guarda en ${elegido.name}` : 'se abre la hoja para escribir'}
            onPress={() => onNuevaNota?.(elegido || null)}
          />
          {elegido ? (
            <Accion
              Icono={NotebookText}
              texto="la historia"
              detalle="lo que cuenta este espacio, por partes"
              onPress={() => onAbrirEspacio?.(elegido, null)}
            />
          ) : (
            <Accion
              Icono={Layers}
              texto="un espacio"
              detalle="para juntar lo que va con lo que"
              onPress={onNuevoEspacio}
            />
          )}
        </View>

        {elegido && (armando || asociados.length) ? (
          <Animated.View entering={FadeIn.duration(280).delay(80)} style={{ marginTop: 28 }}>
            <Rotulo texto="en este espacio" />
            {filtros.length ? (
              <ScrollView
                horizontal
                nestedScrollEnabled
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 30, gap: 14 }}
                style={{ marginBottom: 8, flexGrow: 0 }}
              >
                {filtros.map((f) => {
                  const activo = filtro === f.id;
                  return (
                    <Pressable
                      key={f.id}
                      onPress={() => {
                        roce();
                        setFiltro(f.id);
                      }}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityState={{ selected: activo }}
                      accessibilityLabel={`Mostrar ${f.label}`}
                    >
                      <Text
                        style={{
                          fontFamily: MONO,
                          fontSize: 11.5,
                          color: activo ? INK.title : TENUE,
                          backgroundColor: activo ? RESALTADOR : 'transparent',
                          paddingHorizontal: 4,
                          paddingVertical: 1,
                        }}
                      >
                        {f.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : null}
            <View style={{ paddingHorizontal: 30 }}>
              {armando && !asociados.length ? (
                <ActivityIndicator size="small" color={INK.faint} style={{ marginTop: 8 }} />
              ) : visibles.length ? (
                visibles.map((it, i) => (
                  <FilaAsociado
                    key={it.id}
                    item={it}
                    ultima={i === visibles.length - 1}
                    onPress={() => {
                      toque();
                      if (normalizeTipo(it.tipo) === 'Snippet') onAbrirNota?.(it);
                      else onAbrirItem?.(it);
                    }}
                  />
                ))
              ) : (
                <Text style={{ fontFamily: MONO, fontSize: 12.5, color: TENUE, lineHeight: 20, marginTop: 8 }}>
                  no hay {filtros.find((f) => f.id === filtro)?.label || 'nada'} en este espacio.
                </Text>
              )}
            </View>
          </Animated.View>
        ) : null}
      </ScrollView>

      {/* El color en vuelo. Va fuera del ScrollView para que el viaje no se
          mueva con el desplazamiento a mitad de camino. */}
      {origen ? (
        <Animated.View
          pointerEvents="none"
          style={[{ position: 'absolute', left: 0, top: 0, backgroundColor: color }, estiloVuelo]}
        />
      ) : null}

      <GrafoPantallaCompleta
        visible={completo && !!elegido}
        espacio={elegido}
        armarPara={armarPara}
        onCerrar={() => setCompleto(false)}
        {...accionesGrafo}
      />

      {/* La lupa, arriba: el teclado sube desde abajo, y así el campo y los
          resultados quedan a la vista mientras se escribe. */}
      {buscando && elegido ? (
        <View style={{ position: 'absolute', top: 6, left: 20, right: 20 }}>
          <AgregarAlEspacio
            indice={indice}
            espacio={elegido}
            onAgregar={sumarAlEspacio}
            onCerrar={onCerrarBusqueda}
          />
        </View>
      ) : null}
    </View>
  );
}

// ─── Piezas ───────────────────────────────────────────────────────────────────

/** Rótulo de sección: la misma voz minúscula que usa el historial. */
function Rotulo({ texto }) {
  return (
    <Text
      style={{ fontFamily: MONO, fontSize: 11.5, color: TENUE, paddingHorizontal: 30, marginBottom: 14 }}
    >
      {texto}
    </Text>
  );
}

/**
 * Una acción de crear.
 *
 * Lleva un renglón de detalle debajo y no es adorno: acá hay dos acciones que
 * se parecen y hacen cosas distintas según dónde estés, y el detalle dice qué
 * va a pasar —no qué es el botón.
 */
function Accion({ Icono, texto, detalle, onPress }) {
  return (
    <Pressable
      onPress={() => {
        roce();
        onPress?.();
      }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 13,
        paddingVertical: 14,
        paddingHorizontal: 15,
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: 'rgba(28,43,34,0.09)',
        backgroundColor: pressed ? 'rgba(28,43,34,0.035)' : 'transparent',
      })}
      accessibilityRole="button"
      accessibilityLabel={texto}
      accessibilityHint={detalle}
    >
      <Icono size={17} color={INK.faint} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: MONO, fontSize: 13.5, color: INK.title }}>{texto}</Text>
        <Text style={{ fontFamily: MONO, fontSize: 11, color: TENUE, marginTop: 4 }}>{detalle}</Text>
      </View>
      <Plus size={15} color="rgba(28,43,34,0.22)" />
    </Pressable>
  );
}

const HAIRLINE = 'rgba(28,43,34,0.07)';

/** Cómo se nombra un tipo cuando es un filtro, no una ficha. */
function etiquetaTipo(tipo) {
  return (
    {
      Snippet: 'notas',
      Actor: 'actores',
      Entidad: 'entidades',
      Territorio: 'territorios',
      Evento: 'eventos',
      Concepto: 'conceptos',
      Documento: 'documentos',
      Evidencia: 'evidencias',
      Historia: 'historias',
      Objeto: 'objetos',
      Artefacto: 'artefactos',
    }[tipo] || String(tipo || '').toLowerCase()
  );
}

/**
 * Un elemento del espacio, en la lista de abajo.
 *
 * Snippet e item no se ven igual a propósito: una nota es texto que se sigue
 * escribiendo, un actor es una ficha. El tipo en color es lo que los separa
 * —el mismo acento que usa el grafo de arriba—, y los Posts ni llegan acá.
 */
function FilaAsociado({ item, ultima, onPress }) {
  const tipo = normalizeTipo(item.tipo);
  const esNota = tipo === 'Snippet';
  const color = TYPE_ACCENT[tipo] || INK.faint;
  const lineas = String(item.description || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const resumen = esNota ? lineas.slice(1).join(' ') : lineas.join(' ');

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        paddingVertical: 15,
        opacity: pressed ? 0.55 : 1,
      })}
      accessibilityRole="button"
      accessibilityLabel={esNota ? item.name || 'sin título' : `${item.name || 'sin nombre'}, ${tipo}`}
    >
      <Text numberOfLines={esNota ? 2 : 1} style={{ fontFamily: MONO, fontSize: 14, color: INK.title, lineHeight: 21 }}>
        {item.name || (esNota ? 'sin título' : 'sin nombre')}
      </Text>

      {resumen ? (
        <Text numberOfLines={2} style={{ fontFamily: MONO, fontSize: 12.5, color: 'rgba(28,43,34,0.42)', lineHeight: 20, marginTop: 5 }}>
          {resumen}
        </Text>
      ) : null}

      <Text style={{ fontFamily: MONO, fontSize: 11, marginTop: 7 }}>
        {esNota ? (
          <Text style={{ color: 'rgba(28,43,34,0.26)' }}>{fechaCorta(item.created_at)}</Text>
        ) : (
          <>
            <Text style={{ color, opacity: 0.75 }}>{tipo.toLowerCase()}</Text>
            {item.created_at ? (
              <Text style={{ color: 'rgba(28,43,34,0.26)' }}>{` · ${fechaCorta(item.created_at)}`}</Text>
            ) : null}
          </>
        )}
      </Text>

      {ultima ? null : <View style={{ height: 1, backgroundColor: HAIRLINE, marginTop: 15 }} />}
    </Pressable>
  );
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function fechaCorta(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const hoy = new Date();
  const dia = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const delta = (dia(hoy) - dia(d)) / 86400000;
  if (delta === 0) return 'hoy';
  if (delta === 1) return 'ayer';
  return `${d.getDate()} ${MESES[d.getMonth()]}`;
}

// ─── Texto ────────────────────────────────────────────────────────────────────

/**
 * El saludo según la hora.
 *
 * Los cortes no son los del reloj sino los del día vivido: a las 5 de la mañana
 * todavía es de noche para quien no se acostó, y a las 7 de la tarde ya nadie
 * dice «buenas tardes». Se prefiere errar del lado del que está despierto.
 */
function saludoDe(d) {
  const h = d.getHours();
  if (h >= 5 && h < 12) return 'Buenos días';
  if (h >= 12 && h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}
