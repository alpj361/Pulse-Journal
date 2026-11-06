import { Text, View } from 'react-native';
import { INK } from '../theme';
import { COLOR_VOTO } from './diputados';
import { caminoDelDecreto } from './estadoDeLeyes';

const TINTA = '#2F4A7A';
const RAYA = 'rgba(28,43,34,0.12)';
const ROJO = COLOR_VOTO.contra;

/**
 * El estado de una ley o un decreto, en su pill. El veto va en rojo con letra
 * blanca, para que se vea antes que el título; los demás, en gris.
 */
export function PillEstado({ estado, children }) {
  const veto = estado === 'vetado' || /^vetad[ao]$/.test(String(children || ''));
  return (
    <View style={{
      paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999,
      backgroundColor: veto ? ROJO : 'rgba(28,43,34,0.06)',
    }}>
      <Text style={{ fontSize: 11, fontWeight: veto ? '700' : '500', color: veto ? '#FFFFFF' : INK.meta }}>{children}</Text>
    </View>
  );
}

const dia = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('es-GT', { day: 'numeric', month: 'short' });

/**
 * Por dónde va un decreto: aprobado, al Ejecutivo, sancionado (o vetado),
 * publicado y en vigor, en puntos que se llenan. Debajo, en una oración, qué
 * significa el paso en que va. Las fechas que no constan no se escriben.
 */
export default function CaminoDecreto({ eventos, estado, fechaVigencia, style }) {
  const { pasos, actual, vetado, explicacion } = caminoDelDecreto({ eventos, estado, fechaVigencia });
  return (
    <View style={[{ marginTop: 12 }, style]}>
      <View style={{ flexDirection: 'row' }}>
        {pasos.map((p, i) => {
          const esta = i === actual;
          const color = p.veto ? ROJO : p.hecho ? TINTA : 'rgba(28,43,34,0.18)';
          // El tramo que llega a un paso toma su color: tinta si ya pasó, rojo si es el veto.
          const tramo = (j) => (pasos[j]?.hecho ? (pasos[j].veto ? ROJO : TINTA) : RAYA);
          return (
            <View key={p.clave} style={{ flex: 1, alignItems: 'center' }} accessible accessibilityLabel={`${p.nombre}${p.fecha ? `, ${dia(p.fecha)}` : ''}${p.hecho ? '' : ', pendiente'}`}>
              <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', height: 13 }}>
                <View style={{ flex: 1, height: 2, backgroundColor: i === 0 ? 'transparent' : tramo(i) }} />
                <View style={{
                  width: esta ? 13 : 8, height: esta ? 13 : 8, borderRadius: 7,
                  backgroundColor: p.hecho ? color : 'transparent',
                  borderWidth: p.hecho ? 0 : 1.5, borderColor: color,
                }} />
                <View style={{ flex: 1, height: 2, backgroundColor: i === pasos.length - 1 ? 'transparent' : tramo(i + 1) }} />
              </View>
              <Text numberOfLines={1} style={{ fontSize: 10, marginTop: 5, color: p.veto ? ROJO : esta ? TINTA : p.hecho ? INK.meta : INK.faint, fontWeight: esta ? '700' : '400' }}>{p.nombre}</Text>
              {p.fecha ? <Text style={{ fontSize: 9.5, marginTop: 1, color: INK.faint }}>{dia(p.fecha)}</Text> : null}
            </View>
          );
        })}
      </View>
      <Text style={{ fontSize: 12.5, lineHeight: 18, color: vetado ? ROJO : INK.body, marginTop: 10 }}>{explicacion}</Text>
    </View>
  );
}
