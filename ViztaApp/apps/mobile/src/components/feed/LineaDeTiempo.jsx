import { useState } from 'react';
import { Linking, Pressable, Text } from 'react-native';
import Animated, { LinearTransition, useReducedMotion } from 'react-native-reanimated';
import { INK, MOTION } from '../theme';
import {
  VISIBLE_INICIAL,
  desarrollosDe,
  etiquetaMedios,
  filaDe,
} from './desarrollos';

const ROTULO = {
  fontSize: 10,
  color: INK.faint,
  fontWeight: '800',
  letterSpacing: 1,
};

function transicionDe(reduceMotion) {
  // Con reduced motion la expansión no se anima: las filas aparecen.
  // El resorte es el mismo de siempre (`MOTION.layout`), no uno nuevo.
  return reduceMotion
    ? LinearTransition.duration(0)
    : LinearTransition.springify()
        .damping(MOTION.layout.damping)
        .stiffness(MOTION.layout.stiffness)
        .mass(MOTION.layout.mass);
}

function Medio({ nombre, url }) {
  if (!nombre) return null;
  const estilo = { color: INK.meta };
  if (!url) return <Text style={estilo}>{nombre}</Text>;
  return (
    <Text
      accessibilityRole="link"
      accessibilityLabel={nombre}
      onPress={() => Linking.openURL(url).catch(() => {})}
      style={{ ...estilo, textDecorationLine: 'underline', textDecorationColor: `${INK.meta}66` }}
    >
      {nombre}
    </Text>
  );
}

function Fila({ entrada, card, index, transicion }) {
  const fila = filaDe(entrada, card, index);
  if (!fila) return null;

  const { hora, texto, medio, url, detalle, corregido, correccion } = fila;
  const trozos = [];
  if (hora) trozos.push({ clave: 'hora', nodo: <Text style={{ color: INK.meta }}>{hora}</Text> });
  if (texto) trozos.push({ clave: 'texto', nodo: texto });
  if (medio) trozos.push({ clave: 'medio', nodo: <Medio nombre={medio} url={url} /> });

  return (
    <Animated.View layout={transicion} style={{ marginTop: index ? 16 : 0 }}>
      {trozos.length ? (
        <Text style={{ fontSize: 14.5, color: INK.body, lineHeight: 22 }}>
          {trozos.map((t, i) => (
            <Text key={t.clave}>
              {i ? ' · ' : null}
              {t.nodo}
            </Text>
          ))}
        </Text>
      ) : null}

      {detalle ? (
        <Text style={{ fontSize: 13.5, color: INK.body, lineHeight: 21, marginTop: 5 }}>
          {detalle}
        </Text>
      ) : null}

      {corregido ? (
        <Text style={{ fontSize: 12, color: INK.meta, marginTop: 6 }}>corregido</Text>
      ) : null}

      {correccion ? (
        <Text style={{ fontSize: 13.5, color: INK.body, lineHeight: 21, marginTop: 3 }}>
          {correccion}
        </Text>
      ) : null}
    </Animated.View>
  );
}

/**
 * Cómo avanzó la historia, debajo del resumen.
 *
 * Si la card no trae desarrollos, no se pinta nada: ni rótulo, ni hueco.
 * Las cuatro más nuevas bastan para barrer; «ver más» abre el resto en
 * la misma ficha, sin saltar a otra pantalla.
 */
export default function LineaDeTiempo({ card }) {
  const reduceMotion = useReducedMotion();
  const [abierta, setAbierta] = useState(false);
  const lista = desarrollosDe(card);
  if (!lista.length) return null;

  const transicion = transicionDe(!!reduceMotion);
  const visibles = abierta ? lista : lista.slice(0, VISIBLE_INICIAL);
  const hayMas = lista.length > VISIBLE_INICIAL;
  const medios = etiquetaMedios(card);

  return (
    <Animated.View layout={transicion} style={{ marginTop: 22 }}>
      <Text style={{ ...ROTULO, marginBottom: medios ? 5 : 12 }}>CÓMO AVANZÓ</Text>
      {medios ? (
        <Text style={{ fontSize: 13, color: INK.meta, marginBottom: 12 }}>{medios}</Text>
      ) : null}

      {visibles.map((entrada, i) => (
        <Fila
          key={entrada.id || `${entrada.ts}-${i}`}
          entrada={entrada}
          card={card}
          index={i}
          transicion={transicion}
        />
      ))}

      {hayMas ? (
        <Pressable
          onPress={() => setAbierta((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={abierta ? 'ver menos' : 'ver más'}
          style={{ marginTop: 14, alignSelf: 'flex-start' }}
        >
          <Text style={{ fontSize: 13, color: INK.meta }}>{abierta ? 'ver menos' : 'ver más'}</Text>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}
