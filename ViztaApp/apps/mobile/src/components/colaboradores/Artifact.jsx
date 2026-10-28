import { useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, Forward } from 'lucide-react-native';
import { INK, SERIF } from '../theme';
import { leerArtifact, titulosDeFuentes } from './api';
import { Boton, EstadoCentro, ROTULO, TONO } from './piezas';
import MorphingInfinity from '../MorphingInfinity';
import Reenviar from './Reenviar';

/**
 * Los tokens de diseño que un artifact HTML puede usar (`var(--pulzos-*)` o
 * clases `pulzos-*`, que el backend exige). La app los define; el HTML no
 * trae estilos propios porque el servidor quita `<style>`.
 */
const ESTILO_PULZOS = `
:root{--pulzos-tinta:${INK.title};--pulzos-cuerpo:#2E3B33;--pulzos-meta:${INK.meta};--pulzos-fondo:#FBFAF6;--pulzos-verde:${TONO.verde};--pulzos-ladrillo:${TONO.ladrillo};--pulzos-borde:rgba(28,43,34,0.1);--pulzos-lavado:rgba(28,43,34,0.05)}
html,body{margin:0;background:var(--pulzos-fondo);color:var(--pulzos-cuerpo);font:16px/1.5 -apple-system,system-ui,sans-serif;-webkit-text-size-adjust:100%}
body{padding:4px 20px 28px}
h1,h2,h3{color:var(--pulzos-tinta);line-height:1.2;margin:1.2em 0 .4em}
h1{font-size:24px}h2{font-size:19px}h3{font-size:16px}
a{color:var(--pulzos-verde);font-weight:600}
img{max-width:100%;height:auto;border-radius:12px}
table{border-collapse:collapse;width:100%;font-size:14px}td,th{border-bottom:1px solid var(--pulzos-borde);padding:8px 6px;text-align:left}
blockquote{margin:0;padding:8px 14px;border-left:3px solid var(--pulzos-borde);color:var(--pulzos-meta)}
hr{border:0;border-top:1px solid var(--pulzos-borde);margin:20px 0}
.pulzos-meta{color:var(--pulzos-meta);font-size:13px}
.pulzos-tarjeta{background:#fff;border:1px solid var(--pulzos-borde);border-radius:14px;padding:12px 14px;margin:10px 0}
`;

const pagina = (html) =>
  `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${ESTILO_PULZOS}</style></head><body>${html}</body></html>`;

/**
 * Un dashboard trae su propio JavaScript (gráficos, filtros, pestañas). Corre
 * encerrado: puede cargar librerías de los CDN conocidos y nada más, y no
 * puede hablar con ningún servidor (`connect-src 'none'`), así que los datos
 * van dentro del HTML y no salen de ahí. No hay puente con la app.
 */
const CDN = 'https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://unpkg.com';
const CSP = [
  "default-src 'none'",
  `script-src 'unsafe-inline' ${CDN}`,
  `style-src 'unsafe-inline' ${CDN} https://fonts.googleapis.com`,
  "font-src https://fonts.gstatic.com data:",
  'img-src https: data: blob:',
  "connect-src 'none'",
  "frame-src 'none'",
  "form-action 'none'",
].join('; ');

const paginaInteractiva = (html) => {
  // Si el agente mandó un documento entero, se le agrega la política y los
  // tokens en su <head>; si mandó solo el cuerpo, se arma la página.
  const cabeza = `<meta http-equiv="Content-Security-Policy" content="${CSP}"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${ESTILO_PULZOS}</style>`;
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (h) => `${h}${cabeza}`);
  return `<!doctype html><html><head><meta charset="utf-8">${cabeza}</head><body>${html}</body></html>`;
};

/** Un dashboard (interactivo) o un HTML de solo lectura. */
export const esInteractivo = (a) => a?.tipo === 'dashboard' || a?.subtipo === 'dashboard' || a?.interactivo === true;

const QUE_FUENTE = { dataset: 'conjunto de datos', codex: 'del Codex', noticia: 'noticia' };

/**
 * Abrir un artifact (pantalla 7). El HTML llega saneado por el servidor y se
 * muestra sin JavaScript; los enlaces se abren afuera. Una visualización o un
 * preset todavía no se dibujan en la app: se ve su título, versión y fuentes.
 */
export default function Artifact({ id, topInset, bottomInset, onVolver }) {
  const consulta = useQuery({
    queryKey: ['colab-artifact', id],
    queryFn: () => leerArtifact(id),
    staleTime: 1000 * 60,
    retry: false,
  });
  const a = consulta.data;
  // El HTML tarda un momento en dibujarse: mientras, el loader de la app.
  const [dibujando, setDibujando] = useState(true);
  const [reenviando, setReenviando] = useState(false);
  const fuentes = useMemo(() => (Array.isArray(a?.fuentes) ? a.fuentes : []), [a]);
  const titulos = useQuery({
    queryKey: ['colab-titulos-fuentes', id],
    queryFn: () => titulosDeFuentes(fuentes),
    enabled: fuentes.length > 0 && !esInteractivo(a),
    staleTime: 1000 * 60,
  });

  const cabecera = (
    <View style={{ paddingTop: topInset + 10, paddingHorizontal: 20, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 6, borderBottomWidth: 1, borderBottomColor: TONO.raya }}>
      <Pressable
        onPress={onVolver}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Volver al chat"
        style={({ pressed }) => ({ width: 44, height: 44, marginLeft: -10, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.5 : 1 })}
      >
        <ChevronLeft size={24} color={INK.title} strokeWidth={2} />
      </Pressable>
      <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: INK.title }} numberOfLines={1}>
        {a?.titulo || ''}
      </Text>
      {/* La versión, solo el número: sin rótulos debajo del título. */}
      {a?.version ? (
        <View
          accessibilityLabel={`versión ${a.version}`}
          style={{ minWidth: 26, height: 26, paddingHorizontal: 8, borderRadius: 13, borderWidth: 1, borderColor: TONO.borde, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ fontSize: 12.5, fontWeight: '700', color: INK.meta }}>{a.version}</Text>
        </View>
      ) : null}
      {a ? (
        <Pressable
          onPress={() => setReenviando(true)}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Reenviar"
          style={({ pressed }) => ({ width: 40, height: 44, marginRight: -8, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.5 : 1 })}
        >
          <Forward size={20} color={INK.title} strokeWidth={1.9} />
        </Pressable>
      ) : null}
      {reenviando && a ? (
        <Reenviar
          adjunto={{ tipo: 'artifact', ref_id: id, meta: { titulo: String(a.titulo || 'Dashboard').slice(0, 500), tipo: 'dashboard', clave: 'dashboard' } }}
          bottomInset={bottomInset}
          onCerrar={() => setReenviando(false)}
        />
      ) : null}
    </View>
  );

  if (consulta.isLoading) {
    return (
      <View style={{ flex: 1 }}>
        {cabecera}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <MorphingInfinity size={28} color={INK.meta} />
        </View>
      </View>
    );
  }
  if (consulta.error || !a) {
    return (
      <View style={{ flex: 1 }}>
        {cabecera}
        <EstadoCentro titulo="No se pudo abrir" texto="Revisá la conexión y probá de nuevo.">
          <Boton texto="probar de nuevo" onPress={() => consulta.refetch()} />
        </EstadoCentro>
      </View>
    );
  }

  const listaFuentes = fuentes.length ? (
    <View style={{ gap: 6, paddingHorizontal: 20, paddingTop: 14, paddingBottom: bottomInset + 18, borderTopWidth: 1, borderTopColor: TONO.raya }}>
      <Text style={ROTULO}>{fuentes.length === 1 ? 'FUENTE' : 'FUENTES'}</Text>
      {fuentes.map((f) => (
        <Text key={`${f.tipo}-${f.id}`} style={{ fontSize: 13.5, color: INK.body }} numberOfLines={1}>
          {titulos.data?.[f.id] || QUE_FUENTE[f.tipo] || f.tipo}
        </Text>
      ))}
    </View>
  ) : null;

  return (
    <View style={{ flex: 1 }}>
      {cabecera}
      <View style={{ flex: 1 }}>
        {a.html && esInteractivo(a) ? (
          <WebView
            style={{ flex: 1, backgroundColor: '#FBFAF6' }}
            onLoadEnd={() => setDibujando(false)}
            originWhitelist={['about:blank']}
            source={{ html: paginaInteractiva(a.html) }}
            javaScriptEnabled
            domStorageEnabled={false}
            incognito
            allowsLinkPreview={false}
            allowFileAccess={false}
            setSupportMultipleWindows={false}
            javaScriptCanOpenWindowsAutomatically={false}
            mediaPlaybackRequiresUserAction
            onShouldStartLoadWithRequest={(r) => {
              if (r.url === 'about:blank' || r.url.startsWith('about:') || r.url.startsWith('data:') || r.url.startsWith('#')) return true;
              // Un enlace del dashboard se abre afuera; el dashboard no navega.
              if (r.isTopFrame !== false && /^https?:\/\//i.test(r.url)) Linking.openURL(r.url).catch(() => {});
              return false;
            }}
          />
        ) : a.tipo === 'html' && a.html ? (
          <WebView
            style={{ flex: 1, backgroundColor: '#FBFAF6' }}
            onLoadEnd={() => setDibujando(false)}
            originWhitelist={['*']}
            source={{ html: pagina(a.html) }}
            javaScriptEnabled={false}
            domStorageEnabled={false}
            allowsLinkPreview={false}
            setSupportMultipleWindows={false}
            onShouldStartLoadWithRequest={(r) => {
              if (r.url === 'about:blank' || r.url.startsWith('data:') || r.url.startsWith('#')) return true;
              if (/^https?:\/\//i.test(r.url)) Linking.openURL(r.url).catch(() => {});
              return false;
            }}
          />
        ) : (
          <ScrollView contentContainerStyle={{ padding: 20, gap: 8 }}>
            <Text style={{ fontFamily: SERIF, fontSize: 28, lineHeight: 32, color: INK.title }}>{a.titulo}</Text>
          </ScrollView>
        )}
        {a.html && dibujando && (esInteractivo(a) || a.tipo === 'html') ? (
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', backgroundColor: '#FBFAF6' }]}>
            <MorphingInfinity size={28} color={INK.meta} />
          </View>
        ) : null}
      </View>
      {/* El dashboard ya trae sus fuentes al pie: no se repiten afuera. */}
      {esInteractivo(a) ? null : listaFuentes}
    </View>
  );
}
