import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react-native';
import { INK, RADIUS, SERIF } from '../theme';
import { MONO } from '../codex/mono';
import { PAPEL } from '../codex/Papel';
import { supabase } from '../../utils/supabase';
import { roce } from '../../utils/haptics';

/**
 * El tráfico, tramo por tramo.
 *
 * El mapa dice dónde está cargado; esta hoja dice cuánto. De cada tramo: lo que
 * tarda ahora, cuánto más que cuando va libre, y —cuando ya hay historia de esa
 * hora— si hoy va peor o mejor que de costumbre. Debajo, cómo vino en el día.
 *
 * Los tiempos son de Apple Maps para la ruta más rápida entre los dos puntos.
 * «Libre» y «de costumbre» salen de lo que cada tramo midió antes, no de Apple.
 * Nada de esto sabe por qué hay demora.
 */

export const COLOR_TRAFICO = {
  fluido: '#15803D',
  lento: '#D97706',
  pesado: '#EA580C',
  detenido: '#B91C1C',
  sin_dato: 'rgba(28,43,34,0.35)',
};

// Los mismos cortes que la vista `trafico_ahora`.
const nivelDe = (razon) => (razon < 1.3 ? 'fluido' : razon < 1.7 ? 'lento' : razon < 2.4 ? 'pesado' : 'detenido');

const minutos = (s) => Math.round(s / 60);

/** «hace 4 min», o la hora si ya pasó un rato. */
export function hace(iso) {
  if (!iso) return null;
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return m < 2 ? 'medido recién' : `medido hace ${m} min`;
}

/**
 * @param tramos  lo que ya trae el mapa de `trafico_ahora`
 * @param onIr    llevar el mapa a un tramo
 */
export default function TraficoSheet({ tramos, onClose, onIr, topInset = 0, bottomInset = 0 }) {
  // Cómo vino cada tramo hoy: las mediciones desde la madrugada de Guatemala.
  const { data: delDia } = useQuery({
    queryKey: ['trafico-del-dia'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      // Medianoche de Guatemala (UTC−6), en UTC.
      const ahora = new Date();
      const gt = new Date(ahora.getTime() - 6 * 3600 * 1000);
      const inicio = new Date(Date.UTC(gt.getUTCFullYear(), gt.getUTCMonth(), gt.getUTCDate(), 6));
      const { data, error } = await supabase
        .from('trafico_muestras')
        .select('tramo_id, medido_en, con_trafico_s')
        .gte('medido_en', inicio.toISOString())
        .order('medido_en', { ascending: true })
        .limit(2000);
      if (error) throw error;
      const por = new Map();
      for (const m of data || []) {
        if (!por.has(m.tramo_id)) por.set(m.tramo_id, []);
        por.get(m.tramo_id).push(m);
      }
      return por;
    },
  });

  // La ciudad y las carreteras son dos preguntas distintas —cómo llego al
  // trabajo, cómo está la ruta a Xela— y mezcladas en una lista de cincuenta
  // tramos ninguna se contesta. Se abre en la ciudad, que es la de todos los días.
  const [ambito, setAmbito] = useState('ciudad');
  const hayPais = (tramos || []).some((t) => t.ambito === 'pais');

  // Los más cargados arriba; los que no tienen medición, al final.
  const orden = useMemo(
    () =>
      (tramos || [])
        .filter((t) => (t.ambito || 'ciudad') === ambito)
        .sort((a, b) => (Number(b.razon) || 0) - (Number(a.razon) || 0)),
    [tramos, ambito]
  );
  const medidos = orden.filter((t) => t.nivel);
  const cargados = medidos.filter((t) => t.nivel === 'pesado' || t.nivel === 'detenido').length;
  const medido = medidos.find((t) => t.medido_en)?.medido_en || null;

  const titular = !medidos.length
    ? 'Sin medición reciente'
    : cargados === 0
      ? 'Todo va con normalidad'
      : cargados === 1
        ? 'Un tramo va cargado'
        : `${cargados} de ${medidos.length} tramos van cargados`;

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: PAPEL }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 16, paddingHorizontal: 18 }}>
          <Text style={{ flex: 1, fontFamily: MONO, fontSize: 12, color: INK.faint, paddingLeft: 12 }}>tráfico</Text>
          <Pressable onPress={onClose} hitSlop={12} style={{ padding: 6 }} accessibilityRole="button" accessibilityLabel="Cerrar">
            <X size={19} color={INK.faint} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 30, paddingTop: 10, paddingBottom: bottomInset + 40 }} showsVerticalScrollIndicator={false}>
          <Text style={{ fontFamily: SERIF, fontSize: 28, lineHeight: 33, letterSpacing: -0.4, color: INK.title }}>{titular}</Text>
          <Text style={{ fontFamily: MONO, fontSize: 11.5, color: INK.faint, marginTop: 6 }}>
            {medidos.length ? hace(medido) : 'Se mide cada 15 minutos, de 5 a 22 h.'}
          </Text>

          {hayPais ? (
            <View style={{ flexDirection: 'row', gap: 16, marginTop: 20 }}>
              {[['ciudad', 'la ciudad'], ['pais', 'carreteras']].map(([clave, texto]) => {
                const activa = ambito === clave;
                return (
                  <Pressable
                    key={clave}
                    onPress={() => {
                      roce();
                      setAmbito(clave);
                    }}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityState={{ selected: activa }}
                    style={{ paddingBottom: 5, borderBottomWidth: 1, borderBottomColor: activa ? INK.title : 'transparent' }}
                  >
                    <Text style={{ fontFamily: MONO, fontSize: 12.5, color: activa ? INK.title : INK.faint }}>{texto}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          <View style={{ marginTop: hayPais ? 8 : 22 }}>
            {orden.map((t, i) => (
              <Fila
                key={t.clave}
                tramo={t}
                dia={delDia?.get(t.id) || []}
                ultima={i === orden.length - 1}
                onPress={() => {
                  roce();
                  onIr?.(t);
                }}
              />
            ))}
          </View>

          <Text style={{ fontFamily: MONO, fontSize: 10.5, color: INK.faint, lineHeight: 16, marginTop: 20 }}>
            Tiempos de Apple Maps para la ruta más rápida entre los dos puntos.
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

function Fila({ tramo: t, dia, ultima, onPress }) {
  const color = COLOR_TRAFICO[t.nivel] || COLOR_TRAFICO.sin_dato;
  const ahora = t.con_trafico_s ? minutos(t.con_trafico_s) : null;
  const demora = t.demora_s != null ? minutos(t.demora_s) : null;
  const sobre = t.sobre_lo_normal_s != null ? minutos(t.sobre_lo_normal_s) : null;

  // Frente a lo de costumbre a esta hora. Dos minutos arriba o abajo es lo mismo.
  const costumbre =
    sobre === null ? null : sobre >= 3 ? `${sobre} min más que de costumbre a esta hora` : sobre <= -3 ? `${-sobre} min menos que de costumbre a esta hora` : 'como de costumbre a esta hora';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        paddingVertical: 15,
        borderBottomWidth: ultima ? 0 : 1,
        borderBottomColor: 'rgba(28,43,34,0.08)',
        opacity: pressed ? 0.6 : 1,
      })}
      accessibilityRole="button"
      accessibilityLabel={`${t.desde} a ${t.hacia}${ahora ? `, ${ahora} minutos, ${t.nivel}` : ', sin medición'}. Ver en el mapa`}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <View style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, backgroundColor: color, marginTop: 3, marginBottom: 3 }} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: MONO, fontSize: 13.5, color: INK.title, lineHeight: 19 }}>
            {t.desde} <Text style={{ color: INK.faint }}>→</Text> {t.hacia}
          </Text>
          <Text numberOfLines={1} style={{ fontFamily: MONO, fontSize: 11, color: INK.faint, marginTop: 3 }}>
            {[t.corredor ? `por ${t.corredor}` : null, t.distancia_m ? `${(t.distancia_m / 1000).toFixed(1)} km` : null].filter(Boolean).join(' · ')}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          {ahora !== null ? (
            <>
              <Text style={{ fontSize: 22, fontWeight: '700', letterSpacing: -0.5, color: INK.title }}>
                {ahora}
                <Text style={{ fontSize: 12, fontWeight: '500', color: INK.faint }}> min</Text>
              </Text>
              <Text style={{ fontFamily: MONO, fontSize: 11, color, marginTop: 1 }}>{t.nivel}</Text>
            </>
          ) : (
            <Text style={{ fontFamily: MONO, fontSize: 11, color: INK.faint, marginTop: 4 }}>sin medición</Text>
          )}
        </View>
      </View>

      {ahora !== null ? (
        <View style={{ marginLeft: 16, marginTop: 9 }}>
          <Text style={{ fontFamily: MONO, fontSize: 11.5, color: INK.body, lineHeight: 17 }}>
            {demora >= 2 ? `${demora} min más que cuando va libre` : 'lo mismo que cuando va libre'}
            {costumbre ? ` · ${costumbre}` : ''}
          </Text>
          <DelDia muestras={dia} libre={t.sin_trafico_s} />
        </View>
      ) : null}
    </Pressable>
  );
}

/**
 * Cómo vino el tramo hoy: una barra por medición, alta según cuánto tardó y del
 * color de su nivel. Es para ver la forma del día —el pico de la mañana, si ya
 * está bajando—, no para leer un número.
 */
function DelDia({ muestras, libre }) {
  if (!libre || muestras.length < 4) return null;
  const tope = Math.max(...muestras.map((m) => m.con_trafico_s), libre * 2.4);
  const hora = (iso) => {
    const d = new Date(new Date(iso).getTime() - 6 * 3600 * 1000);
    return `${d.getUTCHours()} h`;
  };
  return (
    <View style={{ marginTop: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 30, gap: 1.5 }}>
        {muestras.map((m) => {
          const razon = m.con_trafico_s / libre;
          return (
            <View
              key={m.medido_en}
              style={{
                flex: 1,
                height: Math.max(3, (m.con_trafico_s / tope) * 30),
                borderRadius: 1.5,
                backgroundColor: COLOR_TRAFICO[nivelDe(razon)],
                opacity: 0.85,
              }}
            />
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 3 }}>
        <Text style={{ fontFamily: MONO, fontSize: 9.5, color: INK.faint }}>{hora(muestras[0].medido_en)}</Text>
        <Text style={{ fontFamily: MONO, fontSize: 9.5, color: INK.faint }}>ahora</Text>
      </View>
    </View>
  );
}
