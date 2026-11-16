import { useEffect, useRef } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { X } from 'lucide-react-native';

const GLOBO = 'rgba(28,43,34,0.92)';

/**
 * El helper: un globo oscuro con su pico debajo de lo que explica (un paso del
 * camino, una pill). Frases completas; se cierra con la cruz o tocando otra
 * vez lo mismo. `lugar` es dónde cae el pico, de 0 a 1 del ancho.
 * Ver docs/DESIGN.md › Las explicaciones van en helpers.
 */
export default function GloboAyuda({ texto, lugar = 0.1, nota = null, onCerrar }) {
  const aparece = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    aparece.setValue(0);
    Animated.timing(aparece, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  }, [texto, aparece]);
  return (
    <Animated.View style={{ marginTop: 8, opacity: aparece, transform: [{ translateY: aparece.interpolate({ inputRange: [0, 1], outputRange: [-4, 0] }) }] }}>
      <View style={{ position: 'absolute', top: -5, left: `${lugar * 100}%`, marginLeft: -6, width: 12, height: 12, backgroundColor: GLOBO, transform: [{ rotate: '45deg' }] }} />
      <View style={{ backgroundColor: GLOBO, borderRadius: 12, paddingVertical: 11, paddingLeft: 13, paddingRight: 36 }} accessibilityLiveRegion="polite">
        <Text style={{ fontSize: 13, lineHeight: 19, color: '#FFFFFF' }}>{texto}</Text>
        {nota ? <Text style={{ fontSize: 11.5, lineHeight: 16, color: 'rgba(255,255,255,0.68)', marginTop: 6 }}>{nota}</Text> : null}
        <Pressable onPress={onCerrar} hitSlop={12} accessibilityRole="button" accessibilityLabel="Cerrar la ayuda"
          style={{ position: 'absolute', top: 8, right: 8, padding: 4 }}>
          <X size={15} color="rgba(255,255,255,0.75)" />
        </Pressable>
      </View>
    </Animated.View>
  );
}
