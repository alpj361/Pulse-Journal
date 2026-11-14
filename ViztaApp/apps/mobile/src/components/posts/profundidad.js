/**
 * Cuánto análisis merece un post.
 *
 * Un disfraz de Halloween o el tráiler de una película no piden narrativa,
 * hechos ni postura: piden decir qué son y la obra para guardarla. El backend
 * lo dice en `analysis.profundidad` ('breve' | 'completa'); mientras un
 * análisis no lo traiga, se decide con lo que ya clasificó Jev
 * (`details.clasificacion.probabilidades`).
 */

const UMBRAL_LIVIANO = 0.6;
const UMBRAL_INFORMA = 0.5;

const probabilidades = (details) => details?.clasificacion?.probabilidades || {};

const esLiviano = (p) => Number(p.comedia || 0) >= UMBRAL_LIVIANO || Number(p.baile_tendencia || 0) >= UMBRAL_LIVIANO;

/**
 * ¿El post informa o afirma algo comprobable? Ahí sí importa en qué se apoya.
 * En un post liviano un hecho suelto («salió el tráiler») no lo vuelve
 * informativo: hace falta que informar sea a lo que va.
 */
export function esInformativo(details) {
  const p = probabilidades(details);
  if (Number(p.informacion || 0) >= UMBRAL_INFORMA) return true;
  return !esLiviano(p) && Number(p.hechos || 0) >= UMBRAL_INFORMA;
}

/** Entretenimiento, referencias, tendencias: se muestra lo esencial y el resto se pliega. */
export function esBreve(analisis, details) {
  if (analisis?.profundidad === 'breve') return true;
  if (analisis?.profundidad === 'completa') return false;
  return esLiviano(probabilidades(details)) && !esInformativo(details);
}

/** La obra que el post muestra o evoca, venga del vistazo guardado o del análisis. */
export const obraDelPost = (analisis, details) =>
  details?.vistazo?.obra_identificada || analisis?.vistazo?.obra_identificada || null;

const plano = (t) =>
  String(t || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');

/** ¿Esta mención es la misma obra que ya está arriba? Entonces no se lista otra vez en «materiales». */
export function esLaObra(mencion, obra) {
  if (!obra?.titulo || !mencion) return false;
  const de = [obra.titulo, obra.titulo_original].map(plano).filter(Boolean);
  const nombres = [mencion.texto, mencion.identidad?.titulo, mencion.identidad?.titulo_original].map(plano).filter(Boolean);
  return nombres.some((n) => de.includes(n));
}
