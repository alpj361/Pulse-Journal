import { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useQuery } from '@tanstack/react-query';
import Animated, { FadeIn } from 'react-native-reanimated';
import { BookOpen, ChevronDown, ChevronRight, Code, PanelTop, Radar } from 'lucide-react-native';
import { INK } from '../theme';
import { TEMAS } from '../feed/temas';
import { supabase } from '../../utils/supabase';
import MorphingInfinity from '../MorphingInfinity';
import { leerArtifact } from './api';
import { resumenPlano } from './logica';
import Elemento from './Elemento';
import { Avatar, TONO } from './piezas';

/**
 * Un bloque de un mensaje (contrato `openui.v1`, pantalla 4 del diseño).
 *
 * Texto, adjuntos, código y la referencia a un artifact. Lo demás todavía no
 * existe en la app y no se dibuja (ver `SE_VEN` en logica.js).
 */
export default function Bloque({ bloque, mio, onAbrirItem, onAbrirMio, onAbrirArtifact, onAbrirSeguimiento, onAbrirMonitoreo, onAbrirContacto, onReenviar }) {
  const p = bloque?.payload || {};
  switch (bloque?.type) {
    case 'text':
      return <Burbuja texto={p.text} mio={mio} />;
    case 'code':
      return <Codigo contenido={p.contenido} />;
    case 'attachment':
      if (p.tipo === 'seguimiento' || p.tipo === 'monitor') {
        return <MonitoreoRef id={p.ref_id} tema={p.meta?.titulo || p.meta?.tema} onAbrir={onAbrirMonitoreo} onReenviar={onReenviar} adjunto={p} />;
      }
      if (p.tipo === 'agente') return <ContactoRef id={p.ref_id} nombre={p.meta?.nombre || p.meta?.titulo} de={p.meta?.de} mio={mio} onAbrir={onAbrirContacto} />;
      return p.tipo === 'snippet' || p.tipo === 'code' ? (
        <Codigo contenido={p.contenido} />
      ) : (
        <Adjunto adjunto={p} mio={mio} onAbrirItem={mio ? onAbrirMio : onAbrirItem} onReenviar={onReenviar} />
      );
    case 'artifact_ref':
      return <ArtifactRef id={p.ref_id} onAbrir={onAbrirArtifact} onReenviar={onReenviar} />;
    case 'seguimiento_ref':
      // Sin hallazgo es un monitoreo compartido (su estructura), no un aviso.
      if (!p.hallazgo_id && !p.url) {
        return <MonitoreoRef id={p.seguimiento_id} tema={p.tema || p.resumen?.tema} onAbrir={onAbrirMonitoreo} onReenviar={onReenviar} />;
      }
      return <SeguimientoRef ref_={p} onAbrir={onAbrirSeguimiento} />;
    case 'contacto_ref':
      return <ContactoRef id={p.agent_id || p.agente_id || p.ref_id} nombre={p.nombre} de={p.de || p.owner_nombre} mio={mio} onAbrir={onAbrirContacto} />;
    default:
      return null;
  }
}

function Burbuja({ texto, mio }) {
  if (!texto) return null;
  return (
    <View
      style={{
        alignSelf: mio ? 'flex-end' : 'flex-start',
        maxWidth: '86%',
        backgroundColor: mio ? TONO.verde : TONO.tarjeta,
        borderWidth: mio ? 0 : 1,
        borderColor: 'rgba(28,43,34,0.08)',
        borderRadius: 18,
        borderBottomLeftRadius: mio ? 18 : 6,
        borderBottomRightRadius: mio ? 6 : 18,
        paddingVertical: 9,
        paddingHorizontal: 13,
      }}
    >
      <Text selectable style={{ fontSize: 14.5, lineHeight: 20, color: mio ? '#FFFFFF' : '#2E3B33' }}>
        {texto}
      </Text>
    </View>
  );
}

function Tarjeta({ children, onPress, onLongPress, accessibilityLabel }) {
  const estilo = {
    alignSelf: 'flex-start',
    width: '86%',
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    backgroundColor: TONO.tarjeta,
    borderWidth: 1,
    borderColor: 'rgba(28,43,34,0.08)',
    borderRadius: 14,
    paddingVertical: 9,
    paddingHorizontal: 11,
  };
  if (!onPress && !onLongPress) return <View style={estilo}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [estilo, { opacity: pressed ? 0.6 : 1 }]}
    >
      {children}
    </Pressable>
  );
}

function Icono({ Componente, tema }) {
  return (
    <View
      accessible={false}
      style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: tema.lavado[0], alignItems: 'center', justifyContent: 'center' }}
    >
      <Componente size={16} color={tema.tinta} strokeWidth={1.8} />
    </View>
  );
}

const QUE_ES = {
  item: 'ítem',
  noticia: 'noticia',
  news_card: 'noticia',
  artifact: 'artifact',
  visualization: 'visualización',
  preset: 'preset',
};

/**
 * La foto de algo del Codex, por su id: se busca al mostrarlo en vez de viajar
 * en el mensaje. Si no es tuyo o no tiene, queda en nada y va el ícono.
 */
function useFotoDe(id, deMeta) {
  const { data } = useQuery({
    queryKey: ['codex-foto', id],
    enabled: !!id && !deMeta,
    staleTime: 1000 * 60 * 30,
    retry: false,
    queryFn: async () => {
      const { data: fila } = await supabase.from('codex_universe_items').select('thumbnail_url').eq('id', id).maybeSingle();
      return fila?.thumbnail_url || null;
    },
  });
  return deMeta || data || null;
}

/** Algo de un Codex, una noticia o una visualización, por su id. */
function Adjunto({ adjunto, mio, onAbrirItem, onReenviar }) {
  const meta = adjunto.meta || {};
  const titulo = meta.titulo || meta.title || meta.nombre || QUE_ES[adjunto.tipo] || 'adjunto';
  const tipo = meta.clave || meta.tipo || QUE_ES[adjunto.tipo] || adjunto.tipo;
  const esItem = adjunto.tipo === 'item' && adjunto.ref_id;
  // Lo del agente se abre en Su Codex; lo mío, en su propia pantalla.
  const abrir = esItem && onAbrirItem ? () => onAbrirItem(adjunto.ref_id) : null;
  const foto = useFotoDe(esItem ? adjunto.ref_id : null, meta.imagen || meta.thumbnail_url);
  return (
    <Elemento
      titulo={titulo}
      tipo={tipo}
      imagen={foto}
      mio={mio}
      onPress={abrir}
      onLongPress={onReenviar && adjunto.ref_id ? () => onReenviar({ tipo: adjunto.tipo, ref_id: adjunto.ref_id, meta }) : null}
      derecha={abrir ? <ChevronRight size={16} color={INK.meta} /> : null}
    />
  );
}

function Codigo({ contenido }) {
  if (!contenido) return null;
  return (
    <View style={{ alignSelf: 'flex-start', width: '86%', backgroundColor: '#1F2A24', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12 }}>
      <View style={{ position: 'absolute', top: 8, right: 10 }} accessible={false}>
        <Code size={13} color="rgba(217,228,220,0.45)" />
      </View>
      <Text selectable style={{ fontFamily: 'Menlo', fontSize: 11.5, lineHeight: 16, color: '#D9E4DC' }}>
        {String(contenido)}
      </Text>
    </View>
  );
}

/** Un artifact, por referencia: su título, versión y fuentes. Se abre al tocarlo. */
function ArtifactRef({ id, onAbrir, onReenviar }) {
  const { data } = useQuery({
    queryKey: ['colab-artifact', id],
    queryFn: () => leerArtifact(id),
    enabled: !!id,
    staleTime: 1000 * 60 * 10,
    retry: false,
  });
  const fuentes = Array.isArray(data?.fuentes) ? data.fuentes.length : 0;
  const detalle = ['artifact', data?.version ? `versión ${data.version}` : null, fuentes ? `${fuentes} ${fuentes === 1 ? 'fuente' : 'fuentes'}` : null]
    .filter(Boolean)
    .join(' · ');
  return (
    <Tarjeta
      onPress={onAbrir && id ? () => onAbrir(id) : null}
      onLongPress={onReenviar && id ? () => onReenviar({ tipo: 'artifact', ref_id: id, meta: { titulo: String(data?.titulo || 'Dashboard').slice(0, 500), tipo: 'dashboard', clave: 'dashboard' } }) : null}
      accessibilityLabel={`${data?.titulo || 'Artifact'}, ${detalle}`}
    >
      <Icono Componente={PanelTop} tema={TEMAS.Economía} />
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={{ fontSize: 13.5, fontWeight: '700', color: INK.title }} numberOfLines={2}>
          {data?.titulo || 'Artifact'}
        </Text>
        <Text style={{ fontSize: 11.5, color: INK.meta }}>{detalle}</Text>
      </View>
      {onAbrir ? <ChevronRight size={16} color={INK.meta} /> : null}
    </Tarjeta>
  );
}

/**
 * Algo urgente de un tema que sigue el agente: el tema, lo que encontró y de
 * dónde. Al tocarla se abre ahí mismo (título entero, resumen, medio y fecha)
 * para decidir antes de ir a la nota; solo si no trae enlace, va al tema.
 */
function SeguimientoRef({ ref_: p, onAbrir }) {
  const [abierta, setAbierta] = useState(false);
  const fuente = { noticias: 'noticia', congreso_items: 'Congreso', iniciativas: 'iniciativa', pc_items: 'Poder Ciudadano', trending_tweets: 'redes' }[p.fuente_tipo] || p.fuente_nombre || '';
  const alTocar = p.url ? () => setAbierta((a) => !a) : onAbrir && p.seguimiento_id ? () => onAbrir(p.seguimiento_id) : null;
  return (
    <Pressable
      onPress={alTocar}
      disabled={!alTocar}
      accessibilityRole="button"
      accessibilityState={p.url ? { expanded: abierta } : undefined}
      accessibilityLabel={`Urgente en ${p.tema || 'un tema'}: ${p.titulo || ''}`}
      style={({ pressed }) => ({
        alignSelf: 'flex-start',
        width: '86%',
        backgroundColor: TONO.tarjeta,
        borderWidth: 1,
        borderColor: 'rgba(28,43,34,0.08)',
        borderRadius: 14,
        paddingVertical: 9,
        paddingHorizontal: 11,
        gap: 10,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
        <Icono Componente={Radar} tema={TEMAS.Violencia} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 0.8, color: TONO.ladrillo }} numberOfLines={abierta ? undefined : 1}>
            {`URGENTE${p.tema ? ` · ${String(p.tema).toUpperCase()}` : ''}`}
          </Text>
          <Text style={{ fontSize: 13.5, fontWeight: '700', color: INK.title }} numberOfLines={abierta ? undefined : 3}>
            {p.titulo || 'Encontró algo'}
          </Text>
          {fuente && !abierta ? <Text style={{ fontSize: 11.5, color: INK.meta }}>{fuente}</Text> : null}
        </View>
        {!alTocar ? null : p.url && abierta ? <ChevronDown size={16} color={INK.meta} /> : <ChevronRight size={16} color={INK.meta} />}
      </View>
      {abierta ? <LaNota url={p.url} esNoticia={p.fuente_tipo === 'noticias'} /> : null}
    </Pressable>
  );
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** «hoy», «ayer» o «27 oct», de una fecha `AAAA-MM-DD`. */
function diaCorto(fecha, ahora = new Date()) {
  const [a, m, d] = String(fecha || '').slice(0, 10).split('-').map(Number);
  if (!a || !m || !d) return '';
  const dias = Math.round((new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()) - new Date(a, m - 1, d)) / 86400000);
  if (dias === 0) return 'hoy';
  if (dias === 1) return 'ayer';
  return `${d} ${MESES[m - 1]}`;
}

function dominio(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** Lo que dice la nota, antes de abrirla: resumen, medio y fecha. */
function LaNota({ url, esNoticia }) {
  const { data, isLoading } = useQuery({
    queryKey: ['nota-por-url', url],
    enabled: esNoticia && !!url,
    staleTime: 1000 * 60 * 60,
    retry: false,
    queryFn: async () => {
      const { data: filas, error } = await supabase.from('news').select('titulo, resumen, fuente, fecha').eq('url', url).order('fecha', { ascending: false }).limit(1);
      if (error) throw error;
      return filas?.[0] || null;
    },
  });
  const resumen = resumenPlano(data?.resumen);
  const pie = [data?.fuente || dominio(url), diaCorto(data?.fecha)].filter(Boolean).join(' · ');
  return (
    <Animated.View entering={FadeIn.duration(180)} style={{ gap: 10, paddingLeft: 2 }}>
      {esNoticia && isLoading ? (
        <MorphingInfinity size={18} color={INK.meta} style={{ alignSelf: 'flex-start' }} />
      ) : resumen ? (
        <Text style={{ fontSize: 13, lineHeight: 18.5, color: INK.body }}>{resumen}</Text>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Text style={{ flex: 1, fontSize: 11.5, color: INK.meta }} numberOfLines={1}>
          {pie}
        </Text>
        <Pressable
          onPress={() => WebBrowser.openBrowserAsync(url).catch(() => Linking.openURL(url).catch(() => {}))}
          hitSlop={6}
          accessibilityRole="link"
          accessibilityLabel="Leer la nota"
          style={({ pressed }) => ({
            width: 38,
            height: 38,
            borderRadius: 19,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: 'rgba(28,43,34,0.16)',
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <BookOpen size={17} color={INK.title} strokeWidth={1.9} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

/**
 * Un monitoreo compartido: su tema. Se abre en lectura y desde ahí se puede
 * seguir con un agente tuyo.
 */
function MonitoreoRef({ id, tema, adjunto, onAbrir, onReenviar }) {
  return (
    <Tarjeta
      onPress={onAbrir && id ? () => onAbrir(id) : null}
      onLongPress={onReenviar && id ? () => onReenviar(adjunto || { tipo: 'seguimiento', ref_id: id, meta: { titulo: String(tema || 'Monitoreo').slice(0, 500), clave: 'seguimiento' } }) : null}
      accessibilityLabel={`Monitoreo: ${tema || ''}`}
    >
      <Icono Componente={Radar} tema={TEMAS.Violencia} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 0.8, color: TONO.ladrillo }}>MONITOREO</Text>
        <Text style={{ fontSize: 13.5, fontWeight: '700', color: INK.title }} numberOfLines={2}>
          {tema || 'Un tema'}
        </Text>
      </View>
      {onAbrir ? <ChevronRight size={16} color={INK.meta} /> : null}
    </Tarjeta>
  );
}

/**
 * Un agente compartido como contacto, como en WhatsApp. Quien lo recibe le
 * puede escribir; su Codex sigue siendo de su dueño.
 */
function ContactoRef({ id, nombre, de, mio, onAbrir }) {
  const n = nombre || 'Agente';
  return (
    <View
      style={{
        alignSelf: mio ? 'flex-end' : 'flex-start',
        width: '72%',
        backgroundColor: 'rgba(255,255,255,0.9)',
        borderWidth: 1,
        borderColor: 'rgba(28,43,34,0.1)',
        borderRadius: 16,
        overflow: 'hidden',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 }}>
        <Avatar tipo="agente" nombre={n} size={44} />
        <View style={{ flex: 1, gap: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: INK.title }} numberOfLines={1}>
            {n}
          </Text>
          {de ? <Text style={{ fontSize: 12, color: INK.meta }}>{`de ${de}`}</Text> : null}
        </View>
      </View>
      {!mio && onAbrir && id ? (
        <Pressable
          onPress={() => onAbrir(id)}
          accessibilityRole="button"
          accessibilityLabel={`Escribirle a ${n}`}
          style={({ pressed }) => ({ borderTopWidth: 1, borderTopColor: 'rgba(28,43,34,0.08)', paddingVertical: 11, alignItems: 'center', opacity: pressed ? 0.6 : 1 })}
        >
          <Text style={{ fontSize: 14.5, fontWeight: '600', color: TONO.verde }}>escribirle</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
