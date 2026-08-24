import { Text, View } from 'react-native';
import { inclinacion } from '../codex/Papel';
import { paletaDe, temaDe } from './temas';

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
 */
export default function Pegatina({ categoria, id, style }) {
  const tema = temaDe(categoria);
  const p = paletaDe(categoria);

  return (
    <View
      style={[
        {
          alignSelf: 'flex-start',
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
        },
        style,
      ]}
    >
      <Text style={{ fontSize: 9.5, fontWeight: '800', color: p.tinta, letterSpacing: 0.9 }}>
        {tema.toUpperCase()}
      </Text>
    </View>
  );
}
