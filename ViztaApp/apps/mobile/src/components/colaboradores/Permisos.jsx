import { useState } from 'react';
import { Alert, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { ChevronRight, CircleQuestionMark, FolderInput, Inbox } from 'lucide-react-native';
import { useQueryClient } from '@tanstack/react-query';
import { INK } from '../theme';
import { cambiarColaborador, revocarColaborador } from './api';
import { CATALOGO_PERMISOS, PERMISOS, conPermiso, destinoDe } from './logica';
import GuiaPermisos, { ICONO_PERMISO } from './GuiaPermisos';
import { Boton, Cabecera, ROTULO, TONO, nombreDe } from './piezas';
import { AvisosDelAgente } from './Enterarse';

/** Los que escriben en la cuenta personal se confirman antes de activarse. */
const CONFIRMAR = {
  editar: (n) => ({
    titulo: `¿Permitir que ${n} edite tu cuenta?`,
    texto: `${n} podrá crear y actualizar espacios y fichas directamente en tu cuenta personal, sin pedirte aprobación. Todo quedará marcado como hecho por el agente.`,
    boton: 'permitir',
  }),
  eliminar: (n) => ({
    titulo: `¿Permitir que ${n} elimine?`,
    texto: `${n} podrá eliminar fichas o relaciones de tu cuenta personal.`,
    boton: 'permitir',
  }),
};

/**
 * Qué puede hacer un agente en tu Codex (pantalla 9). Cada interruptor se
 * guarda al tocarlo; si no sale, vuelve a como estaba.
 *
 * Sigue el contrato v4.8 (STA-259): sin «editar», lo del agente queda en su
 * espacio y llega como propuesta; con «editar», va directo a la cuenta
 * personal. Lo que explica eso vive en la guía (el «?»); acá solo los
 * interruptores y dónde queda lo que crea. Activar «editar» o «eliminar» se
 * confirma, porque escriben en la cuenta personal.
 *
 * «Desde dónde trabaja» y los créditos de la semana entran con Actividad y el
 * gasto por agente: hoy no hay de dónde leerlos por agente.
 */
export default function Permisos({ colaborador, porAprobar = 0, topInset, bottomInset, onVolver, onCambiado, onPorAprobar, onQuitado }) {
  const queryClient = useQueryClient();
  const [permisos, setPermisos] = useState(colaborador.permisos || {});
  const [guardando, setGuardando] = useState(null);
  const [quitando, setQuitando] = useState(false);
  const [guia, setGuia] = useState(false);
  const nombre = nombreDe(colaborador);

  const pedirCambio = (clave, valor) => {
    const c = valor && CONFIRMAR[clave] ? CONFIRMAR[clave](nombre) : null;
    if (!c) return cambiar(clave, valor);
    Alert.alert(c.titulo, c.texto, [
      { text: 'cancelar', style: 'cancel' },
      { text: c.boton, onPress: () => cambiar(clave, valor) },
    ]);
  };

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
      Alert.alert('No se pudo cambiar el permiso', 'Revisa la conexión a internet e inténtalo de nuevo.');
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
            Alert.alert('No se pudo quitar el acceso', 'Revisa la conexión a internet e inténtalo de nuevo.');
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
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[ROTULO, { flex: 1 }]}>PERMISOS</Text>
            <Pressable onPress={() => setGuia(true)} hitSlop={12} accessibilityRole="button" accessibilityLabel="Qué significa cada permiso">
              <CircleQuestionMark size={19} color={INK.meta} strokeWidth={1.8} />
            </Pressable>
          </View>
          <View style={{ backgroundColor: 'rgba(255,255,255,0.78)', borderWidth: 1, borderColor: 'rgba(28,43,34,0.08)', borderRadius: 18, overflow: 'hidden' }}>
            {PERMISOS.map((clave, i) => {
              const Icono = ICONO_PERMISO[clave];
              const p = CATALOGO_PERMISOS[clave];
              const peligro = clave === 'eliminar';
              return (
                <View
                  key={clave}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    paddingVertical: 12,
                    paddingHorizontal: 14,
                    borderBottomWidth: i === PERMISOS.length - 1 ? 0 : 1,
                    borderBottomColor: 'rgba(28,43,34,0.06)',
                  }}
                >
                  <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: peligro ? 'rgba(154,83,71,0.1)' : 'rgba(28,43,34,0.06)', alignItems: 'center', justifyContent: 'center' }}>
                    <Icono size={16} color={peligro ? TONO.ladrillo : INK.body} strokeWidth={1.9} />
                  </View>
                  <View style={{ flex: 1, gap: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: INK.title }}>{p.titulo}</Text>
                    <Text style={{ fontSize: 12.5, color: INK.meta }}>{p.corto}</Text>
                  </View>
                  <Switch
                    value={!!permisos[clave]}
                    onValueChange={(v) => pedirCambio(clave, v)}
                    disabled={!!guardando || quitando}
                    trackColor={{ true: TONO.verde, false: 'rgba(28,43,34,0.14)' }}
                    ios_backgroundColor="rgba(28,43,34,0.14)"
                    accessibilityLabel={p.titulo}
                    accessibilityHint={p.texto}
                  />
                </View>
              );
            })}
          </View>
          <Destino permisos={permisos} />
        </View>

        {colaborador.cuenta_tipo === 'agente' ? (
          <AvisosDelAgente colaborador={colaborador} nombre={nombre} />
        ) : null}

        <View style={{ flex: 1 }} />
        <Boton texto="quitarle el acceso" peligro onPress={quitar} cargando={quitando} alto={44} />
      </ScrollView>
      {guia ? <GuiaPermisos nombre={nombre} bottomInset={bottomInset} onClose={() => setGuia(false)} /> : null}
    </View>
  );
}

/**
 * Dónde queda lo que crea, según «editar»: el dato, no la explicación (esa
 * está en la guía). Sin «editar» no todo pasa por aprobación: lo nuevo queda
 * en su cuenta de agente (Su Codex); solo pasarlo a la tuya es una propuesta.
 */
function Destino({ permisos }) {
  const directo = destinoDe(permisos) === 'cuenta';
  const Icono = directo ? FolderInput : Inbox;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4, paddingTop: 4 }}>
      <Icono size={16} color={directo ? '#8A6420' : INK.meta} strokeWidth={1.9} />
      <Text style={{ flex: 1, fontSize: 13, color: INK.body }}>
        {directo ? 'Lo que crea va directo a tu cuenta' : 'Lo que crea queda en su espacio; pasarlo a tu cuenta te llega para aprobar'}
      </Text>
    </View>
  );
}
