import { useState } from 'react';
import { Alert, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useQueryClient } from '@tanstack/react-query';
import { INK } from '../theme';
import { cambiarColaborador, revocarColaborador } from './api';
import { PERMISOS, conPermiso } from './logica';
import { Boton, Cabecera, ROTULO, TONO, nombreDe } from './piezas';
import { AvisosDelAgente } from './Enterarse';

const QUE = {
  leer: { titulo: 'Leer', texto: 'Busca en lo que guardaste' },
  crear: { titulo: 'Crear', texto: 'Guarda cosas nuevas en su Codex' },
  editar: { titulo: 'Editar', texto: 'Sin esto, sus cambios te llegan para aprobar' },
  eliminar: { titulo: 'Borrar', texto: 'Quita lo que ya no sirve' },
};

/**
 * Qué puede hacer un agente en tu Codex (pantalla 9). Cada interruptor se
 * guarda al tocarlo; si no sale, vuelve a como estaba.
 *
 * «Desde dónde trabaja» y los créditos de la semana entran con Actividad y el
 * gasto por agente: hoy no hay de dónde leerlos por agente.
 */
export default function Permisos({ colaborador, porAprobar = 0, topInset, bottomInset, onVolver, onCambiado, onPorAprobar, onQuitado }) {
  const queryClient = useQueryClient();
  const [permisos, setPermisos] = useState(colaborador.permisos || {});
  const [guardando, setGuardando] = useState(null);
  const [quitando, setQuitando] = useState(false);
  const nombre = nombreDe(colaborador);

  const cambiar = async (clave, valor) => {
    const antes = permisos;
    const despues = conPermiso(permisos, clave, valor);
    setPermisos(despues);
    setGuardando(clave);
    try {
      const r = await cambiarColaborador(colaborador.id, { permisos: { [clave]: !!valor } });
      const final = r?.colaborador?.permisos || r?.permisos || despues;
      setPermisos(final);
      onCambiado?.({ ...colaborador, permisos: final });
      queryClient.invalidateQueries({ queryKey: ['colab-lista'] });
    } catch {
      setPermisos(antes);
      Alert.alert('No se pudo cambiar', 'Revisá la conexión y probá de nuevo.');
    } finally {
      setGuardando(null);
    }
  };

  const quitar = () => {
    Alert.alert(`¿Quitarle el acceso a ${nombre}?`, 'Deja de ver tu Codex. Lo que guardó en el suyo no se borra.', [
      { text: 'cancelar', style: 'cancel' },
      {
        text: 'quitar el acceso',
        style: 'destructive',
        onPress: async () => {
          setQuitando(true);
          try {
            await revocarColaborador(colaborador.id);
            await queryClient.invalidateQueries({ queryKey: ['colab-lista'] });
            onQuitado?.();
          } catch {
            setQuitando(false);
            Alert.alert('No se pudo quitar el acceso', 'Revisá la conexión y probá de nuevo.');
          }
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: TONO.raya }}>
        <Cabecera
          colaborador={colaborador}
          subtitulo={colaborador.cuenta_tipo === 'agente' ? 'agente · responde a vos' : null}
          onVolver={onVolver}
          volverLabel="Volver al chat"
          topInset={topInset}
        />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: bottomInset + 20, gap: 16, flexGrow: 1 }}>
        {porAprobar ? (
          <Pressable
            onPress={onPorAprobar}
            accessibilityRole="button"
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              backgroundColor: '#FFFFFF',
              borderWidth: 1,
              borderColor: 'rgba(154,83,71,0.28)',
              borderRadius: 16,
              paddingVertical: 12,
              paddingHorizontal: 14,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text style={{ flex: 1, fontSize: 14.5, fontWeight: '600', color: INK.title }}>
              <Text style={{ color: TONO.ladrillo }}>{porAprobar}</Text> {porAprobar === 1 ? 'cosa por aprobar' : 'cosas por aprobar'}
            </Text>
            <ChevronRight size={18} color={TONO.ladrillo} />
          </Pressable>
        ) : null}

        <View style={{ gap: 8 }}>
          <Text style={ROTULO}>EN TU CODEX PUEDE</Text>
          <View style={{ backgroundColor: 'rgba(255,255,255,0.78)', borderWidth: 1, borderColor: 'rgba(28,43,34,0.08)', borderRadius: 18, overflow: 'hidden' }}>
            {PERMISOS.map((clave, i) => (
              <View
                key={clave}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  borderBottomWidth: i === PERMISOS.length - 1 ? 0 : 1,
                  borderBottomColor: 'rgba(28,43,34,0.06)',
                }}
              >
                <View style={{ flex: 1, gap: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: INK.title }}>{QUE[clave].titulo}</Text>
                  <Text style={{ fontSize: 12.5, color: INK.meta }}>{QUE[clave].texto}</Text>
                </View>
                <Switch
                  value={!!permisos[clave]}
                  onValueChange={(v) => cambiar(clave, v)}
                  disabled={!!guardando || quitando}
                  trackColor={{ true: TONO.verde, false: 'rgba(28,43,34,0.14)' }}
                  ios_backgroundColor="rgba(28,43,34,0.14)"
                  accessibilityLabel={QUE[clave].titulo}
                />
              </View>
            ))}
          </View>
        </View>

        {colaborador.cuenta_tipo === 'agente' ? (
          <AvisosDelAgente colaborador={colaborador} nombre={nombre} />
        ) : null}

        <View style={{ flex: 1 }} />
        <Boton texto="quitarle el acceso" peligro onPress={quitar} cargando={quitando} alto={44} />
      </ScrollView>
    </View>
  );
}
