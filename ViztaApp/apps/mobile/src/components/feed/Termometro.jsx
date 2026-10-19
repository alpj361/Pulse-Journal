import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Minus, X } from 'lucide-react-native';
import { supabase } from '../../utils/supabase';
import { INK, SERIF } from '../theme';
import { nombreDelDia } from './congreso';
import { EN_LA_FRANJA, MEDIDAS, colorDe, deQueSeHabla, diaDeCard, diaGT, frase, medirDia, puntuar } from './termometro';
import { colorIntensidad, frasesIntensidad, intensidadDelDia } from './intensidad';

/**
 * Cómo está el día, a un toque del feed.
 *
 * Arriba, una franja con cuatro medidas (intensidad, violencia, gobierno y
 * Congreso, volumen). Al tocarla, una hoja con todas las medidas, la semana,
 * el mes y de qué se habla. Todo sale de contar las tarjetas de cada día; cada
 * día se compara contra los anteriores que haya, y se dice cuántos.
 */

const RAYA = 'rgba(28,43,34,0.08)';
const ROTULO = { fontSize: 10.5, fontWeight: '800', letterSpacing: 1.1, color: INK.faint };

/** Las tarjetas de cada día: la última corrida de ese día, solo las de ese día. */
async function traerDias(pais) {
  const desde = new Date(Date.now() - 35 * 86400000).toISOString();
  const { data: corridas, error } = await supabase
    .from('news_cards')
    .select('id, generated_at')
    .eq('pais', pais)
    .gte('generated_at', desde)
    .order('generated_at', { ascending: false });
  if (error) throw error;
  const ultimaDelDia = new Map();
  for (const c of corridas || []) {
    const dia = diaGT(c.generated_at);
    if (!ultimaDelDia.has(dia)) ultimaDelDia.set(dia, c);
  }
  const ids = [...ultimaDelDia.values()].map((c) => c.id);
  if (!ids.length) return [];
  const { data: filas, error: e2 } = await supabase.from('news_cards').select('id, generated_at, cards').in('id', ids);
  if (e2) throw e2;
  return (filas || []).map((f) => {
    const dia = diaGT(f.generated_at);
    const cards = (f.cards || []).filter((c) => diaDeCard(c, f.generated_at) === dia);
    return { dia, cards, todas: f.cards || [] };
  });
}

export function useDias(pais) {
  return useQuery({
    queryKey: ['termometro-dias', pais],
    queryFn: async () => {
      const crudos = await traerDias(pais);
      // La versión más nueva de cada historia, con todo su recorrido.
      const historias = new Map();
      for (const d of [...crudos].sort((a, b) => (a.dia < b.dia ? 1 : -1))) {
        for (const c of d.todas) if (!historias.has(c.id || c.titulo)) historias.set(c.id || c.titulo, c);
      }
      const todas = [...historias.values()];
      const puntuados = puntuar(crudos.map((d) => medirDia(d.cards, d.dia))).map((d) => {
        const intensidad = intensidadDelDia(todas, d.dia);
        return { ...d, intensidad, puntos: { ...d.puntos, intensidad: intensidad.puntos } };
      });
      const cardsPorDia = new Map(crudos.map((d) => [d.dia, d.cards]));
      return { dias: puntuados, cardsPorDia };
    },
    staleTime: 15 * 60 * 1000,
  });
}

// ─── La franja ───────────────────────────────────────────────────────────────

export default function Termometro({ pais, style }) {
  const { data } = useDias(pais);
  const [abierta, setAbierta] = useState(false);
  const dias = data?.dias || [];
  const hoy = dias[dias.length - 1];
  if (!hoy) return null;
  const nombres = Object.fromEntries(MEDIDAS);

  return (
    <>
      <Pressable
        onPress={() => setAbierta(true)}
        accessibilityRole="button"
        accessibilityLabel="Cómo está el día"
        style={({ pressed }) => [{ flexDirection: 'row', gap: 8, opacity: pressed ? 0.7 : 1 }, style]}
      >
        {EN_LA_FRANJA.map((k) => {
          const p = hoy.puntos[k];
          return (
            <View key={k} style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{ fontSize: 10.5, color: INK.meta, marginBottom: 5 }}>
                {k === 'gobierno' ? 'Gobierno' : nombres[k]}
              </Text>
              <View style={{ height: 6, borderRadius: 3, backgroundColor: RAYA, overflow: 'hidden' }}>
                <View style={{ width: `${Math.max(6, p ?? 0)}%`, height: 6, borderRadius: 3, backgroundColor: k === 'intensidad' ? colorIntensidad(p) : colorDe(p) }} />
              </View>
            </View>
          );
        })}
      </Pressable>
      {abierta ? <Hoja data={data} onClose={() => setAbierta(false)} /> : null}
    </>
  );
}

// ─── La hoja ─────────────────────────────────────────────────────────────────

function Hoja({ data, onClose }) {
  const insets = useSafeAreaInsets();
  const { dias, cardsPorDia } = data;
  const [elegido, setElegido] = useState(dias[dias.length - 1].dia);
  const d = dias.find((x) => x.dia === elegido) || dias[dias.length - 1];
  const i = dias.indexOf(d);
  const anterior = dias[i - 1];
  const temas = useMemo(
    () => deQueSeHabla(cardsPorDia.get(d.dia) || [], anterior ? cardsPorDia.get(anterior.dia) || [] : []),
    [cardsPorDia, d.dia, anterior]
  );

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(20,32,26,0.42)', justifyContent: 'flex-end' }}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={{ maxHeight: '90%', backgroundColor: '#FBFAF6', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: Math.max(insets.bottom, 18) }}>
          <View style={{ alignItems: 'center', paddingTop: 10 }}>
            <View style={{ width: 34, height: 4, borderRadius: 2, backgroundColor: 'rgba(28,43,34,0.18)' }} />
          </View>
          <Pressable onPress={onClose} hitSlop={14} accessibilityRole="button" accessibilityLabel="Cerrar" style={{ position: 'absolute', right: 20, top: 20, zIndex: 2 }}>
            <X size={20} color={INK.meta} />
          </Pressable>

          <ScrollView contentContainerStyle={{ paddingHorizontal: 26, paddingTop: 18, paddingBottom: 12 }} showsVerticalScrollIndicator={false}>
            <Text style={{ fontFamily: SERIF, fontSize: 26, color: INK.title, letterSpacing: -0.3 }}>Cómo está el día</Text>
            <Text style={{ fontSize: 13, color: INK.meta, marginTop: 3 }}>
              {nombreDelDia(d.dia)}
              {d.base ? ` · contra ${d.base === 1 ? 'el día anterior' : `los ${d.base} días anteriores`}` : ''}
            </Text>

            <Semana dias={dias} elegido={d.dia} onElegir={setElegido} />

            <View style={{ marginTop: 22 }}>
              {/* El termómetro es de un día: el elegido en la semana. Se dice
                  cuál, para que no se lea como de toda la semana. */}
              <Text style={ROTULO}>{`TERMÓMETRO · ${nombreDelDia(d.dia).toUpperCase()}`}</Text>
              {MEDIDAS.map(([k, nombre]) =>
                k === 'intensidad' ? (
                  <Intensidad key={k} i={d.intensidad} />
                ) : (
                  <Medida key={k} nombre={nombre} puntos={d.puntos[k]} frase={frase(k, d)} porcentaje={k === 'polarizacion' || k === 'novedad'} />
                )
              )}
            </View>

            {temas.length ? (
              <View style={{ marginTop: 24 }}>
                <Text style={ROTULO}>DE QUÉ SE HABLA</Text>
                {temas.map((t) => (
                  <Tema key={t.id || t.titulo} t={t} />
                ))}
              </View>
            ) : null}

            <Mes dias={dias} elegido={d.dia} onElegir={setElegido} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/** La intensidad: su total en escala fija y los cuatro componentes con su cifra. */
function Intensidad({ i }) {
  return (
    <View style={{ marginTop: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: INK.title }}>Intensidad</Text>
        <Text style={{ fontSize: 12.5, color: INK.meta }}>{i.puntos}</Text>
      </View>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: RAYA, marginTop: 6, overflow: 'hidden' }}>
        <View style={{ width: `${Math.max(2, i.puntos)}%`, height: 6, borderRadius: 3, backgroundColor: colorIntensidad(i.puntos) }} />
      </View>
      <View style={{ marginTop: 6, gap: 4 }}>
        {frasesIntensidad(i).map(([nombre, pts, texto]) => (
          <View key={nombre} style={{ flexDirection: 'row', gap: 8 }}>
            <Text style={{ width: 84, fontSize: 12, color: INK.meta }}>{nombre}</Text>
            <Text style={{ flex: 1, fontSize: 12.5, color: INK.body, lineHeight: 17 }}>{texto}</Text>
            <Text style={{ fontSize: 12, color: INK.faint }}>{pts}/25</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function Medida({ nombre, puntos, frase: texto, porcentaje }) {
  return (
    <View style={{ marginTop: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: INK.title }}>{nombre}</Text>
        <Text style={{ fontSize: 12.5, color: INK.meta }}>{puntos == null ? '—' : porcentaje ? `${puntos}%` : puntos}</Text>
      </View>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: RAYA, marginTop: 6, overflow: 'hidden' }}>
        <View style={{ width: `${Math.max(2, puntos ?? 0)}%`, height: 6, borderRadius: 3, backgroundColor: porcentaje ? INK.meta : colorDe(puntos) }} />
      </View>
      <Text style={{ fontSize: 12.5, color: INK.body, marginTop: 5, lineHeight: 18 }}>{texto}</Text>
    </View>
  );
}

/** Los últimos 7 días, cada uno con el color de su intensidad. Tocar uno lo abre. */
function Semana({ dias, elegido, onElegir }) {
  const ultimos = dias.slice(-7);
  return (
    <View style={{ marginTop: 18 }}>
      <Text style={ROTULO}>LA SEMANA</Text>
      <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
        {ultimos.map((x) => {
          const activo = x.dia === elegido;
          const [a, m, dd] = x.dia.split('-').map(Number);
          const corto = new Date(a, m - 1, dd).toLocaleDateString('es-GT', { weekday: 'short' }).replace('.', '');
          return (
            <Pressable key={x.dia} onPress={() => onElegir(x.dia)} accessibilityRole="button" accessibilityLabel={nombreDelDia(x.dia)} style={{ flex: 1, alignItems: 'center' }}>
              <View
                style={{
                  width: '100%',
                  aspectRatio: 1,
                  borderRadius: 8,
                  backgroundColor: colorIntensidad(x.puntos.intensidad),
                  borderWidth: activo ? 2 : 0,
                  borderColor: INK.title,
                }}
              />
              <Text style={{ fontSize: 10.5, color: activo ? INK.title : INK.faint, marginTop: 4, fontWeight: activo ? '700' : '400' }}>{corto}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** El mes en calor, como un calendario: un cuadro por día con el color de su intensidad. */
function Mes({ dias, elegido, onElegir }) {
  const porDia = new Map(dias.map((x) => [x.dia, x]));
  const [a, m] = elegido.split('-').map(Number);
  const primero = new Date(a, m - 1, 1);
  const enMes = new Date(a, m, 0).getDate();
  const vacios = (primero.getDay() + 6) % 7; // lunes primero
  const celdas = [...Array(vacios).fill(null), ...Array.from({ length: enMes }, (_, i) => i + 1)];
  const nombreMes = primero.toLocaleDateString('es-GT', { month: 'long', year: 'numeric' });
  return (
    <View style={{ marginTop: 24 }}>
      <Text style={ROTULO}>{`EL MES · ${nombreMes.toUpperCase()}`}</Text>
      <View style={{ flexDirection: 'row', marginTop: 8 }}>
        {['l', 'm', 'm', 'j', 'v', 's', 'd'].map((x, i) => (
          <Text key={i} style={{ flex: 1, textAlign: 'center', fontSize: 10, color: INK.faint }}>
            {x}
          </Text>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 }}>
        {celdas.map((n, i) => {
          if (!n) return <View key={`v${i}`} style={{ width: `${100 / 7}%`, aspectRatio: 1 }} />;
          const dia = `${a}-${String(m).padStart(2, '0')}-${String(n).padStart(2, '0')}`;
          const x = porDia.get(dia);
          return (
            <Pressable key={dia} disabled={!x} onPress={() => onElegir(dia)} style={{ width: `${100 / 7}%`, aspectRatio: 1, padding: 2 }}>
              <View
                style={{
                  flex: 1,
                  borderRadius: 5,
                  backgroundColor: x ? colorIntensidad(x.puntos.intensidad) : 'rgba(28,43,34,0.05)',
                  borderWidth: dia === elegido ? 2 : 0,
                  borderColor: INK.title,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 10, color: x ? '#fff' : INK.faint }}>{n}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function Tema({ t }) {
  const Flecha = t.rumbo === 'sube' ? ArrowUp : t.rumbo === 'baja' ? ArrowDown : Minus;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: RAYA }}>
      <Text style={{ width: 38, fontSize: 15, fontWeight: '700', color: INK.title }}>{t.porcentaje}%</Text>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={2} style={{ fontSize: 14, color: INK.title, lineHeight: 19 }}>
          {t.titulo}
        </Text>
        {t.categoria ? <Text style={{ fontSize: 11, color: INK.faint, marginTop: 2 }}>{t.categoria}</Text> : null}
      </View>
      {t.rumbo === 'nueva' ? (
        <Text style={{ fontSize: 11, color: INK.meta }}>nueva</Text>
      ) : (
        <Flecha size={15} color={t.rumbo === 'sube' ? '#C0453B' : INK.meta} />
      )}
    </View>
  );
}

export { diaGT };
