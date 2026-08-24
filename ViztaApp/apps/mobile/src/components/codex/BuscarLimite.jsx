import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { X } from 'lucide-react-native';
import { INK, RADIUS, SERIF } from '../theme';
import { MONO } from './mono';
import { inputStyle } from './FieldInput';
import { supabase } from '../../utils/supabase';
import { roce } from '../../utils/haptics';

/**
 * Elegir un límite oficial del catálogo.
 *
 * **La asociación la hace una persona, nunca las coordenadas.** Adivinar el
 * límite por cercanía funciona hasta que un municipio queda dentro de su
 * departamento —siempre— y hay que decidir cuál de los dos era. Un polígono mal
 * asociado se propaga a todo lo que después cuelgue de ese territorio, y nadie
 * lo revisa porque nadie lo eligió.
 *
 * **La lista no trae los polígonos.** El catálogo son 386 fronteras y cada
 * geometría pesa; pedirlas todas para mostrar una lista de nombres serían varios
 * megabytes por cada tecla. Se piden los campos de identificación, y el polígono
 * recién cuando alguien elige uno.
 *
 * **El nivel y el padre van siempre visibles.** «Jutiapa» es un departamento y
 * también un municipio adentro de ese departamento; «Jutiapa · municipio · en
 * Jutiapa» es lo único que deja distinguirlos sin abrir nada.
 */

/** Lo que alcanza para listar. La geometría se pide aparte. */
const CAMPOS = 'boundary_id, name, level, parent_name, country_code, admin_code, source_name, centroid';

export default function BuscarLimite({ visible, consultaInicial = '', onElegir, onClose }) {
  const [texto, setTexto] = useState(consultaInicial);
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [trayendo, setTrayendo] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!visible) return undefined;
    setTexto(consultaInicial);
  }, [visible, consultaInicial]);

  useEffect(() => {
    if (!visible) return undefined;

    const q = texto.trim();
    if (q.length < 2) {
      setResultados([]);
      setBuscando(false);
      return undefined;
    }

    // Se espera a que la mano pare. Sin esto, escribir «Jutiapa» dispara siete
    // consultas y la que contesta última no es necesariamente la de la última
    // letra: la lista termina mostrando resultados de «Juti».
    let vivo = true;
    setBuscando(true);
    const t = setTimeout(async () => {
      const { data, error: err } = await supabase
        .from('map_boundaries')
        .select(CAMPOS)
        .ilike('name', `%${q}%`)
        .order('level')
        .limit(25);
      if (!vivo) return;
      setError(err ? 'No se pudo buscar en el catálogo.' : null);
      setResultados(data || []);
      setBuscando(false);
    }, 260);

    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [texto, visible]);

  const elegir = async (fila) => {
    roce();
    setTrayendo(fila.boundary_id);
    // El polígono, recién ahora.
    const { data, error: err } = await supabase
      .from('map_boundaries')
      .select(`${CAMPOS}, geometry`)
      .eq('boundary_id', fila.boundary_id)
      .single();
    setTrayendo(null);
    if (err || !data?.geometry) {
      setError('Ese límite no tiene geometría en el catálogo.');
      return;
    }
    onElegir(data);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(20,28,22,0.4)', justifyContent: 'flex-end' }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />

        <View
          style={{
            backgroundColor: '#F7F8F5',
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            maxHeight: '78%',
            paddingBottom: 24,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 20,
              paddingTop: 18,
              paddingBottom: 12,
            }}
          >
            <Text style={{ fontFamily: SERIF, fontSize: 19, color: INK.title }}>Límite oficial</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <X size={19} color={INK.faint} />
            </Pressable>
          </View>

          <View style={{ paddingHorizontal: 20 }}>
            <TextInput
              value={texto}
              onChangeText={setTexto}
              placeholder="Buscar por nombre"
              placeholderTextColor={INK.faint}
              autoFocus
              autoCorrect={false}
              style={inputStyle}
            />
          </View>

          <ScrollView
            style={{ marginTop: 12 }}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12 }}
            keyboardShouldPersistTaps="handled"
          >
            {error ? (
              <Text style={{ fontFamily: MONO, fontSize: 12, color: '#B45309', marginTop: 8 }}>{error}</Text>
            ) : null}

            {buscando ? (
              <ActivityIndicator size="small" color={INK.meta} style={{ marginTop: 18 }} />
            ) : null}

            {!buscando && texto.trim().length >= 2 && resultados.length === 0 && !error ? (
              <Text style={{ fontSize: 13.5, color: INK.meta, marginTop: 14, lineHeight: 20 }}>
                No hay ningún límite con ese nombre en el catálogo.
              </Text>
            ) : null}

            {resultados.map((r) => (
              <Pressable
                key={r.boundary_id}
                onPress={() => elegir(r)}
                disabled={Boolean(trayendo)}
                style={({ pressed }) => ({
                  paddingVertical: 12,
                  opacity: pressed ? 0.55 : trayendo && trayendo !== r.boundary_id ? 0.4 : 1,
                  borderBottomWidth: 1,
                  borderBottomColor: 'rgba(28,43,34,0.07)',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                })}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, color: INK.title, fontWeight: '600' }}>{r.name}</Text>
                  <Text style={{ fontFamily: MONO, fontSize: 11.5, color: INK.meta, marginTop: 3 }}>
                    {[r.level, r.parent_name ? `en ${r.parent_name}` : null, r.country_code]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
                {trayendo === r.boundary_id ? <ActivityIndicator size="small" color={INK.meta} /> : null}
              </Pressable>
            ))}

            {texto.trim().length < 2 ? (
              <Text style={{ fontSize: 13, color: INK.meta, marginTop: 14, lineHeight: 20 }}>
                Escribí al menos dos letras. El catálogo tiene los departamentos y municipios oficiales.
              </Text>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
