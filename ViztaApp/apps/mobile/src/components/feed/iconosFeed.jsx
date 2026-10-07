import Svg, { Path, Rect } from 'react-native-svg';
import { INK } from '../theme';

/**
 * Los dos íconos del selector del feed. Van dibujados acá y no salen de la
 * librería de íconos porque ninguno existe ahí: un mapa de Guatemala y un podio.
 */

/** Guatemala en miniatura: el Petén arriba, Izabal asomando al este, la costa sur. */
export function MapaGuate({ size = 18, color = INK.title, relleno = false }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        // El Petén cuadrado arriba, el escalón con México, Izabal al este y la
        // costa del Pacífico en diagonal: lo que hace que se lea como Guatemala.
        d="M9.6 2.2h7.8v6.4l3.4.7.8 1-2.4 2 .4 2-2.4 3-2 2.6-5.2-.6-4.8-1.6-2.6-2.4 1-3.4 2.6-.6 1.4-2.2h2z"
        fill={relleno ? color : 'none'}
        fillOpacity={relleno ? 0.14 : 0}
        stroke={color}
        strokeWidth={1.6}
        strokeLinejoin="miter"
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Un podio: de ahí habla el Congreso. Tres escalones, el del medio más alto. */
export function Podio({ size = 18, color = INK.title, relleno = false }) {
  const f = relleno ? color : 'none';
  const o = relleno ? 0.14 : 0;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x={8.6} y={6} width={6.8} height={14.4} rx={1.2} fill={f} fillOpacity={o} stroke={color} strokeWidth={1.7} strokeLinejoin="round" />
      <Rect x={2.4} y={11.4} width={6.2} height={9} rx={1.2} fill={f} fillOpacity={o} stroke={color} strokeWidth={1.7} strokeLinejoin="round" />
      <Rect x={15.4} y={14.2} width={6.2} height={6.2} rx={1.2} fill={f} fillOpacity={o} stroke={color} strokeWidth={1.7} strokeLinejoin="round" />
    </Svg>
  );
}
