import { View, Text } from 'react-native';
import { INK } from '../theme';
import { fuentesDe, narrativasDe, divergenciaDe } from './encuadres';

const ALERTA = '#B45309';
const TENUE = 'rgba(28,43,34,0.38)';
const FILETE = 'rgba(28,43,34,0.12)';

function Rotulo({ children }) {
  return (
    <Text
      style={{
        fontSize: 10,
        color: INK.faint,
        fontWeight: '800',
        letterSpacing: 1,
        marginBottom: 12,
      }}
    >
      {children}
    </Text>
  );
}

/**
 * Cómo se está contando la historia.
 *
 * Es la capa de medios del análisis: si las fuentes coinciden y qué narrativas
 * compiten. Va en el detalle y no en el feed porque es material de lectura — el
 * feed solo se gana la línea de si las fuentes divergen.
 *
 * **Todo lo que dice es de la historia entera, no de un tweet.** `divergencia`
 * y `narrativas` describen la cobertura completa, así que esto va arriba, junto
 * a las otras secciones de ese nivel —y pegado a `PERSPECTIVAS`, que responde
 * lo mismo sin fuentes—. Lo que **sí** es por tweet es el `encuadre`, y ese vive
 * abajo, bajo el texto de cada uno en `FUENTES`. Cada capa con su granularidad.
 *
 * **Quiénes cubrieron la historia no se enumera acá.** Eso lo dice `FUENTES`,
 * con el texto de cada tweet. Esta sección responde otra pregunta —cómo lo
 * contaron— y repetir la lista solo la alejaba de su respuesta.
 *
 * **Devuelve `null` cuando la historia tiene una sola casa editorial.** No una
 * sección vacía: con una fuente no hay nada que contrastar, y mostrar el hueco
 * donde iría el análisis se lee como que algo falló.
 *
 * Lo que **no** está acá es la visualización de espectro. En la primera corrida
 * con estos campos, los 6 encuadres con postura de las 9 cards eran todos
 * `Institucional` — los dos ejes reales (Oficialista↔Crítico del poder,
 * Conservador↔Progresista) quedaron vacíos. Un gráfico de dispersión sin
 * dispersión no dice «equilibrado», dice nada, y ocupa el lugar de lo que sí
 * tiene datos. Cuando aparezca la dispersión, este es el lugar.
 */
export default function MediosNoticia({ card }) {
  // Solo la compuerta: las casas se enumeran en `FUENTES`, al pie de la ficha.
  if (!fuentesDe(card).contrastada) return null;

  const narrativas = narrativasDe(card);
  const d = divergenciaDe(card);

  // Ver el bloque de narrativas: el respaldo solo se gana su lugar cuando hay
  // algo que dirimir.
  const conRespaldo = d.estado === 'divergen';

  return (
    <View style={{ marginTop: 24 }}>
      <Rotulo>CÓMO SE CUENTA</Rotulo>

      {/* Si coinciden, y **nada más**: la lista de casas no va acá.

          Estaba, y era redundante por partida doble. `FUENTES`, al pie de la
          ficha, ya enumera quién cubrió la historia con el texto de cada tweet;
          y cuando hay una sola narrativa, sus casas son todas las casas, así
          que la misma lista aparecía otra vez cuatro líneas más abajo. Tres
          veces el mismo dato en una pantalla.

          Sin ella, esto arranca con lo único que la sección afirma —si las
          fuentes coinciden— y en cuerpo de lectura, no de pie de página. Antes
          iba en 12.5 tenue debajo de la lista y se leía como una aclaración al
          margen; es el hallazgo, y ahora abre.

          El estado `desconocido` sigue sin escribirse: significa que el
          análisis no corrió, y decir «no se sabe si coinciden» es ruido sobre
          algo que nadie intentó averiguar. */}
      {d.estado === 'divergen' ? (
        <>
          <Text style={{ fontSize: 14.5, color: ALERTA, lineHeight: 22 }}>
            Las fuentes no coinciden.
          </Text>
          {/* El en_qué va en su propia línea y no pegado a la anterior: el campo
              llega como oración entera —«Los tweets difieren entre el
              trámite…»—, así que meterlo detrás de «no coinciden en» armaba un
              engendro. Suelto se lee como lo que es: la explicación. */}
          {d.enQue ? (
            <Text style={{ fontSize: 13.5, color: INK.body, lineHeight: 21, marginTop: 5 }}>
              {d.enQue}
            </Text>
          ) : null}
        </>
      ) : d.estado === 'coinciden' ? (
        <Text style={{ fontSize: 14.5, color: INK.body, lineHeight: 22 }}>
          Las fuentes coinciden en los hechos.
        </Text>
      ) : null}

      {/* Las narrativas en competencia.

          El respaldo de cada una —quién la sostiene y la cita que la prueba—
          se muestra **solo cuando las fuentes divergen**. Ahí es el punto
          entero: si dos casas cuentan cosas distintas, saber cuál sostiene qué
          y con qué evidencia *es* la información.

          Cuando coinciden en los hechos, las narrativas son maneras de contar
          lo mismo, y respaldar cada una es ceremonia: la cita sale textual del
          tweet que `FUENTES` muestra entero cuatro dedos más abajo, y las casas
          son las mismas de esa lista. Queda la narrativa sola, que es lo único
          que esta sección aporta sobre lo que ya está. */}
      {narrativas.length > 0 ? (
        <View style={{ marginTop: 14 }}>
          {narrativas.map((n, i) => (
            <View
              key={i}
              style={{
                marginTop: i ? 16 : 0,
                paddingLeft: 13,
                borderLeftWidth: 2,
                borderLeftColor: FILETE,
              }}
            >
              <Text style={{ fontSize: 14.5, color: INK.body, lineHeight: 22 }}>
                {n.narrativa}
              </Text>

              {conRespaldo && n.casas.length > 0 ? (
                <Text style={{ fontSize: 11.5, color: TENUE, marginTop: 5 }}>
                  {n.casas.join(', ')}
                </Text>
              ) : null}

              {/* La cita que sostiene la narrativa. En cursiva y más chica:
                  es material de respaldo, no la afirmación. */}
              {conRespaldo && n.evidencia ? (
                <Text
                  style={{
                    fontSize: 12.5,
                    color: TENUE,
                    lineHeight: 20,
                    marginTop: 6,
                    fontStyle: 'italic',
                  }}
                >
                  «{n.evidencia}»
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/**
 * La marca de un tweet: su postura y su lenguaje.
 *
 * Va **sobre el texto del tweet, nunca al lado del handle**, y esa colocación
 * es una restricción del dato, no una preferencia visual: el espectro describe
 * *ese tweet*, no la ideología del medio. Un mismo medio puede salir
 * Institucional en una card y Empresarial en otra. Pegada a la cuenta, la
 * interfaz afirmaría «este medio es Institucional», que es exactamente lo que
 * el dato no dice.
 */
export function MarcaTweet({ marca }) {
  if (!marca) return null;

  const partes = [marca.espectro, marca.lenguaje].filter(Boolean);

  return (
    <Text style={{ fontSize: 11, color: TENUE, marginTop: 7, letterSpacing: 0.1 }}>
      {partes.join(' · ')}
    </Text>
  );
}
