import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { INK, SERIF } from '../theme';
import PortadaEspacio from '../codex/PortadaEspacio';
import { TYPE_ACCENT } from '../codex/tipos';
import MorphingInfinity from '../MorphingInfinity';
import { espacioDe, quitarRecuerdo } from './api';
import { TIPO_MEMORIA, itemsPorTipo, resumenPlano } from './logica';
import { Ficha } from './SuCodex';
import { ROTULO, TONO } from './piezas';

/**
 * Un Espacio del agente, como se ve uno tuyo en el Codex: su carátula, su
 * historia, lo que recuerda ahí y lo que guardó, ordenado por tipo (actores,
 * entidades, territorios…). Cada cosa se abre en su ficha.
 *
 * Si el backend todavía no da el contenido, se ve lo que trae la lista: la
 * historia y los recuerdos.
 */
export default function EspacioAgente({ colaborador, espacio: deLista, topInset, bottomInset, onVolver, onPedir }) {
  const { width } = useWindowDimensions();
  const queryClient = useQueryClient();
  const [historiaEntera, setHistoriaEntera] = useState(false);
  const [abierto, setAbierto] = useState(null);
  const consulta = useQuery({
    queryKey: ['colab-espacio', colaborador.id, deLista.id],
    queryFn: () => espacioDe(colaborador.id, deLista.id),
    staleTime: 1000 * 60,
    retry: false,
  });
  const datos = consulta.data;
  const e = { ...deLista, ...(datos?.espacio || {}) };
  const recuerdos = datos?.recuerdos || deLista.recuerdos || [];
  const grupos = itemsPorTipo(datos?.items);
  const historia = resumenPlano(e.historia);

  const olvidar = (r) => {
    Alert.alert('¿Que lo olvide?', r.titulo || null, [
      { text: 'cancelar', style: 'cancel' },
      {
        text: 'olvidar',
        style: 'destructive',
        onPress: () =>
          quitarRecuerdo(colaborador.id, r.id).then(
            () => {
              queryClient.invalidateQueries({ queryKey: ['colab-espacio', colaborador.id, deLista.id] });
              queryClient.invalidateQueries({ queryKey: ['colab-espacios', colaborador.id] });
            },
            () => Alert.alert('No se pudo', 'Revisá la conexión y probá de nuevo.')
          ),
      },
    ]);
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingTop: topInset + 10, paddingHorizontal: 20 }}>
        <Pressable
          onPress={onVolver}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Volver a su Codex"
          style={({ pressed }) => ({ width: 44, height: 44, marginLeft: -10, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.5 : 1 })}
        >
          <ChevronLeft size={24} color={INK.title} strokeWidth={2} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: bottomInset + 28, gap: 22 }}>
        <View style={{ gap: 12 }}>
          <PortadaEspacio space={e} radius={22} ancho={width - 40} alto={132} style={{ width: width - 40, height: 132 }} />
          <View style={{ gap: 4 }}>
            <Text style={{ fontFamily: SERIF, fontSize: 30, lineHeight: 34, color: INK.title }} accessibilityRole="header">
              {e.nombre}
            </Text>
            {e.descripcion ? <Text style={{ fontSize: 14, lineHeight: 20, color: INK.body }}>{e.descripcion}</Text> : null}
          </View>
        </View>

        {historia ? (
          <Pressable onPress={() => setHistoriaEntera((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: historiaEntera }} style={{ gap: 6 }}>
            <Text style={ROTULO}>HISTORIA</Text>
            <Text style={{ fontSize: 15, lineHeight: 22, color: INK.title }} numberOfLines={historiaEntera ? undefined : 5}>
              {historia}
            </Text>
            {historia.length > 280 ? (
              <Text style={{ fontSize: 13, fontWeight: '600', color: INK.meta }}>{historiaEntera ? 'leer menos' : 'leer todo'}</Text>
            ) : null}
          </Pressable>
        ) : null}

        {recuerdos.length ? (
          <View style={{ gap: 8 }}>
            <Text style={ROTULO}>LO QUE RECUERDA</Text>
            {recuerdos.map((r) => (
              <Pressable
                key={r.id}
                onLongPress={() => olvidar(r)}
                accessibilityHint="Mantené apretado para que lo olvide"
                style={({ pressed }) => ({ backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: TONO.borde, borderRadius: 14, padding: 14, gap: 4, opacity: pressed ? 0.7 : 1 })}
              >
                <Text style={{ fontSize: 11.5, fontWeight: '700', color: INK.meta }}>{TIPO_MEMORIA[r.tipo] || 'recuerdo'}</Text>
                {r.titulo ? <Text style={{ fontSize: 15, fontWeight: '600', color: INK.title }}>{r.titulo}</Text> : null}
                {r.contenido ? (
                  <Text style={{ fontSize: 13.5, lineHeight: 19, color: INK.body }} numberOfLines={5}>
                    {resumenPlano(r.contenido)}
                  </Text>
                ) : null}
              </Pressable>
            ))}
          </View>
        ) : null}

        {consulta.isLoading ? (
          <MorphingInfinity size={24} color={INK.meta} style={{ alignSelf: 'center', marginVertical: 8 }} />
        ) : null}

        {grupos.map((g) => (
          <Animated.View key={g.tipo} entering={FadeIn.duration(220)} style={{ gap: 8 }}>
            <Text style={[ROTULO, { color: TYPE_ACCENT[g.tipo] || INK.faint }]}>
              {g.titulo.toUpperCase()} · {g.items.length}
            </Text>
            <View style={{ backgroundColor: 'rgba(255,255,255,0.86)', borderWidth: 1, borderColor: 'rgba(28,43,34,0.08)', borderRadius: 16, overflow: 'hidden' }}>
              {g.items.map((it, i) => (
                <Pressable
                  key={`${it.origen_tabla || 'codex'}-${it.id}`}
                  onPress={() => setAbierto(it)}
                  accessibilityRole="button"
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    paddingVertical: 12,
                    paddingHorizontal: 14,
                    borderTopWidth: i ? 1 : 0,
                    borderTopColor: 'rgba(28,43,34,0.06)',
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: INK.title }} numberOfLines={2}>
                      {it.titulo || 'Sin nombre'}
                    </Text>
                    {it.resumen ? (
                      <Text style={{ fontSize: 12.5, lineHeight: 17, color: INK.meta }} numberOfLines={2}>
                        {resumenPlano(it.resumen)}
                      </Text>
                    ) : null}
                  </View>
                  <ChevronRight size={16} color={INK.meta} />
                </Pressable>
              ))}
            </View>
          </Animated.View>
        ))}
      </ScrollView>

      {abierto ? (
        <Ficha
          colaborador={colaborador}
          item={abierto}
          bottomInset={bottomInset}
          onClose={() => setAbierto(null)}
          onPedir={
            onPedir
              ? (texto) => {
                  setAbierto(null);
                  onPedir(texto);
                }
              : null
          }
        />
      ) : null}
    </View>
  );
}
