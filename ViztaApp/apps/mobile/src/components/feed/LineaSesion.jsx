import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { INK } from '../theme';
import GloboAyuda from './GloboAyuda';
import { claveSesion, numeroDeSesion, traerAvisosSesiones } from './avisosSesion';

/** Los avisos de todas las sesiones: una consulta, compartida. */
export function useAvisosSesiones() {
  return useQuery({ queryKey: ['avisos-sesiones'], queryFn: traerAvisosSesiones, staleTime: 10 * 60 * 1000 });
}

/**
 * La línea de una sesión («27 oct 2026 · Sesión ordinaria 54») con sus
 * avisos en pills grises al lado. Al tocar una, su helper explica qué pasa.
 * Sin avisos, queda la línea sola: lo que falta no se anuncia de otra forma.
 */
export default function LineaSesion({ texto, fecha, sesion }) {
  const { data } = useAvisosSesiones();
  const avisos = data?.get(claveSesion(fecha, numeroDeSesion(sesion))) || [];
  const [abierto, setAbierto] = useState(null);
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
        <Text style={{ color: INK.meta, fontSize: 12 }}>{texto}</Text>
        {avisos.map((a, i) => (
          <Pressable key={a.tipo} onPress={() => setAbierto(abierto === i ? null : i)} hitSlop={8}
            accessibilityRole="button" accessibilityState={{ expanded: abierto === i }}
            accessibilityLabel={`${a.pill}. Abre qué significa`}
            style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: abierto === i ? 'rgba(28,43,34,0.14)' : 'rgba(28,43,34,0.06)' }}>
            <Text style={{ fontSize: 11, fontWeight: '500', color: INK.meta }}>{a.pill.toLowerCase()}</Text>
          </Pressable>
        ))}
      </View>
      {abierto !== null && avisos[abierto] ? (
        <GloboAyuda texto={avisos[abierto].texto} lugar={0.5} onCerrar={() => setAbierto(null)} />
      ) : null}
    </View>
  );
}
