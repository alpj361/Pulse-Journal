import { useMemo, useRef, useState } from 'react';
import { Linking, Pressable, Text, TextInput, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight, FileText } from 'lucide-react-native';
import { supabase } from '../../utils/supabase';
import { INK } from '../theme';
import { Camino, RAYA, Rotulo, TINTA, Titulo, VotacionCongreso, cabezaDe, useDiputados } from './TarjetasCongreso';
import { CLASES, repartirActores } from './clasesCongreso';
import Pegatina from './Pegatina';
import { nombreDelDia } from './congreso';
import FiltroChips from './FiltroChips';
import { anoDecreto, buscarRegistro, fechaRegistro, periodoDe, resultadoVotacion } from './organizacion';
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
    queryKey: ['congreso-conteos-legislativos-v2'],
    queryFn: async () => {
      const [ini, dec, votos] = await Promise.all([
        supabase.from('iniciativas_app_view').select('numero', { count: 'exact', head: true }),
        supabase.from('pc_congreso_decretos_view').select('numero', { count: 'exact', head: true }),
        supabase.from('votaciones').select('id', { count: 'exact', head: true }),
      ]);
      for (const r of [ini, dec, votos]) if (r.error) throw r.error;
      return { iniciativas: ini.count || 0, leyes: dec.count || 0, votaciones: votos.count || 0 };
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
      <EncabezadoRegistro titulo="Iniciativas" datos={(q.data || []).map((i) => ({ fecha: i.fecha_presentacion || i.fecha_conocio_pleno }))} />
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
      ) : <Text style={{ fontSize: 13, color: INK.meta, marginTop: 7 }}>Resumen aún no disponible. Puedes consultar la fuente.</Text>}
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
      {errorEnlace ? <Text accessibilityLiveRegion="polite" style={{ fontSize: 12, color: INK.body }}>No se pudo abrir. Prueba de nuevo.</Text> : null}
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

/**
 * Una iniciativa que salió en el tablero, igual que en «Organizado».
 *
 * Si la nota trae número, se busca su ficha en el registro y se dibuja la misma
 * tarjeta de la lista de iniciativas. Si todavía no tiene número —una recién
 * presentada—, se arma con lo que dice la nota: de qué trata, dónde va y
 * quiénes la presentaron.
 */
export function IniciativaDeNota({ item, onAbrir, onEntidad }) {
  const numero = item.iniciativa_numero || item.card_data?.iniciativa_numero || null;
  const c = CLASES.iniciativa;
  const diputados = useDiputados();
  const { data: ini, isLoading } = useQuery({
    queryKey: ['congreso-iniciativa', numero],
    queryFn: async () => {
      const { data, error } = await supabase.from('iniciativas_app_view').select(COLUMNAS_INICIATIVA).eq('numero', numero).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!numero,
    staleTime: 10 * 60 * 1000,
  });
  const pegatina = <Pegatina texto={c.nombre} paleta={c.paleta} sticker={c.sticker} respaldo={c.respaldo} id={item.id} style={{ marginBottom: 4 }} />;
  const { titulo, resumen } = cabezaDe(item);
  if (numero && (isLoading || ini)) {
    return (
      <View style={{ paddingTop: 18, paddingBottom: 8 }}>
        {pegatina}
        {/* Lo que pasó hoy con ella: la tarjeta del registro dice qué es, la
            nota dice por qué está en el tablero. */}
        <Pressable onPress={() => onAbrir?.(item)} accessibilityRole="button" accessibilityLabel={`abrir noticia, ${titulo}`}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, marginTop: 4, opacity: pressed ? 0.6 : 1 })}>
          <Text style={{ flex: 1, fontSize: 14, lineHeight: 19, color: INK.body }}>{titulo}</Text>
          <ChevronRight size={16} color={TINTA} />
        </Pressable>
        {ini ? <Iniciativa ini={ini} notas={[item]} /> : <Cargando>Trayendo la iniciativa {numero}…</Cargando>}
      </View>
    );
  }
  const ponentes = repartirActores(item.actors, diputados).diputados;
  const rotulo = [numero ? `INICIATIVA ${numero}` : 'SIN NÚMERO TODAVÍA', ROTULOS_ETAPA[item.stage]].filter(Boolean).join(' · ');
  return (
    <View style={{ paddingTop: 18, paddingBottom: 8 }}>
      {pegatina}
      <Pressable onPress={() => onAbrir?.(item)} accessibilityRole="button"
        style={({ pressed }) => ({ padding: 14, marginVertical: 7, borderWidth: 1, borderColor: RAYA, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.6)', opacity: pressed ? 0.7 : 1 })}>
        <Rotulo>{rotulo}</Rotulo>
        <Titulo>{titulo}</Titulo>
        {resumen ? <Text numberOfLines={3} style={{ fontSize: 13.5, color: INK.body, lineHeight: 20, marginTop: 7 }}>{resumen}</Text> : null}
        <Camino etapa={item.stage} />
        {ponentes.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 6, marginTop: 12 }}>
            {ponentes.slice(0, 5).map((p) => (
              <Pressable key={p.nombre} onPress={(ev) => { ev.stopPropagation(); onEntidad?.(p.nombre); }} accessibilityRole="link" hitSlop={{ top: 6, bottom: 6 }}>
                <Text style={{ fontSize: 12.5, color: TINTA, textDecorationLine: 'underline', textDecorationColor: `${TINTA}55` }}>
                  {p.nombre}{p.bloque ? <Text style={{ color: INK.faint, textDecorationLine: 'none' }}>{` · ${p.bloque}`}</Text> : null}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        <Text style={{ fontSize: 13, color: TINTA, fontWeight: '600', marginTop: 12 }}>abrir noticia ›</Text>
      </Pressable>
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

/** Registros completos: su contenido no depende de los días del tablero. */
export function ListaLeyes({ onPagina }) {
  const q = useQuery({
    queryKey: ['congreso-decretos-registro-v2'],
    queryFn: async () => (await registroCompleto('pc_congreso_decretos_view', 'numero, fecha, resumen, pdf_url', 'numero'))
      .sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')) || String(b.numero).localeCompare(String(a.numero), undefined, { numeric: true })),
    staleTime: 30 * 60 * 1000,
  });
  const [ano, setAno] = useState('todos');
  const [texto, setTexto] = useState('');
  const [pagina, setPagina] = useState(1);
  const ancla = useRef(null);
  const datos = q.data || [];
  const anos = [...new Set(datos.map(anoDecreto).filter(Boolean))].sort().reverse();
  const filas = datos.filter((d) => (ano === 'todos' || anoDecreto(d) === ano) && buscarRegistro(`${d.numero} ${d.resumen || ''}`, texto));
  const total = Math.max(1, Math.ceil(filas.length / PAGINA));
  const actual = Math.min(pagina, total);
  const cambiar = (n) => { setPagina(n); onPagina?.(ancla.current); };
  return (
    <View>
      <EncabezadoRegistro titulo="Leyes y decretos" datos={datos} />
      <View ref={ancla} collapsable={false}>
        <BuscadorRegistro valor={texto} onCambiar={(v) => { setTexto(v); setPagina(1); }} etiqueta="buscar decreto por número o tema" />
        <FiltroChips valor={ano} onCambiar={(v) => { setAno(v); setPagina(1); }} opciones={[
          { clave: 'todos', nombre: 'todos los años', cuenta: datos.length },
          ...anos.map((a) => ({ clave: a, nombre: a, cuenta: datos.filter((d) => anoDecreto(d) === a).length })),
        ]} />
      </View>
      <EstadoRegistro q={q} vacio={!filas.length} />
      <Paginado actual={actual} total={total} onCambiar={cambiar} />
      {filas.slice((actual - 1) * PAGINA, actual * PAGINA).map((d) => <Decreto key={d.numero} decreto={d} />)}
      <CuentaRegistro pagina={actual} cantidad={filas.length} unidad="decretos" />
      <Paginado actual={actual} total={total} onCambiar={cambiar} />
    </View>
  );
}

export function Decreto({ decreto: d }) {
  const [error, setError] = useState(false);
  const enlace = /^https?:\/\//i.test(d.pdf_url || '') ? d.pdf_url : null;
  return (
    <View style={CARD_REGISTRO}>
      <Rotulo>{`DECRETO ${d.numero}`}</Rotulo>
      <Titulo>{d.resumen || `Decreto ${d.numero}`}</Titulo>
      {d.fecha ? <Text style={{ color: INK.meta, fontSize: 12, marginTop: 8 }}>{fechaRegistro(d.fecha)}</Text> : null}
      {enlace ? <Pressable accessibilityRole="link" accessibilityLabel={`documento del decreto ${d.numero}`}
        onPress={() => { setError(false); Linking.openURL(enlace).catch(() => setError(true)); }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 50, paddingHorizontal: 12, marginTop: 12, borderWidth: 1, borderColor: RAYA, borderRadius: 10 }}>
        <FileText size={20} color={TINTA} /><Text style={{ color: TINTA, fontSize: 13, fontWeight: '600', flex: 1 }}>documento del decreto</Text>
      </Pressable> : <Text style={{ fontSize: 12, color: INK.meta, marginTop: 12 }}>Documento aún no disponible.</Text>}
      {error ? <Text accessibilityLiveRegion="polite" style={{ color: INK.body, marginTop: 6 }}>No se pudo abrir. Prueba de nuevo.</Text> : null}
    </View>
  );
}

export function ListaVotaciones({ onPagina }) {
  const q = useQuery({
    queryKey: ['congreso-votaciones-registro'],
    queryFn: async () => (await registroCompleto('votaciones', 'id, fecha, sesion, asunto, resultado, a_favor, en_contra, ausentes, licencia, iniciativa_numero', 'id'))
      .sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')) || String(b.id).localeCompare(String(a.id))),
    staleTime: 10 * 60 * 1000,
  });
  const [texto, setTexto] = useState('');
  const [resultado, setResultado] = useState('todas');
  const [pagina, setPagina] = useState(1);
  const ancla = useRef(null);
  const datos = q.data || [];
  const buscadas = datos.filter((v) => buscarRegistro(`${v.asunto || ''} ${v.sesion || ''} ${v.iniciativa_numero || ''}`, texto));
  const filas = buscadas.filter((v) => resultado === 'todas' || resultadoVotacion(v) === resultado);
  const total = Math.max(1, Math.ceil(filas.length / PAGINA));
  const actual = Math.min(pagina, total);
  const cambiar = (n) => { setPagina(n); onPagina?.(ancla.current); };
  const opciones = [['todas', 'todas'], ['aprobada', 'aprobadas'], ['no_aprobada', 'no aprobadas']];
  if (buscadas.some((v) => resultadoVotacion(v) === 'sin_resultado')) opciones.push(['sin_resultado', 'sin resultado']);
  return (
    <View>
      <EncabezadoRegistro titulo="Votaciones" datos={datos} />
      <View ref={ancla} collapsable={false}>
        <BuscadorRegistro valor={texto} onCambiar={(v) => { setTexto(v); setPagina(1); }} etiqueta="buscar votación por asunto o iniciativa" />
        <FiltroChips valor={resultado} onCambiar={(v) => { setResultado(v); setPagina(1); }} opciones={opciones.map(([clave, nombre]) => ({ clave, nombre,
          cuenta: clave === 'todas' ? buscadas.length : buscadas.filter((v) => resultadoVotacion(v) === clave).length }))} />
      </View>
      <EstadoRegistro q={q} vacio={!filas.length} />
      <Paginado actual={actual} total={total} onCambiar={cambiar} />
      {filas.slice((actual - 1) * PAGINA, actual * PAGINA).map((v) => (
        <View key={v.id} style={CARD_REGISTRO}>
          <Text style={{ color: INK.meta, fontSize: 12 }}>{fechaRegistro(v.fecha)}</Text>
          <VotacionCongreso votacion={v} compacta />
        </View>
      ))}
      <CuentaRegistro pagina={actual} cantidad={filas.length} unidad="votaciones" />
      <Paginado actual={actual} total={total} onCambiar={cambiar} />
    </View>
  );
}

export const CARD_REGISTRO = { padding: 14, marginVertical: 7, borderWidth: 1, borderColor: RAYA, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.6)' };

export function BuscadorRegistro({ valor, onCambiar, etiqueta }) {
  return <TextInput value={valor} onChangeText={onCambiar} placeholder={etiqueta} accessibilityLabel={etiqueta} placeholderTextColor={INK.meta}
    autoCorrect={false} returnKeyType="search" style={{ minHeight: 44, borderWidth: 1, borderColor: RAYA, borderRadius: 12, paddingHorizontal: 12, color: INK.title, fontSize: 14 }} />;
}

export function EncabezadoRegistro({ titulo, datos }) {
  const periodo = periodoDe(datos);
  return <View style={{ marginBottom: 14 }}><Titulo>{titulo}</Titulo>
    <Text style={{ fontSize: 12, color: INK.meta, lineHeight: 18, marginTop: 4 }}>historial disponible{periodo ? ` · ${periodo}` : ''}</Text>
  </View>;
}

export function EstadoRegistro({ q, vacio }) {
  if (q.isLoading) return <Cargando>Trayendo el registro…</Cargando>;
  if (q.isError) return <Reintentar onPress={q.refetch}>No se pudo traer el registro.</Reintentar>;
  return vacio ? <Cargando>No hay resultados para esta búsqueda.</Cargando> : null;
}

export function CuentaRegistro({ pagina, cantidad, unidad, tamano = PAGINA }) {
  if (!cantidad) return null;
  return <Text accessibilityLiveRegion="polite" style={{ fontSize: 12, color: INK.meta, marginTop: 12 }}>
    {(pagina - 1) * tamano + 1}–{Math.min(pagina * tamano, cantidad)} de {cantidad} {unidad}
  </Text>;
}

function Cargando({ children }) {
  return <Text style={{ fontSize: 13, color: INK.meta, paddingVertical: 16 }}>{children}</Text>;
}
