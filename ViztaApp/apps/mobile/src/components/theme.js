// Tokens de la superficie clara de Vizta.
// El fondo es claro (ver AppBackground), así que el glassmorphism se invierte:
// en vez de un panel oscuro translúcido, es un cristal lechoso con rim blanco
// y sombra suave. Estos tokens son la fuente única para todas las pantallas.

export const INK = {
  title: '#1C2B22',
  body: '#5A6B60',
  meta: '#8A968D',
  faint: '#A7B0A6',
};

export const GLASS = {
  fill: 'rgba(255, 255, 255, 0.58)',
  rim: 'rgba(255, 255, 255, 0.9)',
  blur: 26,
};

export const CARD_SHADOW = {
  shadowColor: '#25332A',
  shadowOpacity: 0.08,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 8 },
  elevation: 4,
};

// Acentos semánticos en versión clara: par {tint, ink} listo para chip
// (fondo tint + texto ink) o para filete lateral (ink).
export const ACCENT = {
  indigo: { tint: 'rgba(99,102,241,0.10)', ink: '#4B4FA6' },
  amber: { tint: 'rgba(245,158,11,0.10)', ink: '#92400E' },
  green: { tint: 'rgba(22,163,74,0.10)', ink: '#15803D' },
  red: { tint: 'rgba(220,38,38,0.09)', ink: '#B91C1C' },
  pink: { tint: 'rgba(219,39,119,0.08)', ink: '#9D2A6B' },
  neutral: { tint: 'rgba(28,43,34,0.05)', ink: '#5A6B60' },
};

// ─── Movimiento ───────────────────────────────────────────────────────────────
// Un solo juego de resortes para toda la app. Antes cada pantalla declaraba el
// suyo (240 en una, 250 en otra, ninguno en la tercera) y el conjunto se sentía
// hecho por manos distintas.
export const MOTION = {
  // Respuesta al dedo: corta y seca, sin rebote visible.
  tap: { damping: 20, stiffness: 250, mass: 0.5 },
  // Entradas y morphs: algo más de recorrido para que se lea el movimiento.
  enter: { damping: 18, stiffness: 150, mass: 0.7 },
  // Reordenar y crecer.
  layout: { damping: 22, stiffness: 200, mass: 0.7 },
  // El hundido al presionar va con timing, no con resorte: tiene que llegar al
  // fondo antes de que el dedo se levante.
  press: { duration: 90 },
};

export const RADIUS = { sm: 11, md: 15, lg: 18, xl: 22, pill: 999 };

// ─── Refracción del cristal ───────────────────────────────────────────────────
// RN 0.81 con New Architecture soporta `boxShadow` con `inset`, que es lo que
// permite el borde refractado de verdad en vez de un borderWidth plano: una
// línea de luz arriba y una sombra tenue abajo, como un canto de vidrio real.
// Va en la View que recorta (overflow: hidden); la sombra exterior no puede
// vivir ahí porque iOS la recortaría — para eso está el wrapper de GlassCard.
export const RIM = [
  { inset: true, offsetX: 0, offsetY: 1, blurRadius: 1, color: 'rgba(255,255,255,0.95)' },
  { inset: true, offsetX: 0, offsetY: -1, blurRadius: 1, color: 'rgba(28,43,34,0.05)' },
  { inset: true, offsetX: 0, offsetY: 0, blurRadius: 8, spreadDistance: 2, color: 'rgba(255,255,255,0.22)' },
];

// Sobre superficie oscura la luz se invierte: el filo brillante sigue arriba
// pero mucho más tenue, y el interior gana profundidad en vez de perderla.
export const RIM_OSCURO = [
  { inset: true, offsetX: 0, offsetY: 1, blurRadius: 1, color: 'rgba(255,255,255,0.16)' },
  { inset: true, offsetX: 0, offsetY: 0, blurRadius: 10, spreadDistance: 2, color: 'rgba(0,0,0,0.18)' },
];

// Chip estándar: fondo tenue + borde del mismo tono un poco más marcado.
export const chipStyle = (tint, border) => ({
  backgroundColor: tint,
  paddingHorizontal: 10,
  paddingVertical: 4,
  borderRadius: 8,
  borderWidth: 1,
  borderColor: border,
});
