import { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { ChevronDown, ChevronUp, Cloud } from 'lucide-react-native';
import GlassCard from '../GlassCard';
import { INK } from '../theme';

/**
 * Lo que cambió en cada versión.
 *
 * Un menú plegado más, como «Uso». Por ahora vacío: cuando haya entradas van en
 * `ENTRADAS`, la más nueva primero.
 */
const ENTRADAS = [];

export default function SeccionChangelog() {
  const [abierto, setAbierto] = useState(false);

  return (
    <View style={{ marginBottom: 24 }}>
      <GlassCard radius={16}>
        <TouchableOpacity
          onPress={() => setAbierto((v) => !v)}
          style={{ flexDirection: 'row', alignItems: 'center', padding: 18, gap: 10 }}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityState={{ expanded: abierto }}
        >
          <Cloud size={17} color={INK.meta} strokeWidth={1.8} />
          <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: INK.title, lineHeight: 20 }}>Changelog</Text>
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
            {ENTRADAS.length ? (
              ENTRADAS.map((e) => (
                <View key={e.version} style={{ marginTop: 16 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: INK.title }}>{e.version}</Text>
                  {e.cambios.map((c, i) => (
                    <Text key={i} style={{ fontSize: 14, color: INK.body, lineHeight: 21, marginTop: 6 }}>
                      {c}
                    </Text>
                  ))}
                </View>
              ))
            ) : (
              <Text style={{ fontSize: 13.5, color: INK.faint, marginTop: 16 }}>Todavía no hay novedades.</Text>
            )}
          </View>
        )}
      </GlassCard>
    </View>
  );
}
