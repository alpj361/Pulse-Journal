import { useRef, useState } from 'react';
import { Dimensions, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Check, ChevronDown } from 'lucide-react-native';
import { CARD_SHADOW, GLASS, INK, RADIUS } from '../theme';
import { MapaGuate, Podio } from './iconosFeed';
import { roce } from '../../utils/haptics';

/**
 * De dónde viene lo que hay que leer: el país entero o el Congreso.
 *
 * Es una pastilla de cristal al lado del título. Cerrada muestra solo el ícono
 * de lo elegido —el mapa de Guatemala o el podio—; abierta, las dos opciones
 * con su nombre. No son pestañas porque no pesan lo mismo: el feed del país es
 * el de siempre, y el del Congreso es una mirada más angosta a la que se entra
 * a propósito.
 */
export const FEEDS = [
  { clave: 'pais', nombre: 'Guatemala', Icono: MapaGuate },
  { clave: 'congreso', nombre: 'Congreso', Icono: Podio },
];

const ANCHO_MENU = 190;

function Cristal({ radio, children, style }) {
  return (
    <View style={[CARD_SHADOW, { borderRadius: radio }, style]}>
      <View style={{ borderRadius: radio, borderWidth: 1, borderColor: GLASS.rim, overflow: 'hidden' }}>
        <BlurView intensity={GLASS.blur} tint="light" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: GLASS.fill }]} />
        {children}
      </View>
    </View>
  );
}

export default function SelectorFeed({ valor, onCambiar }) {
  const ancla = useRef(null);
  const [menu, setMenu] = useState(null); // { top, right } mientras está abierto
  const actual = FEEDS.find((f) => f.clave === valor) || FEEDS[0];

  const abrir = () => {
    roce();
    // El menú va en un Modal para que tocar afuera lo cierre y nada del feed
    // lo tape; por eso hay que saber dónde quedó la pastilla en la pantalla.
    ancla.current?.measureInWindow((x, y, w, h) => {
      setMenu({ top: y + h + 8, right: Math.max(12, Dimensions.get('window').width - (x + w)) });
    });
  };

  const elegir = (clave) => {
    roce();
    setMenu(null);
    if (clave !== valor) onCambiar?.(clave);
  };

  return (
    <>
      <Pressable
        ref={ancla}
        onPress={abrir}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`Mostrando ${actual.nombre}. Cambiar`}
        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
      >
        <Cristal radio={RADIUS.pill}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingLeft: 11, paddingRight: 8, height: 36 }}>
            <actual.Icono size={18} color={INK.title} relleno />
            <ChevronDown size={14} color={INK.meta} strokeWidth={2.4} />
          </View>
        </Cristal>
      </Pressable>

      <Modal visible={!!menu} transparent animationType="none" onRequestClose={() => setMenu(null)}>
        <Pressable style={{ flex: 1 }} onPress={() => setMenu(null)}>
          {menu ? (
            <Animated.View
              entering={ZoomIn.springify().damping(18).stiffness(260).mass(0.6)}
              style={{ position: 'absolute', top: menu.top, right: menu.right, width: ANCHO_MENU, transformOrigin: 'top right' }}
            >
              <Cristal radio={RADIUS.lg}>
                <Animated.View entering={FadeIn.duration(140)} style={{ paddingVertical: 6 }}>
                  {FEEDS.map((f) => {
                    const elegido = f.clave === actual.clave;
                    return (
                      <Pressable
                        key={f.clave}
                        onPress={() => elegir(f.clave)}
                        accessibilityRole="menuitem"
                        accessibilityState={{ selected: elegido }}
                        style={({ pressed }) => ({
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 11,
                          paddingHorizontal: 14,
                          height: 46,
                          backgroundColor: pressed ? 'rgba(28,43,34,0.05)' : 'transparent',
                        })}
                      >
                        <f.Icono size={20} color={elegido ? INK.title : INK.body} relleno={elegido} />
                        <Text style={{ flex: 1, fontSize: 15, fontWeight: elegido ? '700' : '500', color: elegido ? INK.title : INK.body }}>
                          {f.nombre}
                        </Text>
                        {elegido ? <Check size={16} color={INK.title} strokeWidth={2.6} /> : null}
                      </Pressable>
                    );
                  })}
                </Animated.View>
              </Cristal>
            </Animated.View>
          ) : null}
        </Pressable>
      </Modal>
    </>
  );
}
