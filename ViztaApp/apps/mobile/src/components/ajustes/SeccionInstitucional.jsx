import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowUpRight, Landmark, Scale } from 'lucide-react-native';
import GlassCard from '../GlassCard';
import { INK } from '../theme';
import { COPY } from '../congreso/copy';
import { SECCION } from '../congreso/estilos';

/**
 * Congreso y CC en Ajustes: destinos públicos, no un privilegio de cuenta.
 *
 * El resto de esta pantalla habla de la sesión. Estas dos filas no: cualquiera
 * puede leer iniciativas y resoluciones, así que no viven dentro del recuadro
 * de «en la app tienes acceso a».
 */
const DESTINOS = [
  { clave: 'congreso', ruta: '/congreso', texto: COPY.congreso.titulo, Icono: Landmark },
  { clave: 'cc', ruta: '/cc', texto: COPY.cc.titulo, Icono: Scale },
];

export default function SeccionInstitucional() {
  const router = useRouter();

  return (
    <View style={{ marginBottom: 24 }}>
      <Text style={{ fontSize: 12, color: INK.meta, fontWeight: '700', letterSpacing: 0.5, marginBottom: 12 }}>
        INSTITUCIONAL
      </Text>
      <GlassCard radius={16}>
        <View style={{ paddingHorizontal: 18, paddingVertical: 6 }}>
          {DESTINOS.map((d, i) => {
            const tinta = SECCION[d.clave].tinta;
            return (
              <Pressable
                key={d.clave}
                onPress={() => router.push(d.ruta)}
                accessibilityRole="button"
                accessibilityLabel={d.texto}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  minHeight: 48,
                  gap: 10,
                  opacity: pressed ? 0.6 : 1,
                  borderTopWidth: i ? 1 : 0,
                  borderTopColor: 'rgba(28,43,34,0.07)',
                })}
              >
                <d.Icono size={16} color={tinta} strokeWidth={2} />
                <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: INK.title }}>{d.texto}</Text>
                <ArrowUpRight size={15} color={INK.faint} />
              </Pressable>
            );
          })}
        </View>
      </GlassCard>
    </View>
  );
}
