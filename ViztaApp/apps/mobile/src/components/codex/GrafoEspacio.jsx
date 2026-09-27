import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { RotateCcw } from 'lucide-react-native';
import { CAMARA_INICIAL, LIMITES, dondeSeVe, esInicial, proyectar } from './camara';
import { etiquetar } from './grafo';
import { INK } from '../theme';
import { MONO } from './mono';
import { PAPEL } from './Papel';
import { TENUE } from './piezasCarpeta';
import { TYPE_ACCENT, normalizeTipo } from './tipos';
import { EV, evento } from '../../utils/analitica';

// El área mínima para tocar un punto. Un punto de 3.5 de radio no se acierta
// con un dedo; el área invisible alrededor es lo que lo vuelve tocable.
const TOQUE_MIN = 26;

// El color de lo que escribiste vos: la historia y todo lo que sale de ella.
const INDIGO = '#4B4FA6';
const indigo = (a) => `rgba(75,79,166,${a})`;

/**
 * Cómo se ve cada clase de lazo. La línea dice de dónde salió sin rotularla:
 * lo afirmado va entero, lo deducido punteado, y la historia en índigo.
 */
function trazoDe(l) {
  switch (l.clase) {
    case 'miembro':
      // Casi invisible: lo que dice que estas ideas van juntas es que están
      // juntas, no la línea.
      return { color: indigo(0.13), ancho: 0.7 };
    case 'menciona':
      return { color: indigo(0.42), ancho: 1 };
    case 'parecido': {
      // Más parecido, más visible. La franja útil del índice va de 0.6 a 0.9.
      const a = Math.min(0.5, Math.max(0.16, 0.16 + (l.peso - 0.6) * 1.1));
      return { color: indigo(a), ancho: 0.9, punteado: '1 3' };
    }
    case 'relacion':
      return { color: 'rgba(28,43,34,0.38)', ancho: 1.1 };
    default:
      return { color: 'rgba(28,43,34,0.17)', ancho: 0.8, punteado: '2 3' };
  }
}

/**
 * El grafo de un espacio, dibujado.
 *
 * **Puntos y líneas en SVG; nombres como texto de verdad.** Un `<Text>` de SVG
 * no hereda la tipografía de la app y mide distinto, así que los nombres van
 * posicionados encima del lienzo. El SVG queda para lo que RN no sabe hacer:
 * curvas y círculos.
 *
 * **No todos los puntos llevan nombre**, y es a propósito: `grafo.etiquetas`
 * trae solo los que entraron sin pisarse. Un nombre encimado no se lee y tapa al
 * que sí entró. El resto se lee tocando.
 *
 * **Tocar un punto apaga el resto.** Es lo que convierte un enredo de líneas en
 * algo legible: quedan encendidos solo ese nodo y lo que lo toca, y su nombre
 * aparece aunque no hubiera entrado. Es el gesto que responde «¿y esto con qué
 * tiene que ver?», que es para lo que se mira un grafo.
 */
export default function GrafoEspacio({
  grafo,
  ancho,
  alto,
  cargando,
  error,
  onAbrirItem,
  onAgregar,
  onAbrirHistoria,
  onCrearConcepto,
  // Arma el mismo grafo con un concepto abierto. Sin esto, los conceptos no se
  // abren y el grafo se queda en el primer nivel.
  armarCon,
  // Un dedo orbita en 3D. Solo donde un dedo no hace otra cosa: en la hoja, un
  // dedo desplaza la página; en pantalla completa, orbita.
  orbitar = false,
}) {
  const [elegido, setElegido] = useState(null);

  /**
   * El concepto abierto. Al entrar se ven los conceptos; tocar uno muestra sus
   * ideas alrededor, partiendo de donde estaba todo: abrir no desordena lo que
   * ya se miraba. Tocarlo de nuevo, o tocar el fondo, lo cierra.
   */
  const [expandido, setExpandido] = useState(null);
  const visto = useMemo(() => {
    if (!expandido || !armarCon || !grafo?.nodos?.length) return grafo;
    const iniciales = new Map(grafo.nodos.map((n) => [n.id, { x: n.x, y: n.y }]));
    return armarCon({ expandido, iniciales }) || grafo;
  }, [expandido, armarCon, grafo]);

  // Si el seguro tuvo que rehacer el acomodo, se anota: es un caso que la
  // prueba no cubrió y conviene verlo.
  useEffect(() => {
    if (visto?.rescate) evento(EV.GRAFO_RESCATADO, { rescate: visto.rescate, nodos: visto.nodos?.length || 0 });
  }, [visto]);

  const planos = visto?.nodos || [];
  const lazos = visto?.lazos || [];

  /**
   * La cámara. Pellizcar acerca y aleja; dos dedos mueven; girar dos dedos
   * rota en el plano; un dedo orbita en 3D (donde está habilitado). Se orbita
   * alrededor del nodo tocado, o del centro si no hay ninguno.
   */
  const [camara, setCamara] = useState(CAMARA_INICIAL);
  const inicial = esInicial(camara);
  const pivote = useMemo(() => {
    const n = elegido ? planos.find((x) => x.id === elegido) : null;
    return n ? { x: n.x, y: n.y, z: n.z || 0 } : { x: ancho / 2, y: alto / 2, z: 0 };
  }, [elegido, planos, ancho, alto]);

  // Cambiar de pivote con la cámara movida haría saltar la vista: se corrige
  // el desplazamiento para que el nuevo pivote quede donde se estaba viendo.
  const pivoteAntes = useRef(pivote);
  useEffect(() => {
    const antes = pivoteAntes.current;
    pivoteAntes.current = pivote;
    if (antes === pivote) return;
    setCamara((c) => {
      if (esInicial(c)) return c;
      const seVe = dondeSeVe(pivote, { ...c, dx: 0, dy: 0 }, antes);
      return { ...c, dx: seVe.x + c.dx - pivote.x, dy: seVe.y + c.dy - pivote.y };
    });
  }, [pivote]);

  const nodos = useMemo(() => proyectar(planos, camara, pivote), [planos, camara, pivote]);
  // Sin mover la cámara, los nombres son los que ubicó el acomodo. Movida, se
  // vuelven a ubicar sobre lo que se ve.
  const etiquetas = useMemo(
    () => (inicial ? visto?.etiquetas || [] : etiquetar(nodos, { ancho, alto })),
    [inicial, visto, nodos, ancho, alto]
  );
  // Lo que queda al fondo se apaga un poco: es lo que da la profundidad.
  const hondura = (n) => 1 - (n?.fondo || 0) * 0.55;

  const desde = useRef({});
  const tomar = (campos) => {
    desde.current = { ...desde.current, ...campos };
  };
  const pellizco = Gesture.Pinch()
    .runOnJS(true)
    .onStart(() => tomar({ escala: camara.escala }))
    .onUpdate((e) =>
      setCamara((c) => ({
        ...c,
        escala: Math.min(LIMITES.escalaMax, Math.max(LIMITES.escalaMin, desde.current.escala * e.scale)),
      }))
    );
  const mover = Gesture.Pan()
    .minPointers(2)
    .runOnJS(true)
    .onStart(() => tomar({ dx: camara.dx, dy: camara.dy }))
    .onUpdate((e) => setCamara((c) => ({ ...c, dx: desde.current.dx + e.translationX, dy: desde.current.dy + e.translationY })));
  const giro = Gesture.Rotation()
    .runOnJS(true)
    .onStart(() => tomar({ roll: camara.roll }))
    .onUpdate((e) => setCamara((c) => ({ ...c, roll: desde.current.roll + e.rotation })));
  const orbita = Gesture.Pan()
    .enabled(orbitar)
    .maxPointers(1)
    .minDistance(10)
    .runOnJS(true)
    .onStart(() => tomar({ yaw: camara.yaw, pitch: camara.pitch }))
    .onUpdate((e) =>
      setCamara((c) => ({
        ...c,
        yaw: desde.current.yaw + e.translationX * 0.009,
        pitch: Math.max(-LIMITES.pitchMax, Math.min(LIMITES.pitchMax, desde.current.pitch - e.translationY * 0.009)),
      }))
    );
  const gestos = Gesture.Simultaneous(orbita, mover, pellizco, giro);

  // Con quién se toca el elegido. Se calcula una vez y no por nodo: si no, cada
  // punto recorría la lista entera de lazos en cada render.
  const vecinos = useMemo(() => {
    if (!elegido) return null;
    const s = new Set([elegido]);
    for (const l of lazos) {
      if (l.a === elegido) s.add(l.b);
      else if (l.b === elegido) s.add(l.a);
    }
    return s;
  }, [elegido, lazos]);

  const porId = useMemo(() => new Map(nodos.map((n) => [n.id, n])), [nodos]);
  const etiquetaDe = useMemo(() => new Map(etiquetas.map((e) => [e.id, e])), [etiquetas]);
  const elegidoNodo = elegido ? porId.get(elegido) : null;
  // Un elemento que además es concepto se trata como elemento: su nombre abre
  // su ficha. El concepto solo es el que tiene acciones de concepto.
  const conceptoSolo = elegidoNodo?.concepto && !elegidoNodo?.item ? elegidoNodo.concepto : null;

  // El nombre del elegido cuando no había entrado: debajo del punto, empujado
  // adentro del marco. Va con fondo de papel porque puede caer encima de líneas.
  const nombreSuelto = useMemo(() => {
    // Las ideas y los conceptos se leen en su globo, que ya trae el nombre.
    if (!elegidoNodo || !elegidoNodo.texto || (elegidoNodo.concepto && !elegidoNodo.item) || elegidoNodo.documento || etiquetaDe.has(elegidoNodo.id)) return null;
    const cuerpo = 10.5;
    const w = elegidoNodo.texto.length * cuerpo * 0.6 + 8;
    const h = cuerpo * 1.3 + 4;
    const x = Math.min(Math.max(elegidoNodo.x - w / 2, 2), ancho - w - 2);
    const debajo = elegidoNodo.y + elegidoNodo.cuerpo + 3;
    const y = debajo + h > alto ? elegidoNodo.y - elegidoNodo.cuerpo - 3 - h : debajo;
    return { x, y, w, h };
  }, [elegidoNodo, etiquetaDe, ancho, alto]);

  /**
   * El globo: lo que se leyó, encima del dibujo.
   *
   * Tocar una idea muestra su oración entera al lado del punto; tocar un
   * concepto, su nombre y las oraciones que agrupa. Es la respuesta a «¿qué
   * leyó de mi historia?» sin salir del grafo. Va arriba o abajo del punto
   * según dónde quepa, y nunca se sale del marco. No se toca: deja pasar el
   * toque al lienzo, y las acciones quedan en el pie.
   */
  const globo = useMemo(() => {
    // Un concepto no lleva globo: se abre y sus ideas quedan a la vista.
    if (!elegidoNodo || !(elegidoNodo.idea || elegidoNodo.documento)) return null;
    const TOPE = 4;
    let titulo = null;
    let oraciones;
    let resto = 0;
    if (elegidoNodo.idea) {
      // Un fragmento de documento puede ser largo: el globo es para
      // reconocerlo; se lee entero en la historia.
      const t = elegidoNodo.idea.texto || '';
      oraciones = [t.length > 420 ? `${t.slice(0, 419)}…` : t];
    } else if (elegidoNodo.documento) {
      // Un documento: su nombre y, si entró una parte, cuánto.
      const d = elegidoNodo.documento;
      titulo = d.nombre;
      oraciones =
        d.paginas && d.paginas_leidas < d.paginas
          ? [`se leyeron ${d.paginas_leidas} de ${d.paginas} páginas`]
          : [];
    } else {
      titulo = elegidoNodo.concepto.nombre;
      // Los conceptos traen sus textos: los de un documento son fragmentos
      // que no están dibujados. Un fragmento largo se corta: el globo es para
      // reconocerlo, no para leerlo entero.
      const todas = (elegidoNodo.concepto.textos || []).map((t) => (t.length > 180 ? `${t.slice(0, 179)}…` : t));
      oraciones = todas.slice(0, TOPE);
      resto = todas.length - oraciones.length;
    }

    // Monoespaciada: cuánto ocupa es aritmética, no medición.
    const w = Math.min(ancho - 32, 290);
    const porRenglon = Math.floor((w - 22) / (11.5 * 0.6));
    const renglon = 17;
    let renglones = titulo ? 1.4 : 0;
    for (const o of oraciones) renglones += Math.max(1, Math.ceil(o.length / porRenglon)) + 0.35;
    if (resto) renglones += 1;
    const h = Math.ceil(renglones * renglon + 18);

    const x = Math.min(Math.max(elegidoNodo.x - w / 2, 8), ancho - w - 8);
    const debajo = elegidoNodo.y + elegidoNodo.cuerpo + 10;
    const y = debajo + h <= alto - 4 ? debajo : Math.max(4, elegidoNodo.y - elegidoNodo.cuerpo - 10 - h);
    return { x, y, w, titulo, oraciones, resto };
  }, [elegidoNodo, porId, ancho, alto]);

  if (cargando) {
    return (
      <View style={{ height: alto, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="small" color={INK.faint} />
      </View>
    );
  }

  if (error || !nodos.length) {
    return (
      <View style={{ height: alto, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 46 }}>
        <Text style={{ fontFamily: MONO, fontSize: 12.5, color: TENUE, textAlign: 'center', lineHeight: 20 }}>
          {error || 'este espacio todavía no tiene nada adentro.'}
        </Text>
      </View>
    );
  }

  const colorDe = (n) =>
    n.idea || (n.concepto && !n.item) || n.documento ? INDIGO : TYPE_ACCENT[normalizeTipo(n.tipo)] || INK.title;

  return (
    // Estilo vacío a propósito: por defecto ocupa todo (`flex: 1`), y dentro de
    // la hoja desplazable eso lo estiraba.
    <GestureHandlerRootView style={{}}>
      <GestureDetector gesture={gestos}>
      <Pressable
        onPress={() => {
          setElegido(null);
          setExpandido(null);
        }}
        style={{ width: ancho, height: alto }}
        // El fondo del lienzo limpia la selección. Es lo que uno intenta
        // primero para «soltar» algo que quedó enfocado.
        accessibilityRole="none"
      >
        <Svg width={ancho} height={alto} style={{ position: 'absolute' }}>
          {lazos.map((l) => {
            const a = porId.get(l.a);
            const b = porId.get(l.b);
            if (!a || !b) return null;

            const apagado = vecinos && !(vecinos.has(l.a) && vecinos.has(l.b));
            const trazo = trazoDe(l);

            // Curva y no recta: con muchas líneas rectas, las que comparten
            // dirección se superponen y parecen una sola. Una curva suave las
            // separa lo suficiente para contarlas.
            const mx = (a.x + b.x) / 2;
            const my = (a.y + b.y) / 2;
            const nx = -(b.y - a.y);
            const ny = b.x - a.x;
            const largo = Math.sqrt(nx * nx + ny * ny) || 1;
            const comba = Math.min(14, largo * 0.1);

            return (
              <Path
                key={l.clave}
                d={`M ${a.x} ${a.y} Q ${mx + (nx / largo) * comba} ${my + (ny / largo) * comba} ${b.x} ${b.y}`}
                stroke={trazo.color}
                strokeDasharray={trazo.punteado}
                strokeWidth={trazo.ancho}
                fill="none"
                opacity={(apagado ? 0.08 : 1) * Math.min(hondura(a), hondura(b))}
              />
            );
          })}

          {nodos.map((n) => {
            const apagado = vecinos && !vecinos.has(n.id);
            const esElegido = elegido === n.id;
            // Un documento es una hoja: rectángulo vertical de papel, con borde
            // índigo. Se lee distinto de un elemento y de un concepto.
            if (n.documento) {
              const w = n.cuerpo * 1.5;
              const h = n.cuerpo * 2;
              return (
                <Rect
                  key={n.id}
                  x={n.x - w / 2}
                  y={n.y - h / 2}
                  width={w}
                  height={h}
                  rx={2}
                  fill={PAPEL}
                  stroke={INDIGO}
                  strokeWidth={esElegido ? 2.2 : 1.5}
                  opacity={(apagado ? 0.16 : 1) * hondura(n)}
                />
              );
            }
            // Un concepto es un aro: es el centro de un racimo de ideas, no una
            // cosa. Hueco para que se lea distinto de los elementos del Codex.
            if (n.concepto && !n.item) {
              const abierto = expandido === n.concepto.id;
              return (
                <Circle
                  key={n.id}
                  cx={n.x}
                  cy={n.y}
                  r={n.cuerpo}
                  // Abierto, el aro se tiñe: dice cuál es el que muestra sus ideas.
                  fill={abierto ? indigo(0.16) : PAPEL}
                  stroke={INDIGO}
                  strokeWidth={esElegido ? 2.2 : 1.5}
                  opacity={(apagado ? 0.16 : 1) * hondura(n)}
                />
              );
            }
            // Un elemento que además es concepto lleva un aro índigo por fuera:
            // es lo que dice que también se abre en ideas.
            const aro =
              n.item && n.concepto ? (
                <Circle
                  key={`aro-${n.id}`}
                  cx={n.x}
                  cy={n.y}
                  r={n.cuerpo + 3.5}
                  fill={expandido === n.concepto.id ? indigo(0.14) : 'none'}
                  stroke={INDIGO}
                  strokeWidth={1.3}
                  opacity={(apagado ? 0.16 : 0.9) * hondura(n)}
                />
              ) : null;
            return [
              aro,
              <Circle
                key={n.id}
                cx={n.x}
                cy={n.y}
                r={n.cuerpo}
                fill={colorDe(n)}
                // Apagar es bajar la opacidad y no cambiar el color: el color
                // dice de qué tipo es cada cosa, y cambiarlo al enfocar otro
                // punto haría que la taxonomía parpadee.
                // Lo de afuera del espacio va tenue y con el aro punteado: la
                // nota lo nombra, pero todavía no es parte del espacio.
                opacity={(apagado ? 0.16 : esElegido ? 1 : n.externo ? 0.4 : n.idea ? 0.7 : 0.86) * hondura(n)}
                stroke={esElegido ? INK.title : n.externo ? colorDe(n) : PAPEL}
                strokeWidth={esElegido ? 1.6 : 1}
                strokeDasharray={n.externo && !esElegido ? '2 2' : undefined}
              />,
            ];
          })}
        </Svg>

        {etiquetas.map((e, i) => {
          const n = porId.get(e.id);
          if (!n) return null;
          const apagado = vecinos && !vecinos.has(e.id);
          return (
            // La entrada va en una caja y la opacidad de apagar en el texto de
            // adentro. Juntas en el mismo componente se pisan: la animación de
            // entrada es de opacidad, y Reanimated avisaba una vez por nombre
            // que podía borrar el apagado.
            <Animated.View
              key={`nombre-${e.id}`}
              entering={FadeIn.duration(260).delay(Math.min(i, 14) * 28)}
              pointerEvents="none"
              style={{ position: 'absolute', left: e.x, top: e.y, width: e.ancho + 2 }}
            >
              <Text
                numberOfLines={1}
                style={{
                  fontFamily: MONO,
                  fontSize: 10.5,
                  lineHeight: e.alto,
                  color: colorDe(n),
                  opacity: (apagado ? 0.14 : elegido === e.id ? 1 : 0.84) * hondura(n),
                  textDecorationLine: elegido === e.id ? 'underline' : 'none',
                }}
              >
                {e.texto}
              </Text>
            </Animated.View>
          );
        })}

        {nombreSuelto ? (
          <Animated.View
            entering={FadeIn.duration(140)}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: nombreSuelto.x,
              top: nombreSuelto.y,
              width: nombreSuelto.w,
              height: nombreSuelto.h,
              borderRadius: 4,
              backgroundColor: PAPEL,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              numberOfLines={1}
              style={{ fontFamily: MONO, fontSize: 10.5, color: colorDe(elegidoNodo), textDecorationLine: 'underline' }}
            >
              {elegidoNodo.texto}
            </Text>
          </Animated.View>
        ) : null}

        {globo ? (
          <Animated.View
            key={`globo-${elegido}`}
            entering={FadeIn.duration(160)}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: globo.x,
              top: globo.y,
              width: globo.w,
              paddingHorizontal: 11,
              paddingVertical: 9,
              borderRadius: 10,
              backgroundColor: PAPEL,
              borderWidth: 1,
              borderColor: indigo(0.22),
              shadowColor: '#1C2B22',
              shadowOpacity: 0.08,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 3 },
              gap: 6,
            }}
          >
            {globo.titulo ? (
              <Text style={{ fontFamily: MONO, fontSize: 12, lineHeight: 17, color: INDIGO, fontWeight: '600' }}>
                {globo.titulo}
              </Text>
            ) : null}
            {globo.oraciones.map((o, i) => (
              <Text key={i} style={{ fontFamily: MONO, fontSize: 11.5, lineHeight: 17, color: INK.title }}>
                {globo.titulo ? `· ${o}` : o}
              </Text>
            ))}
            {globo.resto ? (
              <Text style={{ fontFamily: MONO, fontSize: 11, lineHeight: 17, color: indigo(0.6) }}>
                {`y ${globo.resto} más`}
              </Text>
            ) : null}
          </Animated.View>
        ) : null}

        {/* Las áreas de toque van al final y en orden inverso: los nodos
            pesados salen primero de `grafo.nodos`, así que invertidos quedan
            arriba y ganan cuando dos áreas se superponen en un grupo apretado. */}
        {[...nodos].reverse().map((n) => {
          const lado = Math.max(TOQUE_MIN, n.cuerpo * 2 + 14);
          return (
            <Pressable
              key={`toque-${n.id}`}
              onPress={() => {
                // Un concepto —o un elemento que también lo es— se abre y se
                // cierra con el mismo toque.
                if (n.concepto && armarCon) {
                  const cerrar = expandido === n.concepto.id;
                  setExpandido(cerrar ? null : n.concepto.id);
                  setElegido(cerrar ? null : n.id);
                  return;
                }
                setElegido((e) => (e === n.id ? null : n.id));
              }}
              style={{
                position: 'absolute',
                left: n.x - lado / 2,
                top: n.y - lado / 2,
                width: lado,
                height: lado,
                borderRadius: lado / 2,
              }}
              accessibilityRole="button"
              accessibilityLabel={`${n.idea?.texto || n.concepto?.nombre || n.documento?.nombre || n.item?.name || n.texto}${n.grado ? `, ${n.grado} conexiones` : ''}`}
            />
          );
        })}

        {/* Volver a la vista de siempre, cuando se movió algo. */}
        {!inicial ? (
          <Pressable
            onPress={() => setCamara(CAMARA_INICIAL)}
            hitSlop={10}
            style={({ pressed }) => ({ position: 'absolute', top: 4, left: 22, padding: 6, opacity: pressed ? 0.5 : 1 })}
            accessibilityRole="button"
            accessibilityLabel="Volver a la vista original del grafo"
          >
            <RotateCcw size={16} color="rgba(28,43,34,0.45)" />
          </Pressable>
        ) : null}
      </Pressable>
      </GestureDetector>

      {/* El pie existe por una sola razón: arriba el nombre puede estar
          recortado, y este es el lugar donde se lee entero y se entra a la
          ficha. Nada más. No lleva cuántos lazos ni cuántas menciones —eso ya
          está dicho por el tamaño del punto y por las líneas que salen de él,
          y repetirlo en números al pie es contar dos veces lo mismo. */}
      <View style={{ minHeight: 30, paddingHorizontal: 30, justifyContent: 'center' }}>
        {elegidoNodo ? (
          <Animated.View
            entering={FadeIn.duration(180)}
            exiting={FadeOut.duration(120)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
          >
            {/* Lo que se leyó ya está en el globo; acá van las acciones. Una
                idea se lee en la historia, donde está escrita; un concepto que
                ya es del Codex y un elemento, en su ficha. */}
            {conceptoSolo && !conceptoSolo.item ? <View style={{ flex: 1 }} /> : (
            <Pressable
              onPress={() => {
                if (elegidoNodo.idea || elegidoNodo.documento) onAbrirHistoria?.(elegidoNodo.idea || elegidoNodo.documento);
                else if (conceptoSolo) {
                  if (conceptoSolo.item) onAbrirItem?.(conceptoSolo.item);
                } else onAbrirItem?.(elegidoNodo.item);
              }}
              style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.5 : 1, paddingVertical: 5 })}
              accessibilityRole="button"
              accessibilityLabel={
                elegidoNodo.idea || elegidoNodo.documento
                  ? 'Leer en la historia'
                  : conceptoSolo
                    ? conceptoSolo.nombre
                    : `Abrir ${elegidoNodo.item?.name}`
              }
            >
              <Text
                numberOfLines={1}
                style={{
                  fontFamily: MONO,
                  fontSize: elegidoNodo.idea || conceptoSolo || elegidoNodo.documento ? 12 : 12.5,
                  lineHeight: 18,
                  color: elegidoNodo.idea || conceptoSolo || elegidoNodo.documento ? INDIGO : INK.title,
                }}
              >
                {elegidoNodo.idea || elegidoNodo.documento
                  ? 'leer en la historia'
                  : conceptoSolo
                    ? 'ver en el Codex'
                    : elegidoNodo.item?.name}
              </Text>
            </Pressable>
            )}
            {/* Un concepto que todavía no es del Codex se puede crear desde
                acá. Nunca solo: lo decidís vos. */}
            {conceptoSolo && !conceptoSolo.item && onCrearConcepto ? (
              <Pressable
                onPress={() => onCrearConcepto(conceptoSolo)}
                hitSlop={8}
                style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, paddingVertical: 5 })}
                accessibilityRole="button"
                accessibilityLabel={`Crear ${conceptoSolo.nombre} en el Codex`}
              >
                <Text style={{ fontFamily: MONO, fontSize: 12, color: INDIGO }}>+ al Codex</Text>
              </Pressable>
            ) : null}
            {/* Lo que la nota nombra y todavía no está en el espacio se puede
                sumar desde acá: es el momento en que se ve que falta. */}
            {elegidoNodo.externo && onAgregar ? (
              <Pressable
                onPress={() => onAgregar(elegidoNodo.item)}
                hitSlop={8}
                style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, paddingVertical: 5 })}
                accessibilityRole="button"
                accessibilityLabel={`Agregar ${elegidoNodo.item?.name} al espacio`}
              >
                <Text style={{ fontFamily: MONO, fontSize: 12, color: INDIGO }}>+ al espacio</Text>
              </Pressable>
            ) : null}
          </Animated.View>
        ) : null}
      </View>
    </GestureHandlerRootView>
  );
}
