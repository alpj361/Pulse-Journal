import { useCallback, useMemo } from 'react';
import { Modal, Pressable, Text, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Minimize2 } from 'lucide-react-native';
import { INK } from '../theme';
import { MONO } from './mono';
import { PAPEL } from './Papel';
import GrafoEspacio from './GrafoEspacio';

// Lo que ocupan arriba el nombre y abajo el pie donde se lee lo tocado.
const CABEZA = 52;
const PIE = 64;

/**
 * El grafo del espacio en toda la pantalla.
 *
 * Es el mismo grafo, con los mismos datos, acomodado otra vez para el lugar
 * que hay: con el doble de alto los racimos se separan y entran más nombres.
 * No se vuelve a pedir nada; solo se recalcula dónde cae cada cosa.
 */
export default function GrafoPantallaCompleta({ visible, espacio, armarPara, onCerrar, ...acciones }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const marco = useMemo(
    () => ({ ancho: width, alto: Math.max(300, height - insets.top - insets.bottom - CABEZA - PIE) }),
    [width, height, insets.top, insets.bottom]
  );
  const grafo = useMemo(() => (visible ? armarPara?.(marco) : null), [visible, armarPara, marco]);
  const armarCon = useCallback((opciones) => armarPara?.(marco, opciones), [armarPara, marco]);

  if (!visible) return null;

  return (
    <Modal visible animationType="fade" onRequestClose={onCerrar} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: PAPEL, paddingTop: insets.top, paddingBottom: insets.bottom }}>
        <View
          style={{
            height: CABEZA,
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 24,
            gap: 12,
          }}
        >
          <Text numberOfLines={1} style={{ flex: 1, fontFamily: MONO, fontSize: 15, color: INK.title }}>
            {espacio?.name}
          </Text>
          <Pressable
            onPress={onCerrar}
            hitSlop={10}
            style={({ pressed }) => ({ padding: 6, opacity: pressed ? 0.5 : 1 })}
            accessibilityRole="button"
            accessibilityLabel="Salir de la pantalla completa"
          >
            <Minimize2 size={18} color="rgba(28,43,34,0.55)" />
          </Pressable>
        </View>

        <Animated.View entering={FadeIn.duration(260)} style={{ flex: 1 }}>
          <GrafoEspacio
            grafo={grafo}
            ancho={marco.ancho}
            alto={marco.alto}
            cargando={!grafo}
            armarCon={armarCon}
            // Acá un dedo no desplaza nada: orbita en 3D.
            orbitar
            {...acciones}
          />
        </Animated.View>
      </View>
    </Modal>
  );
}
