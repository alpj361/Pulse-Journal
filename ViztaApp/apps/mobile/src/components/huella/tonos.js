import { INK } from '../theme';
import { TEMAS } from '../feed/temas';

/** Los tonos de la huella: lavado de fondo y tinta. */
export const TONOS = {
  verde: { fondo: TEMAS.Social.lavado[0], tinta: TEMAS.Social.tinta },
  ambar: { fondo: TEMAS.Economía.lavado[0], tinta: TEMAS.Economía.tinta },
  rojo: { fondo: TEMAS.Violencia.lavado[0], tinta: TEMAS.Violencia.tinta },
  azul: { fondo: TEMAS.Política.lavado[0], tinta: TEMAS.Política.tinta },
  neutro: { fondo: 'rgba(28,43,34,0.06)', tinta: INK.body },
};
