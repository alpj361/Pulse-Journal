import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, Pattern, RadialGradient, Rect, Stop } from 'react-native-svg';

// Paleta base del nuevo fondo claro.
// APP_BG_BOTTOM es el color plano con el que termina el gradiente: la tab bar
// usa ese mismo color para que no se vea costura entre pantalla y navbar.
export const APP_BG_TOP = '#F7F7F4';
export const APP_BG_MID = '#F1F3EE';
export const APP_BG_BOTTOM = '#E9F0E8';

const GRID_SPACING = 78;
const DOT_RADIUS = 1.6;

/**
 * Fondo compartido de la app: gradiente claro + bloom verde suave + grid de puntos.
 * Se monta como capa absoluta al inicio de cada pantalla.
 */
export default function AppBackground({ grid = true, style }) {
  return (
    <View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      <LinearGradient
        colors={[APP_BG_TOP, APP_BG_MID, APP_BG_BOTTOM, APP_BG_BOTTOM]}
        locations={[0, 0.55, 0.85, 1]}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <RadialGradient id="bgBloom" cx="18%" cy="86%" rx="72%" ry="46%">
            <Stop offset="0" stopColor="#8FB597" stopOpacity="0.30" />
            <Stop offset="1" stopColor="#8FB597" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="bgHaze" cx="88%" cy="6%" rx="60%" ry="34%">
            <Stop offset="0" stopColor="#C9C6E0" stopOpacity="0.26" />
            <Stop offset="1" stopColor="#C9C6E0" stopOpacity="0" />
          </RadialGradient>
          <Pattern
            id="bgDots"
            x={GRID_SPACING / 2}
            y={GRID_SPACING / 2}
            width={GRID_SPACING}
            height={GRID_SPACING}
            patternUnits="userSpaceOnUse"
          >
            <Circle
              cx={GRID_SPACING / 2}
              cy={GRID_SPACING / 2}
              r={DOT_RADIUS}
              fill="#AFB3A8"
              opacity={0.45}
            />
          </Pattern>
        </Defs>

        <Rect x="0" y="0" width="100%" height="100%" fill="url(#bgHaze)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#bgBloom)" />
        {grid && <Rect x="0" y="0" width="100%" height="100%" fill="url(#bgDots)" />}
      </Svg>
    </View>
  );
}
