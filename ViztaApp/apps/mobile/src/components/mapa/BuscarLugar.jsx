import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { MapPin, Search, X } from 'lucide-react-native';
import { INK, RADIUS, SERIF } from '../theme';
import { MONO } from '../codex/mono';
import { PAPEL } from '../codex/Papel';
import { inputStyle } from '../codex/FieldInput';
import { buscarLugares } from '../../services/lugares';
import { roce } from '../../utils/haptics';

/**
 * Buscar un lugar del mundo real y marcarlo.
 *
 * Es el gemelo de `BuscarLimite`: aquel copia una frontera oficial del
 * catálogo, este trae un punto de Apple Places. La estructura es
 * deliberadamente la misma —escribir, esperar a que la mano pare, elegir de una
 * lista— porque para quien la usa son la misma operación con distinto insumo, y
 * dos formas de hacer lo mismo se aprenden dos veces.
 *
 * **Lo que se guarda es una copia, no un vínculo.** El nombre, la dirección y
 * las coordenadas quedan en el item; si Apple cambia o borra el registro
 * mañana, lo que ya está marcado sigue estando. Se conserva el id del
 * proveedor por si alguna vez hace falta refrescar, pero nada depende de que
 * siga existiendo.
 */
export default function BuscarLugar({ visible, centro, onElegir, onClose }) {
  const [texto, setTexto] = useState('');
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [busco, setBusco] = useState(false);

  useEffect(() => {
    if (!visible) return undefined;
    setTexto('');
    setResultados([]);
    setBusco(false);
    return undefined;
  }, [visible]);

  useEffect(() => {
    if (!visible) return undefined;

    const q = texto.trim();
    if (q.length < 2) {
      setResultados([]);
      setBuscando(false);
      setBusco(false);
      return undefined;
    }

    // Se espera a que la mano pare. Cada consulta cruza a un proveedor externo
    // y cuesta; sin la espera, escribir «Pollo Campero» dispara trece.
    const control = new AbortController();
    setBuscando(true);
    const t = setTimeout(async () => {
      const filas = await buscarLugares(q, {
        lat: centro?.lat,
        lng: centro?.lng,
        señal: control.signal,
      });
      if (control.signal.aborted) return;
      setResultados(filas);
      setBuscando(false);
      setBusco(true);
    }, 320);

    return () => {
      control.abort();
      clearTimeout(t);
    };
  }, [texto, visible, centro?.lat, centro?.lng]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(20,28,22,0.4)', justifyContent: 'flex-end' }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />

        <View
          style={{
            backgroundColor: PAPEL,
            borderTopLeftRadius: RADIUS.xl,
            borderTopRightRadius: RADIUS.xl,
            paddingHorizontal: 20,
            paddingTop: 16,
            paddingBottom: 28,
            maxHeight: '78%',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
            <Text style={{ fontFamily: SERIF, fontSize: 24, color: INK.title, flex: 1 }}>
              Buscar un lugar
            </Text>
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Cerrar">
              <X size={18} color={INK.faint} />
            </Pressable>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
            <Search size={15} color={INK.faint} />
            <TextInput
              value={texto}
              onChangeText={setTexto}
              placeholder="nombre del lugar"
              placeholderTextColor={INK.faint}
              autoFocus
              autoCorrect={false}
              style={[inputStyle, { flex: 1 }]}
            />
          </View>

          <ScrollView style={{ marginTop: 14 }} keyboardShouldPersistTaps="handled">
            {buscando ? (
              <View style={{ paddingVertical: 22, alignItems: 'center' }}>
                <ActivityIndicator color={INK.faint} />
              </View>
            ) : null}

            {!buscando && busco && !resultados.length ? (
              <Text style={{ fontFamily: MONO, fontSize: 11.5, color: INK.faint, paddingVertical: 20, textAlign: 'center' }}>
                sin resultados
              </Text>
            ) : null}

            {resultados.map((r) => (
              <Pressable
                key={r.id || `${r.lat},${r.lng}`}
                onPress={() => {
                  roce();
                  onElegir(r);
                }}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 11,
                  paddingVertical: 12,
                  borderTopWidth: 1,
                  borderTopColor: 'rgba(28,43,34,0.08)',
                  backgroundColor: pressed ? 'rgba(28,43,34,0.04)' : 'transparent',
                })}
              >
                <MapPin size={15} color={INK.faint} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, color: INK.title }}>{r.name}</Text>
                  {r.address ? (
                    <Text numberOfLines={1} style={{ fontSize: 12, color: INK.meta, marginTop: 2 }}>
                      {r.address}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            ))}

            {/* Apple pide crédito cuando se muestran sus resultados. Aparece
                solo cuando efectivamente hay algo de ellos en pantalla. */}
            {resultados.length ? (
              <Text style={{ fontFamily: MONO, fontSize: 9.5, color: INK.faint, marginTop: 14, textAlign: 'center' }}>
                resultados de Apple Maps
              </Text>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
