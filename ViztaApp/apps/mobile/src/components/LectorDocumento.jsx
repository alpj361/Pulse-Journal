import { useEffect, useState } from 'react';
import { Linking, Modal, Platform, Pressable, Share, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { ExternalLink, Share as Compartir, X } from 'lucide-react-native';
import { INK } from './theme';
import { PAPEL } from './codex/Papel';
import MorphingInfinity from './MorphingInfinity';
import { roce } from '../utils/haptics';

/**
 * El lector de documentos: un PDF, un Word, una hoja de cálculo, un texto o
 * una página, abiertos dentro de Vizta y no en el navegador. Lo que se lee
 * (una ley, una iniciativa) se queda a la mano: se cierra y se vuelve a donde
 * se estaba.
 *
 * En iPhone lo dibuja el visor del sistema, que entiende PDF, Office, iWork,
 * RTF, texto e imágenes, con zoom y selección de texto. En Android el visor
 * web no abre PDF: ahí el documento se abre afuera.
 *
 * Uso: `<LectorDocumento documento={{ uri, titulo, origen }} onClose={…} />`;
 * con `documento` en null no se muestra.
 */
const ADENTRO = Platform.OS === 'ios';

export default function LectorDocumento({ documento, onClose }) {
  const uri = documento?.uri;
  useEffect(() => {
    if (!uri || ADENTRO) return;
    Linking.openURL(uri).catch(() => {});
    onClose?.();
  }, [uri]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!uri || !ADENTRO) return null;
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <Lector documento={documento} onClose={onClose} />
    </Modal>
  );
}

function Lector({ documento, onClose }) {
  const [estado, setEstado] = useState('cargando'); // cargando | listo | falla
  const [intento, setIntento] = useState(0);
  const [avance, setAvance] = useState(0); // 0 a 1: los PDF escaneados del Congreso pesan decenas de megas
  const { uri, titulo, origen } = documento;
  const abrirAfuera = () => { roce(); Linking.openURL(uri).catch(() => {}); };
  const compartir = () => { roce(); Share.share({ url: uri, title: titulo }).catch(() => {}); };
  return (
    <View style={{ flex: 1, backgroundColor: PAPEL }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 14, paddingBottom: 10, paddingLeft: 18, paddingRight: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(28,43,34,0.08)' }}>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} accessibilityRole="header" style={{ fontSize: 15, fontWeight: '700', color: INK.title }}>{titulo || 'Documento'}</Text>
          {origen ? <Text numberOfLines={1} style={{ fontSize: 12, color: INK.meta, marginTop: 1 }}>{origen}</Text> : null}
        </View>
        <Boton onPress={compartir} etiqueta="Compartir el documento"><Compartir size={18} color={INK.meta} /></Boton>
        <Boton onPress={abrirAfuera} etiqueta="Abrir en el navegador"><ExternalLink size={18} color={INK.meta} /></Boton>
        <Boton onPress={onClose} etiqueta="Cerrar el documento"><X size={19} color={INK.faint} /></Boton>
      </View>
      {estado === 'cargando' ? (
        <View style={{ height: 2, backgroundColor: 'rgba(28,43,34,0.06)' }}>
          <View style={{ height: 2, width: `${Math.max(4, Math.round(avance * 100))}%`, backgroundColor: INK.meta }} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <WebView
          key={intento}
          source={{ uri }}
          style={{ flex: 1, backgroundColor: PAPEL }}
          originWhitelist={['*']}
          allowsInlineMediaPlayback
          onLoadProgress={({ nativeEvent }) => setAvance(nativeEvent.progress || 0)}
          onLoadEnd={() => setEstado((e) => (e === 'falla' ? e : 'listo'))}
          onError={() => setEstado('falla')}
          onHttpError={() => setEstado('falla')}
        />
        {estado === 'cargando' ? (
          <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: PAPEL }}>
            <MorphingInfinity size={34} color={INK.meta} />
            {avance > 0.05 ? <Text style={{ fontSize: 12, color: INK.meta, marginTop: 10 }}>{`${Math.round(avance * 100)} %`}</Text> : null}
          </View>
        ) : null}
        {estado === 'falla' ? (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, padding: 24, justifyContent: 'center', backgroundColor: PAPEL, gap: 14 }}>
            <Text style={{ fontSize: 15, lineHeight: 21, color: INK.body }}>No se pudo abrir el documento aquí.</Text>
            <View style={{ flexDirection: 'row', gap: 18 }}>
              <Pressable onPress={() => { setEstado('cargando'); setIntento((n) => n + 1); }} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: INK.title }}>volver a intentar</Text>
              </Pressable>
              <Pressable onPress={abrirAfuera} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}>
                <Text style={{ fontSize: 14, color: INK.meta }}>abrir en el navegador</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function Boton({ onPress, etiqueta, children }) {
  return (
    <Pressable onPress={onPress} hitSlop={6} accessibilityRole="button" accessibilityLabel={etiqueta}
      style={({ pressed }) => ({ width: 40, height: 40, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.5 : 1 })}>
      {children}
    </Pressable>
  );
}
