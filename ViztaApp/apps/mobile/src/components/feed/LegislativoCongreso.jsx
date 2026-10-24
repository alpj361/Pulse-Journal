import { useMemo, useRef, useState } from 'react';
import { Linking, Pressable, Text, TextInput, View } from 'react-native';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight, FileText } from 'lucide-react-native';
import { supabase } from '../../utils/supabase';
import { INK } from '../theme';
import { Camino, RAYA, Rotulo, TINTA, Titulo } from './TarjetasCongreso';
import { nombreDelDia } from './congreso';
import FiltroChips from './FiltroChips';
import { coincide, enlaceDe, etapaDe, ETAPAS, paginasVisibles, paradaDe, ROTULOS_ETAPA } from './iniciativas';

/**
 * Iniciativas y leyes del Congreso, de su registro y no de las noticias.
 *
 * Las noticias de la semana sirven para el tablero, pero no son la lista de
 * iniciativas ni la de leyes: una iniciativa es una sola entrada aunque nadie
 * hable de ella esta semana, y una ley es un decreto aprobado, no un tuit que
 * dice «se aprobaron leyes». Acá cada iniciativa sale una vez, de la más nueva
 * a la más vieja, y cada decreto una vez, con su fecha. Las dos listas se
 * muestran de a 20; las iniciativas se guardan juntas para buscar y filtrar
 * sobre todo el registro sin pedir de nuevo al cambiar de página.
 */
const PAGINA = 20;

const fechaCorta = (f) => (f ? nombreDelDia(String(f).slice(0, 10)) : null);

// ─── Iniciativas ─────────────────────────────────────────────────────────────

const COLUMNAS_INICIATIVA =
  'numero, titulo, ponentes, comisiones, estado_actual, fecha_presentacion, fecha_conocio_pleno, url_ficha, url_pdf, fuente_presentacion_url, eventos_timeline, decreto_resultante';

/** Lee lotes acotados, sin depender del límite de filas configurado en la base. */
export async function registroCompleto(tabla, columnas, orden, configurar = (q) => q) {
  const filas = [];
  const lote = 250;
  for (let desde = 0; ; desde += lote) {
    const { data, error } = await configurar(supabase.from(tabla).select(columnas))
      .order(orden, { ascending: false }).range(desde, desde + lote - 1);
    if (error) throw error;
    filas.push(...(data || []));
    if ((data || []).length < lote) return filas;
  }
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

/**
 * Lo que se sabe de cada iniciativa en palabras: el objetivo que trae su
 * registro, o el resumen de la nota del Congreso que habló de ella. El texto
 * de la iniciativa todavía no se lee, así que muchas no tienen ninguno.
 */
function indexarNotas(data) {
  const m = new Map();
  for (const nota of [...data].sort((a, b) => String(b.digest_date).localeCompare(String(a.digest_date)))) {
    const clave = String(nota.iniciativa_numero);
    m.set(clave, [...(m.get(clave) || []), nota]);
  }
  return m;
}

function useResumenes() {
  return useQuery({
    queryKey: ['congreso-notas-iniciativas-v2'],
    queryFn: async () => {
      const data = await registroCompleto('congreso_items_app_view',
        'id, titulo, iniciativa_numero, summary, digest_date, stage, iniciativa_url, url', 'id',
        (q) => q.not('iniciativa_numero', 'is', null));
      return data;
    },
    select: indexarNotas,
    staleTime: 10 * 60 * 1000,
  });
}

export function resumenDe(ini, deNotas) {
  const objetivos = [...(ini.eventos_timeline || [])]
    .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))
    .map((e) => e.detalle?.objetivo);
  const plano = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const titulo = plano(limpiarTitulo(ini.titulo));
  const comunes = new Set(['iniciativa', 'dispone', 'aprobar', 'propone', 'reformas', 'decreto', 'numero', 'congreso', 'republica', 'guatemala', 'nacional', 'para', 'sobre', 'como', 'esta', 'este']);
  const palabras = [...new Set((titulo.match(/[a-z]{4,}/g) || []).filter((p) => !comunes.has(p)))];
  const notas = (deNotas?.get(String(ini.numero)) || []).filter((n) => {
    const texto = plano(n.summary);
    // El número asociado no basta si el resumen habla de otro tema.
    // Filtro conservador de presentación: el dato se corrige en el backend.
    const coincidencias = palabras.filter((p) => texto.includes(p)).length;
    return palabras.length && coincidencias >= Math.min(2, palabras.length) &&
      !/resumen semanal|lo mas destacado de la semana/.test(plano(n.titulo));
  }).map((n) => n.summary);
  const compacto = (t) => plano(t).replace(/[^a-z0-9]/g, '');
  return [...notas, ...objetivos].find((r) => typeof r === 'string' && compacto(r) &&
    !/\btuit\b|seg[uú]n el t[ií]tulo|sin m[aá]s detalles/i.test(r) &&
    (!titulo || !compacto(titulo).includes(compacto(r)))) || null;
}

export function ListaIniciativas({ onPagina }) {
  const notas = useResumenes();
  const [texto, setTexto] = useState('');
  const [filtro, setFiltro] = useState('todas');
  const [pagina, setPagina] = useState(1);
  const ancla = useRef(null);
  const q = useQuery({
    queryKey: ['congreso-iniciativas-registro-v2'],
    queryFn: () => registroCompleto('iniciativas_app_view', COLUMNAS_INICIATIVA, 'numero'),
    staleTime: 10 * 60 * 1000,
  });
  const iniciativas = useMemo(() => (q.data || []).map((ini) => ({
    ...ini, etapa: etapaDe(ini, notas.data?.get(String(ini.numero)) || []),
  })), [q.data, notas.data]);
  const buscadas = iniciativas.filter((ini) => coincide(ini, texto));
  const filas = buscadas.filter((ini) => filtro === 'todas' || paradaDe(ini.etapa) === filtro);
  const totalPaginas = Math.max(1, Math.ceil(filas.length / PAGINA));
  const actual = Math.min(pagina, totalPaginas);
  const visibles = filas.slice((actual - 1) * PAGINA, actual * PAGINA);
  const cambiarPagina = (n) => {
    setPagina(n);
    onPagina?.(ancla.current);
  };
  return (
    <View>
      <SinNumero />
      <View ref={ancla} collapsable={false}>
        <TextInput value={texto} onChangeText={(t) => { setTexto(t); setPagina(1); }}
          placeholder="buscar por número o título" accessibilityLabel="buscar iniciativa por número o título"
          placeholderTextColor={INK.meta} autoCorrect={false} returnKeyType="search"
          style={{ minHeight: 44, borderWidth: 1, borderColor: RAYA, borderRadius: 12, paddingHorizontal: 12, color: INK.title, fontSize: 14 }} />
        <FiltroChips valor={filtro} onCambiar={(f) => { setFiltro(f); setPagina(1); }} opciones={[
          { clave: 'todas', nombre: 'todas', cuenta: buscadas.length },
          ...ETAPAS.map(([clave, nombre]) => ({ clave, nombre, cuenta: buscadas.filter((ini) => paradaDe(ini.etapa) === clave).length })),
        ]} />
      </View>
      {q.isLoading ? <Cargando>Trayendo las iniciativas…</Cargando> : null}
      {q.isError ? <Reintentar onPress={q.refetch}>No se pudieron traer las iniciativas.</Reintentar> : null}
      {notas.isError ? <Reintentar onPress={notas.refetch}>No se pudieron completar los avances.</Reintentar> : null}
      {!q.isLoading && !q.isError && !filas.length ? <Cargando>No hay iniciativas para esta búsqueda.</Cargando> : null}
      <Paginado actual={actual} total={totalPaginas} onCambiar={cambiarPagina} />
      {visibles.map((ini) => (
        <Iniciativa key={ini.numero} ini={ini} resumen={resumenDe(ini, notas.data)} notas={notas.data?.get(String(ini.numero)) || []} />
      ))}
      {filas.length ? <Text accessibilityLiveRegion="polite" style={{ fontSize: 12, color: INK.meta, marginTop: 12 }}>
        {(actual - 1) * PAGINA + 1}–{Math.min(actual * PAGINA, filas.length)} de {filas.length} iniciativas
      </Text> : null}
      <Paginado actual={actual} total={totalPaginas} onCambiar={cambiarPagina} />
    </View>
  );
}

export function Paginado({ actual, total, onCambiar }) {
  if (total < 2) return null;
  const boton = (n, texto, deshabilitado = false) => (
    <Pressable key={texto || n} onPress={() => onCambiar(n)} disabled={deshabilitado}
      accessibilityRole="button" accessibilityLabel={texto || `página ${n}`}
      accessibilityState={{ disabled: deshabilitado, selected: !texto && actual === n }}
      style={{ minWidth: 36, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10,
        backgroundColor: !texto && actual === n ? 'rgba(47,74,122,0.12)' : 'transparent', opacity: deshabilitado ? 0.35 : 1 }}>
      {texto ? (texto === 'anterior' ? <ChevronLeft size={17} color={TINTA} /> : <ChevronRight size={17} color={TINTA} />) : <Text style={{ color: TINTA, fontSize: 13, fontWeight: actual === n ? '700' : '500' }}>{n}</Text>}
    </Pressable>
  );
  return (
    <View style={{ marginVertical: 12, alignItems: 'center' }}>
      <View style={{ flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 2 }}>
        {boton(actual - 1, 'anterior', actual === 1)}
        {paginasVisibles(actual, total).map((n, i) => n === '…'
          ? <Text key={`salto-${i}`} style={{ color: INK.meta, alignSelf: 'center', paddingHorizontal: 3 }}>…</Text>
          : boton(n))}
        {boton(actual + 1, 'siguiente', actual === total)}
      </View>
    </View>
  );
}

function Reintentar({ children, onPress }) {
  return <View style={{ paddingVertical: 10 }}><Text style={{ color: INK.body }}>{children}</Text>
    <Pressable onPress={() => onPress()} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}>
      <Text style={{ color: TINTA }}>volver a intentar</Text>
    </Pressable></View>;
}

export function Iniciativa({ ini, resumen, notas = [] }) {
  const [abierta, setAbierta] = useState(false);
  const [resumenAbierto, setResumenAbierto] = useState(false);
  const parada = ini.etapa ?? etapaDe(ini, notas);
  const rotulo = ROTULOS_ETAPA[parada];
  const enlace = enlaceDe(ini, notas);
  const [errorEnlace, setErrorEnlace] = useState(false);
  const fecha = ini.fecha_presentacion || ini.fecha_conocio_pleno;
  const ponentes = nombres(ini.ponentes);
  const eventos = [...(ini.eventos_timeline || [])].sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  const Flecha = abierta ? ChevronUp : ChevronDown;
  return (
    <View style={{ padding: 14, marginVertical: 7, borderWidth: 1, borderColor: RAYA, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.6)' }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Rotulo>{[`INICIATIVA ${ini.numero}`, rotulo].filter(Boolean).join(' · ')}</Rotulo>
        </View>
        {fecha ? <Text style={{ fontSize: 11, color: INK.faint, marginBottom: 5 }}>{fechaCorta(fecha)}</Text> : null}
      </View>
      <Titulo>{limpiarTitulo(ini.titulo)}</Titulo>
      {resumen ? (
        <View>
        <Text numberOfLines={resumenAbierto ? undefined : 3} style={{ fontSize: 13.5, color: INK.body, lineHeight: 20, marginTop: 7 }}>
          {resumen}
        </Text>
        <Pressable onPress={() => setResumenAbierto((v) => !v)} accessibilityRole="button" accessibilityLabel={`${resumenAbierto ? 'cerrar resumen' : 'leer resumen completo'}, iniciativa ${ini.numero}`} accessibilityState={{ expanded: resumenAbierto }} style={{ minHeight: 44, justifyContent: 'center' }}>
          <Text style={{ fontSize: 12, color: TINTA }}>{resumenAbierto ? 'resumir' : 'leer resumen completo'}</Text>
        </Pressable>
        </View>
      ) : <Text style={{ fontSize: 13, color: INK.meta, marginTop: 7 }}>Resumen aún no disponible. Podés consultar la fuente.</Text>}
      {parada ? <Camino etapa={parada} /> : null}
      {ponentes.length ? <Text style={{ fontSize: 12, color: INK.faint, marginTop: 8 }}>{ponentes.join(' · ')}</Text> : null}
      {enlace ? (
        <Pressable onPress={() => { setErrorEnlace(false); Linking.openURL(enlace.url).catch(() => setErrorEnlace(true)); }}
          accessibilityRole="link" accessibilityLabel={`${enlace.titulo}, iniciativa ${ini.numero}`}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, marginTop: 10, borderWidth: 1, borderColor: RAYA, borderRadius: 10 }}>
          <FileText size={20} color={TINTA} />
          <View style={{ flex: 1 }}><Text style={{ fontSize: 13, color: TINTA, fontWeight: '600' }}>{enlace.titulo}</Text>
            <Text style={{ fontSize: 11, color: INK.meta, marginTop: 2 }}>{enlace.tipo === 'PDF' ? 'PDF · Congreso de la República' : 'consultar la fuente'}</Text></View>
        </Pressable>
      ) : <Text style={{ fontSize: 12, color: INK.meta, marginTop: 8 }}>Documento aún no disponible.</Text>}
      {errorEnlace ? <Text accessibilityLiveRegion="polite" style={{ fontSize: 12, color: INK.body }}>No se pudo abrir. Probá de nuevo.</Text> : null}
      <Pressable onPress={() => setAbierta((x) => !x)} accessibilityRole="button" accessibilityState={{ expanded: abierta }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44 }}>
        <Text style={{ fontSize: 12, color: INK.meta }}>{abierta ? 'menos' : 'su recorrido'}</Text>
        <Flecha size={13} color={INK.meta} />
      </Pressable>
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
              </Text>
            </View>
          ))}
          {notas.filter((n) => ROTULOS_ETAPA[n.stage]).map((n) => (
            <Pressable key={n.id} onPress={() => Linking.openURL(n.url).catch(() => setErrorEnlace(true))} disabled={!/^https?:\/\//i.test(n.url || '')} accessibilityRole="link" style={{ minHeight: 44, justifyContent: 'center' }}>
              <Text style={{ color: TINTA, fontSize: 12 }}>{ROTULOS_ETAPA[n.stage].toLowerCase()} · {fechaCorta(n.digest_date)} ›</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
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
  const [abierto, setAbierto] = useState(false);
  const q = useQuery({
    queryKey: ['congreso-sin-numero'],
    queryFn: async () => {
      const { data: filas, error } = await supabase
        .from('iniciativas_sin_numero')
        .select('id, titulo, ponentes, fecha_presentacion, estado, numero_asignado, resumen, fuentes')
        .is('numero_asignado', null)
        .order('fecha_presentacion', { ascending: false, nullsFirst: false })
        .limit(20);
      if (error) throw error;
      return filas || [];
    },
    staleTime: 30 * 60 * 1000,
  });
  const data = q.data || [];
  if (q.isError) return <Reintentar onPress={q.refetch}>No se pudieron traer las propuestas sin número.</Reintentar>;
  if (!data.length) return null;
  return (
    <View style={{ marginTop: 6, marginBottom: 10, padding: 14, borderRadius: 16, backgroundColor: 'rgba(28,43,34,0.04)' }}>
      <Pressable onPress={() => setAbierto((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: abierto }}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 }}>
        <Rotulo color={INK.meta}>TODAVÍA SIN NÚMERO · {data.length}</Rotulo>
        {abierto ? <ChevronUp size={16} color={INK.meta} /> : <ChevronDown size={16} color={INK.meta} />}
      </Pressable>
      {abierto ? data.map((s) => {
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
            {s.resumen ? (
              <Text numberOfLines={3} style={{ fontSize: 13, color: INK.body, lineHeight: 18, marginTop: 3 }}>
                {s.resumen}
              </Text>
            ) : null}
            <Text style={{ fontSize: 11.5, color: INK.faint, marginTop: 3 }}>
              {etiqueta}
              {s.fecha_presentacion ? ` · ${fechaCorta(s.fecha_presentacion)}` : ''}
            </Text>
          </Pressable>
        );
      }) : null}
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
