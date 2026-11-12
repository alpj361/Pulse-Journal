import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Coins, GitCompare, ListChecks, MessageCircleQuestionMark, ScanSearch, Target, Users } from 'lucide-react-native';
import { INK } from '../theme';
import { Plegable, RAYA, TINTA } from './TarjetasCongreso';
import { traerAnalisis, traerVigente } from './lecturaDelAnalisis';

/**
 * El análisis de una iniciativa, plegado en su tarjeta como «su análisis» (STA-337).
 *
 * Pensar con quien lee: qué propone, a quién toca y qué conviene revisar, cada
 * cosa con su cita y sin decir si está bien o mal. Arriba la frase; cada
 * sección es una fila con su ícono y cuántos puntos tiene, plegada; las
 * preguntas van abiertas al final, porque son por dónde mirar. Una sección sin
 * datos no aparece, y si la iniciativa no tiene análisis, la tarjeta no ofrece
 * «su análisis».
 */

const ICONOS = {
  problema: Target,
  que_hace: ListChecks,
  cambios_ley_vigente: GitCompare,
  quien_gana_quien_asume: Users,
  dinero: Coins,
  para_revisar: ScanSearch,
};

/** El análisis de una iniciativa, si ya tiene; `null` mientras no. */
export function useAnalisisIniciativa(numero) {
  const q = useQuery({
    queryKey: ['analisis-iniciativa', numero],
    queryFn: () => traerAnalisis(numero),
    enabled: !!numero,
    staleTime: 30 * 60 * 1000,
    retry: 1,
  });
  return q.data || null;
}

/** Lo que se ve al abrir «su análisis» en la tarjeta de la iniciativa. */
export default function AnalisisIniciativa({ analisis: a }) {
  if (!a) return null;
  return (
    <View style={{ marginTop: 4 }}>
      {a.frase ? <Text style={{ fontSize: 15, lineHeight: 22, color: INK.title }}>{a.frase}</Text> : null}
      <View style={{ marginTop: 8 }}>
        {a.secciones.map((s) => <Seccion key={s.key} seccion={s} />)}
      </View>
      {a.preguntas.length ? (
        <View style={{ marginTop: 12, gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <MessageCircleQuestionMark size={17} color={TINTA} />
            <Text style={{ fontSize: 13, fontWeight: '700', color: INK.title }}>Preguntas para leerla</Text>
          </View>
          {a.preguntas.map((p, i) => (
            <Text key={i} style={{ fontSize: 13.5, lineHeight: 20, color: INK.body, paddingLeft: 25 }}>{p}</Text>
          ))}
        </View>
      ) : null}
      <Text style={{ fontSize: 11, color: INK.faint, marginTop: 12 }}>
        {a.escaneo ? 'Lectura automática de un documento escaneado; cada punto lleva su cita.' : 'Lectura automática del texto; cada punto lleva su cita.'}
      </Text>
    </View>
  );
}

function Seccion({ seccion }) {
  const [abierta, setAbierta] = useState(false);
  const [citas, setCitas] = useState(false);
  const Icono = ICONOS[seccion.key] || ListChecks;
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: RAYA }}>
      <Pressable onPress={() => setAbierta((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: abierta }}
        accessibilityLabel={`${seccion.titulo}, ${seccion.items.length}`}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48 }}>
        <Icono size={17} color={TINTA} />
        <Text style={{ flex: 1, fontSize: 13.5, fontWeight: '600', color: INK.title }}>{seccion.titulo}</Text>
        <Text style={{ fontSize: 13, color: INK.meta, fontVariant: ['tabular-nums'] }}>{seccion.items.length}</Text>
      </Pressable>
      {abierta ? (
        <View style={{ paddingLeft: 27, paddingBottom: 6, gap: 10 }}>
          {seccion.items.map((it, i) => (seccion.key === 'cambios_ley_vigente' ? <Cambio key={i} item={it} /> : <Punto key={i} item={it} />))}
          {seccion.citas.length ? (
            <View>
              <Plegable abierto={citas} onPress={() => setCitas((v) => !v)} texto="en el texto" color={INK.meta} />
              {citas ? seccion.citas.map((c, i) => <Cita key={i}>{c}</Cita>) : null}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function Etiqueta({ children }) {
  return (
    <View style={{ alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, backgroundColor: 'rgba(0,0,0,0.05)' }}>
      <Text style={{ fontSize: 11, color: INK.body }}>{children}</Text>
    </View>
  );
}

function Punto({ item }) {
  return (
    <View style={{ gap: 3 }}>
      {item.titulo || item.etiqueta || item.cifra ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
          {item.titulo ? <Text style={{ fontSize: 13, fontWeight: '700', color: INK.title }}>{item.titulo}</Text> : null}
          {item.etiqueta ? <Etiqueta>{item.etiqueta}</Etiqueta> : null}
          {item.cifra ? <Text style={{ fontSize: 13, fontWeight: '700', color: INK.title, fontVariant: ['tabular-nums'] }}>{item.cifra}</Text> : null}
        </View>
      ) : null}
      <Text style={{ fontSize: 13.5, lineHeight: 20, color: INK.body }}>{item.texto}</Text>
      {item.nota ? <Text style={{ fontSize: 11.5, color: INK.meta }}>{item.nota}</Text> : null}
    </View>
  );
}

/** Un artículo que se toca: el propuesto, y al abrir, el de hoy desde la base de leyes. */
function Cambio({ item }) {
  const [antes, setAntes] = useState(false);
  const vigente = useQuery({
    queryKey: ['articulo-vigente', item.ley.decreto, item.ley.articulo],
    queryFn: () => traerVigente(item.ley),
    enabled: antes && !!item.ley.decreto,
    staleTime: 60 * 60 * 1000,
  });
  const puedeComparar = !!item.ley.decreto && item.etiqueta !== 'adiciona';
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {item.etiqueta ? <Etiqueta>{item.etiqueta}</Etiqueta> : null}
        <Text style={{ flex: 1, fontSize: 13, fontWeight: '700', color: INK.title }}>
          art. {item.ley.articulo} · {item.ley.nombre || item.nota}
        </Text>
      </View>
      {item.propuesto ? <Cita>{item.propuesto}</Cita> : null}
      {puedeComparar ? <Plegable abierto={antes} onPress={() => setAntes((v) => !v)} texto="cómo está hoy" color={INK.meta} /> : null}
      {antes && vigente.data ? <Cita apagada>{vigente.data.texto}</Cita> : null}
      {antes && vigente.isSuccess && !vigente.data ? <Text style={{ fontSize: 12, color: INK.meta }}>Ese artículo no está en la biblioteca de leyes.</Text> : null}
    </View>
  );
}

function Cita({ children, apagada = false }) {
  return (
    <Text style={{ fontSize: 12.5, lineHeight: 19, color: apagada ? INK.meta : INK.body, fontStyle: 'italic', borderLeftWidth: 2, borderLeftColor: RAYA, paddingLeft: 9, marginTop: 4 }}>
      {children}
    </Text>
  );
}
