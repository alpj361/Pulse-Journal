import { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useQuery } from '@tanstack/react-query';
import Animated, { FadeIn } from 'react-native-reanimated';
import { AlignLeft, BookOpen, ChevronDown, ChevronRight, Code, Link2, PanelTop, Radar } from 'lucide-react-native';
import { INK } from '../theme';
import { TEMAS } from '../feed/temas';
import { supabase } from '../../utils/supabase';
import MorphingInfinity from '../MorphingInfinity';
import { leerArtifact } from './api';
import { resumenPlano } from './logica';
import { TONO } from './piezas';

/**
 * Un bloque de un mensaje (contrato `openui.v1`, pantalla 4 del diseño).
 *
 * Texto, adjuntos, código y la referencia a un artifact. Lo demás todavía no
 * existe en la app y no se dibuja (ver `SE_VEN` en logica.js).
 */
export default function Bloque({ bloque, mio, onAbrirItem, onAbrirArtifact, onAbrirSeguimiento }) {
  const p = bloque?.payload || {};
  switch (bloque?.type) {
    case 'text':
      return <Burbuja texto={p.text} mio={mio} />;
    case 'code':
      return <Codigo contenido={p.contenido} />;
    case 'attachment':
      return p.tipo === 'snippet' || p.tipo === 'code' ? (
        <Codigo contenido={p.contenido} />
      ) : (
        <Adjunto adjunto={p} onAbrirItem={onAbrirItem} />
      );
    case 'artifact_ref':
      return <ArtifactRef id={p.ref_id} onAbrir={onAbrirArtifact} />;
    case 'seguimiento_ref':
      return <SeguimientoRef ref_={p} onAbrir={onAbrirSeguimiento} />;
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

function Tarjeta({ children, onPress, accessibilityLabel }) {
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
  if (!onPress) return <View style={estilo}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
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

/** Algo de un Codex, una noticia o una visualización, por su id. */
function Adjunto({ adjunto, onAbrirItem }) {
  const meta = adjunto.meta || {};
  const titulo = meta.titulo || meta.title || meta.nombre || QUE_ES[adjunto.tipo] || 'adjunto';
  const tipo = meta.tipo ? String(meta.tipo).toLowerCase() : QUE_ES[adjunto.tipo] || adjunto.tipo;
  const esItem = adjunto.tipo === 'item' && adjunto.ref_id;
  const abrir = esItem && onAbrirItem ? () => onAbrirItem(adjunto.ref_id) : null;
  return (
    <Tarjeta onPress={abrir} accessibilityLabel={`${titulo}, ${tipo}`}>
      <Icono Componente={adjunto.tipo === 'item' ? AlignLeft : Link2} tema={adjunto.tipo === 'item' ? TEMAS.Política : TEMAS.Economía} />
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={{ fontSize: 13.5, fontWeight: '700', color: INK.title }} numberOfLines={2}>
          {titulo}
        </Text>
        <Text style={{ fontSize: 11.5, color: INK.meta }}>{esItem ? `${tipo} · en su Codex` : tipo}</Text>
      </View>
      {abrir ? <ChevronRight size={16} color={INK.meta} /> : null}
    </Tarjeta>
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
function ArtifactRef({ id, onAbrir }) {
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
    <Tarjeta onPress={onAbrir && id ? () => onAbrir(id) : null} accessibilityLabel={`${data?.titulo || 'Artifact'}, ${detalle}`}>
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
