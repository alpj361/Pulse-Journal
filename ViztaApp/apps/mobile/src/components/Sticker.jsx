import { Image } from 'react-native';

/**
 * Los stickers de Vizta: objetos de bloques de juguete, con borde blanco.
 *
 * Son la ilustración de la app —un tema, un estado, un lugar—, no sus
 * controles: los botones siguen siendo íconos de línea. Un sticker va donde
 * hay algo que reconocer de un vistazo o un momento que acompañar (no hay
 * nada, algo falló, ya quedó).
 *
 * Los archivos están en `assets/stickers/`, a 256 px: alcanza hasta unos 85
 * puntos de lado en pantalla. A menos de 32 puntos, «vacio» y «cargando»
 * pierden el detalle.
 */
const STICKER = {
  // Feeds
  guatemala: require('../../assets/stickers/guatemala.png'),
  congreso: require('../../assets/stickers/congreso.png'),
  observatorio: require('../../assets/stickers/cc/fiscal.png'),
  // Temas del feed
  politica: require('../../assets/stickers/politica.png'),
  economia: require('../../assets/stickers/economia-costo-vida.png'),
  social: require('../../assets/stickers/social.png'),
  violencia: require('../../assets/stickers/violencia.png'),
  justicia: require('../../assets/stickers/justicia-mazo.png'),
  clima: require('../../assets/stickers/clima-desastres.png'),
  movilidad: require('../../assets/stickers/movilidad.png'),
  internacional: require('../../assets/stickers/internacional.png'),
  deportes: require('../../assets/stickers/deportes.png'),
  cultura: require('../../assets/stickers/cultura.png'),
  entretenimiento: require('../../assets/stickers/entretenimiento.png'),
  tecnologia: require('../../assets/stickers/tecnologia.png'),
  otros: require('../../assets/stickers/otros.png'),
  // Violencia, por subtipo (pegatinaDe en temas.js elige cuál)
  'violencia-alerta': require('../../assets/stickers/violencia/alerta.png'),
  'violencia-urgente': require('../../assets/stickers/violencia/urgente.png'),
  'violencia-homicidio': require('../../assets/stickers/violencia/homicidio.png'),
  'violencia-ninez': require('../../assets/stickers/violencia/ninez.png'),
  'violencia-mujer': require('../../assets/stickers/violencia/mujer.png'),
  'violencia-intrafamiliar': require('../../assets/stickers/violencia/intrafamiliar.png'),
  'violencia-extorsion': require('../../assets/stickers/violencia/extorsion.png'),
  'violencia-crimen-organizado': require('../../assets/stickers/violencia/crimen-organizado.png'),
  'violencia-desaparicion': require('../../assets/stickers/violencia/desaparicion.png'),
  'violencia-transporte': require('../../assets/stickers/violencia/transporte.png'),
  'violencia-linchamiento': require('../../assets/stickers/violencia/linchamiento.png'),
  'violencia-estado': require('../../assets/stickers/violencia/estado.png'),
  // Estados
  error: require('../../assets/stickers/error.png'),
  vacio: require('../../assets/stickers/vacio.png'),
  cargando: require('../../assets/stickers/cargando.png'),
  exito: require('../../assets/stickers/exito.png'),
  'not-found': require('../../assets/stickers/not-found.png'),
  // Lugares de la app
  trafico: require('../../assets/stickers/trafico.png'),
  // Secciones del Congreso (vista organizada)
  iniciativas: require('../../assets/stickers/iniciativas.png'),
  comisiones: require('../../assets/stickers/comisiones.png'),
  pleno: require('../../assets/stickers/pleno.png'),
  // Mientras no haya uno propio, la urna del tema política.
  votaciones: require('../../assets/stickers/politica.png'),
  fiscalizacion: require('../../assets/stickers/fiscalizacion.png'),
  leyes: require('../../assets/stickers/leyes.png'),
};

export const STICKERS = Object.keys(STICKER);

/**
 * @param nombre uno de `STICKERS`; si no existe, no dibuja nada
 * @param size   lado en puntos
 */
export default function Sticker({ nombre, size = 48, style }) {
  const fuente = STICKER[nombre];
  if (!fuente) return null;
  // Decorativo: quien lo usa ya dice con texto lo que el sticker ilustra.
  return <Image source={fuente} style={[{ width: size, height: size }, style]} resizeMode="contain" accessible={false} />;
}
