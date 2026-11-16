import { useRef } from 'react';
import { Modal, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { X } from 'lucide-react-native';
import { ACCENT, INK, SERIF } from '../theme';
import { PAPEL } from '../codex/Papel';
import { Boton, ROTULO } from '../colaboradores/piezas';
import Sticker from '../Sticker';
import { roce } from '../../utils/haptics';
import { EV, evento } from '../../utils/analitica';
import { useFeedStore } from '../../state/feedStore';
import { CLASES_VIOLENCIA, ESTADOS, conClase, conEstado, estadoDe, temasAjustables } from './preferencias';
import { normalizarTema } from './temas';

// El color de la opción elegida: «primero» suma, «ocultar» resta.
const TINTA_ESTADO = { primero: ACCENT.green.ink, normal: INK.title, ocultar: ACCENT.red.ink };

/**
 * El ajuste del feed: por tema, si va primero, normal u oculto; y, mientras
 * Violencia se vea, qué tipos de violencia sí. Se abre desde el chip «ajustar».
 *
 * Cada cambio se aplica al feed de una vez (está detrás, se ve reacomodarse);
 * a la cuenta se manda al cerrar, una sola escritura.
 */
export default function AjustarFeed({ visible, cards, bottomInset = 0, onClose }) {
  const prefs = useFeedStore((s) => s.prefs);
  const cambiar = useFeedStore((s) => s.cambiar);
  const guardar = useFeedStore((s) => s.guardarEnLaCuenta);
  const alAbrir = useRef(null);

  const cerrar = () => {
    const tocado = JSON.stringify(prefs) !== alAbrir.current;
    onClose?.();
    if (!tocado) return;
    // Lo del teléfono ya quedó; si la cuenta falla, se reintenta en el próximo cierre.
    guardar().catch(() => {});
    evento(EV.FEED_AJUSTADO, {
      primero: Object.values(prefs.temas).filter((e) => e === 'primero').length,
      ocultos: Object.values(prefs.temas).filter((e) => e === 'ocultar').length,
      violencia_oculta: prefs.violencia.length,
    });
  };

  const violenciaVisible = estadoDe(prefs, 'Violencia') !== 'ocultar';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onShow={() => (alAbrir.current = JSON.stringify(prefs))}
      onRequestClose={cerrar}
    >
      <View style={{ flex: 1, backgroundColor: PAPEL }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 16, paddingHorizontal: 18 }}>
          <Text style={[ROTULO, { flex: 1 }]}>TU FEED</Text>
          <Pressable onPress={cerrar} hitSlop={12} accessibilityRole="button" accessibilityLabel="Cerrar" style={{ padding: 6 }}>
            <X size={19} color={INK.faint} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 6, paddingBottom: bottomInset + 32, gap: 26 }}>
          <View style={{ gap: 10 }}>
            <Text style={{ fontFamily: SERIF, fontSize: 30, lineHeight: 34, color: INK.title }} accessibilityRole="header">
              Qué quieres ver
            </Text>
            <Text style={{ fontSize: 15, lineHeight: 21, color: INK.body }}>
              Tu feed se abre así cada vez. Lo que ocultes queda al final de los filtros, por si un día quieres verlo.
            </Text>
          </View>

          <View style={{ gap: 14 }}>
            <Text style={{ fontSize: 17, fontWeight: '800', color: INK.title }}>Temas</Text>
            {temasAjustables(cards, prefs).map((tema) => (
              <FilaTema
                key={tema}
                tema={tema}
                estado={estadoDe(prefs, tema)}
                onCambiar={(estado) => {
                  roce();
                  cambiar(conEstado(prefs, tema, estado));
                }}
              />
            ))}
          </View>

          {violenciaVisible ? (
            <View style={{ gap: 14 }}>
              <Text style={{ fontSize: 17, fontWeight: '800', color: INK.title }}>Tipos de violencia</Text>
              {CLASES_VIOLENCIA.map((c) => {
                const ve = !prefs.violencia.includes(c.clave);
                const alternar = (v) => {
                  roce();
                  cambiar(conClase(prefs, c.clave, v));
                };
                // Toda la fila alterna: el interruptor solo es un blanco chico.
                return (
                  <Pressable
                    key={c.clave}
                    onPress={() => alternar(!ve)}
                    accessibilityRole="switch"
                    accessibilityLabel={`Ver ${c.nombre.toLowerCase()}`}
                    accessibilityState={{ checked: ve }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
                  >
                    <Sticker nombre={c.sticker} respaldo="violencia" size={32} style={{ opacity: ve ? 1 : 0.4 }} />
                    <Text style={{ flex: 1, fontSize: 15, lineHeight: 20, color: ve ? INK.title : INK.meta }}>{c.nombre}</Text>
                    <Switch
                      value={ve}
                      onValueChange={alternar}
                      trackColor={{ false: 'rgba(28,43,34,0.14)', true: ACCENT.indigo.ink }}
                      thumbColor="#FFFFFF"
                      importantForAccessibility="no"
                      accessibilityElementsHidden
                    />
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          <Boton texto="listo" primario onPress={cerrar} />
        </ScrollView>
      </View>
    </Modal>
  );
}

function FilaTema({ tema, estado, onCambiar }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Sticker nombre={normalizarTema(tema)} respaldo="otros" size={34} style={{ opacity: estado === 'ocultar' ? 0.4 : 1 }} />
      <Text numberOfLines={1} style={{ flex: 1, fontSize: 15, fontWeight: '600', color: estado === 'ocultar' ? INK.meta : INK.title }}>
        {tema}
      </Text>
      <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', backgroundColor: 'rgba(28,43,34,0.05)', borderRadius: 11, padding: 3 }}>
        {ESTADOS.map((o) => {
          const elegido = o.clave === estado;
          return (
            <Pressable
              key={o.clave}
              onPress={() => !elegido && onCambiar(o.clave)}
              accessibilityRole="radio"
              accessibilityLabel={`${tema}: ${o.nombre}`}
              accessibilityState={{ checked: elegido }}
              hitSlop={{ top: 6, bottom: 6 }}
              style={{
                minWidth: 60,
                height: 32,
                paddingHorizontal: 8,
                borderRadius: 9,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: elegido ? '#FFFFFF' : 'transparent',
                shadowColor: '#25332A',
                shadowOpacity: elegido ? 0.08 : 0,
                shadowRadius: 4,
                shadowOffset: { width: 0, height: 1 },
              }}
            >
              <Text style={{ fontSize: 12.5, fontWeight: elegido ? '700' : '500', color: elegido ? TINTA_ESTADO[o.clave] : INK.meta }}>
                {o.nombre}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
