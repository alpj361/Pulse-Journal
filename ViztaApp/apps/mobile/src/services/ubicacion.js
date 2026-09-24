import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { celdasBajoPincel } from '../components/mapa/niebla';

/**
 * Dónde está la persona, y por dónde estuvo.
 *
 * **Dos permisos para dos preguntas distintas.** iOS los llama «mientras uso la
 * app» y «siempre»:
 *
 * - *Mientras uso la app* contesta «¿dónde estoy ahora?». El punto aparece
 *   mientras el mapa está abierto y se apaga al salir.
 * - *Siempre* contesta «¿por dónde anduve?». Con la app cerrada, el sistema la
 *   despierta de vez en cuando y eso descubre el mapa.
 *
 * **Por eventos, no por rastreo.** Lo segundo no es un GPS encendido siguiendo
 * cada paso: es una geocerca de 400 m alrededor de donde estás. Mientras no
 * salgas de ahí el sistema no despierta a nadie y la app no gasta nada; cuando
 * salís, iOS la despierta una vez, anota dónde estás, y vuelve a poner la
 * geocerca en el punto nuevo. El resultado es «estuve por acá», que es lo que
 * el mapa necesita para destapar la niebla — no una línea con cada esquina que
 * doblaste.
 *
 * Eso también es lo que evita la píldora azul permanente del sistema: la
 * enciende el rastreo continuo en segundo plano, no el monitoreo por regiones.
 * La app no la apaga con una bandera; simplemente no hace lo que la enciende.
 *
 * **Lo que anota la tarea se deja en una cola, no en el store.** La tarea
 * corre en otro contexto de JS —sin pantallas montadas y sin el estado de
 * zustand— así que escribe claves de celda en AsyncStorage y el mapa las
 * recoge cuando vuelve al frente.
 */

/** Nombre de la tarea de geocerca. Lo registra el sistema: no puede cambiar
 *  sin dejar huérfanas las tareas de los teléfonos ya instalados. */
export const TAREA_EXPLORACION = 'vizta-exploracion';

/** Las celdas que la tarea descubrió y el mapa todavía no recogió. */
const LLAVE_PENDIENTES = 'vizta-explorado-pendiente';

/** Dónde quedó la geocerca, para saber si hay que moverla. */
const LLAVE_CENTRO = 'vizta-exploracion-centro';

/**
 * El radio de la geocerca.
 *
 * 400 m es el compromiso: más chico y el sistema despierta la app cada vez que
 * alguien cruza la calle —que es batería sin información nueva, porque la
 * celda de la niebla mide 275 m—; más grande y se pierden barrios enteros
 * entre despertar y despertar.
 */
const RADIO = 400;

/** Cuánto se destapa alrededor de un punto visitado, en metros. */
const DESCUBIERTO = 350;

/** Las celdas alrededor de un punto, en la misma cuadrícula que el pincel. */
function celdasDe(lat, lng, metros = DESCUBIERTO) {
  // `celdasBajoPincel` piensa en píxeles porque lo usa el dedo; acá se le pasa
  // la equivalencia directa —un «píxel» es un metro— para no duplicar la
  // geometría de la cuadrícula en dos lugares que podrían discrepar.
  const gradosPorMetro = 1 / 111320;
  return celdasBajoPincel({ lat, lng, gradosPorPixel: gradosPorMetro, radioPx: metros });
}

async function encolar(claves) {
  if (!claves?.length) return;
  try {
    const crudo = await AsyncStorage.getItem(LLAVE_PENDIENTES);
    const previas = crudo ? JSON.parse(crudo) : [];
    const todas = Array.from(new Set([...(Array.isArray(previas) ? previas : []), ...claves]));
    await AsyncStorage.setItem(LLAVE_PENDIENTES, JSON.stringify(todas));
  } catch {
    // Perder un descubrimiento no justifica romper el despertar.
  }
}

/** Lo que la tarea dejó anotado. Se vacía al leerlo: quien lo lee lo aplica. */
export async function recogerPendientes() {
  try {
    const crudo = await AsyncStorage.getItem(LLAVE_PENDIENTES);
    if (!crudo) return [];
    await AsyncStorage.removeItem(LLAVE_PENDIENTES);
    const claves = JSON.parse(crudo);
    return Array.isArray(claves) ? claves : [];
  } catch {
    return [];
  }
}

/** Deja la geocerca centrada donde está la persona ahora. */
async function moverGeocerca(lat, lng) {
  await Location.startGeofencingAsync(TAREA_EXPLORACION, [
    {
      identifier: 'aqui',
      latitude: lat,
      longitude: lng,
      radius: RADIO,
      // Solo la salida: la entrada es el momento en que se acaba de poner la
      // geocerca, así que avisaría de inmediato y en un bucle.
      notifyOnEnter: false,
      notifyOnExit: true,
    },
  ]);
  try {
    await AsyncStorage.setItem(LLAVE_CENTRO, JSON.stringify({ lat, lng, ts: Date.now() }));
  } catch {
    // El centro guardado es informativo; la geocerca real la tiene el sistema.
  }
}

/**
 * La tarea.
 *
 * Se define en el módulo y no dentro de un componente: el sistema la despierta
 * con la app cerrada, y en ese arranque no hay ninguna pantalla montada — si
 * viviera en un `useEffect`, no existiría cuando el sistema la busca por su
 * nombre.
 */
TaskManager.defineTask(TAREA_EXPLORACION, async ({ data, error }) => {
  if (error) return;
  if (data?.eventType !== Location.GeofencingEventType.Exit) return;

  try {
    // Precisión baja a propósito: para saber en qué celda de 275 m estuviste no
    // hace falta encender el GPS fino, y la diferencia en batería es toda la
    // diferencia entre esto y un rastreador.
    const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
    const { latitude, longitude } = p.coords;
    await encolar(celdasDe(latitude, longitude));
    await moverGeocerca(latitude, longitude);
  } catch {
    // Sin señal al despertar: la geocerca vieja sigue puesta y el próximo
    // evento vuelve a intentar.
  }
});

/** Qué permiso hay hoy, sin pedir nada. */
export async function permisoActual() {
  const enUso = await Location.getForegroundPermissionsAsync();
  if (!enUso.granted) return 'ninguno';
  const siempre = await Location.getBackgroundPermissionsAsync();
  return siempre.granted ? 'siempre' : 'enUso';
}

/** Pide «mientras uso la app». */
export async function pedirEnUso() {
  const { granted } = await Location.requestForegroundPermissionsAsync();
  if (!granted) return 'ninguno';
  const siempre = await Location.getBackgroundPermissionsAsync();
  return siempre.granted ? 'siempre' : 'enUso';
}

/**
 * Pide «siempre».
 *
 * iOS muestra este diálogo una sola vez en la vida de la instalación, así que
 * se pide cuando la persona ya dijo que quiere que el mapa se vaya destapando
 * solo — no al abrir, cuando todavía no se entiende para qué.
 */
export async function pedirSiempre() {
  const enUso = await Location.getForegroundPermissionsAsync();
  if (!enUso.granted) {
    const r = await Location.requestForegroundPermissionsAsync();
    if (!r.granted) return 'ninguno';
  }

  // Ya concedido: nada que preguntar. Sin esto, prender el descubrimiento
  // disparaba dos diálogos seguidos —el de «mientras uso la app» y el de
  // «siempre»— aunque el primero ya estuviera contestado.
  const actual = await Location.getBackgroundPermissionsAsync();
  if (actual.granted) return 'siempre';

  // Se pide igual aunque `canAskAgain` venga en falso: el sistema decide si
  // muestra algo, y cortar antes convertía el botón en un botón muerto —se
  // tocaba y no pasaba nada, ni diálogo ni aviso.
  const { granted, canAskAgain } = await Location.requestBackgroundPermissionsAsync();
  if (granted) return 'siempre';
  // «negado» es cuando el sistema ya no va a preguntar más: ahí el único
  // camino es Ajustes, y quien llama puede decirlo. «enUso» es un no de esta
  // vez, que se puede volver a intentar con otro toque.
  return canAskAgain === false ? 'negado' : 'enUso';
}

/** Una sola lectura, para centrar el mapa sin quedarse escuchando. */
export async function donde() {
  const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  return { lat: p.coords.latitude, lng: p.coords.longitude, precision: p.coords.accuracy, ts: p.timestamp };
}

/**
 * Escuchar mientras el mapa está abierto.
 *
 * Devuelve la suscripción. El intervalo es generoso: un punto cada pocos metros
 * no mueve el punto en pantalla y sí gasta batería.
 */
export async function escuchar(alMoverse) {
  return Location.watchPositionAsync(
    { accuracy: Location.Accuracy.Balanced, timeInterval: 4000, distanceInterval: 10 },
    (p) => alMoverse({ lat: p.coords.latitude, lng: p.coords.longitude, precision: p.coords.accuracy, ts: p.timestamp })
  );
}

/** Las celdas que corresponden a estar parado en un punto. */
export const celdasDeVisita = celdasDe;

/** Empezar a descubrir el mapa solo. */
export async function iniciarExploracion() {
  const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
  await moverGeocerca(p.coords.latitude, p.coords.longitude);
  await encolar(celdasDe(p.coords.latitude, p.coords.longitude));
  return true;
}

export async function detenerExploracion() {
  if (await TaskManager.isTaskRegisteredAsync(TAREA_EXPLORACION)) {
    await Location.stopGeofencingAsync(TAREA_EXPLORACION);
  }
}

export async function explorandoSolo() {
  try {
    return await Location.hasStartedGeofencingAsync(TAREA_EXPLORACION);
  } catch {
    return false;
  }
}
