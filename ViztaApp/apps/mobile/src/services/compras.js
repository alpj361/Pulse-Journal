import { Platform } from 'react-native';
import * as Device from 'expo-device';
import { supabase } from '../utils/supabase';
import { refrescarCapacidades } from '../state/capacidadesStore';

/**
 * Comprar el plan o un paquete de créditos.
 *
 * **La app no otorga nada.** Compra contra la tienda y RevenueCat avisa al
 * servidor, que es quien mueve el plan y suma los créditos. Así la compra vale
 * igual si alguien reinstala, cambia de teléfono o pide un reembolso, y nadie
 * puede regalarse créditos desde el cliente.
 *
 * El id de RevenueCat es el de Supabase (`logIn`), que es lo que después deja
 * cruzar el webhook con la cuenta.
 *
 * **Dos claves, y la app elige sola.** En el simulador no existe StoreKit, así
 * que la única tienda que puede mostrar productos es la de prueba de RevenueCat
 * (`EXPO_PUBLIC_REVENUECAT_IOS_KEY_SIMULADOR`). En un teléfono —y en TestFlight—
 * va la de la App Store (`EXPO_PUBLIC_REVENUECAT_IOS_KEY`), que es la que hace
 * compras de verdad. Sin esto habría que editar el `.env` y reempaquetar cada
 * vez que se pasa de un lado al otro, y es justo el paso que se olvida: subir a
 * TestFlight con la clave de prueba hace que App Review rechace la app.
 *
 * Si solo hay una configurada, se usa esa. Sin ninguna, las compras quedan
 * apagadas y la pantalla no ofrece nada, en vez de reventar al abrirse.
 */

// El módulo nativo no existe en Expo Go: se pide con cuidado para que la app
// abra igual, solo sin compras.
let Purchases = null;
try {
  // eslint-disable-next-line global-require
  Purchases = require('react-native-purchases').default;
} catch {
  Purchases = null;
}

// `Device.isDevice` es false en un simulador y true en un teléfono.
const CLAVE = Platform.select({
  ios: Device.isDevice
    ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY || process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY_SIMULADOR
    : process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY_SIMULADOR || process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
  default: null,
});

/** El derecho que abre Posts, tal como se llama en RevenueCat. */
export const DERECHO = process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT || 'vizta_t';

export const comprasDisponibles = () => !!Purchases && !!CLAVE;

let configurado = false;
let usuarioEnSesion = null;

/** Arrancar el SDK y decirle de quién es esta sesión. Repetirlo no hace daño. */
export async function prepararCompras() {
  if (!comprasDisponibles()) return false;

  if (!configurado) {
    Purchases.configure({ apiKey: CLAVE });
    configurado = true;
  }

  const { data } = await supabase.auth.getSession();
  const userId = data?.session?.user?.id || null;

  if (userId && userId !== usuarioEnSesion) {
    await Purchases.logIn(userId);
    usuarioEnSesion = userId;
  } else if (!userId && usuarioEnSesion) {
    await Purchases.logOut();
    usuarioEnSesion = null;
  }
  return true;
}

/** Lo que se puede comprar hoy, tal como lo devuelve la tienda. */
export async function ofertas() {
  if (!(await prepararCompras())) return [];
  const oferta = (await Purchases.getOfferings())?.current;
  return oferta?.availablePackages || [];
}

/**
 * Comprar. Devuelve `{ ok }`, o `{ cancelado: true }` si la persona se arrepintió.
 *
 * Al volver se refrescan las capacidades, pero el plan y los créditos los pone
 * el webhook: si todavía no llegó, se vuelven a pedir en el próximo refresco.
 */
export async function comprar(paquete) {
  if (!(await prepararCompras())) throw new Error('Las compras no están configuradas.');
  try {
    await Purchases.purchasePackage(paquete);
    await refrescarCapacidades({ forzar: true });
    return { ok: true };
  } catch (e) {
    if (e?.userCancelled) return { cancelado: true };
    throw new Error(e?.message || 'No se pudo completar la compra.');
  }
}

/** Para quien cambió de teléfono: la tienda vuelve a contar lo que ya pagó. */
export async function restaurar() {
  if (!(await prepararCompras())) throw new Error('Las compras no están configuradas.');
  await Purchases.restorePurchases();
  await refrescarCapacidades({ forzar: true });
}
