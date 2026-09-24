import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import {
  useAudioRecorder,
  useAudioRecorderState,
  RecordingPresets,
  setAudioModeAsync,
  requestRecordingPermissionsAsync,
} from 'expo-audio';
import { Check, X } from 'lucide-react-native';
import { INK } from '../theme';
import { MONO } from './mono';
import { toque, roce, falla } from '../../utils/haptics';
import Pista from '../Pista';
import { usePistasStore, PISTA } from '../../state/pistasStore';

const TENUE = 'rgba(28,43,34,0.34)';
const BARRAS = 38;

// Cada cuánto se lee el nivel del micrófono. 90 ms da una onda que se mueve sin
// temblar: más rápido cansa la vista y no dice nada nuevo, más lento se ve a
// tirones y deja de sentirse en vivo.
const LATIDO = 90;

function reloj(ms) {
  const s = Math.floor((ms || 0) / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Grabar una nota de voz, dentro de la nota.
 *
 * La onda **se mueve de verdad**: cada barra es un nivel real del micrófono,
 * leído mientras grabás. Es lo contrario de la onda del reproductor, que es
 * decorativa y está dicho ahí — acá sí hay señal que mostrar, y es la única
 * forma de saber que el micrófono está tomando algo antes de escuchar el
 * resultado. Una barra de tiempo corriendo no distingue grabar de grabar en
 * silencio.
 *
 * `metering` llega en decibeles, de unos −60 (silencio) a 0 (saturado). Se
 * mapea a una altura relativa: por debajo de −60 no hay nada que ver, y arriba
 * de 0 no existe.
 *
 * Se descarta al cancelar: el archivo temporal no se sube hasta que confirmás.
 */
export default function GrabadorVoz({ onListo, onCerrar }) {
  const grabador = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const estado = useAudioRecorderState(grabador, LATIDO);

  const [niveles, setNiveles] = useState([]);
  const [error, setError] = useState(null);
  const arrancado = useRef(false);

  const marcarPista = usePistasStore((s) => s.marcar);

  // El historial de niveles: entra por la derecha y empuja. Un arreglo fijo que
  // se recorta es lo que hace que la onda **avance** en vez de redibujarse.
  useEffect(() => {
    if (!estado.isRecording) return;
    const db = typeof estado.metering === 'number' ? estado.metering : -60;
    const alto = Math.max(0.06, Math.min(1, (db + 60) / 60));
    setNiveles((n) => [...n, alto].slice(-BARRAS));
  }, [estado.metering, estado.isRecording]);

  useEffect(() => {
    let vivo = true;

    (async () => {
      try {
        const permiso = await requestRecordingPermissionsAsync();
        if (!vivo) return;
        if (!permiso.granted) {
          setError('Sin permiso para usar el micrófono.');
          return;
        }

        // Sin esto, en iOS el micrófono no entra si el teléfono está en
        // silencio — y grabar una nota de voz con el switch en mute es
        // exactamente lo que alguien haría en una conferencia de prensa.
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });

        if (!vivo) return;
        await grabador.prepareToRecordAsync();
        grabador.record();
        arrancado.current = true;
        toque();
      } catch (e) {
        if (vivo) setError(e?.message || 'No se pudo empezar a grabar');
      }
    })();

    return () => {
      vivo = false;
      // Si la hoja se cierra con la grabación viva, se corta: dejar el
      // micrófono tomando después de irse es lo peor que puede hacer una app.
      if (arrancado.current) grabador.stop().catch(() => {});
      setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const confirmar = useCallback(async () => {
    try {
      await grabador.stop();
      arrancado.current = false;

      const uri = grabador.uri;
      if (!uri) throw new Error('La grabación salió vacía');

      // Ya adjuntó una: la pista del visto no vuelve.
      marcarPista(PISTA.GRABAR);
      toque();
      onListo?.({ uri, duracionMs: estado.durationMillis || 0 });
    } catch (e) {
      falla();
      setError(e?.message || 'No se pudo terminar la grabación');
    }
  }, [grabador, estado.durationMillis, onListo, marcarPista]);

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(140)}
      style={{
        marginHorizontal: 22,
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 18,
        backgroundColor: 'rgba(28,43,34,0.06)',
      }}
    >
      {error ? (
        <Text style={{ fontFamily: MONO, fontSize: 12, color: '#B91C1C', lineHeight: 19 }}>
          {error}
        </Text>
      ) : (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {/* Descartar. Lo grabado no se subió todavía, así que irse no deja
                nada atrás. */}
            <Pressable
              onPress={() => {
                roce();
                onCerrar?.();
              }}
              hitSlop={10}
              style={({ pressed }) => ({ opacity: pressed ? 0.4 : 1, padding: 4 })}
              accessibilityRole="button"
              accessibilityLabel="Descartar la grabación"
            >
              <X size={17} color={TENUE} />
            </Pressable>

            {/* La onda. Crece desde la derecha: las barras nuevas empujan a las
                viejas, que es cómo se lee «esto está pasando ahora». */}
            <View
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: 2.5,
                height: 34,
              }}
            >
              {niveles.length === 0 ? (
                <Text style={{ fontFamily: MONO, fontSize: 11, color: TENUE }}>escuchando…</Text>
              ) : (
                niveles.map((h, i) => (
                  <View
                    key={i}
                    style={{
                      flex: 1,
                      height: Math.max(3, 34 * h),
                      borderRadius: 1.5,
                      backgroundColor: INK.title,
                      // Las más viejas se apagan: da sentido de dirección sin
                      // necesidad de una flecha ni de que nada se desplace.
                      opacity: 0.25 + (i / Math.max(niveles.length - 1, 1)) * 0.75,
                    }}
                  />
                ))
              )}
            </View>

            <Text style={{ fontFamily: MONO, fontSize: 11.5, color: INK.title, minWidth: 36 }}>
              {reloj(estado.durationMillis)}
            </Text>

            {/* Listo. Recién acá el archivo sale del temporal y se sube. */}
            <Pressable
              onPress={confirmar}
              disabled={!estado.isRecording}
              hitSlop={10}
              style={({ pressed }) => ({
                width: 34,
                height: 34,
                borderRadius: 17,
                backgroundColor: INK.title,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: !estado.isRecording ? 0.35 : pressed ? 0.7 : 1,
              })}
              accessibilityRole="button"
              accessibilityLabel="Terminar y adjuntar"
            >
              <Check size={16} color="#FFF" />
            </Pressable>
          </View>

          {/* Cómo se adjunta. Una vez y no vuelve: la segunda grabación ya no
              necesita que se lo expliquen. Flota encima del panel en vez de
              sumarle un renglón, para que al apagarse no cambie de alto. */}
          <Pista clave={PISTA.GRABAR} style={{ position: 'absolute', left: 0, right: 0, top: -34 }}>
            Toca el símbolo ✓ para adjuntar la grabación a tu nota
          </Pista>
        </>
      )}
    </Animated.View>
  );
}
