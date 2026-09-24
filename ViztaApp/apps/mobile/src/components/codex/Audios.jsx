import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useVideoPlayer } from 'expo-video';
import { useEventListener } from 'expo';
import { Play, Pause, X } from 'lucide-react-native';
import { INK } from '../theme';
import { MONO } from './mono';
import MorphingInfinity from '../MorphingInfinity';
import { roce } from '../../utils/haptics';

const TENUE = 'rgba(28,43,34,0.34)';
const BARRAS = 34;

/** m:ss. Con horas no: una nota de voz de una hora no es una nota de voz. */
function reloj(seg) {
  if (!seg || !isFinite(seg)) return '0:00';
  const m = Math.floor(seg / 60);
  const s = Math.floor(seg % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Un audio adjunto, con la forma de una nota de voz.
 *
 * Play a la izquierda, la onda al medio, el tiempo a la derecha — lo mismo que
 * hacen Instagram y WhatsApp. No es imitación por imitación: esa fila ya
 * significa «esto se escucha» para cualquiera, y una barra de progreso genérica
 * o un botón que dijera «reproducir» tendrían que enseñarlo de nuevo.
 *
 * **Suena con `expo-video`, no con una librería de audio.** Su reproductor toca
 * archivos sin video igual de bien, y ya estaba instalado: `expo-audio` habría
 * sido más idiomático pero es un módulo nativo, y agregarlo obliga a recompilar
 * la app entera para algo que se resuelve con lo que hay.
 *
 * **La onda es decorativa y hay que decirlo.** Son barras de alturas fijas
 * sembradas con el nombre del archivo, no la amplitud real: leer la forma de
 * onda de verdad exige decodificar el audio completo en el teléfono. Lo que sí
 * es real es hasta dónde se pintan —eso es el progreso—, que es lo único que la
 * onda tiene que comunicar mientras suena.
 */
export default function Audio({ audio, onQuitar }) {
  const player = useVideoPlayer(audio.url || audio.local || null, (p) => {
    p.loop = false;
  });

  const [sonando, setSonando] = useState(false);
  const [t, setT] = useState(0);

  useEventListener(player, 'playingChange', ({ isPlaying }) => setSonando(isPlaying));
  useEventListener(player, 'timeUpdate', ({ currentTime }) => setT(currentTime || 0));
  useEventListener(player, 'playToEnd', () => {
    // Vuelve al principio en vez de quedarse clavado al final: el siguiente
    // toque tiene que volver a escucharlo, no no hacer nada.
    setSonando(false);
    setT(0);
    try {
      player.currentTime = 0;
    } catch {
      // Si el player ya se liberó, no hay nada que rebobinar.
    }
  });

  /**
   * La duración, sin esperar al reproductor.
   *
   * `player.duration` llega recién cuando el archivo se descarga lo suficiente,
   * y hasta entonces vale 0: la píldora mostraba «0:00» en una nota de voz que
   * acabás de grabar y de ver contar. La guardada es la que el grabador midió,
   * así que se usa esa mientras el reproductor no tenga la suya.
   */
  const duracion = player?.duration || (audio.duracion_ms || 0) / 1000;
  const avance = duracion > 0 ? Math.min(t / duracion, 1) : 0;

  /**
   * Las alturas de la onda.
   *
   * Sembradas con el nombre del archivo, así que el mismo audio se ve siempre
   * igual y dos audios distintos se ven distintos. Con alturas al azar en cada
   * render, la onda temblaría mientras suena.
   */
  const alturas = useMemo(() => {
    const semilla = String(audio.storage_path || audio.nombre || audio.id || '');
    let n = 0;
    for (let i = 0; i < semilla.length; i++) n = (n * 31 + semilla.charCodeAt(i)) >>> 0;

    return Array.from({ length: BARRAS }, () => {
      n = (n * 1664525 + 1013904223) >>> 0;
      return 0.25 + ((n >>> 16) % 100) / 100 * 0.75;
    });
  }, [audio.storage_path, audio.nombre, audio.id]);

  // Al desmontar, el reproductor se calla. Sin esto, cerrar la nota con un
  // audio sonando lo deja sonando.
  useEffect(() => () => {
    try {
      player.pause();
    } catch {
      // Ya liberado.
    }
  }, [player]);

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(140)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 11,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 13,
        backgroundColor: 'rgba(28,43,34,0.05)',
        marginTop: 8,
      }}
    >
      <Pressable
        onPress={() => {
          if (audio.subiendo) return;
          roce();
          if (sonando) player.pause();
          else player.play();
        }}
        hitSlop={8}
        style={({ pressed }) => ({
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: INK.title,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: audio.subiendo ? 0.35 : pressed ? 0.7 : 1,
        })}
        accessibilityRole="button"
        accessibilityLabel={sonando ? 'Pausar' : 'Escuchar'}
      >
        {audio.subiendo ? (
          <MorphingInfinity size={14} color="#FFF" />
        ) : sonando ? (
          <Pause size={13} color="#FFF" fill="#FFF" />
        ) : (
          // Corrido un pixel: un triángulo centrado por su caja se ve corrido a
          // la izquierda, porque su peso visual no está en el medio.
          <Play size={13} color="#FFF" fill="#FFF" style={{ marginLeft: 1.5 }} />
        )}
      </Pressable>

      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 2.5, height: 24 }}>
        {alturas.map((h, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 24 * h,
              borderRadius: 1.5,
              backgroundColor: i / BARRAS <= avance ? INK.title : 'rgba(28,43,34,0.18)',
            }}
          />
        ))}
      </View>

      <Text style={{ fontFamily: MONO, fontSize: 10.5, color: TENUE, minWidth: 34, textAlign: 'right' }}>
        {sonando || t > 0 ? reloj(t) : reloj(duracion)}
      </Text>

      {onQuitar ? (
        <Pressable
          onPress={() => {
            roce();
            player.pause();
            onQuitar(audio);
          }}
          hitSlop={10}
          style={({ pressed }) => ({ opacity: pressed ? 0.4 : 1, padding: 2 })}
          accessibilityRole="button"
          accessibilityLabel="Quitar este audio de la nota"
        >
          <X size={13} color={TENUE} />
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

/** Los audios de una nota, uno debajo del otro. */
export function Audios({ audios, onQuitar }) {
  if (!audios?.length) return null;

  return (
    <View style={{ marginTop: 18 }}>
      {audios.map((a) => (
        <Audio key={a.id} audio={a} onQuitar={onQuitar} />
      ))}
    </View>
  );
}
