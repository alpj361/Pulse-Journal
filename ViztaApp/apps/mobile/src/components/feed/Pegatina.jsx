import { Text, View } from 'react-native';
import { inclinacion } from '../codex/Papel';
import Sticker from '../Sticker';
import { normalizarTema, paletaDe, temaDe } from './temas';

/**
 * La categoría, como una etiqueta de papel pegada.
 *
 * Reemplaza al «• VIOLENCIA» que había antes. El punto de color al lado de una
 * palabra en versalitas es uno de los tics más repetidos de interfaz generada:
 * no aporta nada que el color del texto no diga ya, y aparece idéntico en
 * cientos de apps.
 *
 * Una pegatina, en cambio, pertenece al mundo de papel del resto del feed — la
 * portada es un collage, esto es la etiqueta que alguien le pegó encima.
 *
 * Tres detalles la hacen leer como pegada y no como un rectángulo de color:
 *
 *  · **Está torcida.** El ángulo sale de `inclinacion(id)`, un hash estable:
 *    con `Math.random()` cambiaría en cada render y la lista temblaría al
 *    scrollear. Cada nota tiene su ángulo, siempre el mismo.
 *  · **Esquinas casi rectas.** Una pegatina se corta con tijera; un radio
 *    grande la convertiría en la píldora de siempre.
 *  · **Sombra corta y pegada.** Una sombra difusa la haría flotar. Esta la
 *    apoya sobre la página.
 *
 * A su lado va el sticker del tema: cada categoría tiene el suyo —la urna de
 * Política, el bus de Movilidad—, y es lo que deja reconocerla al bajar por el
 * feed antes de leer la palabra. Va torcido para el otro lado, como dos cosas
 * pegadas a mano y no una sola pieza.
 */
// A menos de 32 puntos los stickers pierden el detalle.
const TAMANO_STICKER = 36;

export default function Pegatina({ categoria, sticker, id, style }) {
  const tema = temaDe(categoria);
  const p = paletaDe(categoria);

  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 7 }, style]}>
      <Sticker
        nombre={sticker || normalizarTema(tema)}
        size={TAMANO_STICKER}
        style={{ marginVertical: -4, transform: [{ rotate: `${-inclinacion(`${id || tema}-stk`, 5)}deg` }] }}
      />
      <View
        style={{
          backgroundColor: p.lavado[1],
          borderRadius: 2.5,
          paddingHorizontal: 8,
          paddingVertical: 3.5,
          transform: [{ rotate: `${inclinacion(`${id || tema}-peg`, 2.6)}deg` }],
          shadowColor: '#1E3326',
          shadowOpacity: 0.13,
          shadowRadius: 2,
          shadowOffset: { width: 0, height: 1.5 },
          elevation: 2,
        }}
      >
        <Text style={{ fontSize: 9.5, fontWeight: '800', color: p.tinta, letterSpacing: 0.9 }}>
          {tema.toUpperCase()}
        </Text>
      </View>
    </View>
  );
}
