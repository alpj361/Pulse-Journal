import { useEffect, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import GlassCard from '../GlassCard';
import { INK } from '../theme';
import { falla, listo } from '../../utils/haptics';
import { guardarPerfil, leerPerfil } from '../colaboradores/api';
import { Boton, TONO } from '../colaboradores/piezas';

const campo = {
  height: 44,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: 'rgba(28,43,34,0.12)',
  backgroundColor: '#FFFFFF',
  paddingHorizontal: 12,
  fontSize: 15,
  color: INK.title,
};

/** El usuario como lo guarda el servidor: minúsculas, sin espacios, [a-z0-9._-]. */
const limpiarUsuario = (u) =>
  String(u || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9._-]/g, '')
    .slice(0, 32);

/**
 * Tu nombre y tu usuario: con eso te encuentran tus colegas para escribirte y
 * es lo que ven en sus chats. Solo para quien colabora.
 */
export default function SeccionPerfil() {
  const queryClient = useQueryClient();
  const perfil = useQuery({ queryKey: ['mi-perfil'], queryFn: leerPerfil, staleTime: 1000 * 60 * 5, retry: false });
  const [nombre, setNombre] = useState('');
  const [usuario, setUsuario] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!perfil.data) return;
    setNombre(perfil.data.nombre || '');
    setUsuario(perfil.data.usuario || '');
  }, [perfil.data]);

  const cambio = !!perfil.data && (nombre.trim() !== (perfil.data.nombre || '') || usuario !== (perfil.data.usuario || ''));

  const guardar = async () => {
    if (!cambio || guardando) return;
    if (usuario && usuario.length < 2) return setError('El usuario lleva al menos 2 letras.');
    setGuardando(true);
    setError(null);
    try {
      const nuevo = await guardarPerfil({ nombre: nombre.trim(), usuario });
      queryClient.setQueryData(['mi-perfil'], nuevo);
      listo();
    } catch (e) {
      falla();
      setError(e?.code === 'usuario_en_uso' || e?.status === 409 ? 'Ese usuario ya lo tiene alguien.' : 'No se pudo guardar. Probá de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  if (perfil.error || (!perfil.isLoading && !perfil.data)) return null;

  return (
    <View style={{ marginBottom: 24 }}>
      <GlassCard radius={16}>
        <View style={{ padding: 18, gap: 10 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: INK.title }}>Cómo te encuentran</Text>
          <TextInput value={nombre} onChangeText={setNombre} placeholder="tu nombre" placeholderTextColor={INK.faint} accessibilityLabel="Tu nombre" style={campo} maxLength={80} />
          <View style={[campo, { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 0 }]}>
            <Text style={{ fontSize: 15, color: INK.meta, paddingLeft: 12 }}>@</Text>
            <TextInput
              value={usuario}
              onChangeText={(t) => setUsuario(limpiarUsuario(t))}
              placeholder="usuario"
              placeholderTextColor={INK.faint}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Tu usuario"
              style={{ flex: 1, height: 44, paddingHorizontal: 4, fontSize: 15, color: INK.title }}
            />
          </View>
          {error ? <Text style={{ fontSize: 13, color: TONO.rojo }}>{error}</Text> : null}
          {cambio ? <Boton texto="guardar" primario alto={42} cargando={guardando} onPress={guardar} /> : null}
        </View>
      </GlassCard>
    </View>
  );
}
