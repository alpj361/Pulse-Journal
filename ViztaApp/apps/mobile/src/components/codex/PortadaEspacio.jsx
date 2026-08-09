import { StyleSheet, View } from 'react-native';
import { Canvas, Fill, Shader, Skia } from '@shopify/react-native-skia';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

/**
 * Portada de un espacio.
 *
 * Si el usuario subió una imagen (`space.cover`, guardada en `data.cover` del
 * jsonb — no hizo falta migrar nada), se usa esa. Si no, la genera un shader.
 *
 * Lo importante es que sea DERIVADA DEL ID, no aleatoria. Con Math.random() la
 * portada cambiaría en cada render y el carrusel parpadearía de colores; así
 * cada espacio tiene siempre la suya y se reconoce por su textura antes de leer
 * el nombre — que es para lo que sirve una portada.
 */

// ─── El shader ────────────────────────────────────────────────────────────────

/**
 * fBm con domain warping.
 *
 * Un degradado de dos paradas siempre se ve como un degradado. Esto en cambio
 * deforma el espacio con ruido antes de muestrear el color, y de ahí salen
 * vetas, nubes y remolinos — texturas que parecen tinta en agua o piedra
 * pulida, distintas en cada semilla. Es la técnica de warping de Iñigo Quílez.
 *
 * Va sin reloj a propósito: estático, Skia lo dibuja una vez y queda como
 * textura. Animado serían ocho carátulas repintándose a 60 fps detrás de un
 * carrusel que además está transformando en 3D.
 */
const FUENTE = `
uniform float2 u_size;
uniform float  u_seed;
uniform float3 c1;
uniform float3 c2;
uniform float3 c3;

float hash(float2 p) {
  return fract(sin(dot(p, float2(127.1, 311.7))) * 43758.5453);
}

float noise(float2 p) {
  float2 i = floor(p);
  float2 f = fract(p);
  float a = hash(i);
  float b = hash(i + float2(1.0, 0.0));
  float c = hash(i + float2(0.0, 1.0));
  float d = hash(i + float2(1.0, 1.0));
  float2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(float2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = p * 2.02;
    a = a * 0.5;
  }
  return v;
}

half4 main(float2 xy) {
  float2 uv = xy / u_size;
  float s = u_seed;

  // Dos pasadas de deformación: la primera curva el espacio, la segunda curva
  // esa curva. Con una sola pasada se ve ruido; con dos, se ve materia.
  float2 q = float2(fbm(uv * 3.0 + s), fbm(uv * 3.0 + s + 5.2));
  float2 r = float2(fbm(uv * 3.0 + 4.0 * q + 1.7 + s), fbm(uv * 3.0 + 4.0 * q + 9.2 + s));
  float f = fbm(uv * 3.0 + 4.0 * r);

  float3 col = mix(c1, c2, clamp(f * f * 2.4, 0.0, 1.0));
  col = mix(col, c3, clamp(length(r) * 0.75, 0.0, 1.0));

  // Un realce donde el warp se acumula: da la sensación de luz atravesando.
  col += c3 * 0.18 * clamp(length(q) - 0.35, 0.0, 1.0);

  // Viñeta suave, para que la carátula tenga cuerpo y no se vea impresa plana.
  float d = distance(uv, float2(0.5, 0.5));
  col = col * (1.0 - 0.42 * d * d * 1.8);

  return half4(clamp(col, 0.0, 1.0), 1.0);
}
`;

// Si el shader no compila en este dispositivo, `Make` devuelve null y la portada
// cae al degradado. Nunca debe romper la pantalla por una decoración.
const EFECTO = (() => {
  try {
    return Skia.RuntimeEffect.Make(FUENTE);
  } catch {
    return null;
  }
})();

// ─── Paletas ──────────────────────────────────────────────────────────────────

// Ocho tríos: sombra, cuerpo y luz. Pensados como carátulas, no como fondos de
// UI — saturados, con una fuente de luz clara.
const PALETAS = [
  ['#08243F', '#1C6E8C', '#8FE0CE'], // marea
  ['#2E0A08', '#A33B20', '#F0B45A'], // brasa
  ['#0B1F14', '#2F6B3E', '#B6D983'], // musgo
  ['#150C2B', '#4B3F8F', '#CBA6E8'], // anochecer
  ['#241209', '#8A4B2A', '#E7C39A'], // barro
  ['#0E1216', '#3C4A57', '#A3B6C4'], // pizarra
  ['#2C0718', '#A82B57', '#F7AEBE'], // flor
  ['#182306', '#6E8A19', '#DCE86A'], // cítrico
];

/** Hash entero y estable de una cadena. */
function hash(s) {
  let h = 2166136261;
  const t = String(s ?? '');
  for (let i = 0; i < t.length; i++) {
    h ^= t.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** '#RRGGBB' → [r, g, b] en 0..1, que es lo que espera un float3 de SkSL. */
function aRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/**
 * Receta de portada para un id. Dos espacios pueden caer en la misma paleta, así
 * que la semilla del warp también sale del hash: la misma paleta con otra
 * semilla da una composición completamente distinta.
 */
export function portadaDe(id) {
  const h = hash(id);
  const paleta = PALETAS[h % PALETAS.length];
  const invertida = (h >> 3) % 2 === 0;
  const colores = invertida ? [...paleta].reverse() : paleta;

  return {
    colores,
    rgb: colores.map(aRgb),
    // Semilla en un rango amplio para que dos espacios no caigan en warps
    // parecidos por casualidad.
    seed: ((h >> 7) % 10000) / 100,
    inicio: { x: ((h >> 5) % 40) / 100, y: ((h >> 9) % 30) / 100 },
    fin: { x: 0.7 + ((h >> 13) % 30) / 100, y: 0.75 + ((h >> 17) % 25) / 100 },
  };
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function PortadaEspacio({ space, radius = 20, style, lado, ancho, alto }) {
  // `lado` es el atajo para cuadrado; la ficha lo usa como banner con ancho/alto
  // distintos, así que el shader recibe las dos medidas por separado.
  const w = ancho ?? lado;
  const h = alto ?? lado;
  const cover = space?.cover;

  if (cover) {
    return (
      <Image
        source={{ uri: cover }}
        style={[{ borderRadius: radius }, style]}
        contentFit="cover"
        transition={200}
      />
    );
  }

  const p = portadaDe(space?.id || space?.name || 'x');

  // Sin shader disponible: degradado con dos brillos radiales. Menos rico, pero
  // la pantalla no se cae por una portada.
  if (!EFECTO || !w || !h) {
    return (
      <View style={[{ borderRadius: radius, overflow: 'hidden' }, style]}>
        <LinearGradient
          colors={p.colores}
          locations={[0, 0.52, 1]}
          start={p.inicio}
          end={p.fin}
          style={StyleSheet.absoluteFill}
        />
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
          <Defs>
            <RadialGradient id="pBrillo" cx="34%" cy="28%" rx="62%" ry="52%">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.30" />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#pBrillo)" />
        </Svg>
      </View>
    );
  }

  return (
    <View style={[{ borderRadius: radius, overflow: 'hidden' }, style]}>
      <Canvas style={{ width: w, height: h }}>
        <Fill>
          <Shader
            source={EFECTO}
            uniforms={{
              u_size: [w, h],
              u_seed: p.seed,
              c1: p.rgb[0],
              c2: p.rgb[1],
              c3: p.rgb[2],
            }}
          />
        </Fill>
      </Canvas>
    </View>
  );
}
