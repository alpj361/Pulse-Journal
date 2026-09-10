import { StyleSheet, View } from 'react-native';
import { Canvas, Fill, FractalNoise } from '@shopify/react-native-skia';

/**
 * Grano de papel sobre el feed.
 *
 * Va como **una sola capa fija sobre todo**, no dentro de cada tarjeta. Esto no
 * es una preferencia: un filtro de ruido dentro de un contenedor que scrollea se
 * repinta en cada frame del scroll, y con veinte tarjetas visibles eso se paga
 * en fps. Fijo y por encima, Skia lo dibuja una vez y no lo vuelve a tocar
 * mientras el contenido se mueve debajo.
 *
 * `FractalNoise` viene nativo en Skia, así que no hay que empaquetar un PNG de
 * ruido ni repetirlo por tile. El ruido sale de color, y una `ColorMatrix` lo
 * pasa a luminancia: el grano de una emulsión no tiene tinte, y el color a esta
 * opacidad se vería como suciedad de pantalla.
 *
 * `pointerEvents: none` es obligatorio — sin eso la capa se come todos los
 * toques del feed.
 */

// Frecuencia alta: grano fino, de película, no manchas. Con valores bajos se ve
// como una textura de estuco.
const FRECUENCIA = 0.85;

/**
 * Sin `ColorMatrix` a propósito.
 *
 * El primer intento envolvía el ruido en `<Group layer={<ColorMatrix/>}>` para
 * pasarlo a luminancia y que el grano no tuviera tinte. Eso hace abortar a Skia:
 * `Recorder::play` termina llamando `back()` sobre un vector de `SkPaint` vacío
 * y el proceso muere con SIGABRT — un `Fill` que ya trae su propio shader hijo
 * dentro de un `Group` con capa deja la pila de paint inconsistente.
 *
 * A 5.5% de opacidad el tinte del ruido de color es imperceptible, así que la
 * conversión no valía un crash.
 */
export default function Grano({ opacidad = 0.055 }) {
  return (
    <View style={[StyleSheet.absoluteFill, { opacity: opacidad }]} pointerEvents="none">
      <Canvas style={{ flex: 1 }}>
        <Fill>
          <FractalNoise freqX={FRECUENCIA} freqY={FRECUENCIA} octaves={3} seed={7} />
        </Fill>
      </Canvas>
    </View>
  );
}
