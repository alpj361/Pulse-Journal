import { useEffect, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import GlassCard from '../GlassCard';
import { INK, ACCENT } from '../theme';
import { useUsoStore, refrescarUso } from '../../state/usoStore';

/**
 * Cuánto llevás usado, en tres renglones.
 *
 * Nada de nombres de límites ni periodos: «Posts», «Espacios» y
 * «Almacenamiento», cada uno con su barra. La base ya decide cuáles aplican —a
 * quien no tiene Posts no le aparece esa fila— y de dónde sale cada número.
 *
 * Un área sin tope muestra el número y no una barra: una barra que nunca se
 * llena no dice nada. Los admins tienen los mismos topes que cualquiera.
 */

const NOMBRE = { posts: 'Posts', espacios: 'Espacios', almacenamiento: 'Almacenamiento' };

/** Bytes en algo que se lee de un vistazo. */
function pesa(bytes) {
  const n = Number(bytes) || 0;
  if (n >= 1073741824) return `${(n / 1073741824).toFixed(1)} GB`;
  if (n >= 1048576) return `${Math.round(n / 1048576)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}

const contar = (area) => (area.clave === 'almacenamiento' ? pesa(area.usado) : String(area.usado ?? 0));

export default function SeccionUso() {
  const [abierto, setAbierto] = useState(false);
  const uso = useUsoStore((s) => s.uso);

  useEffect(() => {
    if (abierto) refrescarUso({ forzar: true });
  }, [abierto]);

  const areas = uso?.areas || [];
  // El área más gastada resume el renglón plegado; sin topes, no se resume nada.
  const tope = areas.reduce((alto, a) => (a.porcentaje != null && a.porcentaje > alto ? a.porcentaje : alto), -1);

  return (
    <View style={{ marginBottom: 24 }}>
      <GlassCard radius={16}>
        <TouchableOpacity
          onPress={() => setAbierto((v) => !v)}
          style={{ flexDirection: 'row', alignItems: 'center', padding: 18 }}
          activeOpacity={0.7}
        >
          <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: INK.title, lineHeight: 20 }}>Uso</Text>
          {tope >= 0 ? (
            <Text style={{ fontSize: 13, color: INK.faint, marginRight: 10 }}>{tope}%</Text>
          ) : null}
          {abierto ? <ChevronUp size={17} color={INK.meta} /> : <ChevronDown size={17} color={INK.meta} />}
        </TouchableOpacity>

        {abierto && (
          <View
            style={{
              paddingHorizontal: 18,
              paddingBottom: 18,
              borderTopWidth: 1,
              borderColor: 'rgba(28,43,34,0.08)',
            }}
          >
            {areas.map((area) => (
              <View key={area.clave} style={{ marginTop: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                  <Text style={{ flex: 1, fontSize: 14, color: INK.title }}>{NOMBRE[area.clave] || area.clave}</Text>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: INK.title }}>
                    {area.porcentaje != null ? `${area.porcentaje}%` : contar(area)}
                  </Text>
                </View>

                {area.porcentaje != null ? (
                  <View
                    style={{
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: 'rgba(28,43,34,0.08)',
                      marginTop: 8,
                      overflow: 'hidden',
                    }}
                  >
                    <View
                      style={{
                        width: `${Math.max(2, area.porcentaje)}%`,
                        height: '100%',
                        borderRadius: 3,
                        backgroundColor: area.porcentaje >= 90 ? ACCENT.red.ink : ACCENT.indigo.ink,
                      }}
                    />
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        )}
      </GlassCard>
    </View>
  );
}
