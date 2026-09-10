import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Envoltorio de haptics.
 *
 * Dos razones para no llamar a expo-haptics directo:
 *
 *  1. En Android y en simulador las llamadas pueden rechazar la promesa (no hay
 *     motor, o el permiso VIBRATE no está). Un háptico que falla nunca debe
 *     tumbar una interacción, así que acá se traga el error.
 *  2. El vocabulario queda en un solo lugar. Si «guardar» y «soltar un nodo»
 *     usan la misma intensidad, la app deja de comunicar con el tacto.
 *
 * El vocabulario:
 *  · roce    — cambiar de foco, alternar vista. El más leve.
 *  · toque   — confirmar una acción normal.
 *  · agarre  — levantar algo que se va a arrastrar.
 *  · suelta  — soltarlo en su lugar.
 *  · listo   — la acción terminó bien (guardado, creado).
 *  · falla   — la acción no se pudo completar.
 */

const tragar = (p) => {
  if (p && typeof p.catch === 'function') p.catch(() => {});
};

// En web no hay motor y expo-haptics no expone no-ops para todo.
const activo = Platform.OS === 'ios' || Platform.OS === 'android';

export const roce = () => {
  if (activo) tragar(Haptics.selectionAsync());
};

export const toque = () => {
  if (activo) tragar(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
};

export const agarre = () => {
  if (activo) tragar(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
};

export const suelta = () => {
  if (activo) tragar(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid));
};

export const listo = () => {
  if (activo) tragar(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
};

export const falla = () => {
  if (activo) tragar(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
};
