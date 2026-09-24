import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import { Check, X } from 'lucide-react-native';
import { INK, ACCENT, RADIUS } from '../theme';
import { MONO } from '../codex/mono';
import usePortada from '../../utils/portada';
import { supabase } from '../../utils/supabase';
import { roce, toque, falla } from '../../utils/haptics';
import {
  confirmarHablante,
  descartarHablante,
  useReconocimientoDisponible,
} from '../../utils/reconocimientoRostros';

/**
 * Quién habla en el video — la sugerencia, y lo confirmado.
 *
 * Va debajo del autor porque es la misma clase de dato: quién publicó y quién
 * está a cámara. Cuando la cuenta es de un grupo, esas dos respuestas son
 * distintas, y esta tarjeta es la segunda.
 *
 * **Es una pregunta, no una afirmación.** «¿Habla Patricia Orantes?», con su
 * foto del Codex al lado para que la comparación la haga el ojo de quien lee.
 * El número de similitud no se muestra: siempre está por encima de 95, así que
 * no ayuda a decidir, y convertiría una pregunta en un veredicto.
 *
 * Tres estados, y ninguno más:
 *   · sugerido   → la tarjeta con «Sí, es» y «No es».
 *   · confirmado → una línea: «habla · Patricia Orantes», que abre su ficha.
 *   · lo demás   → nada. Un «no se pudo reconocer» no le sirve a nadie.
 *
 * Todo depende del feature flag: si se apaga, esto no se dibuja, aunque el post
 * tenga una sugerencia guardada.
 */
export default function SugerenciaHablante({ post, hablante, reconocimiento, onAbrirActor, onActualizado }) {
  const disponible = useReconocimientoDisponible();
  const [actor, setActor] = useState(null);
  const [ocupado, setOcupado] = useState(null); // 'si' | 'no'
  const [error, setError] = useState(null);

  const sugerido = reconocimiento?.estado === 'sugerido' ? reconocimiento.sugerencia : null;
  const confirmado = hablante?.confirmado && hablante?.actor_id ? hablante : null;
  const actorId = sugerido?.actor_id || null;

  // La foto del actor sugerido, para comparar a ojo.
  useEffect(() => {
    if (!disponible || !actorId) return setActor(null);
    let vivo = true;
    supabase
      .from('codex_universe_items')
      .select('id, name, thumbnail_url, details')
      .eq('id', actorId)
      .maybeSingle()
      .then(({ data }) => vivo && setActor(data || null));
    return () => {
      vivo = false;
    };
  }, [disponible, actorId]);

  const foto = usePortada(actor);

  if (!disponible) return null;

  if (confirmado) {
    return (
      <Animated.View entering={FadeIn.duration(220)} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
        <Text style={{ fontFamily: MONO, fontSize: 11.5, color: 'rgba(28,43,34,0.4)' }}>habla · </Text>
        <Pressable
          onPress={() => {
            roce();
            onAbrirActor?.(confirmado.actor_id);
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Habla ${confirmado.nombre}. Abrir su ficha`}
        >
          <Text style={{ fontFamily: MONO, fontSize: 11.5, color: ACCENT.indigo.ink }}>{confirmado.nombre}</Text>
        </Pressable>
      </Animated.View>
    );
  }

  if (!sugerido) return null;

  const resolver = async (cual) => {
    if (ocupado) return;
    setOcupado(cual);
    setError(null);
    try {
      const details =
        cual === 'si'
          ? await confirmarHablante(post, reconocimiento, hablante)
          : await descartarHablante(post, reconocimiento);
      cual === 'si' ? toque() : roce();
      onActualizado?.(details);
    } catch {
      falla();
      setError('No se pudo guardar. Probá de nuevo.');
    } finally {
      setOcupado(null);
    }
  };

  return (
    <Animated.View
      entering={FadeInDown.springify().damping(20).stiffness(220)}
      exiting={FadeOut.duration(160)}
      layout={LinearTransition.springify().damping(22)}
      style={{
        marginTop: 14,
        padding: 14,
        borderRadius: RADIUS.md,
        backgroundColor: ACCENT.indigo.tint,
        borderWidth: 1,
        borderColor: 'rgba(75,79,166,0.14)',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View
          style={{
            width: 46,
            height: 46,
            borderRadius: 23,
            overflow: 'hidden',
            backgroundColor: 'rgba(75,79,166,0.12)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {foto ? (
            <Image source={{ uri: foto }} style={{ width: 46, height: 46 }} contentFit="cover" />
          ) : (
            <Text style={{ fontSize: 17, fontWeight: '700', color: ACCENT.indigo.ink }}>
              {(sugerido.actor_nombre || '?').trim().charAt(0).toUpperCase()}
            </Text>
          )}
        </View>

        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
            <Text style={{ flexShrink: 1, fontSize: 15, fontWeight: '600', color: INK.title }}>
              ¿Habla {sugerido.actor_nombre}?
            </Text>
            <Text style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: 0.4, color: ACCENT.indigo.ink }}>BETA</Text>
          </View>
          <Text style={{ fontSize: 12.5, color: INK.meta, marginTop: 2 }}>Se parece a su foto en tu Codex.</Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
        <Boton
          Icono={Check}
          texto="Sí, es"
          principal
          cargando={ocupado === 'si'}
          onPress={() => resolver('si')}
        />
        <Boton Icono={X} texto="No es" cargando={ocupado === 'no'} onPress={() => resolver('no')} />
      </View>

      {error ? <Text style={{ fontSize: 12, color: '#B91C1C', marginTop: 8 }}>{error}</Text> : null}
    </Animated.View>
  );
}

function Boton({ Icono, texto, principal, cargando, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={cargando}
      accessibilityRole="button"
      accessibilityLabel={texto}
      style={({ pressed }) => ({
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        borderRadius: RADIUS.sm,
        backgroundColor: principal ? ACCENT.indigo.ink : 'rgba(255,255,255,0.7)',
        opacity: cargando ? 0.55 : pressed ? 0.8 : 1,
      })}
    >
      <Icono size={14} color={principal ? '#FFFFFF' : INK.body} />
      <Text style={{ fontSize: 13.5, fontWeight: '600', color: principal ? '#FFFFFF' : INK.body }}>{texto}</Text>
    </Pressable>
  );
}
