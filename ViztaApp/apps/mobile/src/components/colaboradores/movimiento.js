import { Easing, FadeIn, FadeInLeft, FadeInRight, FadeOut, LinearTransition, ZoomIn, ZoomOut, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { MOTION } from '../theme';

/**
 * El movimiento de Colaboradores, en un solo lugar.
 *
 * Todo es corto: un chat se abre muchas veces al día, y lo que se repite no
 * puede hacerse esperar. Lo que entra lo hace desde donde viene (un mensaje
 * del otro desde su esquina, uno tuyo desde la tuya), y lo que ya estaba se
 * corre con un resorte en vez de saltar.
 */

const salida = Easing.out(Easing.cubic);

/** Entrar a una pantalla, o volver a la anterior: un tramo corto, no la pantalla entera. */
export const entrarPantalla = (adelante) =>
  (adelante ? FadeInRight : FadeInLeft).duration(220).easing(salida);

/** La conversación aparece cuando termina de cargar, sin saltar desde el vacío. */
export const aparecer = FadeIn.duration(180);

/**
 * Un mensaje que llega: sube un poco y crece desde su esquina de abajo. El
 * resorte es el de las entradas de toda la app. `tinta`: la opacidad final
 * (lo tuyo, mientras se envía, queda a media tinta).
 */
export const llegaMensaje = (tinta = 1) => () => {
  'worklet';
  const resorte = { damping: MOTION.enter.damping, stiffness: MOTION.enter.stiffness, mass: MOTION.enter.mass };
  return {
    initialValues: { opacity: 0, transform: [{ translateY: 14 }, { scale: 0.94 }] },
    animations: {
      opacity: withTiming(tinta, { duration: 160 }),
      transform: [{ translateY: withSpring(0, resorte) }, { scale: withSpring(1, resorte) }],
    },
  };
};

/**
 * El mensaje que mandaste, ya guardado: estaba a media tinta mientras se
 * enviaba y solo termina de encenderse. No vuelve a entrar.
 */
export function quedaEnviado() {
  'worklet';
  return {
    initialValues: { opacity: 0.55 },
    animations: { opacity: withTiming(1, { duration: 220 }) },
  };
}

/** Lo que hizo el agente: el renglón aparece y su ícono salta un poco después. */
export const llegaAccion = FadeIn.duration(220);
export function saltaIcono() {
  'worklet';
  return {
    initialValues: { opacity: 0, transform: [{ scale: 0.4 }] },
    animations: {
      opacity: withDelay(60, withTiming(1, { duration: 120 })),
      transform: [{ scale: withDelay(60, withSpring(1, { damping: 11, stiffness: 260, mass: 0.6 })) }],
    },
  };
}
/** Una cosa más dentro de un renglón que ya estaba («Creó 5…»). */
export const llegaEnlace = FadeInLeft.duration(200).easing(salida);

/** El diamante entra y sale con escala: está, o no está. */
export const entraDiamante = ZoomIn.springify().damping(14).stiffness(260).mass(0.5);
export const saleDiamante = ZoomOut.duration(140);

/** Lo que cambia de texto (la vista previa de un chat) se funde, no parpadea. */
export const cambiaTexto = FadeIn.duration(240);
export const seVa = FadeOut.duration(140);

/** Cuando entra algo nuevo, lo de alrededor se corre con resorte. */
export const correrse = LinearTransition.springify().damping(MOTION.layout.damping).stiffness(MOTION.layout.stiffness).mass(MOTION.layout.mass);
