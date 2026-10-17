import { useMemo } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { INK } from '../theme';
import { RAYA } from '../feed/TarjetasCongreso';
import IconoCC from './IconoCC';
import { traerActores } from './observatorio';

/**
 * Los actores públicos que sigue el observatorio, por institución. Cada uno
 * con su cargo y, al tocarlo, la fuente que lo respalda.
 */
function iconoDe(a) {
  const c = `${a.cargo || ''} ${a.institucion || ''}`.toLowerCase();
  if (/diputad/.test(c)) return 'DIPUTADO';
  if (/magistrad|corte|juez/.test(c)) return 'MAGISTRADO';
  if (/fiscal|ministerio p[uú]blico/.test(c)) return 'FISCAL';
  if (/ministr|secretari|presiden|director|gobernador|alcalde/.test(c)) return 'AUTORIDAD';
  return 'PERSONA';
}

export default function ActoresCC() {
  const { data: actores = [], isLoading, error } = useQuery({ queryKey: ['cc-actores'], queryFn: traerActores, staleTime: 6 * 3600e3 });
  const grupos = useMemo(() => {
    const m = new Map();
    for (const a of actores) {
      const k = a.institucion || 'Otros';
      m.set(k, [...(m.get(k) || []), a]);
    }
    return [...m.entries()].sort((x, y) => y[1].length - x[1].length);
  }, [actores]);

  if (isLoading) return <Text style={{ fontSize: 13, color: INK.faint, paddingVertical: 20 }}>Trayendo los actores…</Text>;
  if (error || !actores.length) return <Text style={{ fontSize: 13, color: INK.faint, paddingVertical: 20 }}>No se pudo traer la lista.</Text>;

  return (
    <View style={{ marginTop: 10 }}>
      {grupos.map(([institucion, lista]) => (
        <View key={institucion} style={{ marginTop: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <IconoCC codigo="INSTITUCION" size={26} />
            <Text style={{ flex: 1, fontSize: 12.5, fontWeight: '800', letterSpacing: 0.6, color: INK.title }}>{institucion.toUpperCase()}</Text>
            <Text style={{ fontSize: 12, color: INK.faint }}>{lista.length}</Text>
          </View>
          {lista.map((a, i) => (
            <Pressable
              key={`${a.nombre}-${i}`}
              disabled={!a.fuente_url}
              onPress={() => Linking.openURL(a.fuente_url).catch(() => {})}
              accessibilityRole={a.fuente_url ? 'link' : undefined}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                paddingVertical: 9,
                borderBottomWidth: 1,
                borderBottomColor: RAYA,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <IconoCC codigo={iconoDe(a)} size={30} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, color: INK.title }}>{a.nombre}</Text>
                {a.cargo ? <Text style={{ fontSize: 12, color: INK.faint, marginTop: 1 }}>{a.cargo}</Text> : null}
              </View>
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}
