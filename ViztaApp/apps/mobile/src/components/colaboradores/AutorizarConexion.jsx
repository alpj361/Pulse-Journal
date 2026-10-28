import { useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SvgXml } from 'react-native-svg';
import { Check, ChevronRight, X } from 'lucide-react-native';
import { INK, SERIF } from '../theme';
import { falla, roce, toque } from '../../utils/haptics';
import MorphingInfinity from '../MorphingInfinity';
import { NoDisponible, aprobarOAuth, rechazarOAuth, solicitudOAuth } from './api';
import { LOGOS } from './logos';
import { Boton, EstadoCentro, ROTULO, TONO } from './piezas';

/** Lo que puede hacer en tu Vizta. Leer y crear vienen prendidos; tocar lo tuyo, no. */
const PERMISOS = [
  { clave: 'leer', titulo: 'Leer', texto: 'Busca en lo que guardaste', inicial: true },
  { clave: 'crear', titulo: 'Crear', texto: 'Guarda cosas nuevas en su Codex', inicial: true },
  { clave: 'modificar', titulo: 'Editar', texto: 'Sin esto, sus cambios te llegan para aprobar', inicial: false },
  { clave: 'borrar', titulo: 'Borrar', texto: 'Quita lo que ya no sirve', inicial: false },
];

const logoDe = (nombre) => LOGOS[String(nombre || '').toLowerCase().replace(/[^a-z]/g, '')] || null;

/**
 * Autorizar que ChatGPT, Claude u otro cliente se conecte a tu Vizta.
 *
 * El cliente abre una página que queda esperando; acá decidís. Al autorizar,
 * esa página vuelve sola al cliente con la conexión hecha. Se llega por el
 * enlace de la página (`com.standatpd.vizta://mcp-authorize?req=…`) o desde
 * la tarjeta que aparece en Colaboradores mientras hay una solicitud.
 */
export default function AutorizarConexion({ req, codigo, topInset = 0, bottomInset = 0, onCerrar, onEntrar }) {
  const queryClient = useQueryClient();
  const clave = req || codigo;
  const [permisos, setPermisos] = useState(() => Object.fromEntries(PERMISOS.map((p) => [p.clave, p.inicial])));
  const [enviando, setEnviando] = useState(null);
  const [resultado, setResultado] = useState(null);
  const consulta = useQuery({
    queryKey: ['mcp-solicitud', clave],
    queryFn: () => solicitudOAuth(clave),
    enabled: !!clave,
    retry: false,
    staleTime: 0,
  });
  const s = consulta.data;
  const cliente = s?.client_name || 'Un cliente';
  const logo = logoDe(s?.client_name);

  const decidir = async (aprobar) => {
    roce();
    setEnviando(aprobar ? 'aprobar' : 'rechazar');
    try {
      if (aprobar) await aprobarOAuth(s.req_id || clave, permisos);
      else await rechazarOAuth(s.req_id || clave);
      toque();
      setResultado(aprobar ? 'aprobada' : 'rechazada');
      queryClient.invalidateQueries({ queryKey: ['mcp-solicitudes'] });
    } catch {
      falla();
      setResultado('fallo');
    } finally {
      setEnviando(null);
    }
  };

  const cerrar = (
    <Pressable
      onPress={onCerrar}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="Cerrar"
      style={({ pressed }) => ({ alignSelf: 'flex-end', width: 40, height: 40, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.5 : 1 })}
    >
      <X size={22} color={INK.meta} />
    </Pressable>
  );

  if (consulta.isLoading) {
    return (
      <View style={{ flex: 1, paddingTop: topInset + 8, paddingHorizontal: 20 }}>
        {cerrar}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <MorphingInfinity size={30} color={INK.meta} />
        </View>
      </View>
    );
  }

  if (consulta.error || !s) {
    const sinSesion = consulta.error instanceof NoDisponible && consulta.error.motivo === 'sesion';
    return (
      <View style={{ flex: 1, paddingTop: topInset + 8, paddingHorizontal: 20 }}>
        {cerrar}
        {sinSesion ? (
          <EstadoCentro titulo="Entrá con tu cuenta" texto="Para conectar un agente a tu Vizta tenés que estar adentro.">
            {onEntrar ? <Boton texto="entrar" primario onPress={onEntrar} /> : null}
          </EstadoCentro>
        ) : (
          <EstadoCentro titulo="Esta solicitud ya no está" texto="Venció o ya se respondió. Volvé a conectar desde el agente." />
        )}
      </View>
    );
  }

  if (resultado === 'aprobada' || resultado === 'rechazada') {
    const ok = resultado === 'aprobada';
    return (
      <View style={{ flex: 1, paddingTop: topInset + 8, paddingHorizontal: 20, paddingBottom: bottomInset + 20 }}>
        {cerrar}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 12 }}>
          <Animated.View
            entering={ZoomIn.springify().damping(14)}
            style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: ok ? TONO.verde : 'rgba(28,43,34,0.1)', alignItems: 'center', justifyContent: 'center' }}
          >
            {ok ? <Check size={34} color="#FFFFFF" strokeWidth={2.6} /> : <X size={30} color={INK.body} strokeWidth={2.4} />}
          </Animated.View>
          <Text style={{ fontFamily: SERIF, fontSize: 28, color: INK.title, textAlign: 'center' }}>{ok ? `${cliente} quedó conectado` : 'No se conectó'}</Text>
          <Text style={{ fontSize: 15, lineHeight: 21, color: INK.body, textAlign: 'center' }}>
            {ok ? `Volvé a ${cliente}: ya puede usar tu Vizta.` : `Volvé a ${cliente} si querés intentarlo de nuevo.`}
          </Text>
        </View>
        <Boton texto="listo" primario onPress={onCerrar} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, paddingTop: topInset + 8 }}>
      <View style={{ paddingHorizontal: 20 }}>{cerrar}</View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 20, gap: 22 }}>
        <Animated.View entering={FadeIn.duration(220)} style={{ alignItems: 'center', gap: 14, paddingTop: 4 }}>
          <View style={{ width: 76, height: 76, borderRadius: 22, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: TONO.borde, alignItems: 'center', justifyContent: 'center' }}>
            {logo ? <SvgXml xml={logo} width={40} height={40} /> : <Text style={{ fontFamily: SERIF, fontSize: 30, color: INK.title }}>{cliente.slice(0, 1)}</Text>}
          </View>
          <Text style={{ fontFamily: SERIF, fontSize: 28, lineHeight: 32, color: INK.title, textAlign: 'center' }} accessibilityRole="header">
            {cliente} quiere conectarse a tu Vizta
          </Text>
        </Animated.View>

        {s.user_code ? (
          <View style={{ alignItems: 'center', gap: 8 }}>
            <View style={{ borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(28,43,34,0.25)', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 22 }}>
              <Text selectable style={{ fontFamily: 'Menlo', fontSize: 24, fontWeight: '700', letterSpacing: 3, color: INK.title }}>
                {s.user_code}
              </Text>
            </View>
            <Text style={{ fontSize: 13, color: INK.meta, textAlign: 'center' }}>Es el mismo que ves en {cliente}.</Text>
          </View>
        ) : null}

        <View style={{ gap: 8 }}>
          <Text style={ROTULO}>EN TU VIZTA PUEDE</Text>
          <View style={{ backgroundColor: 'rgba(255,255,255,0.78)', borderWidth: 1, borderColor: 'rgba(28,43,34,0.08)', borderRadius: 18, overflow: 'hidden' }}>
            {PERMISOS.map((p, i) => (
              <View
                key={p.clave}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16, borderTopWidth: i ? 1 : 0, borderTopColor: 'rgba(28,43,34,0.06)' }}
              >
                <View style={{ flex: 1, gap: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: INK.title }}>{p.titulo}</Text>
                  <Text style={{ fontSize: 12.5, color: INK.meta }}>{p.texto}</Text>
                </View>
                <Switch
                  value={!!permisos[p.clave]}
                  onValueChange={(v) => {
                    roce();
                    setPermisos((prev) => ({ ...prev, [p.clave]: v }));
                  }}
                  trackColor={{ true: TONO.verde, false: 'rgba(28,43,34,0.14)' }}
                  ios_backgroundColor="rgba(28,43,34,0.14)"
                  accessibilityLabel={p.titulo}
                />
              </View>
            ))}
          </View>
        </View>

        {resultado === 'fallo' ? (
          <Text style={{ fontSize: 13, color: TONO.rojo, textAlign: 'center' }}>No se pudo responder. Revisá la conexión y probá de nuevo.</Text>
        ) : null}
      </ScrollView>
      <View style={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: bottomInset + 16, gap: 8 }}>
        <Boton texto="autorizar" primario onPress={() => decidir(true)} cargando={enviando === 'aprobar'} disabled={!!enviando} />
        <Boton texto="rechazar" onPress={() => decidir(false)} cargando={enviando === 'rechazar'} disabled={!!enviando} />
      </View>
    </View>
  );
}

/** «ChatGPT quiere conectarse · ABCD-1234 ›»: aparece mientras hay una solicitud esperando. */
export function TarjetaConexion({ solicitud: s, onPress }) {
  const logo = logoDe(s.client_name);
  return (
    <Animated.View entering={FadeIn.duration(220)}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          backgroundColor: '#FFFFFF',
          borderWidth: 1,
          borderColor: 'rgba(43,107,69,0.3)',
          borderRadius: 16,
          paddingVertical: 12,
          paddingHorizontal: 14,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        })}
      >
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(28,43,34,0.05)', alignItems: 'center', justifyContent: 'center' }}>
          {logo ? <SvgXml xml={logo} width={22} height={22} /> : <Text style={{ fontFamily: SERIF, fontSize: 18, color: INK.title }}>{String(s.client_name || '?').slice(0, 1)}</Text>}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontSize: 14.5, fontWeight: '700', color: INK.title }}>{s.client_name || 'Un agente'} quiere conectarse</Text>
          {s.user_code ? <Text style={{ fontSize: 12.5, fontFamily: 'Menlo', color: INK.meta }}>{s.user_code}</Text> : null}
        </View>
        <Text style={{ fontSize: 13.5, fontWeight: '600', color: TONO.verde }}>revisar</Text>
        <ChevronRight size={16} color={TONO.verde} />
      </Pressable>
    </Animated.View>
  );
}
