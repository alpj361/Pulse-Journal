import { View, Text } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { INK } from '../theme';
import { MONO } from './mono';
import Pensando from './Pensando';
import RespuestaVizta from './RespuestaVizta';
import TextoMarkdown from './TextoMarkdown';
import { parsear } from './markdown';

/**
 * El filete que marca lo que dijo Vizta.
 *
 * Es la única marca de autoría, y alcanza: tus preguntas van en la tinta de la
 * nota y sus respuestas llevan esta línea al costado, como material citado en
 * un documento. Poner «Vizta:» al lado sería escribir lo que la línea ya dice.
 */
const FILETE = 'rgba(28,43,34,0.16)';

/**
 * La conversación, escrita como documento.
 *
 * No hay burbujas ni columnas alternadas: la hoja crece hacia abajo y se lee de
 * arriba a abajo, igual que la nota que es. Seguir el hilo es seguir
 * escribiendo, y esa es la razón de que esto no sea una pantalla de chat — el
 * gesto de continuar ya existía.
 *
 * Cuando se termina, todo esto se puede guardar como una nota del Codex: una
 * sesión de investigación con Vizta queda como un Snippet, con sus menciones
 * resaltadas. Eso solo es posible porque el hilo *es* texto en una hoja.
 */
export default function HiloVizta({ turnos, pensando, error }) {
  if (!turnos.length && !pensando && !error) return null;

  // Solo el último se escribe a máquina. Los anteriores ya se leyeron, y
  // volverlos a animar en cada render los haría aparecer de nuevo cada vez que
  // se toca una tecla.
  const ultimo = turnos.length - 1;

  return (
    <View style={{ marginBottom: 22 }}>
      {turnos.map((t, i) =>
        t.rol === 'yo' ? (
          <Text
            key={i}
            style={{
              fontFamily: MONO,
              fontSize: 15,
              lineHeight: 27,
              color: INK.title,
              marginTop: i ? 20 : 0,
            }}
          >
            {t.texto}
          </Text>
        ) : (
          <DeVizta key={i}>
            {i === ultimo && t.nueva ? (
              <RespuestaVizta texto={t.texto} />
            ) : (
              // Ya leída: el mismo markdown, sin animación. Volver a animarla en
              // cada render la haría reaparecer con cada tecla que se escribe.
              <TextoMarkdown lineas={parsear(t.texto)} />
            )}
          </DeVizta>
        )
      )}

      {/* Pensando y el error ocupan el lugar de la respuesta, no uno aparte: es
          el turno de Vizta, todavía sin contenido. */}
      {pensando ? (
        <DeVizta>
          <Pensando />
        </DeVizta>
      ) : null}

      {error ? (
        <DeVizta>
          <Text style={{ fontFamily: MONO, fontSize: 12.5, color: '#B91C1C', lineHeight: 21 }}>
            {error}
          </Text>
        </DeVizta>
      ) : null}
    </View>
  );
}

function DeVizta({ children }) {
  return (
    <Animated.View
      entering={FadeIn.duration(220)}
      style={{
        marginTop: 14,
        paddingLeft: 14,
        borderLeftWidth: 2,
        borderLeftColor: FILETE,
      }}
    >
      {children}
    </Animated.View>
  );
}
