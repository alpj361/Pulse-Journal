import { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { INK, RADIUS } from '../theme';
import { MONO } from '../codex/mono';
import IconoMaterial from '../codex/IconoMaterial';
import { MATERIAL } from '../codex/materiales';
import { roce } from '../../utils/haptics';

/**
 * Las secciones del análisis de un post que no son menciones: de qué tipo es,
 * qué se ve, las cifras, lo que enseña, las listas y las recetas.
 *
 * Cada una se dibuja solo si el post la trae. Un reel a cámara sin números no
 * muestra «cifras» vacía: no la muestra. Así la ficha de un baile y la de una
 * explicación de impuestos se ven distintas sin que nadie elija una plantilla.
 */

const TENUE = 'rgba(28,43,34,0.35)';
const RAYA = 'rgba(28,43,34,0.07)';

export function Bloque({ titulo, children }) {
  return (
    <View style={{ marginTop: 28 }}>
      <Text style={{ fontFamily: MONO, fontSize: 11.5, color: 'rgba(28,43,34,0.3)', marginBottom: 10 }}>
        {titulo}
      </Text>
      {children}
    </View>
  );
}

const TIPO = {
  opinion: 'opinión',
  informacion: 'información',
  aprendizaje: 'enseña',
  hechos: 'hechos',
  comedia: 'comedia',
  narrativa: 'historia',
  baile_tendencia: 'tendencia',
  lista: 'lista',
};

// Por debajo de esto el tipo no se nombra: un 0,12 de «comedia» no dice nada.
const PISO_TIPO = 0.3;

/**
 * Cuánto tiene el post de cada tipo, en una línea.
 *
 * Está desde que el post llega, antes de tocar el ojo: es lo primero que se
 * sabe de él. El número es de 0 a 100 y un post puede tener varios altos.
 */
export function TiposPost({ clasificacion }) {
  const p = clasificacion?.probabilidades;
  if (!p) return null;
  const tipos = Object.entries(p)
    .filter(([k, v]) => TIPO[k] && v >= PISO_TIPO)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
  if (!tipos.length) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 6, marginTop: 10 }}>
      {tipos.map(([k, v]) => (
        <View key={k} style={{ flexDirection: 'row', alignItems: 'baseline', gap: 5 }}>
          <Text style={{ fontFamily: MONO, fontSize: 12, color: v >= 0.6 ? INK.title : INK.meta }}>{TIPO[k]}</Text>
          <Text style={{ fontFamily: MONO, fontSize: 10.5, color: TENUE }}>{Math.round(v * 100)}</Text>
        </View>
      ))}
    </View>
  );
}

const RELACION = { escena: 'es una escena', audio: 'suena de fondo' };

/** Lo que salió de mirar: qué se ve, qué dice la pantalla y la obra, si es una. */
export function LoQueSeVe({ vistazo }) {
  if (!vistazo) return null;
  const obra = vistazo.obra_identificada;
  const enPantalla = typeof vistazo.texto_en_pantalla === 'string' ? vistazo.texto_en_pantalla.trim() : '';
  if (!vistazo.que_se_ve && !obra && !enPantalla) return null;
  return (
    <Bloque titulo="lo que se ve">
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

/** Las cifras: el número grande y, al lado, qué mide. */
export function Cifras({ cantidades }) {
  if (!cantidades?.length) return null;
  return (
    <Bloque titulo="cifras">
      {cantidades.map((c, i) => (
        <View
          key={`${i}-${c.valor}`}
          style={{
            flexDirection: 'row',
            gap: 14,
            paddingVertical: 11,
            borderBottomWidth: i === cantidades.length - 1 ? 0 : 1,
            borderBottomColor: RAYA,
          }}
        >
          <Text style={{ fontFamily: MONO, fontSize: 14, color: INK.title, width: '36%', lineHeight: 20 }}>{c.valor}</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: MONO, fontSize: 12.5, color: INK.body, lineHeight: 19 }}>{c.que_representa}</Text>
            {c.de || c.periodo ? (
              <Text style={{ fontFamily: MONO, fontSize: 11.5, color: TENUE, lineHeight: 17, marginTop: 3 }}>
                {[c.de, c.periodo].filter(Boolean).join(' · ')}
              </Text>
            ) : null}
          </View>
        </View>
      ))}
    </Bloque>
  );
}

/**
 * Para entender más: la idea, los términos y los pasos.
 *
 * Los conceptos van plegados: se lee el término y se toca para abrir la
 * explicación. Con seis explicaciones abiertas la sección tapaba todo lo demás.
 */
export function Aprender({ aprender }) {
  const [abierto, setAbierto] = useState(null);
  if (!aprender) return null;
  const conceptos = aprender.conceptos || [];
  const pasos = aprender.pasos || [];
  return (
    <Bloque titulo="para entender más">
      {aprender.idea ? (
        <Text style={{ fontFamily: MONO, fontSize: 13, color: INK.title, lineHeight: 21 }}>{aprender.idea}</Text>
      ) : null}

      {conceptos.length ? (
        <View style={{ marginTop: 12 }}>
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

      {pasos.length ? <Numerada items={pasos} arriba={14} /> : null}
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
        <Bloque key={`${n}-${l.titulo}`} titulo={l.titulo ? l.titulo.toLowerCase() : 'lista'}>
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
        <Bloque key={r.titulo} titulo="receta">
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
