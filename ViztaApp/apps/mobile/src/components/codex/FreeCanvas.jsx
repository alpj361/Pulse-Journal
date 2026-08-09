import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { INK, MOTION } from '../theme';
import { agarre, suelta } from '../../utils/haptics';
import { EsquinaDoblada, PAPEL, PildoraTipo, inclinacion } from './Papel';
import { normalizeTipo, TYPE_ACCENT } from './SpacesStack';

/**
 * Lienzo libre del espacio.
 *
 * Coordenadas de mundo compartidas con el canvas de escritorio: los items
 * viven en `data.positions` (`{ id: {x, y} }`), las notas llevan su x/y dentro
 * de `data.notes`, y los trazos van a `data.drawPaths` como
 * `{ id, points: [[x, y], …] }`. Mover algo acá lo mueve allá.
 *
 * Tres modos: mover (arrastrar nodos y desplazar el lienzo), texto (tocar el
 * vacío deja una nota) y dibujar (el dedo traza).
 */

const NODE_W = 190;

// Límites del zoom. El piso es además el umbral del gesto de salir: por debajo
// de él, pellizcar ya no es alejarse.
const PISO = 0.35;
const TECHO = 2.5;

// El <Svg> se ancla en -4000,-4000 para cubrir coordenadas negativas: el mundo
// del canvas de escritorio las usa. Los puntos se corren el mismo offset.
const SVG_OFFSET = 4000;
const pathD = (points) =>
  points.map(([px, py], i) => `${i ? 'L' : 'M'} ${px + SVG_OFFSET} ${py + SVG_OFFSET}`).join(' ');

// ─── Nodo arrastrable ─────────────────────────────────────────────────────────

function CanvasNode({ id, x, y, scale, onCommit, onPress, disabled, children, width = NODE_W, sombra = false, rotacion = 0 }) {
  const tx = useSharedValue(x);
  const ty = useSharedValue(y);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const arrastrando = useSharedValue(0);

  // Si la posición cambia desde afuera (otro guardado, recarga), se sincroniza.
  useEffect(() => {
    tx.value = x;
    ty.value = y;
  }, [x, y]);

  const drag = Gesture.Pan()
    .enabled(!disabled)
    .minDistance(4)
    .onStart(() => {
      startX.value = tx.value;
      startY.value = ty.value;
      // Con resorte, no de golpe: el nodo se despega de la hoja.
      arrastrando.value = withSpring(1, MOTION.tap);
      runOnJS(agarre)();
    })
    .onUpdate((e) => {
      // El gesto llega en px de pantalla; el mundo está escalado.
      tx.value = startX.value + e.translationX / scale.value;
      ty.value = startY.value + e.translationY / scale.value;
    })
    .onEnd(() => {
      arrastrando.value = withSpring(0, MOTION.tap);
      runOnJS(suelta)();
      runOnJS(onCommit)(id, tx.value, ty.value);
    });

  const tap = Gesture.Tap()
    .maxDistance(6)
    .onEnd((_e, ok) => {
      if (ok && onPress) runOnJS(onPress)();
    });

  const estilo = useAnimatedStyle(() => ({
    position: 'absolute',
    width,
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: 1 + arrastrando.value * 0.05 },
      // Al levantarlo se endereza: el papel se alinea con la mano que lo toma,
      // y al soltarlo vuelve a caer torcido.
      { rotate: `${rotacion * (1 - arrastrando.value)}deg` },
    ],
    // La sombra crece con el levantamiento: el nodo se separa del papel en vez
    // de solo agrandarse. Solo en los nodos que son tarjeta — sobre una nota de
    // fondo transparente la sombra seguiría el contorno de las letras.
    ...(sombra
      ? {
          shadowOpacity: 0.08 + arrastrando.value * 0.14,
          shadowRadius: 18 + arrastrando.value * 10,
        }
      : null),
    zIndex: arrastrando.value > 0 ? 20 : 1,
  }));

  return (
    <GestureDetector gesture={Gesture.Exclusive(drag, tap)}>
      <Animated.View
        style={[
          sombra ? { shadowColor: '#25332A', shadowOffset: { width: 0, height: 8 }, elevation: 4 } : null,
          estilo,
        ]}
      >
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

// ─── Lienzo ───────────────────────────────────────────────────────────────────

export default function FreeCanvas({
  items,
  positions,
  notas,
  trazos,
  modo,
  scale: scaleExterna,
  salida,
  onDismiss,
  onSoltarSalida,
  onMoveItem,
  onMoveNote,
  onAddNote,
  onEditNote,
  onAddPath,
  onOpenItem,
}) {
  const panX = useSharedValue(0);
  const panY = useSharedValue(0);
  // El zoom puede venir de arriba: el gesto de salir necesita leerlo. Si no
  // viene, el lienzo funciona igual por su cuenta.
  const scalePropia = useSharedValue(1);
  const scale = scaleExterna || scalePropia;
  const startPanX = useSharedValue(0);
  const startPanY = useSharedValue(0);
  const startScale = useSharedValue(1);

  const [trazoVivo, setTrazoVivo] = useState(null); // [[x,y], …] en coords de mundo
  const trazoRef = useRef([]);

  // Pantalla → mundo, para saber dónde cayó un toque.
  const aMundo = useCallback(
    (sx, sy) => ({ x: (sx - panX.value) / scale.value, y: (sy - panY.value) / scale.value }),
    []
  );

  const colocarNota = useCallback(
    (sx, sy) => {
      const p = aMundo(sx, sy);
      onAddNote?.(p.x - 90, p.y - 30);
    },
    [aMundo, onAddNote]
  );

  const iniciarTrazo = useCallback((sx, sy) => {
    const p = { x: (sx - panX.value) / scale.value, y: (sy - panY.value) / scale.value };
    trazoRef.current = [[p.x, p.y]];
    setTrazoVivo([[p.x, p.y]]);
  }, []);

  const seguirTrazo = useCallback((sx, sy) => {
    const p = { x: (sx - panX.value) / scale.value, y: (sy - panY.value) / scale.value };
    trazoRef.current.push([p.x, p.y]);
    setTrazoVivo(trazoRef.current.slice());
  }, []);

  const cerrarTrazo = useCallback(() => {
    if (trazoRef.current.length > 1) onAddPath?.(trazoRef.current.slice());
    trazoRef.current = [];
    setTrazoVivo(null);
  }, [onAddPath]);

  // Fondo: desplaza el lienzo, o dibuja, según el modo.
  const fondoPan = Gesture.Pan()
    .minDistance(2)
    .onStart((e) => {
      if (modo === 'dibujar') {
        runOnJS(iniciarTrazo)(e.x, e.y);
      } else {
        startPanX.value = panX.value;
        startPanY.value = panY.value;
      }
    })
    .onUpdate((e) => {
      if (modo === 'dibujar') {
        runOnJS(seguirTrazo)(e.x, e.y);
      } else {
        panX.value = startPanX.value + e.translationX;
        panY.value = startPanY.value + e.translationY;
      }
    })
    .onEnd(() => {
      if (modo === 'dibujar') runOnJS(cerrarTrazo)();
    });

  const fondoTap = Gesture.Tap()
    .maxDistance(8)
    .onEnd((e, ok) => {
      if (ok && modo === 'texto') runOnJS(colocarNota)(e.x, e.y);
    });

  /**
   * Un solo pellizco hace dos cosas, en este orden:
   *
   *  1. Mientras haya zoom que ceder, aleja el lienzo.
   *  2. Cuando el zoom ya está en el piso y el dedo sigue cerrando, empieza a
   *     cerrar el espacio.
   *
   * El orden importa: si el cierre pudiera dispararse a cualquier escala, cada
   * intento de alejarse arriesgaría salirse del espacio, y el gesto se volvería
   * impredecible justo en la vista donde más se pellizca.
   */
  const pinch = Gesture.Pinch()
    .onStart(() => {
      startScale.value = scale.value;
    })
    .onUpdate((e) => {
      const propuesto = startScale.value * e.scale;

      if (salida && propuesto < PISO && startScale.value <= PISO + 0.02) {
        salida.value = Math.min(1, (PISO - propuesto) / (PISO * 0.5));
        return;
      }

      scale.value = Math.min(TECHO, Math.max(PISO, propuesto));
      if (salida) salida.value = 0;
    })
    .onEnd(() => {
      if (!salida) return;
      if (salida.value > 0.32) {
        if (onDismiss) runOnJS(onDismiss)();
      } else if (salida.value > 0 && onSoltarSalida) {
        runOnJS(onSoltarSalida)();
      }
    });

  const mundo = useAnimatedStyle(() => ({
    transform: [{ translateX: panX.value }, { translateY: panY.value }, { scale: scale.value }],
  }));

  return (
    <GestureDetector gesture={Gesture.Simultaneous(pinch, Gesture.Exclusive(fondoPan, fondoTap))}>
      <View style={{ flex: 1, overflow: 'hidden' }}>
        <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: 1, height: 1 }, mundo]}>
          {/* Trazos */}
          <Svg
            style={{ position: 'absolute', left: -4000, top: -4000, width: 8000, height: 8000 }}
            pointerEvents="none"
          >
            {trazos.map((t) => (
              <Path
                key={t.id}
                d={pathD(t.points)}
                stroke="#1C2B22"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                opacity={0.75}
              />
            ))}
            {trazoVivo ? (
              <Path
                d={pathD(trazoVivo)}
                stroke="#1C2B22"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                opacity={0.55}
              />
            ) : null}
          </Svg>

          {/* Notas */}
          {notas.map((n) => (
            <CanvasNode
              key={n.id}
              id={n.id}
              x={n.x ?? 0}
              y={n.y ?? 0}
              scale={scale}
              disabled={modo === 'dibujar'}
              onCommit={(id, nx, ny) => onMoveNote?.(id, nx, ny)}
              onPress={() => onEditNote?.(n)}
            >
              <View
                style={{
                  backgroundColor: 'transparent',
                  paddingVertical: 2,
                }}
              >
                <Text style={{ fontSize: 15, color: INK.title, lineHeight: 21 }}>{n.content}</Text>
              </View>
            </CanvasNode>
          ))}

          {/* Items */}
          {items.map((it, i) => {
            const pos = positions[it.id] || { x: 40 + (i % 3) * 210, y: 40 + Math.floor(i / 3) * 130 };
            const t = normalizeTipo(it.tipo || it.subcategory);
            const accent = TYPE_ACCENT[t] || INK.meta;
            return (
              <CanvasNode
                key={it.id}
                id={it.id}
                x={pos.x}
                y={pos.y}
                scale={scale}
                sombra
                rotacion={inclinacion(it.id)}
                disabled={modo === 'dibujar'}
                onCommit={(id, nx, ny) => onMoveItem?.(id, nx, ny)}
                onPress={() => onOpenItem?.(it)}
              >
                {/* Recorte de papel: plano, sin borde, con la esquina doblada.
                    La sombra vive en el wrapper de CanvasNode — iOS la recorta si
                    comparte View con `overflow: hidden`. */}
                <View style={{ paddingTop: 8 }}>
                  <View
                    style={{
                      backgroundColor: PAPEL,
                      borderRadius: 14,
                      borderTopRightRadius: 0,
                      paddingHorizontal: 13,
                      paddingTop: 15,
                      paddingBottom: 13,
                      overflow: 'hidden',
                    }}
                  >
                    <Text numberOfLines={3} style={{ fontSize: 13.5, fontWeight: '700', color: INK.title, lineHeight: 18 }}>
                      {it.name || it.titulo}
                    </Text>
                    {it.description || it.descripcion ? (
                      <Text numberOfLines={2} style={{ fontSize: 11.5, color: INK.body, lineHeight: 16, marginTop: 4 }}>
                        {it.description || it.descripcion}
                      </Text>
                    ) : null}
                    <EsquinaDoblada size={20} />
                  </View>

                  {/* Sobresale del borde de arriba, como una calcomanía pegada
                      encima del recorte. El color del tipo queda en el punto, que
                      es lo único que necesita el ojo para agrupar. */}
                  <PildoraTipo
                    label={t}
                    punto={accent}
                    rotacion={inclinacion(it.id, 5) - 3}
                    style={{ position: 'absolute', left: 11, top: 0 }}
                  />
                </View>
              </CanvasNode>
            );
          })}
        </Animated.View>
      </View>
    </GestureDetector>
  );
}
