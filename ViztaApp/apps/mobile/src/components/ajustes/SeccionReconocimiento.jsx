import { useEffect, useState } from 'react';
import { Switch, Text, View } from 'react-native';
import GlassCard from '../GlassCard';
import { INK, ACCENT } from '../theme';
import { roce, falla } from '../../utils/haptics';
import {
  guardarPreferencia,
  leerPreferencia,
  useReconocimientoDisponible,
} from '../../utils/reconocimientoRostros';

/**
 * «Reconocimiento en Posts» — el interruptor.
 *
 * **Solo existe si la cuenta tiene el flag.** Sin él no se dibuja nada: ni el
 * renglón apagado ni un «próximamente». Para quien no la tiene, la función no
 * existe, y el flag se puede apagar de forma remota sin publicar la app.
 *
 * **Arranca apagado.** Comparar caras es algo a lo que alguien dice que sí, no
 * algo que viene puesto.
 *
 * Solo el título: la explicación de qué hace vive en la primera sugerencia,
 * que es donde se ve funcionando.
 */
export default function SeccionReconocimiento() {
  const disponible = useReconocimientoDisponible();
  const [activo, setActivo] = useState(false);
  const [listo, setListo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!disponible) return;
    let vivo = true;
    leerPreferencia()
      .then((v) => vivo && setActivo(v))
      .catch(() => {})
      .finally(() => vivo && setListo(true));
    return () => {
      vivo = false;
    };
  }, [disponible]);

  if (!disponible) return null;

  const cambiar = async (v) => {
    roce();
    setActivo(v);
    setGuardando(true);
    setError(null);
    try {
      await guardarPreferencia(v);
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
            <Text style={{ fontSize: 14, fontWeight: '700', color: INK.title, lineHeight: 20 }}>
              Reconocimiento en Posts
            </Text>
            <View
              style={{
                paddingHorizontal: 7,
                paddingVertical: 2,
                borderRadius: 999,
                backgroundColor: ACCENT.indigo.tint,
              }}
            >
              <Text style={{ fontSize: 10.5, fontWeight: '800', color: ACCENT.indigo.ink, letterSpacing: 0.3 }}>
                BETA
              </Text>
            </View>
            <View style={{ flex: 1 }} />
            <Switch
              value={activo}
              onValueChange={cambiar}
              disabled={!listo || guardando}
              trackColor={{ false: 'rgba(28,43,34,0.14)', true: ACCENT.indigo.ink }}
              thumbColor="#FFFFFF"
              accessibilityLabel="Reconocimiento en Posts"
            />
          </View>


          {error ? <Text style={{ fontSize: 12.5, color: '#B91C1C', marginTop: 8 }}>{error}</Text> : null}
        </View>
      </GlassCard>
    </View>
  );
}
