import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  LinearTransition,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SvgXml } from 'react-native-svg';
import * as Clipboard from 'expo-clipboard';
import { Check, Copy, Plug, X } from 'lucide-react-native';
import { INK, MOTION, SERIF } from '../theme';
import { listo, roce, toque } from '../../utils/haptics';
import { EV, evento } from '../../utils/analitica';
import { listarColaboradores } from './api';
import { MCP_URL, clientesPara, nuevosAgentes, pedidoDeCuenta } from './clientes';
import { visibles } from './logica';
import { LOGOS } from './logos';
import { Boton, TONO } from './piezas';
import { TarjetaConexion } from './AutorizarConexion';

/** Cada cuánto se mira si el agente ya se creó su cuenta. */
const CADA = 4000;

/**
 * Conectar un agente (reemplaza a «sumar un agente»).
 *
 * El agente se crea su propia cuenta: se conecta al MCP de Vizta desde su
 * cliente, entra con la cuenta de quien lo usa y llama a
 * `agent_account_create`. La app no crea nada; muestra con qué se puede
 * conectar, los pasos para ese cliente, y espera a que la cuenta aparezca.
 */
export default function ConectarAgente({ antes, miId, bottomInset, onListo, onCerrar, conexiones = [], onAutorizar }) {
  const CLIENTES = clientesPara();
  const [elegido, setElegido] = useState(CLIENTES.length === 1 ? CLIENTES[0] : null);
  const [nombre, setNombre] = useState('');
  const [llego, setLlego] = useState(null);
  const base = useRef(antes || []);

  const elegir = (c) => {
    roce();
    setElegido(c);
    setNombre(c.id === 'otro' ? '' : c.nombre);
    evento(EV.COLAB_CLIENTE_ELEGIDO, { cliente: c.id });
  };

  // Con un cliente elegido, se mira cada tanto si apareció un agente nuevo.
  useEffect(() => {
    if (!elegido || llego) return undefined;
    let vivo = true;
    const mirar = async () => {
      try {
        const ahora = visibles(await listarColaboradores(), miId);
        const nuevo = nuevosAgentes(base.current, ahora)[0];
        if (vivo && nuevo) {
          listo();
          evento(EV.COLAB_AGENTE_SUMADO, { cliente: elegido.id });
          setLlego(nuevo);
        }
      } catch {
        // Se vuelve a mirar en la próxima vuelta.
      }
    };
    const reloj = setInterval(mirar, CADA);
    return () => {
      vivo = false;
      clearInterval(reloj);
    };
  }, [elegido, llego, miId]);

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View entering={FadeIn.duration(180)} style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(28,43,34,0.35)' }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCerrar} accessibilityRole="button" accessibilityLabel="Cerrar" />
      </Animated.View>

      <KeyboardAvoidingView style={{ flex: 1, justifyContent: 'flex-end' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} pointerEvents="box-none">
        <Animated.View
          entering={FadeInDown.springify().damping(MOTION.enter.damping).stiffness(MOTION.enter.stiffness)}
          style={{ backgroundColor: '#FBFAF6', borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '92%' }}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingTop: 10, paddingHorizontal: 24, paddingBottom: bottomInset + 24, gap: 18 }}
          >
            <View style={{ alignSelf: 'center', width: 34, height: 4, borderRadius: 2, backgroundColor: 'rgba(28,43,34,0.18)' }} />

            {/* Si el agente ya pidió conectarse, se autoriza desde acá. */}
            {conexiones.map((s) => (
              <TarjetaConexion key={s.req_id} solicitud={s} onPress={() => onAutorizar?.(s)} />
            ))}

            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ fontFamily: SERIF, fontSize: 28, letterSpacing: -0.3, color: INK.title }} accessibilityRole="header">
                  Conectar un agente
                </Text>
                <Text style={{ fontSize: 13.5, lineHeight: 19, color: INK.body }}>
                  Se suma desde donde ya trabaja y se crea su propia cuenta. Lo que guarde va a su Codex; lo que quiera pasar al tuyo te llega para aprobar.
                </Text>
              </View>
              <Pressable onPress={onCerrar} hitSlop={12} accessibilityRole="button" accessibilityLabel="Cerrar" style={{ padding: 6, marginRight: -6 }}>
                <X size={19} color={INK.faint} />
              </Pressable>
            </View>

            {llego ? (
              <Llego agente={llego} onVer={() => onListo(llego)} />
            ) : (
              <>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: CLIENTES.length < 3 ? 'flex-start' : 'space-between', gap: CLIENTES.length < 3 ? 12 : 0, rowGap: 12 }}>
                  {CLIENTES.map((c, i) => (
                    <Ficha
                      key={c.id}
                      cliente={c}
                      indice={i}
                      elegida={elegido?.id === c.id}
                      apagada={!!elegido && elegido.id !== c.id}
                      onPress={() => elegir(c)}
                      ancho={CLIENTES.length < 3 ? '47%' : '31%'}
                    />
                  ))}
                  {/* Relleno para que la última fila no se estire. */}
                  {CLIENTES.length > 2 && CLIENTES.length % 3 ? Array.from({ length: 3 - (CLIENTES.length % 3) }, (_, i) => <View key={`r${i}`} style={{ width: '31%' }} />) : null}
                </View>

                {elegido ? <Pasos key={elegido.id} cliente={elegido} nombre={nombre} onNombre={setNombre} /> : null}
              </>
            )}
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

/** Un cliente: su logo en una baldosa. Se hunde al tocarla y salta al elegirla. */
function Ficha({ cliente, indice, elegida, apagada, onPress, ancho = '31%' }) {
  const escala = useSharedValue(1);
  const giro = useSharedValue(0);
  const alto = useSharedValue(0);

  useEffect(() => {
    alto.value = withSpring(elegida ? -3 : 0, MOTION.tap);
    if (elegida) {
      giro.value = withSequence(withTiming(-7, { duration: 80 }), withTiming(6, { duration: 110 }), withSpring(0, MOTION.tap));
    }
  }, [elegida, alto, giro]);

  const estilo = useAnimatedStyle(() => ({
    transform: [{ translateY: alto.value }, { scale: escala.value }],
  }));
  const estiloLogo = useAnimatedStyle(() => ({ transform: [{ rotate: `${giro.value}deg` }] }));

  return (
    <Animated.View
      entering={FadeInDown.delay(60 * indice).springify().damping(MOTION.enter.damping)}
      style={[{ width: ancho }, estilo]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={() => {
          escala.value = withTiming(0.93, MOTION.press);
        }}
        onPressOut={() => {
          escala.value = withSpring(1, MOTION.tap);
        }}
        accessibilityRole="button"
        accessibilityLabel={cliente.id === 'otro' ? 'Otro cliente' : cliente.nombre}
        accessibilityState={{ selected: elegida }}
        style={{
          alignItems: 'center',
          gap: 8,
          paddingVertical: 14,
          borderRadius: 18,
          backgroundColor: '#FFFFFF',
          borderWidth: elegida ? 1.5 : 1,
          borderColor: elegida ? TONO.verde : 'rgba(28,43,34,0.08)',
          opacity: apagada ? 0.5 : 1,
          shadowColor: '#1E3326',
          shadowOpacity: elegida ? 0.16 : 0.05,
          shadowRadius: elegida ? 16 : 8,
          shadowOffset: { width: 0, height: elegida ? 8 : 3 },
          elevation: elegida ? 5 : 1,
        }}
      >
        <Animated.View style={[{ width: 34, height: 34, alignItems: 'center', justifyContent: 'center' }, estiloLogo]}>
          {LOGOS[cliente.id] ? (
            <SvgXml xml={LOGOS[cliente.id]} width={30} height={30} />
          ) : (
            <Plug size={24} color={TONO.verde} strokeWidth={1.8} />
          )}
        </Animated.View>
        <Text style={{ fontSize: 13, fontWeight: '600', color: INK.title }}>{cliente.nombre}</Text>
      </Pressable>
    </Animated.View>
  );
}

/** Los tres pasos para el cliente elegido. */
function Pasos({ cliente, nombre, onNombre }) {
  const pedido = pedidoDeCuenta(nombre);
  // Los chats de siempre traen su paso a paso; los técnicos, el de antes.
  const propios = cliente.pasos || [
    { titulo: 'Agregá Vizta como conector', texto: cliente.donde, copiar: 'url' },
    { titulo: 'Autorizalo en Vizta', texto: 'Se abre una página de Vizta y, en tu teléfono, Vizta te pide autorizarlo.' },
  ];
  const ultimo = propios.length + 1;
  return (
    <Animated.View entering={FadeInDown.springify().damping(MOTION.enter.damping)} layout={LinearTransition} style={{ gap: 16 }}>
      {cliente.antes ? (
        <View style={{ backgroundColor: 'rgba(28,43,34,0.05)', borderRadius: 14, padding: 12 }}>
          <Text style={{ fontSize: 13, lineHeight: 18, color: INK.body }}>{cliente.antes}</Text>
        </View>
      ) : null}

      {propios.map((p, i) => (
        <Paso key={p.titulo} n={i + 1} titulo={p.titulo} texto={p.texto}>
          {p.copiar === 'url' ? <Copiable valor={MCP_URL} etiqueta="Copiar la dirección" mono /> : null}
        </Paso>
      ))}

      <Paso n={ultimo} titulo="Pedile que se cree su cuenta" texto={`Escribile esto en el chat de ${cliente.id === 'otro' ? 'tu agente' : cliente.nombre}. Elegí cómo se va a llamar.`}>
        <TextInput
          value={nombre}
          onChangeText={onNombre}
          placeholder="Cómo se va a llamar"
          placeholderTextColor={INK.faint}
          autoCorrect={false}
          autoCapitalize="words"
          maxLength={60}
          accessibilityLabel="Cómo se va a llamar"
          style={{ height: 44, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(61,95,70,0.35)', backgroundColor: '#FFFFFF', paddingHorizontal: 12, fontSize: 15, color: INK.title }}
        />
        <Copiable valor={pedido} etiqueta="Copiar el pedido" />
      </Paso>

      <Esperando nombre={nombre.trim() || 'tu agente'} />
    </Animated.View>
  );
}

function Paso({ n, titulo, texto, children }) {
  return (
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: TONO.verdeLavado, alignItems: 'center', justifyContent: 'center', marginTop: 1 }} accessible={false}>
        <Text style={{ fontSize: 13, fontWeight: '800', color: TONO.verde }}>{n}</Text>
      </View>
      <View style={{ flex: 1, gap: 8 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: INK.title }}>{titulo}</Text>
        {texto ? <Text style={{ fontSize: 13, lineHeight: 18, color: INK.body }}>{texto}</Text> : null}
        {children}
      </View>
    </View>
  );
}

/** Un texto con su botón de copiar. El ícono pasa a cheque un momento. */
function Copiable({ valor, etiqueta, mono }) {
  const [copiado, setCopiado] = useState(false);
  const reloj = useRef(null);
  useEffect(() => () => clearTimeout(reloj.current), []);

  const copiar = async () => {
    await Clipboard.setStringAsync(valor);
    toque();
    setCopiado(true);
    clearTimeout(reloj.current);
    reloj.current = setTimeout(() => setCopiado(false), 1600);
  };

  return (
    <Pressable
      onPress={copiar}
      accessibilityRole="button"
      accessibilityLabel={copiado ? 'Copiado' : etiqueta}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: copiado ? TONO.verdeLavado : 'rgba(28,43,34,0.05)',
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 12,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text
        style={{ flex: 1, fontSize: mono ? 12.5 : 13, lineHeight: 18, color: '#2E3B33', fontFamily: mono ? 'Menlo' : undefined }}
        numberOfLines={mono ? 1 : 4}
      >
        {valor}
      </Text>
      {copiado ? (
        <Animated.View key="si" entering={ZoomIn.springify().damping(12)}>
          <Check size={17} color={TONO.verde} strokeWidth={2.4} />
        </Animated.View>
      ) : (
        <Animated.View key="no" entering={FadeIn.duration(150)}>
          <Copy size={16} color={INK.body} strokeWidth={1.9} />
        </Animated.View>
      )}
    </Pressable>
  );
}

/** Mientras el agente no se crea su cuenta: un punto que late. */
function Esperando({ nombre }) {
  const pulso = useSharedValue(0);
  useEffect(() => {
    pulso.value = withRepeat(withTiming(1, { duration: 900 }), -1, true);
  }, [pulso]);
  const estilo = useAnimatedStyle(() => ({
    opacity: 0.35 + pulso.value * 0.65,
    transform: [{ scale: 0.8 + pulso.value * 0.4 }],
  }));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 4, paddingLeft: 7 }} accessibilityLiveRegion="polite">
      <Animated.View style={[{ width: 10, height: 10, borderRadius: 5, backgroundColor: TONO.verde }, estilo]} />
      <Text style={{ fontSize: 13, color: INK.meta }}>Cuando {nombre} se cree su cuenta, aparece acá.</Text>
    </View>
  );
}

/** Llegó: el agente ya tiene cuenta. */
function Llego({ agente, onVer }) {
  return (
    <Animated.View entering={FadeIn.duration(200)} style={{ alignItems: 'center', gap: 10, paddingVertical: 18 }}>
      <Animated.View
        entering={ZoomIn.springify().damping(10)}
        style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: TONO.verde, alignItems: 'center', justifyContent: 'center' }}
      >
        <Check size={30} color="#FFFFFF" strokeWidth={2.6} />
      </Animated.View>
      <Text style={{ fontFamily: SERIF, fontSize: 26, color: INK.title, textAlign: 'center' }}>Llegó {agente.nombre || 'tu agente'}</Text>
      <Text style={{ fontSize: 13.5, lineHeight: 19, color: INK.body, textAlign: 'center' }}>Empieza pudiendo leer tu Codex y crear en el suyo.</Text>
      <Boton texto="ver qué puede hacer" primario onPress={onVer} style={{ marginTop: 6, alignSelf: 'stretch' }} />
    </Animated.View>
  );
}
