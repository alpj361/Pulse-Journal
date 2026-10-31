import { useEffect, useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { ScanFace } from 'lucide-react-native';
import GlassCard from '../GlassCard';
import { INK, ACCENT } from '../theme';
import { roce, falla } from '../../utils/haptics';
import { supabase } from '../../utils/supabase';
import { useCapacidadesStore } from '../../state/capacidadesStore';

/**
 * Los detectores que el servidor puede correr solo, uno por renglón. Cada uno
 * aparece si la cuenta tiene su función (`flag`); la opción se guarda en la
 * base (`etiquetas_automaticas`) y el servidor la consulta antes de detectar.
 * Para sumar uno (por ejemplo, voces): agregarlo acá y en la lista de tipos
 * válidos de `etiquetas_automaticas_cambiar`.
 */
const DETECTORES = [{ tipo: 'rostros', titulo: 'Rostros', Icono: ScanFace, flag: 'posts.face_recognition' }];

/**
 * «Etiquetas automáticas» — qué etiqueta el servidor por su cuenta en los posts.
 *
 * Sin ningún detector disponible para la cuenta, no se dibuja. Cada uno arranca
 * apagado mientras la persona no lo encienda.
 */
export default function SeccionEtiquetasAutomaticas() {
  const features = useCapacidadesStore((s) => s.capacidades?.features);
  const disponibles = DETECTORES.filter((d) => features?.[d.flag]?.availability === 'enabled');
  const [estado, setEstado] = useState({});
  const [listo, setListo] = useState(false);
  const [guardando, setGuardando] = useState(null);
  const [error, setError] = useState(null);
  const hay = disponibles.length > 0;

  useEffect(() => {
    if (!hay) return undefined;
    let vivo = true;
    supabase
      .rpc('etiquetas_automaticas')
      .then(({ data }) => vivo && setEstado(data || {}))
      .finally(() => vivo && setListo(true));
    return () => {
      vivo = false;
    };
  }, [hay]);

  if (!hay) return null;

  const cambiar = async (tipo, v) => {
    roce();
    setEstado((e) => ({ ...e, [tipo]: v }));
    setGuardando(tipo);
    setError(null);
    try {
      const { data, error: e } = await supabase.rpc('etiquetas_automaticas_cambiar', { p_tipo: tipo, p_activo: v });
      if (e) throw e;
      if (data) setEstado((previo) => ({ ...previo, ...data }));
    } catch {
      // Lo que se ve tiene que ser lo que quedó guardado: si no se pudo, vuelve.
      falla();
      setEstado((e) => ({ ...e, [tipo]: !v }));
      setError('No se pudo guardar. Prueba de nuevo.');
    } finally {
      setGuardando(null);
    }
  };

  return (
    <View style={{ marginBottom: 24 }}>
      <GlassCard radius={16}>
        <View style={{ padding: 18, gap: 12 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: INK.title, lineHeight: 20 }}>Etiquetas automáticas</Text>
          {disponibles.map(({ tipo, titulo, Icono }) => (
            <View key={tipo} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Icono size={17} color={INK.body} strokeWidth={1.9} />
              <Text style={{ flex: 1, fontSize: 14, color: INK.title }}>{titulo}</Text>
              <Switch
                value={estado[tipo] === true}
                onValueChange={(v) => cambiar(tipo, v)}
                disabled={!listo || guardando === tipo}
                trackColor={{ false: 'rgba(28,43,34,0.14)', true: ACCENT.indigo.ink }}
                thumbColor="#FFFFFF"
                accessibilityLabel={`Etiquetas automáticas: ${titulo}`}
              />
            </View>
          ))}
          {error ? <Text style={{ fontSize: 12.5, color: '#B91C1C' }}>{error}</Text> : null}
        </View>
      </GlassCard>
    </View>
  );
}
