import { useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react-native';
import { INK } from '../theme';
import { compartidosCon } from './api';
import { Cara } from './Elemento';
import { claveTipo, nombreTipo } from './logica';
import { Boton, EstadoCentro, TONO, Refrescar } from './piezas';
import MorphingInfinity from '../MorphingInfinity';

const PARTES = [
  { clave: 'codex', texto: 'Codex' },
  { clave: 'monitoreos', texto: 'Monitoreos' },
];

/** El tipo de una fila compartida, como lo dibuja el Codex. */
const tipoDe = (f) => {
  const t = String(f.tipo || f.recurso_tipo || '').toLowerCase();
  if (['artifact', 'dashboard'].includes(t)) return 'dashboard';
  if (['seguimiento', 'monitor'].includes(t)) return 'seguimiento';
  return t || 'ítem';
};

/**
 * Lo que se compartieron con una persona, en los dos sentidos: lo del Codex
 * (ítems, notas, posts, dashboards) y los monitoreos. Todo se abre en lectura.
 */
export default function Compartido({ colaborador, bottomInset = 0, onAbrirItem, onAbrirArtifact, onAbrirMonitoreo }) {
  const [parte, setParte] = useState('codex');
  const consulta = useQuery({
    queryKey: ['colab-compartido', colaborador.cuenta_id],
    queryFn: () => compartidosCon(colaborador.cuenta_id),
    staleTime: 1000 * 30,
    retry: false,
  });
  const filas = useMemo(() => {
    // Un agente compartido no es algo que se abra acá: es un contacto, y ya está en la lista.
    const todas = (consulta.data || []).filter((f) => !['agente', 'contacto'].includes(String(f.tipo || f.recurso_tipo)));
    const de = (c) => todas.filter((f) => (f.categoria || (tipoDe(f) === 'seguimiento' ? 'monitoreos' : 'codex')) === c);
    return { codex: de('codex'), monitoreos: de('monitoreos') };
  }, [consulta.data]);

  const abrir = (f) => {
    const t = tipoDe(f);
    const ajeno = f.direccion !== 'enviado';
    if (t === 'dashboard') return onAbrirArtifact?.(f.recurso_id);
    if (t === 'seguimiento') return onAbrirMonitoreo?.(f.recurso_id);
    return onAbrirItem?.(f.recurso_id, ajeno);
  };

  if (consulta.isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <MorphingInfinity size={28} color={INK.meta} />
      </View>
    );
  }
  if (consulta.error) {
    return (
      <EstadoCentro titulo="No se pudo traer lo compartido" texto="Revisá la conexión y probá de nuevo.">
        <Boton texto="probar de nuevo" onPress={() => consulta.refetch()} />
      </EstadoCentro>
    );
  }

  const lista = filas[parte];
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 20, paddingTop: 14 }}>
        {PARTES.map((p) => {
          const activo = p.clave === parte;
          return (
            <Pressable
              key={p.clave}
              onPress={() => setParte(p.clave)}
              accessibilityRole="tab"
              accessibilityState={{ selected: activo }}
              style={{
                height: 32,
                paddingHorizontal: 13,
                borderRadius: 16,
                justifyContent: 'center',
                backgroundColor: activo ? INK.title : 'transparent',
                borderWidth: activo ? 0 : 1,
                borderColor: TONO.borde,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: activo ? '#FFFFFF' : INK.body }}>
                {filas[p.clave].length ? `${p.texto} · ${filas[p.clave].length}` : p.texto}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <FlatList
        data={lista}
        keyExtractor={(f) => f.id}
        contentContainerStyle={{ padding: 20, paddingBottom: bottomInset + 24, gap: 2, flexGrow: 1 }}
        refreshControl={<Refrescar onRefresh={consulta.refetch} />}
        ListEmptyComponent={
          <Text style={{ fontSize: 14, color: INK.body, textAlign: 'center', marginTop: 40 }}>
            {parte === 'codex' ? 'Lo que se manden del Codex aparece acá.' : 'Los monitoreos que se manden aparecen acá.'}
          </Text>
        }
        renderItem={({ item: f }) => {
          const tipo = tipoDe(f);
          const clave = tipo === 'seguimiento' ? 'seguimiento' : claveTipo({ tipo });
          return (
            <Pressable
              onPress={() => abrir(f)}
              accessibilityRole="button"
              accessibilityLabel={`${f.titulo || 'Sin título'}, ${nombreTipo(clave)}`}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, opacity: pressed ? 0.6 : 1 })}
            >
              <Cara item={{ tipo: clave }} imagen={f.imagen || f.thumbnail_url} size={40} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: INK.title }} numberOfLines={2}>
                  {f.titulo || 'Sin título'}
                </Text>
                <Text style={{ fontSize: 12, color: INK.meta }} numberOfLines={1}>
                  {[nombreTipo(clave), f.direccion === 'enviado' ? 'lo mandaste' : null].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <ChevronRight size={16} color={INK.meta} />
            </Pressable>
          );
        }}
      />
    </View>
  );
}
