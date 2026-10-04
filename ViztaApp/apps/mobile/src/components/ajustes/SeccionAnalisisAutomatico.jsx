import { useEffect, useState } from 'react';
import { Switch, Text, View } from 'react-native';
import GlassCard from '../GlassCard';
import { INK, ACCENT } from '../theme';
import { roce, falla } from '../../utils/haptics';
import { guardarAutomatico, leerAutomatico } from '../../utils/analisisAutomatico';

/**
 * «Posts analizados al llegar» — el interruptor.
 *
 * Prendido, cada post que se trae llega ya analizado, sin tocar el ojo.
 * Arranca apagado: analizar gasta, y eso lo decide la persona.
 *
 * Solo el título, como el resto de los interruptores de Ajustes.
 */
export default function SeccionAnalisisAutomatico() {
  const [activo, setActivo] = useState(false);
  const [listo, setListo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let vivo = true;
    leerAutomatico()
      .then((v) => vivo && setActivo(v))
      .catch(() => {})
      .finally(() => vivo && setListo(true));
    return () => {
      vivo = false;
    };
  }, []);

  const cambiar = async (v) => {
    roce();
    setActivo(v);
    setGuardando(true);
    setError(null);
    try {
      await guardarAutomatico(v);
    } catch {
      // Lo que se ve tiene que ser lo que quedó guardado: si no se pudo, vuelve.
      falla();
      setActivo(!v);
      setError('No se pudo guardar. Probá de nuevo.');
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
              Posts analizados al llegar
            </Text>
            <Switch
              value={activo}
              onValueChange={cambiar}
              disabled={!listo || guardando}
              trackColor={{ false: 'rgba(28,43,34,0.14)', true: ACCENT.indigo.ink }}
              thumbColor="#FFFFFF"
              accessibilityLabel="Posts analizados al llegar"
            />
          </View>
          {error ? <Text style={{ fontSize: 12.5, color: '#B91C1C', marginTop: 8 }}>{error}</Text> : null}
        </View>
      </GlassCard>
    </View>
  );
}
