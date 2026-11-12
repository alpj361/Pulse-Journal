import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown as ChevronDownIcon, ChevronUp as ChevronUpIcon, Coins, GitCompare, ListChecks, MessageCircleQuestionMark, ScanSearch, Sparkles, Target, Users } from 'lucide-react-native';
import MorphingInfinity from '../MorphingInfinity';
import { INK } from '../theme';
import { Plegable, RAYA, TINTA } from './TarjetasCongreso';
import { PASOS_ANALISIS, esperaDeCache, estadoDelAnalisis, pedirAnalisis, traerVigente } from './lecturaDelAnalisis';

/**
 * El análisis de una iniciativa, plegado en su tarjeta como «su análisis» (STA-337).
 *
 * Pensar con quien lee: qué propone, a quién toca y qué conviene revisar, cada
 * cosa con su cita y sin decir si está bien o mal. Arriba la frase; cada
 * sección es una fila con su ícono y cuántos puntos tiene, plegada; las
 * preguntas van abiertas al final, porque son por dónde mirar. Una sección sin
 * datos no aparece.
 *
 * Se pide a mano (PJ, 12-nov-2026): la tarjeta ofrece «analizar» y la persona
 * lo ve hacerse. Si alguien ya lo había pedido, sale de la caché, pero igual se
 * espera unos segundos: el pedido es suyo y queda guardado como suyo.
 */

const ICONOS = {
  problema: Target,
  que_hace: ListChecks,
  cambios_ley_vigente: GitCompare,
  quien_gana_quien_asume: Users,
  dinero: Coins,
  para_revisar: ScanSearch,
};

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * El análisis de una iniciativa para esta persona: en qué está y cómo pedirlo.
 * `disponible` es falso sin sesión o si el servicio no la reconoce: entonces la
 * tarjeta no ofrece nada.
 */
export function useAnalisisIniciativa(numero) {
  const cliente = useQueryClient();
  const clave = ['analisis-iniciativa', numero];
  const q = useQuery({
    queryKey: clave,
    queryFn: () => estadoDelAnalisis(numero),
    enabled: !!numero,
    staleTime: 10 * 60 * 1000,
    retry: 1,
    // Mientras corre de verdad, se mira cada pocos segundos hasta que esté.
    refetchInterval: (query) => (query.state.data?.estado === 'en_curso' ? 4000 : false),
  });
  const [esperando, setEsperando] = useState(false);
  const pedir = async () => {
    if (esperando) return;
    setEsperando(true);
    try {
      const inicio = Date.now();
      const r = await pedirAnalisis(numero);
      // De la caché llega al instante; igual se ve hacerse.
      if (r?.estado === 'listo') await dormir(Math.max(0, esperaDeCache() - (Date.now() - inicio)));
      cliente.setQueryData(clave, r || { estado: 'fallido', analisis: null });
    } catch {
      cliente.setQueryData(clave, { estado: 'fallido', analisis: null });
    } finally {
      setEsperando(false);
    }
  };
  const estado = esperando ? 'en_curso' : q.data?.estado || 'sin_pedir';
  return { estado, analisis: q.data?.analisis || null, pedir, disponible: q.data != null || esperando };
}

/** Mientras se analiza: el loader de Vizta y lo que va haciendo, en orden. */
export function Analizando() {
  const [paso, setPaso] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setPaso((p) => Math.min(p + 1, PASOS_ANALISIS.length - 1)), 1600);
    return () => clearInterval(t);
  }, []);
  return (
    <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 }}>
      <MorphingInfinity size={22} color={TINTA} />
      <Text style={{ fontSize: 13, color: INK.body }}>{PASOS_ANALISIS[paso]}</Text>
    </View>
  );
}

/**
 * El botón de la tarjeta, al lado de «su recorrido»: «analizar» si no lo ha
 * pedido (o «analizar de nuevo» si falló) y «su análisis» cuando está listo.
 */
export function BotonAnalisis({ estado, abierto, onAbrir, onPedir, numero }) {
  if (estado === 'listo') {
    const Flecha = abierto ? ChevronUpIcon : ChevronDownIcon;
    return (
      <Pressable onPress={onAbrir} accessibilityRole="button" accessibilityState={{ expanded: abierto }} accessibilityLabel={`su análisis, iniciativa ${numero}`}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44 }}>
        <Text style={{ fontSize: 12, color: TINTA, fontWeight: '600' }}>{abierto ? 'cerrar análisis' : 'su análisis'}</Text>
        <Flecha size={13} color={TINTA} />
      </Pressable>
    );
  }
  if (estado === 'en_curso') return null;
  return (
    <Pressable onPress={onPedir} accessibilityRole="button" accessibilityLabel={`analizar la iniciativa ${numero}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 44 }}>
      <Sparkles size={13} color={TINTA} />
      <Text style={{ fontSize: 12, color: TINTA, fontWeight: '600' }}>{estado === 'fallido' ? 'analizar de nuevo' : 'analizar'}</Text>
    </Pressable>
  );
}

/** Abre el análisis solo cuando termina de hacerse delante de la persona. */
export function useAbrirAlTerminar(estado, abrir) {
  const antes = useRef(estado);
  useEffect(() => {
    if (antes.current === 'en_curso' && estado === 'listo') abrir();
    antes.current = estado;
  }, [estado, abrir]);
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
