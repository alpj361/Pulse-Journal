import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, HelpCircle, Minus, X } from 'lucide-react-native';
import { INK, SERIF } from '../theme';
import Sticker from '../Sticker';
import { cielo, eventosActivos, nivelCalles, traerFeedsDelDia, traerPronostico } from './callesYClima';
import { nombreDelDia } from './congreso';
import {
  EN_LA_FRANJA,
  MEDIDAS,
  colorDe,
  colorIntensidad,
  deQueSeHabla,
  diaGT,
  normalDe,
  puntosDe,
  traerTermometro,
  victimasDe,
} from './termometro';

/**
 * Cómo está el día, a un toque del feed.
 *
 * Arriba, una franja con cuatro medidas (intensidad, violencia, gobierno y
 * Congreso, volumen). Al tocarla, una hoja con todas las medidas, la semana,
 * el mes y de qué se habla. Los números los calcula NewsCron con el catálogo
 * de las tarjetas; la app los lee de ExtractorW.
 */

const RAYA = 'rgba(28,43,34,0.08)';
const ROTULO = { fontSize: 10.5, fontWeight: '800', letterSpacing: 1.1, color: INK.faint };

export function useDias(pais) {
  return useQuery({
    queryKey: ['termometro', pais],
    queryFn: () => traerTermometro(pais),
    staleTime: 15 * 60 * 1000,
  });
}

// ─── La franja ───────────────────────────────────────────────────────────────

export default function Termometro({ pais, style }) {
  const { data } = useDias(pais);
  const [abierta, setAbierta] = useState(false);
  const dias = data || [];
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
          const p = puntosDe(k, hoy);
          return (
            <View key={k} style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                <Text numberOfLines={1} style={{ fontSize: 10.5, color: INK.meta, flexShrink: 1 }}>
                  {k === 'gobierno' ? 'Gobierno' : nombres[k]}
                </Text>
                {/* Sin con qué comparar todavía, el conteo del día. */}
                {k !== 'intensidad' && p == null && hoy[k] != null ? (
                  <Text style={{ fontSize: 10.5, fontWeight: '700', color: INK.title }}>{hoy[k]}</Text>
                ) : null}
              </View>
              <View style={{ height: 6, borderRadius: 3, backgroundColor: RAYA, overflow: 'hidden' }}>
                {p != null ? (
                  <View style={{ width: `${Math.max(6, p)}%`, height: 6, borderRadius: 3, backgroundColor: k === 'intensidad' ? colorIntensidad(p) : colorDe(p, k) }} />
                ) : null}
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
  const dias = data;
  const [elegido, setElegido] = useState(dias[dias.length - 1].dia);
  const d = dias.find((x) => x.dia === elegido) || dias[dias.length - 1];
  const i = dias.indexOf(d);
  const anterior = dias[i - 1];
  const temas = useMemo(() => deQueSeHabla(d, anterior), [d, anterior]);
  // Calles y clima: lo que dicen las noticias (NewsCron) y el pronóstico.
  const { data: feeds } = useQuery({ queryKey: ['feeds-calles-clima'], queryFn: traerFeedsDelDia, staleTime: 15 * 60 * 1000 });
  const { data: pronostico } = useQuery({ queryKey: ['pronostico-gt'], queryFn: traerPronostico, staleTime: 60 * 60 * 1000 });

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

            <Semana dias={dias} elegido={d.dia} onElegir={setElegido} />

            <View style={{ marginTop: 22 }}>
              {/* El termómetro es de un día: el elegido en la semana. Se dice
                  cuál —una sola vez, acá—, para que no se lea como de toda la
                  semana. */}
              <Text style={ROTULO}>
                {[nombreDelDia(d.dia), d.parcial ? 'hasta ahora' : null, d.datosParciales ? 'con datos incompletos' : null]
                  .filter(Boolean)
                  .join(' · ')
                  .toUpperCase()}
              </Text>
              <Intensidad d={d} />
              <Violencia d={d} />
              <Gobierno d={d} />
              <Calles d={d} fila={feeds?.movilidad} />
              <Clima d={d} fila={feeds?.clima} dia={pronostico?.[d.dia]} />
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

const TARJETA = {
  backgroundColor: 'rgba(255,255,255,0.72)',
  borderRadius: 16,
  borderWidth: 1,
  borderColor: RAYA,
  padding: 14,
};
const NUMERO = { fontFamily: SERIF, color: INK.title, letterSpacing: -0.5 };

/** «lo normal, 6», cuando el servidor ya junta días para comparar. */
function Normal({ clave, d, style }) {
  const n = normalDe(clave, d);
  if (n == null) return null;
  return <Text style={[{ fontSize: 11, color: INK.faint }, style]}>{`lo normal, ${n}`}</Text>;
}

/**
 * La intensidad: el número grande, en su color, y una barra partida en sus
 * tres componentes —cuánto puso cada uno—, con el dato de cada uno abajo.
 */
function Intensidad({ d }) {
  const p = d.intensidad;
  const c = d.componentes;
  const color = colorIntensidad(p);
  const partes = [
    ['Seguimiento', c.seguimiento, c.maxDesarrollos != null ? `la más seguida, ${c.maxDesarrollos} ${c.maxDesarrollos === 1 ? 'vez' : 'veces'}` : null, 1],
    ['Amplitud', c.amplitud, d.volumen != null ? `${d.volumen} ${d.volumen === 1 ? 'historia' : 'historias'}` : null, 0.66],
    ['Alto impacto', c.altoImpacto, c.historiasAltoImpacto != null ? `${c.historiasAltoImpacto} con 5 medios o más` : null, 0.38],
  ];
  return (
    <View style={[TARJETA, { marginTop: 10 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
        <Text style={[NUMERO, { fontSize: 50, lineHeight: 54, color }]}>{p ?? '—'}</Text>
        <Text style={{ fontSize: 13, color: INK.meta }}>Intensidad</Text>
      </View>
      <View style={{ flexDirection: 'row', height: 10, borderRadius: 5, backgroundColor: RAYA, overflow: 'hidden', marginTop: 8, gap: 2 }}>
        {partes.map(([nombre, pts, , op]) => (
          <View key={nombre} style={{ width: `${Math.max(0, pts ?? 0)}%`, backgroundColor: color, opacity: op }} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
        {partes.map(([nombre, , dato, op]) => (
          <View key={nombre} style={{ flex: 1 }}>
            <View style={{ width: 14, height: 4, borderRadius: 2, backgroundColor: color, opacity: op, marginBottom: 5 }} />
            <Text style={{ fontSize: 11.5, fontWeight: '600', color: INK.title }}>{nombre}</Text>
            {dato ? <Text style={{ fontSize: 11.5, color: INK.body, lineHeight: 15, marginTop: 1 }}>{dato}</Text> : null}
          </View>
        ))}
      </View>
    </View>
  );
}

/** Violencia: cuántas historias nuevas y, debajo, las víctimas que dicen las tarjetas. */
function Violencia({ d }) {
  const victimas = victimasDe(d.victimas);
  const vacio = !d.violencia;
  return (
    <View style={[TARJETA, { marginTop: 8 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Sticker nombre="violencia" size={40} style={{ opacity: vacio ? 0.5 : 1 }} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
            <Text style={[NUMERO, { fontSize: 38, lineHeight: 42, opacity: vacio ? 0.5 : 1 }]}>{d.violencia ?? '—'}</Text>
            <Text style={{ fontSize: 13, color: INK.meta }}>Violencia</Text>
          </View>
          <Normal clave="violencia" d={d} />
        </View>
      </View>
      {victimas.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          {victimas.map(([n, palabra]) => (
            <View key={palabra} style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, backgroundColor: '#F3E9E7', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5 }}>
              {n != null ? <Text style={{ fontSize: 14, fontWeight: '700', color: '#783D34' }}>{n}</Text> : null}
              <Text style={{ fontSize: 12, color: '#783D34' }}>{palabra}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** Gobierno y Congreso: una fila, con su sticker y el número. */
function Gobierno({ d }) {
  const vacio = !d.gobierno;
  return (
    <View style={[TARJETA, { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }]}>
      <Sticker nombre="politica" size={32} style={{ opacity: vacio ? 0.45 : 1 }} />
      <Text style={[NUMERO, { fontSize: 30, lineHeight: 34, opacity: vacio ? 0.45 : 1 }]}>{d.gobierno ?? '—'}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13, color: INK.meta }}>Gobierno y Congreso</Text>
        <Normal clave="gobierno" d={d} />
      </View>
    </View>
  );
}

/** Una etiqueta con el número en negrita: «10 en las noticias». */
function Etiqueta({ n, texto, tinta = INK.body, fondo = 'rgba(28,43,34,0.05)' }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, backgroundColor: fondo, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5 }}>
      {n != null ? <Text style={{ fontSize: 14, fontWeight: '700', color: tinta }}>{n}</Text> : null}
      <Text style={{ fontSize: 12, color: tinta }}>{texto}</Text>
    </View>
  );
}

/** Lo que está pasando en un lugar: «Bloqueo · Mixco». */
function Evento({ e }) {
  return (
    <Text numberOfLines={1} style={{ fontSize: 13, color: INK.body, marginTop: 6 }}>
      <Text style={{ fontWeight: '700', color: e.alto ? '#9A5347' : INK.title }}>{e.tipo}</Text>
      {e.zona ? ` · ${e.zona}` : ''}
    </Text>
  );
}

const esDeHoy = (fila, dia) => !!fila?.generated_at && diaGT(fila.generated_at) === dia;

/**
 * Las calles: qué tan pesado está el día (por los eventos activos que traen
 * las noticias) y dónde. Los eventos son solo del último día que NewsCron
 * armó; para los días anteriores queda el conteo.
 */
function Calles({ d, fila }) {
  const eventos = esDeHoy(fila, d.dia) ? eventosActivos(fila) : [];
  const nivel = eventos.length || esDeHoy(fila, d.dia) ? nivelCalles(eventos) : null;
  // Se abre solo si se toca: no es un letrero fijo. Cuando el mapa tenga el
  // tráfico en vivo, hora por hora, esto cambia.
  const [ayuda, setAyuda] = useState(false);
  return (
    <View style={[TARJETA, { marginTop: 8 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Sticker nombre={nivel ? `trafico-${nivel.clave}` : 'movilidad'} respaldo="movilidad" size={40} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 13, color: INK.meta }}>Calles</Text>
          {nivel ? (
            <Text style={[NUMERO, { fontSize: 30, lineHeight: 34, color: nivel.color }]}>{nivel.nombre}</Text>
          ) : null}
        </View>
        <Pressable
          onPress={() => setAyuda((v) => !v)}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Qué muestra Calles"
          style={{ alignSelf: 'flex-start' }}
        >
          <HelpCircle size={18} color={ayuda ? INK.title : INK.faint} />
        </Pressable>
      </View>
      {ayuda ? (
        <Pressable onPress={() => setAyuda(false)} style={{ backgroundColor: 'rgba(28,43,34,0.06)', borderRadius: 10, padding: 10, marginTop: 10 }}>
          <Text style={{ fontSize: 12.5, color: INK.body, lineHeight: 17 }}>
            Es cómo estuvo el día en las calles, según las noticias. No es el tráfico de este momento: se arma una vez al día.
          </Text>
        </Pressable>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
        <Etiqueta n={d.accidentes ?? 0} texto={d.accidentes === 1 ? 'accidente, incendio o cierre' : 'accidentes, incendios o cierres'} />
        {eventos.length ? <Etiqueta n={eventos.length} texto={eventos.length === 1 ? 'sigue activo' : 'siguen activos'} /> : null}
      </View>
      {eventos.slice(0, 4).map((e) => (
        <Evento key={e.id || `${e.tipo}-${e.zona}`} e={e} />
      ))}
      <Normal clave="accidentes" d={d} style={{ marginTop: 6 }} />
    </View>
  );
}

const grados = (x) => (x == null ? null : `${Math.round(x)}°`);

/** El clima: el cielo del día en la capital y lo que reportan las noticias. */
function Clima({ d, fila, dia }) {
  const c = dia ? cielo(dia.codigo) : null;
  const eventos = esDeHoy(fila, d.dia) ? eventosActivos(fila) : [];
  const alertas = esDeHoy(fila, d.dia) ? (fila?.data?.alertas || []).filter(Boolean) : [];
  const detalle = dia
    ? [
        dia.min != null ? `mín ${grados(dia.min)}` : null,
        dia.probLluvia != null ? `${dia.probLluvia}% de lluvia` : null,
        dia.lluviaMm ? `${Math.round(dia.lluviaMm)} mm` : null,
      ].filter(Boolean).join(' · ')
    : null;
  return (
    <View style={[TARJETA, { marginTop: 8 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Sticker nombre={c?.sticker || 'clima'} respaldo="clima" size={40} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 13, color: INK.meta }}>{c ? c.nombre : 'Clima'}</Text>
          {dia?.max != null ? (
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
              <Text style={[NUMERO, { fontSize: 30, lineHeight: 34 }]}>{grados(dia.max)}</Text>
              {detalle ? <Text style={{ fontSize: 12, color: INK.meta, flexShrink: 1 }}>{detalle}</Text> : null}
            </View>
          ) : null}
        </View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
        <Etiqueta n={d.clima ?? 0} texto={d.clima === 1 ? 'noticia de lluvias, sismos o deslaves' : 'noticias de lluvias, sismos o deslaves'} />
      </View>
      {alertas.slice(0, 2).map((a, i) => (
        <Text key={i} numberOfLines={2} style={{ fontSize: 13, color: '#9A5347', marginTop: 6, fontWeight: '600' }}>
          {typeof a === 'string' ? a : a.titulo || a.descripcion || ''}
        </Text>
      ))}
      {eventos.slice(0, 3).map((e) => (
        <Evento key={e.id || `${e.tipo}-${e.zona}`} e={e} />
      ))}
      <Normal clave="clima" d={d} style={{ marginTop: 6 }} />
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
                  backgroundColor: colorIntensidad(x.intensidad),
                  opacity: x.datosParciales ? 0.55 : 1,
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
                  backgroundColor: x ? colorIntensidad(x.intensidad) : 'rgba(28,43,34,0.05)',
                  opacity: x?.datosParciales ? 0.55 : 1,
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
      <View style={{ flex: 1 }}>
        <Text numberOfLines={2} style={{ fontSize: 14, color: INK.title, lineHeight: 19 }}>
          {t.titulo}
        </Text>
        <Text style={{ fontSize: 11, color: INK.faint, marginTop: 2 }}>
          {`${t.veces} ${t.veces === 1 ? 'vez' : 'veces'} · ${t.medios} ${t.medios === 1 ? 'medio' : 'medios'}`}
        </Text>
      </View>
      {t.rumbo === 'nueva' ? null : <Flecha size={15} color={t.rumbo === 'sube' ? '#C0453B' : INK.meta} />}
    </View>
  );
}

export { diaGT };
