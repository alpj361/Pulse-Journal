import { useMemo, useRef, useState } from 'react';
import { Modal, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Canvas, Path } from '@shopify/react-native-skia';
import { Eraser, Undo2 } from 'lucide-react-native';
import { INK } from '../../theme';
import { MONO } from '../mono';
import { PAPEL } from '../Papel';
import { caminoDeTrazo, trazoParaGuardar } from './trazos';
import { roce, toque } from '../../../utils/haptics';

const TINTAS = [INK.title, '#2D5EA8', '#B5541C', '#2F7D4F'];

/**
 * El lienzo para dibujar, a pantalla completa.
 *
 * Se dibuja con el dedo sobre el mismo ancho que tendrá el dibujo en la nota
 * (la proporción del bloque), así lo que se ve acá es lo que queda. Los
 * trazos se guardan al tocar «listo»; cerrar sin tocarlo deja el dibujo como
 * estaba.
 *
 * Es un `Modal` propio con su raíz de gestos: los de `react-native-gesture-
 * handler` no cruzan el borde de un modal.
 */
export default function LienzoDibujo({ trazos: iniciales, proporcion = 0.6, onListo, onCerrar }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const ancho = Math.min(width - 32, 520);
  const alto = ancho * proporcion;

  const [trazos, setTrazos] = useState(iniciales);
  const [actual, setActual] = useState(null); // puntos en pantalla del trazo en curso
  const [tinta, setTinta] = useState(TINTAS[0]);
  const puntos = useRef([]);

  const gesto = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .minDistance(0)
        .onBegin((e) => {
          puntos.current = [[e.x, e.y, 0.5]];
          setActual(puntos.current);
        })
        .onUpdate((e) => {
          puntos.current = [...puntos.current, [e.x, e.y, 0.5]];
          setActual(puntos.current);
        })
        .onFinalize(() => {
          if (puntos.current.length) {
            const t = trazoParaGuardar(puntos.current, ancho, { color: tinta });
            setTrazos((x) => [...x, t]);
          }
          puntos.current = [];
          setActual(null);
        }),
    [ancho, tinta],
  );

  const caminos = useMemo(() => trazos.map((t) => ({ d: caminoDeTrazo(t, ancho), color: t.color || INK.title })), [trazos, ancho]);
  const enCurso = actual ? caminoDeTrazo({ puntos: actual.map(([x, y, p]) => [x / ancho, y / ancho, p]), color: tinta }, ancho) : '';

  return (
    <Modal visible transparent={false} animationType="slide" onRequestClose={onCerrar}>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: PAPEL }}>
        <View style={{ flex: 1, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12, alignItems: 'center' }}>
          <View style={{ width: ancho, flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
            <Pressable onPress={onCerrar} hitSlop={10} accessibilityRole="button">
              <Text style={{ fontFamily: MONO, fontSize: 13, color: 'rgba(28,43,34,0.55)' }}>cancelar</Text>
            </Pressable>
            <View style={{ flex: 1 }} />
            <Pressable
              onPress={() => {
                toque();
                onListo(trazos);
              }}
              hitSlop={10}
              accessibilityRole="button"
            >
              <Text style={{ fontFamily: MONO, fontSize: 13, color: INK.title, fontWeight: '700' }}>listo</Text>
            </Pressable>
          </View>

          <GestureDetector gesture={gesto}>
            <View style={{ width: ancho, height: alto, borderRadius: 12, backgroundColor: 'rgba(28,43,34,0.045)', overflow: 'hidden' }}>
              <Canvas style={{ width: ancho, height: alto }}>
                {caminos.map((c, i) => (
                  <Path key={i} path={c.d} color={c.color} />
                ))}
                {enCurso ? <Path path={enCurso} color={tinta} /> : null}
              </Canvas>
            </View>
          </GestureDetector>

          <View style={{ width: ancho, flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 16 }}>
            {TINTAS.map((c) => (
              <Pressable
                key={c}
                onPress={() => {
                  roce();
                  setTinta(c);
                }}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityState={{ selected: c === tinta }}
                accessibilityLabel="Color"
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  backgroundColor: c,
                  borderWidth: c === tinta ? 3 : 0,
                  borderColor: 'rgba(255,255,255,0.9)',
                }}
              />
            ))}
            <View style={{ flex: 1 }} />
            <Pressable
              onPress={() => {
                roce();
                setTrazos((x) => x.slice(0, -1));
              }}
              disabled={!trazos.length}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Deshacer el último trazo"
            >
              <Undo2 size={18} color={trazos.length ? INK.title : 'rgba(28,43,34,0.25)'} />
            </Pressable>
            <Pressable
              onPress={() => {
                roce();
                setTrazos([]);
              }}
              disabled={!trazos.length}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Borrar todo el dibujo"
            >
              <Eraser size={18} color={trazos.length ? INK.title : 'rgba(28,43,34,0.25)'} />
            </Pressable>
          </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}
