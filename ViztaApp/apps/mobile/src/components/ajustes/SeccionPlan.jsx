import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Check, ChevronDown, ChevronUp, Coins, Sparkles } from 'lucide-react-native';
import GlassCard from '../GlassCard';
import { INK, ACCENT, chipStyle } from '../theme';
import { useCapacidadesStore, refrescarCapacidades } from '../../state/capacidadesStore';
import { comprar, ofertas, restaurar } from '../../services/compras';

/**
 * Planes: un menú más, como los de abajo.
 *
 * **No hay muro de pago.** Nada interrumpe para vender: quien no tiene Posts
 * simplemente no lo ve, y acá —donde se viene a ver la cuenta— está el plan, el
 * saldo y lo que se puede comprar, plegado como todo lo demás de esta pantalla.
 *
 * Se elige una opción y se confirma con un solo botón, en vez de un botón por
 * renglón: así el renglón sirve para comparar y el botón para decidir, y no hay
 * tres acciones compitiendo por el mismo toque.
 *
 * Lo que se muestra sale de la base (`get_my_capabilities`), la misma respuesta
 * con la que el servidor deja pasar o no un gasto. Los precios salen de la
 * tienda; si no hay nada a la venta, no se dice nada.
 */

/** Un paquete de la tienda que es suscripción, no un consumible suelto. */
const esSuscripcion = (p) =>
  String(p?.product?.productCategory || '').toUpperCase() === 'SUBSCRIPTION' || !!p?.product?.subscriptionPeriod;

// Cómo se llaman acá, que no es como se llaman en la tienda: los títulos de la
// tienda vienen con el nombre de la app repetido y a veces con el id crudo.
const PRESENTACION = {
  weekly_v1: { titulo: 'Vizta-T', subtitulo: 'Suscripción semanal' },
  package_v1: { titulo: '50 créditos', subtitulo: null },
  // Los mismos productos en la Test Store de RevenueCat, que se llaman distinto.
  weekly: { titulo: 'Vizta-T', subtitulo: 'Suscripción semanal' },
  consumable: { titulo: '50 créditos', subtitulo: null },
};

/**
 * Con qué se distingue una opción de otra.
 *
 * El identificador del **paquete** lo pone quien arma la oferta, y puede
 * repetirse entre dos opciones (en la Test Store las dos llegaron como
 * personalizadas). El del **producto** es el de la tienda y es único, así que es
 * el que sirve para elegir y para la clave de la lista.
 */
const idDe = (p) => p?.product?.identifier || p?.identifier || '';

function presentar(p) {
  const id = idDe(p);
  if (PRESENTACION[id]) return PRESENTACION[id];
  return esSuscripcion(p)
    ? { titulo: 'Vizta-T', subtitulo: 'Suscripción semanal' }
    : { titulo: p?.product?.title || 'Créditos', subtitulo: null };
}

/**
 * Cada opción tiene color propio.
 *
 * Dos renglones grises con un borde apenas visible se leen como una lista de
 * ajustes, no como algo que se elige: el color es lo que distingue a la
 * suscripción del paquete antes de leer una sola palabra. Índigo es el acento
 * de la app (el mismo del botón del portal); el ámbar queda para lo que se
 * cuenta en monedas.
 */
const PALETA = {
  suscripcion: {
    suave: 'rgba(99,102,241,0.12)',
    borde: 'rgba(99,102,241,0.40)',
    fuerte: '#5B5BD6',
    lavado: ['rgba(99,102,241,0.18)', 'rgba(139,92,246,0.09)'],
  },
  creditos: {
    suave: 'rgba(245,158,11,0.14)',
    borde: 'rgba(217,119,6,0.38)',
    fuerte: '#C2740B',
    lavado: ['rgba(245,158,11,0.20)', 'rgba(249,115,22,0.08)'],
  },
};

const paletaDe = (p) => (esSuscripcion(p) ? PALETA.suscripcion : PALETA.creditos);

/** El cuadrito con el ícono: pálido mientras se compara, sólido al elegir. */
function Insignia({ paleta, Icono, marcado }) {
  return (
    <View
      style={{
        width: 36,
        height: 36,
        borderRadius: 11,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: marcado ? paleta.fuerte : paleta.suave,
      }}
    >
      <Icono size={18} color={marcado ? '#fff' : paleta.fuerte} />
    </View>
  );
}

export default function SeccionPlan() {
  const [abierto, setAbierto] = useState(false);
  const capacidades = useCapacidadesStore((s) => s.capacidades);
  const [paquetes, setPaquetes] = useState([]);
  const [elegido, setElegido] = useState(null);
  const [comprando, setComprando] = useState(false);
  const [error, setError] = useState(null);

  // Se pregunta al abrir: plegado no molesta ni a la base ni a la tienda.
  useEffect(() => {
    if (!abierto) return undefined;
    let vivo = true;
    refrescarCapacidades();
    ofertas()
      .then((lista) => vivo && setPaquetes(lista))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [abierto]);

  const plan = capacidades?.plan?.name || 'Gratis';
  const planKey = capacidades?.plan?.key;
  const suscripcion = capacidades?.suscripcion;
  const enPrueba = suscripcion?.prueba && suscripcion?.estado === 'trialing';
  const creditos = capacidades?.creditos ?? 0;
  const conSuscripcion = planKey !== 'free' && ['active', 'trialing', 'grace'].includes(suscripcion?.estado);
  const resumen = conSuscripcion ? plan : creditos > 0 ? 'Créditos' : plan;

  /** El que ya se tiene: su suscripción está viva y es la de este plan. */
  const esElActual = (p) =>
    esSuscripcion(p) && planKey !== 'free' && ['active', 'trialing', 'grace'].includes(suscripcion?.estado);

  // Lo primero que no se tiene ya viene marcado: abrir y confirmar, sin un paso
  // de más para quien viene a lo obvio.
  const opciones = paquetes.filter((p) => !esElActual(p));
  const seleccion = opciones.find((p) => idDe(p) === elegido) || opciones[0] || null;

  const tomar = async () => {
    if (!seleccion) return;
    setError(null);
    setComprando(true);
    try {
      await comprar(seleccion);
      // El plan y los créditos los pone la tienda al avisarle al servidor, y eso
      // tarda unos segundos: se vuelve a preguntar un par de veces.
      setTimeout(() => refrescarCapacidades({ forzar: true }), 3000);
      setTimeout(() => refrescarCapacidades({ forzar: true }), 9000);
    } catch (e) {
      setError(e.message);
    } finally {
      setComprando(false);
    }
  };

  return (
    <View style={{ marginBottom: 24 }}>
      <GlassCard radius={16}>
        <TouchableOpacity
          onPress={() => setAbierto((v) => !v)}
          style={{ flexDirection: 'row', alignItems: 'center', padding: 18 }}
          activeOpacity={0.7}
        >
          <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: INK.title, lineHeight: 20 }}>
            Planes
          </Text>
          {/* Lo que se tiene, en este orden: la suscripción, el saldo comprado,
              o nada que anunciar. Un «Gratis» junto a 50 créditos sería mentira. */}
          {conSuscripcion || creditos > 0 ? (
            <View
              style={{
                ...chipStyle(
                  conSuscripcion ? PALETA.suscripcion.suave : PALETA.creditos.suave,
                  conSuscripcion ? PALETA.suscripcion.borde : PALETA.creditos.borde,
                ),
                paddingHorizontal: 9,
                marginRight: 10,
              }}
            >
              <Text
                style={{
                  fontSize: 11.5,
                  fontWeight: '700',
                  color: conSuscripcion ? PALETA.suscripcion.fuerte : PALETA.creditos.fuerte,
                }}
              >
                {resumen}
              </Text>
            </View>
          ) : (
            <Text style={{ fontSize: 13, color: INK.faint, marginRight: 10 }}>{resumen}</Text>
          )}
          {abierto ? <ChevronUp size={17} color={INK.meta} /> : <ChevronDown size={17} color={INK.meta} />}
        </TouchableOpacity>

        {abierto && (
          <View
            style={{
              paddingHorizontal: 18,
              paddingBottom: 18,
              borderTopWidth: 1,
              borderColor: 'rgba(28,43,34,0.08)',
            }}
          >
            {/* Sin saldo no hay nada que contar: un «0» grande solo sirve para
                recordarte que no compraste. */}
            {creditos > 0 || enPrueba ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  marginTop: 16,
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  borderRadius: 14,
                  overflow: 'hidden',
                }}
              >
                <LinearGradient
                  colors={creditos > 0 ? PALETA.creditos.lavado : PALETA.suscripcion.lavado}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
                />
                {creditos > 0 ? (
                  <>
                    <Insignia paleta={PALETA.creditos} Icono={Coins} marcado />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 24, fontWeight: '800', color: INK.title, letterSpacing: -0.4 }}>
                        {creditos}
                      </Text>
                      <Text style={{ fontSize: 12, color: INK.body, marginTop: -1 }}>créditos</Text>
                    </View>
                  </>
                ) : (
                  <View style={{ flex: 1 }} />
                )}
                {enPrueba ? (
                  <View style={{ ...chipStyle('rgba(255,255,255,0.75)', 'rgba(99,102,241,0.30)'), paddingHorizontal: 9 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: ACCENT.indigo.ink }}>Prueba</Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* La fecha es de la suscripción, no del saldo: sin una viva queda
                una promesa vencida («se renueva el 16») debajo de los créditos. */}
            {conSuscripcion && suscripcion?.vence ? (
              <Text style={{ fontSize: 12, color: INK.faint, marginTop: 10 }}>
                {enPrueba ? 'Hasta el ' : 'Se renueva el '}
                {new Date(suscripcion.vence).toLocaleDateString('es-GT', { day: 'numeric', month: 'long' })}
              </Text>
            ) : null}

            {paquetes.length ? (
              <View style={{ marginTop: 18, gap: 10 }}>
                {paquetes.map((p) => {
                  const actual = esElActual(p);
                  const marcado = !actual && idDe(seleccion) === idDe(p);
                  const paleta = paletaDe(p);
                  const Icono = esSuscripcion(p) ? Sparkles : Coins;
                  const { titulo, subtitulo } = presentar(p);
                  return (
                    <TouchableOpacity
                      key={idDe(p)}
                      onPress={() => !actual && setElegido(idDe(p))}
                      activeOpacity={actual ? 1 : 0.8}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 12,
                        paddingVertical: 13,
                        paddingHorizontal: 13,
                        borderRadius: 14,
                        borderWidth: marcado ? 1.5 : 1,
                        borderColor: marcado ? paleta.borde : 'rgba(28,43,34,0.07)',
                        backgroundColor: marcado ? 'transparent' : 'rgba(255,255,255,0.5)',
                        overflow: 'hidden',
                      }}
                    >
                      {/* El elegido se tiñe de su propio color; los demás quedan
                          en cristal, que ya contrasta contra el fondo. */}
                      {marcado ? (
                        <LinearGradient
                          colors={paleta.lavado}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
                        />
                      ) : null}

                      <Insignia paleta={paleta} Icono={Icono} marcado={marcado || actual} />

                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 15, fontWeight: '800', color: INK.title, letterSpacing: -0.2 }}>
                          {titulo}
                        </Text>
                        {subtitulo ? (
                          <Text style={{ fontSize: 11.5, color: INK.body, marginTop: 1 }}>{subtitulo}</Text>
                        ) : null}
                      </View>

                      {actual ? (
                        <View style={{ ...chipStyle(ACCENT.green.tint, 'rgba(22,163,74,0.24)'), paddingHorizontal: 9 }}>
                          <Text style={{ fontSize: 11, fontWeight: '700', color: ACCENT.green.ink }}>Actual</Text>
                        </View>
                      ) : (
                        <>
                          <Text style={{ fontSize: 14, fontWeight: '800', color: marcado ? paleta.fuerte : INK.body }}>
                            {p.product?.priceString}
                          </Text>
                          <View
                            style={{
                              width: 20,
                              height: 20,
                              borderRadius: 10,
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderWidth: marcado ? 0 : 1.5,
                              borderColor: 'rgba(28,43,34,0.14)',
                              backgroundColor: marcado ? paleta.fuerte : 'transparent',
                            }}
                          >
                            {marcado ? <Check size={13} color="#fff" strokeWidth={3} /> : null}
                          </View>
                        </>
                      )}
                    </TouchableOpacity>
                  );
                })}

                {seleccion ? (
                  <TouchableOpacity
                    onPress={tomar}
                    disabled={comprando}
                    activeOpacity={0.85}
                    style={{
                      borderRadius: 14,
                      overflow: 'hidden',
                      marginTop: 4,
                      opacity: comprando ? 0.6 : 1,
                      shadowColor: paletaDe(seleccion).fuerte,
                      shadowOpacity: 0.28,
                      shadowRadius: 14,
                      shadowOffset: { width: 0, height: 6 },
                      elevation: 5,
                    }}
                  >
                    <LinearGradient
                      colors={
                        esSuscripcion(seleccion) ? ['#6366F1', '#4338CA'] : ['#F59E0B', '#D97706']
                      }
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        paddingVertical: 15,
                      }}
                    >
                      {comprando ? <ActivityIndicator size="small" color="#fff" /> : null}
                      <Text style={{ fontSize: 15, fontWeight: '800', color: '#fff', letterSpacing: 0.2 }}>
                        {esSuscripcion(seleccion) ? 'Mejorar' : 'Comprar'}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                ) : null}

                <TouchableOpacity
                  onPress={() => restaurar().catch((e) => setError(e.message))}
                  style={{ alignSelf: 'center', paddingVertical: 8 }}
                >
                  <Text style={{ fontSize: 12, color: INK.faint }}>Restaurar compras</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {error ? (
              <Text style={{ fontSize: 12, color: ACCENT.red.ink, marginTop: 12, lineHeight: 18 }}>{error}</Text>
            ) : null}
          </View>
        )}
      </GlassCard>
    </View>
  );
}
