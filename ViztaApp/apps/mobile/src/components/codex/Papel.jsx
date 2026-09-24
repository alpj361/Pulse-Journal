import { useState } from 'react';
import { View, Text } from 'react-native';
import Svg, { Line, Path, Rect } from 'react-native-svg';

/**
 * Piezas del lenguaje «papel» del lienzo.
 *
 * La idea que las une: los nodos no son ventanas de software, son recortes de
 * papel sobre una mesa. De ahí la inclinación, la esquina doblada y la etiqueta
 * pegada encima como una calcomanía.
 */

export const PAPEL = '#FFFDF8';
export const PAPEL_DORSO = '#E8E7DD';
export const TINTA = '#14201A';

/**
 * Inclinación estable a partir del id.
 *
 * Tiene que derivarse del id y no de Math.random(): con random, cada render le
 * daría un ángulo nuevo y el lienzo temblaría entero al tocar cualquier cosa.
 * Así el mismo nodo está siempre torcido igual, y dos nodos vecinos no caen en
 * el mismo ángulo.
 */
export function inclinacion(id, max = 2.4) {
  const s = String(id);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (((Math.abs(h) % 1000) / 1000) * 2 - 1) * max;
}

/**
 * Esquina doblada, arriba a la derecha.
 *
 * Geometría del doblez: la esquina se pliega sobre la diagonal, así que el
 * triángulo de arriba-derecha queda vacío (se ve la mesa) y el de abajo-izquierda
 * es el dorso del papel. La tarjeta tiene que llevar `borderTopRightRadius: 0`
 * — una página doblada no tiene esa esquina redondeada.
 */
export function EsquinaDoblada({ size = 20, mesa = 'transparent' }) {
  return (
    <Svg width={size} height={size} style={{ position: 'absolute', right: 0, top: 0 }}>
      {/* El recorte: por acá se ve el lienzo. */}
      <Path d={`M0 0 L${size} 0 L${size} ${size} Z`} fill={mesa} />
      {/* El dorso de la hoja, un tono más apagado que la cara. */}
      <Path d={`M0 0 L${size} ${size} L0 ${size} Z`} fill={PAPEL_DORSO} />
      {/* La bisagra, apenas marcada: sin esta línea el doblez se lee como un
          triángulo de color pegado en la esquina. */}
      <Line x1={0} y1={0} x2={size} y2={size} stroke="rgba(28,43,34,0.13)" strokeWidth={1} />
    </Svg>
  );
}

/**
 * Etiqueta del tipo: píldora de tinta, inclinada, sobresaliendo del borde de la
 * tarjeta. Va encima del papel, no adentro — de ahí que sobresalga.
 */
export function PildoraTipo({ label, punto, rotacion = -4, style }) {
  return (
    <View
      style={[
        {
          alignSelf: 'flex-start',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
          backgroundColor: TINTA,
          borderRadius: 999,
          paddingHorizontal: 9,
          paddingVertical: 3.5,
          transform: [{ rotate: `${rotacion}deg` }],
        },
        style,
      ]}
    >
      {/* El color del tipo se reduce a un punto. Sobre tinta, un texto de color
          saturado se vuelve ilegible; el punto agrupa igual y el texto queda
          blanco, que es lo único que se lee a este tamaño. */}
      {punto ? <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: punto }} /> : null}
      <Text style={{ fontSize: 9, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.7 }}>
        {String(label).toUpperCase()}
      </Text>
    </View>
  );
}

/**
 * Chip de borde punteado.
 *
 * En iOS `borderStyle: 'dashed'` se dibuja sólido cuando hay `borderRadius`, así
 * que el punteado se traza con SVG. El ancho no se sabe hasta que el contenido
 * se mide, así que el borde aparece un frame después — imperceptible, y evita
 * tener que fijar anchos a mano.
 */
export function Punteado({ children, fill, borde, radio = 999, style }) {
  const [caja, setCaja] = useState(null);

  return (
    <View
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        if (!caja || Math.abs(caja.width - width) > 0.5 || Math.abs(caja.height - height) > 0.5) {
          setCaja({ width, height });
        }
      }}
      style={[{ borderRadius: radio, backgroundColor: fill, overflow: 'hidden' }, style]}
    >
      {caja ? (
        <Svg width={caja.width} height={caja.height} style={{ position: 'absolute', left: 0, top: 0 }}>
          <Rect
            x={0.75}
            y={0.75}
            width={Math.max(0, caja.width - 1.5)}
            height={Math.max(0, caja.height - 1.5)}
            rx={radio}
            ry={radio}
            fill="none"
            stroke={borde}
            strokeWidth={1.5}
            strokeDasharray="5 4"
          />
        </Svg>
      ) : null}
      {children}
    </View>
  );
}

