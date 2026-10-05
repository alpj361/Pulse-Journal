import { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { ChefHat, CircleCheck, GraduationCap, Hash, ListOrdered, MessageSquareQuote, ScanEye, Tag, Waypoints } from 'lucide-react-native';
import { INK, RADIUS } from '../theme';
import { MONO } from '../codex/mono';
import IconoMaterial from '../codex/IconoMaterial';
import { MATERIAL } from '../codex/materiales';
import { roce } from '../../utils/haptics';

/**
 * Las secciones del análisis de un post que no son menciones: qué se ve, las cifras, lo que enseña, las listas y las recetas.
 *
 * Cada una se dibuja solo si el post la trae. Un reel a cámara sin números no
 * muestra «cifras» vacía: no la muestra. Así la ficha de un baile y la de una
 * explicación de impuestos se ven distintas sin que nadie elija una plantilla.
 */

const TENUE = 'rgba(28,43,34,0.35)';
const RAYA = 'rgba(28,43,34,0.07)';

// Un ícono por sección: es lo que deja reconocerla de un vistazo al bajar por
// la ficha, antes de leer el título.
const ICONO = {
  vista: ScanEye,
  cifras: Hash,
  aprender: GraduationCap,
  lista: ListOrdered,
  receta: ChefHat,
  hechos: CircleCheck,
  afirmaciones: MessageSquareQuote,
  relaciones: Waypoints,
  temas: Tag,
};

export function Bloque({ titulo, icono, children }) {
  const Icono = icono ? ICONO[icono] : null;
  return (
    <View style={{ marginTop: 28 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10 }}>
        {Icono ? <Icono size={13} color="rgba(28,43,34,0.42)" strokeWidth={1.8} /> : null}
        <Text style={{ fontFamily: MONO, fontSize: 11.5, color: 'rgba(28,43,34,0.3)' }}>{titulo}</Text>
      </View>
      {children}
    </View>
  );
}

const RELACION = { escena: 'es una escena', audio: 'suena de fondo' };

/** La transcripción visual: qué se ve, qué dice la pantalla y la obra, si es una. */
export function LoQueSeVe({ vistazo }) {
  if (!vistazo) return null;
  const obra = vistazo.obra_identificada;
  const enPantalla = typeof vistazo.texto_en_pantalla === 'string' ? vistazo.texto_en_pantalla.trim() : '';
  if (!vistazo.que_se_ve && !obra && !enPantalla) return null;
  return (
    <Bloque titulo="transcripción visual" icono="vista">
      {vistazo.que_se_ve ? (
        <Text style={{ fontFamily: MONO, fontSize: 13, color: INK.title, lineHeight: 21 }}>{vistazo.que_se_ve}</Text>
      ) : null}

      {obra?.titulo ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14 }}>
          {obra.imagen ? (
            <Image
              source={{ uri: obra.imagen }}
              style={{ width: 38, height: 56, borderRadius: 6, backgroundColor: 'rgba(28,43,34,0.06)' }}
            />
          ) : (
            <IconoMaterial material={obra.clase === 'serie' ? 'series' : 'film'} size={16} />
          )}
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: MONO, fontSize: 13, color: MATERIAL[obra.clase === 'serie' ? 'series' : 'film'].color }}>
              {obra.titulo}
              {obra.anio ? <Text style={{ color: TENUE }}> · {obra.anio}</Text> : null}
            </Text>
            <Text style={{ fontFamily: MONO, fontSize: 11.5, color: TENUE, marginTop: 3 }}>
              {RELACION[obra.relacion] || RELACION.escena}
            </Text>
          </View>
        </View>
      ) : null}

      {enPantalla ? (
        <View style={{ marginTop: 14, paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: RAYA }}>
          <Text style={{ fontFamily: MONO, fontSize: 11, color: TENUE, marginBottom: 4 }}>escrito en pantalla</Text>
          <Text style={{ fontFamily: MONO, fontSize: 12.5, color: INK.body, lineHeight: 20 }}>{enPantalla}</Text>
        </View>
      ) : null}
    </Bloque>
  );
}

const COLOR_CIFRA = '#0F766E';

/** 0 a 1 si la cifra es un porcentaje entre 0 y 100; si no, null. */
function fraccion(c) {
  if (!/%/.test(c.valor || '')) return null;
  const n = typeof c.numero === 'number' ? c.numero : parseFloat(String(c.valor).replace(',', '.'));
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n / 100 : null;
}

/**
 * Las cifras, en fichas: **cifra · variable → hacia**.
 *
 * Cada cifra es una ficha con el número grande arriba, lo que se cuenta debajo
 * y a qué o a quién corresponde al pie. Van de a dos por fila, como un tablero:
 * se comparan de un vistazo, que es para lo que sirve un número. Un porcentaje
 * lleva además su barra. La ficha que no entra en media fila —«110,000
 * millones»— ocupa la fila entera.
 *
 * Un análisis anterior trae la cifra con una frase (`que_representa`): se
 * muestra igual, con la frase en el lugar de la variable.
 */
export function Cifras({ cantidades }) {
  if (!cantidades?.length) return null;
  return (
    <Bloque titulo="cifras" icono="cifras">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {cantidades.map((c, i) => {
          const variable = c.variable || c.que_representa || '';
          const hacia = c.hacia || (c.variable ? null : c.de) || null;
          const f = fraccion(c);
          const ancha = String(c.valor).length > 7 || variable.length > 26 || (hacia || '').length > 26;
          return (
            <View
              key={`${i}-${c.valor}`}
              style={{
                flexBasis: ancha ? '100%' : '47%',
                flexGrow: 1,
                paddingHorizontal: 14,
                paddingTop: 12,
                paddingBottom: 13,
                borderRadius: RADIUS.md,
                borderWidth: 1,
                borderColor: 'rgba(28,43,34,0.09)',
                backgroundColor: 'rgba(255,255,255,0.55)',
              }}
            >
              <Text style={{ fontSize: 26, fontWeight: '700', letterSpacing: -0.6, color: INK.title }}>{c.valor}</Text>
              {f !== null ? (
                <View style={{ height: 3, borderRadius: 2, backgroundColor: 'rgba(15,118,110,0.14)', marginTop: 7 }}>
                  <View style={{ height: 3, borderRadius: 2, width: `${Math.max(2, f * 100)}%`, backgroundColor: COLOR_CIFRA }} />
                </View>
              ) : null}
              <Text style={{ fontFamily: MONO, fontSize: 12.5, color: INK.body, lineHeight: 18, marginTop: 8 }}>{variable}</Text>
              {hacia ? (
                <Text style={{ fontFamily: MONO, fontSize: 12.5, color: COLOR_CIFRA, lineHeight: 18, marginTop: 2 }}>
                  <Text style={{ color: TENUE }}>→ </Text>
                  {hacia}
                </Text>
              ) : null}
              {c.periodo ? (
                <Text style={{ fontFamily: MONO, fontSize: 11, color: TENUE, lineHeight: 16, marginTop: 5 }}>{c.periodo}</Text>
              ) : null}
            </View>
          );
        })}
      </View>
    </Bloque>
  );
}

/**
 * Para entender más: una lección corta sobre lo que el post explica.
 *
 * No es un glosario. Va lo que el post enseña, punto por punto; después el
 * contexto que el post da por sabido —de dónde viene el tema, por qué importa—,
 * marcado aparte porque eso no lo dijo el post; y al final los términos, plegados.
 * Un análisis anterior solo trae idea y términos, y se muestra con eso.
 */
export function Aprender({ aprender }) {
  const [abierto, setAbierto] = useState(null);
  if (!aprender) return null;
  const conceptos = aprender.conceptos || [];
  const pasos = aprender.pasos || [];
  const puntos = aprender.puntos || [];
  return (
    <Bloque titulo="para entender más" icono="aprender">
      {aprender.idea ? (
        <Text style={{ fontFamily: MONO, fontSize: 14, color: INK.title, lineHeight: 22 }}>{aprender.idea}</Text>
      ) : null}

      {puntos.length ? (
        <View style={{ marginTop: 12 }}>
          {puntos.map((t, i) => (
            <View key={`${i}-${t}`} style={{ flexDirection: 'row', gap: 10, paddingVertical: 6 }}>
              <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(28,43,34,0.3)', marginTop: 8 }} />
              <Text style={{ flex: 1, fontFamily: MONO, fontSize: 13, color: INK.title, lineHeight: 21 }}>{t}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {pasos.length ? <Numerada items={pasos} arriba={12} /> : null}

      {aprender.contexto ? (
        <View
          style={{
            marginTop: 16,
            paddingVertical: 12,
            paddingHorizontal: 14,
            borderRadius: RADIUS.md,
            backgroundColor: 'rgba(75,79,166,0.06)',
          }}
        >
          <Text style={{ fontFamily: MONO, fontSize: 11, color: 'rgba(75,79,166,0.75)', marginBottom: 6 }}>contexto</Text>
          <Text style={{ fontFamily: MONO, fontSize: 12.5, color: INK.body, lineHeight: 20 }}>{aprender.contexto}</Text>
        </View>
      ) : null}

      {conceptos.length ? (
        <View style={{ marginTop: 14 }}>
          {conceptos.map((c, i) => {
            const esta = abierto === i;
            return (
              <Pressable
                key={c.termino}
                onPress={() => {
                  roce();
                  setAbierto(esta ? null : i);
                }}
                style={{
                  paddingVertical: 10,
                  borderBottomWidth: i === conceptos.length - 1 ? 0 : 1,
                  borderBottomColor: RAYA,
                }}
                accessibilityRole="button"
                accessibilityLabel={c.termino}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ flex: 1, fontFamily: MONO, fontSize: 13, color: INK.title }}>{c.termino}</Text>
                  <Text style={{ fontFamily: MONO, fontSize: 13, color: TENUE }}>{esta ? '—' : '+'}</Text>
                </View>
                {esta ? (
                  <Text style={{ fontFamily: MONO, fontSize: 12.5, color: INK.body, lineHeight: 20, marginTop: 7 }}>
                    {c.explicacion}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {aprender.preguntas?.length ? (
        <View style={{ marginTop: 14 }}>
          <Text style={{ fontFamily: MONO, fontSize: 11, color: TENUE, marginBottom: 4 }}>para seguir</Text>
          {aprender.preguntas.map((t, i) => (
            <Text key={`${i}-${t}`} style={{ fontFamily: MONO, fontSize: 12.5, color: INK.body, lineHeight: 20, paddingVertical: 3 }}>
              {t}
            </Text>
          ))}
        </View>
      ) : null}
    </Bloque>
  );
}

function Numerada({ items, arriba = 0 }) {
  return (
    <View style={{ marginTop: arriba }}>
      {items.map((t, i) => (
        <View key={`${i}-${t}`} style={{ flexDirection: 'row', gap: 10, paddingVertical: 5 }}>
          <Text style={{ fontFamily: MONO, fontSize: 12, color: TENUE, width: 18, textAlign: 'right', lineHeight: 20 }}>
            {i + 1}
          </Text>
          <Text style={{ flex: 1, fontFamily: MONO, fontSize: 12.5, color: INK.body, lineHeight: 20 }}>{t}</Text>
        </View>
      ))}
    </View>
  );
}

/**
 * Lo que el post enumera. Un ítem que además es una mención —un lugar, una
 * herramienta— se pinta con su color y se puede tocar, igual que en el texto.
 */
export function Listas({ listas, menciones = [], colorDe, onElegir }) {
  if (!listas?.length) return null;
  return (
    <>
      {listas.map((l, n) => (
        <Bloque key={`${n}-${l.titulo}`} titulo={l.titulo ? l.titulo.toLowerCase() : 'lista'} icono="lista">
          {l.items.map((it, i) => {
            const m = it.mencion ? menciones.find((x) => x.texto === it.mencion) : null;
            return (
              <Pressable
                key={`${i}-${it.texto}`}
                disabled={!m}
                onPress={() => m && onElegir?.(m)}
                style={{
                  flexDirection: 'row',
                  gap: 10,
                  paddingVertical: 9,
                  borderBottomWidth: i === l.items.length - 1 ? 0 : 1,
                  borderBottomColor: RAYA,
                }}
              >
                <Text style={{ fontFamily: MONO, fontSize: 12, color: TENUE, width: 18, textAlign: 'right', lineHeight: 20 }}>
                  {i + 1}
                </Text>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {m?.material ? <IconoMaterial material={m.material} size={12} /> : null}
                    <Text style={{ flex: 1, fontFamily: MONO, fontSize: 13, color: m && colorDe ? colorDe(m) : INK.title, lineHeight: 20 }}>
                      {it.texto}
                    </Text>
                  </View>
                  {it.detalle ? (
                    <Text style={{ fontFamily: MONO, fontSize: 12, color: TENUE, lineHeight: 18, marginTop: 3 }}>
                      {it.detalle}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </Bloque>
      ))}
    </>
  );
}

export function Recetas({ recetas }) {
  if (!recetas?.length) return null;
  return (
    <>
      {recetas.map((r) => (
        <Bloque key={r.titulo} titulo="receta" icono="receta">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10 }}>
            <IconoMaterial material="food" size={13} />
            <Text style={{ fontFamily: MONO, fontSize: 14, color: MATERIAL.food.color }}>{r.titulo}</Text>
          </View>
          {r.ingredientes?.length ? (
            <View
              style={{
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: RADIUS.md || 12,
                backgroundColor: 'rgba(234,88,12,0.06)',
              }}
            >
              {r.ingredientes.map((ing, i) => (
                <Text key={`${i}-${ing}`} style={{ fontFamily: MONO, fontSize: 12.5, color: INK.body, lineHeight: 21 }}>
                  · {ing}
                </Text>
              ))}
            </View>
          ) : null}
          {r.pasos?.length ? <Numerada items={r.pasos} arriba={12} /> : null}
        </Bloque>
      ))}
    </>
  );
}

// Desde acá una afirmación se puede comprobar; por debajo es algo que alguien
// sostiene, y se muestra aparte para no darle el peso de un hecho.
export const PISO_HECHO = 0.6;

/** Separa los hechos de las afirmaciones. Sin número (análisis viejo), todo es hecho. */
export function partirHechos(hechos = []) {
  const comprobables = [];
  const afirmaciones = [];
  for (const h of hechos) {
    (typeof h.verificable === 'number' && h.verificable < PISO_HECHO ? afirmaciones : comprobables).push(h);
  }
  return { comprobables, afirmaciones };
}
