import { StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { CARD_SHADOW, GLASS } from './theme';

export const cardBase = {
  borderRadius: 20,
  borderWidth: 1,
  borderColor: GLASS.rim,
  overflow: 'hidden',
  backgroundColor: 'transparent',
};

/**
 * Card de cristal sobre el fondo claro: blur real del fondo (se ve el grid de
 * puntos difuminado detrás), velo lechoso encima, y sombra en un wrapper
 * externo — la sombra no puede vivir en la misma View que `overflow: hidden`
 * porque iOS la recorta.
 *
 * · `wash`   tinte de color sobre el cristal (acento de categoría, estado…)
 * · `accent` filete vertical de 3px en el borde izquierdo
 */
export default function GlassCard({ children, style, radius = 20, accent, wash, shadow = true }) {
  return (
    <View style={[shadow && CARD_SHADOW, { borderRadius: radius }, style]}>
      <View style={[cardBase, { borderRadius: radius }]}>
        <BlurView intensity={GLASS.blur} tint="light" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: GLASS.fill }]} />
        {wash ? <View style={[StyleSheet.absoluteFill, { backgroundColor: wash }]} /> : null}
        {accent ? (
          <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: accent }} />
        ) : null}
        {children}
      </View>
    </View>
  );
}
