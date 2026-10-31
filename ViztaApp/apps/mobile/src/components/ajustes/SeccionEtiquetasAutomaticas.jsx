import { useEffect, useState } from 'react';
import { Switch, Text, View } from 'react-native';
import GlassCard from '../GlassCard';
import { INK, ACCENT } from '../theme';
import { roce, falla } from '../../utils/haptics';
import { supabase } from '../../utils/supabase';

/**
 * «Etiquetas automáticas» — el interruptor.
 *
 * La app solo enciende o apaga. Qué etiqueta el servidor con esto lo decide la
 * base (`etiquetas_automaticas`), que también dice si la opción existe para la
 * cuenta: sin ella, no se dibuja. Arranca apagado mientras la persona no lo
 * encienda.
 *
 * Solo el título, como el resto de los interruptores de Ajustes.
 */
export default function SeccionEtiquetasAutomaticas() {
  const [disponible, setDisponible] = useState(false);
  const [activo, setActivo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let vivo = true;
    supabase.rpc('etiquetas_automaticas').then(({ data }) => {
      if (!vivo || !data) return;
      setDisponible(data.disponible === true);
      setActivo(data.activo === true);
    });
    return () => {
      vivo = false;
    };
  }, []);

  if (!disponible) return null;

  const cambiar = async (v) => {
    roce();
    setActivo(v);
    setGuardando(true);
    setError(null);
    try {
      const { data, error: e } = await supabase.rpc('etiquetas_automaticas_cambiar', { p_activo: v });
      if (e) throw e;
      if (data) setActivo(data.activo === true);
    } catch {
      // Lo que se ve tiene que ser lo que quedó guardado: si no se pudo, vuelve.
      falla();
      setActivo(!v);
      setError('No se pudo guardar. Prueba de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <View style={{ marginBottom: 24 }}>
      <GlassCard radius={16}>
        <View style={{ padding: 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: INK.title, lineHeight: 20 }}>
              Etiquetas automáticas
            </Text>
            <Switch
              value={activo}
              onValueChange={cambiar}
              disabled={guardando}
              trackColor={{ false: 'rgba(28,43,34,0.14)', true: ACCENT.indigo.ink }}
              thumbColor="#FFFFFF"
              accessibilityLabel="Etiquetas automáticas"
            />
          </View>
          {error ? <Text style={{ fontSize: 12.5, color: '#B91C1C', marginTop: 8 }}>{error}</Text> : null}
        </View>
      </GlassCard>
    </View>
  );
}
