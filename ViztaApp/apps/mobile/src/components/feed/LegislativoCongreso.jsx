import { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { supabase } from '../../utils/supabase';
import { INK } from '../theme';
import { Camino, RAYA, Rotulo, TINTA, Titulo } from './TarjetasCongreso';
import { nombreDelDia } from './congreso';

/**
 * Iniciativas y leyes del Congreso, de su registro y no de las noticias.
 *
 * Las noticias de la semana sirven para el tablero, pero no son la lista de
 * iniciativas ni la de leyes: una iniciativa es una sola entrada aunque nadie
 * hable de ella esta semana, y una ley es un decreto aprobado, no un tuit que
 * dice «se aprobaron leyes». Acá cada iniciativa sale una vez, de la más nueva
 * a la más vieja, y cada decreto una vez, con su fecha. Las dos listas se
 * cargan de a 20.
 */
const PAGINA = 20;

const fechaCorta = (f) => (f ? nombreDelDia(String(f).slice(0, 10)) : null);

// ─── Iniciativas ─────────────────────────────────────────────────────────────

const COLUMNAS_INICIATIVA =
  'numero, titulo, ponentes, comisiones, estado_actual, fecha_presentacion, fecha_conocio_pleno, url_ficha, url_pdf, eventos_timeline';

async function paginaIniciativas({ pageParam = 0 }) {
  const { data, error, count } = await supabase
    .from('iniciativas_app_view')
    .select(COLUMNAS_INICIATIVA, { count: 'exact' })
    .order('numero', { ascending: false })
    .range(pageParam, pageParam + PAGINA - 1);
  if (error) throw error;
  return { filas: data || [], total: count || 0, desde: pageParam };
}

/** Cuántas hay, para la burbuja: iniciativas con número y leyes (decretos). */
export function useConteosLegislativos() {
  return useQuery({
    queryKey: ['congreso-conteos-legislativos'],
    queryFn: async () => {
      const [ini, dec] = await Promise.all([
        supabase.from('iniciativas_app_view').select('numero', { count: 'exact', head: true }),
        supabase.from('pc_congreso_decretos_view').select('numero', { count: 'exact', head: true }),
      ]);
      return { iniciativas: ini.count || 0, leyes: dec.count || 0 };
    },
    staleTime: 30 * 60 * 1000,
  });
}

/** Etapa de la iniciativa, en las paradas del camino que ya dibuja la app. */
const ETAPA_INICIATIVA = {
  presentada: ['iniciativa_presentada', 'PRESENTADA'],
  conocio_pleno: ['iniciativa_presentada', 'CONOCIÓ EL PLENO'],
  en_comision: ['en_comision', 'EN COMISIÓN'],
  dictamen: ['dictamen', 'DICTAMEN'],
  aprobada: ['aprobado', 'APROBADA'],
};

/** Los nombres que trae el registro, sin los pedazos de frase que se colaron. */
const nombres = (lista) => (lista || []).filter((n) => /^[A-ZÁÉÍÓÚÑ]/.test(String(n || '').trim()));

export function ListaIniciativas() {
  const q = useInfiniteQuery({
    queryKey: ['congreso-iniciativas'],
    queryFn: paginaIniciativas,
    getNextPageParam: (u) => (u.desde + PAGINA < u.total ? u.desde + PAGINA : undefined),
    staleTime: 10 * 60 * 1000,
  });
  const filas = (q.data?.pages || []).flatMap((p) => p.filas);
  const total = q.data?.pages?.[0]?.total;

  return (
    <View>
      <SinNumero />
      {q.isLoading ? <Cargando>Trayendo las iniciativas…</Cargando> : null}
      {filas.map((ini) => (
        <Iniciativa key={ini.numero} ini={ini} />
      ))}
      <VerMas q={q} cuantas={filas.length} total={total} />
    </View>
  );
}

function Iniciativa({ ini }) {
  const [abierta, setAbierta] = useState(false);
  const [parada, rotulo] = ETAPA_INICIATIVA[ini.estado_actual] || [null, null];
  const fecha = ini.fecha_presentacion || ini.fecha_conocio_pleno;
  const ponentes = nombres(ini.ponentes);
  const eventos = [...(ini.eventos_timeline || [])].sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  const Flecha = abierta ? ChevronUp : ChevronDown;
  return (
    <Pressable
      onPress={() => setAbierta((x) => !x)}
      accessibilityRole="button"
      accessibilityState={{ expanded: abierta }}
      style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: RAYA }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Rotulo>{[`INICIATIVA ${ini.numero}`, rotulo].filter(Boolean).join(' · ')}</Rotulo>
        </View>
        {fecha ? <Text style={{ fontSize: 11, color: INK.faint, marginBottom: 5 }}>{fechaCorta(fecha)}</Text> : null}
      </View>
      <Titulo>{limpiarTitulo(ini.titulo)}</Titulo>
      {parada ? <Camino etapa={parada} /> : null}
      {ponentes.length ? <Text style={{ fontSize: 12, color: INK.faint, marginTop: 8 }}>{ponentes.join(' · ')}</Text> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
        <Text style={{ fontSize: 12, color: INK.faint }}>{abierta ? 'Menos' : 'Su recorrido'}</Text>
        <Flecha size={13} color={INK.faint} />
      </View>
      {abierta ? (
        <View style={{ marginTop: 10, gap: 8 }}>
          {(ini.comisiones || []).length ? (
            <Text style={{ fontSize: 13, color: INK.body }}>
              <Text style={{ fontWeight: '700' }}>Comisión: </Text>
              {ini.comisiones.join(', ')}
            </Text>
          ) : null}
          {eventos.map((e, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 10 }}>
              <Text style={{ width: 90, fontSize: 12, color: INK.faint }}>{fechaCorta(e.fecha)}</Text>
              <Text style={{ flex: 1, fontSize: 13, color: INK.title }}>
                {ETAPA_INICIATIVA[e.tipo]?.[1]?.toLowerCase() || e.tipo}
                {e.detalle?.objetivo ? ` — ${e.detalle.objetivo}` : ''}
              </Text>
            </View>
          ))}
          {ini.url_ficha || ini.url_pdf ? (
            <Pressable onPress={() => Linking.openURL(ini.url_ficha || ini.url_pdf).catch(() => {})} accessibilityRole="link">
              <Text style={{ fontSize: 13, fontWeight: '600', color: TINTA }}>La iniciativa en el Congreso ›</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}

/** El registro guarda «Iniciativa que dispone aprobar…»: se quita lo que no dice nada. */
function limpiarTitulo(t) {
  const s = String(t || '').trim().replace(/\.$/, '');
  const sin = s.replace(/^iniciativa que (dispone aprobar|propone|dispone)\s+/i, '');
  return sin.charAt(0).toUpperCase() + sin.slice(1);
}

/**
 * Las que se presentaron o se anunciaron y todavía no tienen número. No se
 * dicen «presentadas» si no lo están: una anunciada por un ministerio dice
 * quién la anunció y cuándo.
 */
function SinNumero() {
  const { data = [] } = useQuery({
    queryKey: ['congreso-sin-numero'],
    queryFn: async () => {
      const { data: filas } = await supabase
        .from('iniciativas_sin_numero')
        .select('id, titulo, ponentes, fecha_presentacion, estado, numero_asignado, resumen, fuentes')
        .is('numero_asignado', null)
        .order('fecha_presentacion', { ascending: false, nullsFirst: false })
        .limit(20);
      return filas || [];
    },
    staleTime: 30 * 60 * 1000,
  });
  if (!data.length) return null;
  return (
    <View style={{ marginTop: 6, marginBottom: 10, padding: 14, borderRadius: 16, backgroundColor: 'rgba(28,43,34,0.04)' }}>
      <Rotulo color={INK.faint}>TODAVÍA SIN NÚMERO</Rotulo>
      {data.map((s) => {
        const fuente = (s.fuentes || [])[0];
        const anunciada = /anunciada/i.test(s.estado || '');
        const quien = fuente?.medio && !/congreso/i.test(fuente.medio) ? fuente.medio : null;
        const etiqueta = anunciada
          ? `Anunciada${quien ? ` por ${quien}` : ''}, sin número en el Congreso`
          : 'Presentada, sin número todavía';
        return (
          <Pressable
            key={s.id}
            disabled={!fuente?.url}
            onPress={() => Linking.openURL(fuente.url).catch(() => {})}
            style={{ paddingVertical: 9, borderTopWidth: 1, borderTopColor: RAYA }}
          >
            <Text style={{ fontSize: 14, color: INK.title, lineHeight: 19 }}>{limpiarSinNumero(s.titulo)}</Text>
            <Text style={{ fontSize: 11.5, color: INK.faint, marginTop: 3 }}>
              {etiqueta}
              {s.fecha_presentacion ? ` · ${fechaCorta(s.fecha_presentacion)}` : ''}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** «SALA RECIBE PROPUESTA… — ley de apoyo…»: el titular del sitio va fuera, queda de qué trata. */
function limpiarSinNumero(t) {
  const s = String(t || '').trim();
  const despues = s.includes(' — ') ? s.split(' — ').slice(1).join(' — ') : s;
  const letras = despues.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ]/g, '');
  const base = letras && letras === letras.toUpperCase() ? despues.toLowerCase() : despues;
  return base.charAt(0).toUpperCase() + base.slice(1);
}

// ─── Leyes ───────────────────────────────────────────────────────────────────

async function paginaDecretos({ pageParam = 0 }) {
  const { data, error, count } = await supabase
    .from('pc_congreso_decretos_view')
    .select('numero, fecha, resumen, pdf_url', { count: 'exact' })
    .order('fecha', { ascending: false, nullsFirst: false })
    .range(pageParam, pageParam + PAGINA - 1);
  if (error) throw error;
  return { filas: data || [], total: count || 0, desde: pageParam };
}

/** Las leyes son los decretos que aprobó el Congreso: uno por renglón, con su fecha. */
export function ListaLeyes() {
  const q = useInfiniteQuery({
    queryKey: ['congreso-decretos'],
    queryFn: paginaDecretos,
    getNextPageParam: (u) => (u.desde + PAGINA < u.total ? u.desde + PAGINA : undefined),
    staleTime: 30 * 60 * 1000,
  });
  const filas = (q.data?.pages || []).flatMap((p) => p.filas);
  const total = q.data?.pages?.[0]?.total;
  return (
    <View>
      {q.isLoading ? <Cargando>Trayendo los decretos…</Cargando> : null}
      {filas.map((d) => (
        <Pressable
          key={d.numero}
          disabled={!d.pdf_url}
          onPress={() => Linking.openURL(d.pdf_url).catch(() => {})}
          style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: RAYA }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
            <Rotulo>{`DECRETO ${d.numero}`}</Rotulo>
            {d.fecha ? <Text style={{ fontSize: 11, color: INK.faint }}>{fechaCorta(d.fecha)}</Text> : null}
          </View>
          <Text style={{ fontSize: 14.5, color: INK.title, lineHeight: 20 }}>{d.resumen}</Text>
        </Pressable>
      ))}
      <VerMas q={q} cuantas={filas.length} total={total} />
    </View>
  );
}

// ─── Piezas ──────────────────────────────────────────────────────────────────

function Cargando({ children }) {
  return <Text style={{ fontSize: 13, color: INK.faint, paddingVertical: 16 }}>{children}</Text>;
}

function VerMas({ q, cuantas, total }) {
  if (!q.hasNextPage) return null;
  return (
    <Pressable onPress={() => q.fetchNextPage()} disabled={q.isFetchingNextPage} accessibilityRole="button" style={{ paddingVertical: 14 }}>
      <Text style={{ fontSize: 13, fontWeight: '600', color: TINTA }}>
        {q.isFetchingNextPage ? 'Trayendo…' : `Ver más · ${cuantas} de ${total}`}
      </Text>
    </Pressable>
  );
}
