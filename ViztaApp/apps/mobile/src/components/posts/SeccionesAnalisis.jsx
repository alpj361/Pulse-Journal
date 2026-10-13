import { useEffect } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { BookMarked, Bookmark, BookmarkCheck, ChefHat, Compass, CircleCheck, GraduationCap, Hash, ListOrdered, MessageSquareQuote, ScanEye, Tag, UsersRound } from 'lucide-react-native';
import { INK, RADIUS } from '../theme';
import { MONO } from '../codex/mono';
import IconoMaterial from '../codex/IconoMaterial';
import { MATERIAL } from '../codex/materiales';
import MorphingInfinity from '../MorphingInfinity';
import Pista from '../Pista';
import { usePistasStore, PISTA } from '../../state/pistasStore';
import { ChipRef, Pieza, Refs } from './Saltos';

/**
 * Las secciones del análisis de un post.
 *
 * Cada dato tiene una sola sección dueña (`piezas.js`): ahí se lee entero. En
 * las demás va una referencia que lleva hasta él, sin repetir el texto.
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
  quien: UsersRound,
  postura: Compass,
  apoyo: BookMarked,
  cifras: Hash,
  aprender: GraduationCap,
  lista: ListOrdered,
  receta: ChefHat,
  hechos: CircleCheck,
  afirmaciones: MessageSquareQuote,
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

const EJE = {
  politico: { nombre: 'político', color: '#4B4FA6' },
  economico: { nombre: 'económico', color: '#0F766E' },
  social: { nombre: 'social', color: '#BE123C' },
  cultural: { nombre: 'cultural', color: '#A16207' },
  especifico: { nombre: null, color: '#475569' },
};

const SENTIDO = { a_favor: 'a favor de', en_contra: 'contra', informa: 'sobre', mixto: 'a favor y en contra de' };

// Dónde cae cada sentido entre «contra» (0) y «a favor» (1). Quien solo informa
// no toma lado y no lleva termómetro.
const LADO = { en_contra: -1, a_favor: 1, mixto: 0 };

/**
 * De qué lado está, y cuánto.
 *
 * Una línea de «contra» a «a favor» con una marca. El lado sale del sentido de
 * la postura; qué tan lejos del centro, de la intensidad si el análisis la
 * midió. Un análisis que no la trae pone la marca a media distancia: dice el
 * lado sin inventar un grado.
 */
function Termometro({ eje, color }) {
  const lado = LADO[eje.sentido];
  if (lado === undefined) return null;
  const fuerza = typeof eje.intensidad === 'number' ? Math.min(1, Math.max(0.15, eje.intensidad)) : 0.6;
  const pos = 50 + lado * fuerza * 50;
  return (
    <View style={{ marginTop: 12 }} accessible accessibilityLabel={eje.sentido === 'mixto' ? 'A favor y en contra' : lado < 0 ? 'En contra' : 'A favor'}>
      <View style={{ height: 14, justifyContent: 'center' }}>
        <View style={{ height: 3, borderRadius: 2, backgroundColor: 'rgba(28,43,34,0.08)' }} />
        {/* El tramo del centro a la marca: se lee como «hasta acá llega». */}
        {lado !== 0 ? (
          <View
            style={{
              position: 'absolute',
              height: 3,
              borderRadius: 2,
              backgroundColor: color,
              opacity: 0.45,
              left: `${Math.min(50, pos)}%`,
              width: `${Math.abs(pos - 50)}%`,
            }}
          />
        ) : null}
        <View style={{ position: 'absolute', left: '50%', marginLeft: -0.5, width: 1, height: 9, backgroundColor: 'rgba(28,43,34,0.22)' }} />
        <View
          style={{
            position: 'absolute',
            left: `${pos}%`,
            marginLeft: -6,
            width: 12,
            height: 12,
            borderRadius: 6,
            backgroundColor: color,
            borderWidth: 2,
            borderColor: '#FFFDF8',
          }}
        />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 3 }}>
        <Text style={{ fontFamily: MONO, fontSize: 10.5, color: lado < 0 ? color : TENUE }}>contra</Text>
        <Text style={{ fontFamily: MONO, fontSize: 10.5, color: lado > 0 ? color : TENUE }}>a favor</Text>
      </View>
    </View>
  );
}

/**
 * Desde dónde habla el post: un renglón por terreno en el que toma posición.
 *
 * Arriba el terreno y el asunto; después lo que sostiene, que es lo que
 * importa; y al pie hacia quién va y en qué sentido. Un post que no toma
 * posición —un baile, una receta— no tiene esta sección.
 */
export function Postura({ ejes, hablantes, quienDe, quienDeVoz, resolver }) {
  if (!ejes?.length) return null;
  return (
    <Bloque titulo="desde dónde habla" icono="postura">
      {ejes.map((e, i) => {
        const x = EJE[e.eje] || EJE.especifico;
        const voz = e.hablante ? (hablantes || []).find((v) => v.id === e.hablante) : null;
        const quien = e.hacia ? quienDe?.(e.hacia) : null;
        return (
          <View
            key={`${i}-${e.eje}-${e.tema}`}
            style={{
              paddingVertical: 12,
              borderBottomWidth: i === ejes.length - 1 ? 0 : 1,
              borderBottomColor: RAYA,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: x.color }} />
              <Text style={{ fontFamily: MONO, fontSize: 12, color: x.color }}>
                {[x.nombre, e.tema].filter(Boolean).join(' · ')}
              </Text>
            </View>
            <Text style={{ fontFamily: MONO, fontSize: 13, color: INK.title, lineHeight: 21 }}>{e.postura}</Text>
            <Termometro eje={e} color={x.color} />
            {e.hacia && e.sentido ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 7 }}>
                {/* Si es alguien que aparece en el post, va la referencia a su
                    fila y no su nombre escrito otra vez. */}
                <Text style={{ fontFamily: MONO, fontSize: 11.5, color: TENUE, lineHeight: 17 }}>
                  {/* Con termómetro el lado ya se ve; acá va solo hacia quién. */}
                  {LADO[e.sentido] === undefined ? SENTIDO[e.sentido] : 'hacia'}
                  {quien ? '' : ` ${e.hacia}`}
                </Text>
                {quien ? <ChipRef para={quien.id} /> : null}
              </View>
            ) : null}
            {voz && !voz.es_autor ? <LoDice voz={voz} quienDeVoz={quienDeVoz} antes="lo dice" /> : null}
            {/* En qué hechos y cifras se sostiene: se leen en su sección. */}
            <Refs ids={resolver?.(e.apoyos)} arriba={9} />
          </View>
        );
      })}
    </Bloque>
  );
}

const TIPO_FUENTE = {
  medio: 'medio',
  institucion: 'institución',
  persona: 'persona',
  documento: 'documento',
  estudio: 'estudio',
  dato_oficial: 'dato oficial',
  otro: null,
};

/**
 * En qué se apoya: a quién invoca el post para sostener lo que dice.
 *
 * Cada fuente señala lo que sostiene. Su cita se lee acá solo si no es la de
 * un hecho o una cifra: esa ya está en su pieza, a un toque.
 *
 * Si afirma cosas comprobables y no invoca a nadie, se dice: no citar también
 * es un dato, y es de los que más pesan al leer a una cuenta en el tiempo.
 */
export function Apoyo({ fuentes, afirma = false }) {
  if (!fuentes?.length && !afirma) return null;
  return (
    <Bloque titulo="en qué se apoya" icono="apoyo">
      {fuentes?.length ? (
        fuentes.map((f, i) => (
          <Pieza
            key={f.id || f.nombre}
            id={f.id}
            style={{ paddingVertical: 10, borderBottomWidth: i === fuentes.length - 1 ? 0 : 1, borderBottomColor: RAYA }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
              <Text style={{ flex: 1, fontFamily: MONO, fontSize: 13, color: INK.title }}>{f.nombre}</Text>
              {TIPO_FUENTE[f.tipo] ? (
                <Text style={{ fontFamily: MONO, fontSize: 11, color: TENUE }}>{TIPO_FUENTE[f.tipo]}</Text>
              ) : null}
            </View>
            {f.citaPropia ? (
              <Text style={{ fontFamily: MONO, fontSize: 12, color: TENUE, lineHeight: 18, marginTop: 5 }}>«{f.cita}»</Text>
            ) : null}
            <Refs ids={f.piezas} />
          </Pieza>
        ))
      ) : (
        <Text style={{ fontFamily: MONO, fontSize: 12.5, color: INK.body, lineHeight: 20 }}>
          Afirma hechos sin citar de dónde salen.
        </Text>
      )}
    </Bloque>
  );
}

const ROL = {
  anfitrion: 'conduce',
  invitado: 'invitado',
  narrador: 'narra',
  voz_en_off: 'voz en off',
  personaje: 'fragmento',
  otro: 'otra voz',
};

/**
 * Quién lo dijo, al pie de un hecho o una cifra.
 *
 * Si esa voz tiene fila en «quién aparece», va la referencia y no el nombre
 * escrito otra vez.
 */
export function LoDice({ voz, quienDeVoz, antes = '—' }) {
  if (!voz) return null;
  const quien = quienDeVoz?.(voz.id);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 7 }}>
      <Text style={{ fontFamily: MONO, fontSize: 11.5, color: voz.es_autor ? 'rgba(75,79,166,0.85)' : TENUE }}>
        {antes}
        {quien ? '' : ` ${nombreDeVoz(voz)}`}
        {!quien && voz.es_autor ? ' · la cuenta' : ''}
      </Text>
      {quien ? <ChipRef para={quien.id} /> : null}
    </View>
  );
}

/** Cómo se nombra una voz: su nombre si se dijo, si no su papel. */
export function nombreDeVoz(v) {
  if (!v) return null;
  return v.nombre || ROL[v.rol] || 'otra voz';
}

/**
 * Quién aparece: las personas y organizaciones del post, una fila cada una.
 *
 * Es la sección dueña de todo lo que es de alguien: su nombre, cuánto del post
 * es su voz, con quién se relaciona. Antes eso estaba repartido entre las
 * menciones, «quién habla» y «relaciones», y el mismo nombre se leía tres veces.
 *
 * La cuenta que publicó va marcada: es la que cuenta como su discurso. Las
 * voces de un renglón —el fragmento de un noticiero metido en el reel— se
 * juntan al final para que no tapen a quienes de verdad conversan.
 */
export function QuienAparece({ quienes, colorDe, elegida, onElegir, onSostener, ficha, relacion }) {
  if (!quienes?.length) return null;
  const conVoz = quienes.filter((q) => q.voz);
  const total = conVoz.reduce((n, q) => n + (q.voz.palabras || 0), 0) || 1;
  // Con una sola voz no hay reparto que mostrar.
  const reparto = conVoz.length > 1;
  const parteDe = (q) => (q.voz ? (q.voz.palabras || 0) / total : 0);
  // Una voz sin nombre que casi no habla no merece fila propia.
  const visibles = quienes
    .filter((q) => q.mencion || (reparto && parteDe(q) >= 0.05))
    .sort((a, b) => parteDe(b) - parteDe(a));
  const resto = quienes.length - visibles.length;
  // Vista una vez, la pista de los porcentajes no vuelve.
  const marcar = usePistasStore((x) => x.marcar);
  useEffect(() => (reparto ? () => marcar(PISTA.VOCES) : undefined), [reparto, marcar]);
  if (!visibles.length) return null;

  return (
    <Bloque titulo="quién aparece" icono="quien">
      {reparto ? (
        <Pista clave={PISTA.VOCES} style={{ alignItems: 'flex-end', marginBottom: 2 }}>
          el porcentaje es cuánto del video habla cada quien
        </Pista>
      ) : null}
      {visibles.map((q, i) => {
        const m = q.mencion;
        const color = m && colorDe ? colorDe(m) : INK.title;
        const parte = parteDe(q);
        return (
          <Pieza
            key={q.id}
            id={q.id}
            style={{
              paddingVertical: 11,
              borderBottomWidth: i === visibles.length - 1 && !resto ? 0 : 1,
              borderBottomColor: RAYA,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
              <Pressable
                disabled={!m}
                onPress={() => m && onElegir?.(m)}
                onLongPress={() => m && onSostener?.(m)}
                hitSlop={6}
                style={{ flexShrink: 1 }}
                accessibilityRole={m ? 'button' : undefined}
                accessibilityLabel={m ? m.texto : undefined}
              >
                <Text
                  style={{
                    fontFamily: MONO,
                    fontSize: 13,
                    color,
                    // Subrayado lo que ya está en tu Codex, igual que en el texto.
                    textDecorationLine: m?.codex ? 'underline' : 'none',
                  }}
                >
                  {q.nombre || nombreDeVoz(q.voz)}
                </Text>
              </Pressable>
              {q.voz?.es_autor ? (
                <Text style={{ fontFamily: MONO, fontSize: 11, color: 'rgba(75,79,166,0.85)' }}>la cuenta</Text>
              ) : q.voz && q.nombre && ROL[q.voz.rol] ? (
                <Text style={{ fontFamily: MONO, fontSize: 11, color: TENUE }}>{ROL[q.voz.rol]}</Text>
              ) : null}
              <View style={{ flex: 1 }} />
              {reparto && q.voz ? (
                <Text style={{ fontFamily: MONO, fontSize: 11.5, color: TENUE }}>{Math.round(parte * 100)}%</Text>
              ) : null}
            </View>

            {reparto && q.voz ? (
              <View style={{ height: 3, borderRadius: 2, backgroundColor: 'rgba(28,43,34,0.07)', marginTop: 7 }}>
                <View
                  style={{
                    height: 3,
                    borderRadius: 2,
                    width: `${Math.max(2, parte * 100)}%`,
                    backgroundColor: q.voz.es_autor ? 'rgba(75,79,166,0.7)' : 'rgba(28,43,34,0.3)',
                  }}
                />
              </View>
            ) : null}

            {q.voz?.descripcion ? (
              <Text style={{ fontFamily: MONO, fontSize: 11.5, color: TENUE, lineHeight: 17, marginTop: 6 }}>{q.voz.descripcion}</Text>
            ) : null}

            {q.relaciones.length ? (
              <View style={{ marginTop: 4 }}>{q.relaciones.map((r, n) => relacion?.(r, n))}</View>
            ) : null}

            <Refs ids={q.piezas} />

            {m && elegida === m.texto ? ficha : null}
          </Pieza>
        );
      })}
      {resto ? (
        <Text style={{ fontFamily: MONO, fontSize: 11.5, color: TENUE, marginTop: 10 }}>
          y {resto} {resto === 1 ? 'voz más, de un fragmento' : 'voces más, de fragmentos'}
        </Text>
      ) : null}
    </Bloque>
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
 * El marcador de un hecho: vacío si se puede guardar, lleno si ya es un Fact
 * de tu Codex (y entonces tocarlo lo abre).
 */
export function GuardarHecho({ hecho, ocupado, onGuardar }) {
  return (
    <Pressable
      onPress={onGuardar}
      disabled={ocupado}
      hitSlop={12}
      style={({ pressed }) => ({ paddingTop: 2, opacity: pressed ? 0.5 : 1 })}
      accessibilityRole="button"
      accessibilityLabel={hecho.fact_id ? 'Abrir el hecho guardado' : 'Guardar el hecho'}
    >
      {ocupado ? (
        <MorphingInfinity size={15} color={INK.title} />
      ) : hecho.fact_id ? (
        <BookmarkCheck size={17} color={INK.title} />
      ) : (
        <Bookmark size={17} color="rgba(28,43,34,0.4)" />
      )}
    </Pressable>
  );
}

/**
 * Las cifras, en fichas: **cifra · variable → hacia**.
 *
 * Cada cifra es una ficha con el número grande arriba, lo que se cuenta debajo
 * y a qué o a quién corresponde al pie. Van de a dos por fila, como un tablero:
 * se comparan de un vistazo, que es para lo que sirve un número. Un porcentaje
 * lleva además su barra.
 *
 * Es la sección dueña de todo número. Si el post lo contó en una frase, la
 * frase vive acá —con su cita y su marcador— y no otra vez en «hechos»; esa
 * ficha ocupa la fila entera, igual que la que no entra en media —«110,000
 * millones»—.
 *
 * Un análisis anterior trae la cifra con una frase (`que_representa`): se
 * muestra igual, con la frase en el lugar de la variable.
 */
export function Cifras({ cifras, hablantes, quienDeVoz, ocupado, onGuardar }) {
  if (!cifras?.length) return null;
  return (
    <Bloque titulo="cifras" icono="cifras">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {cifras.map((c, i) => {
          const variable = c.variable || c.que_representa || '';
          const hacia = c.hacia || (c.variable ? null : c.de) || null;
          const f = fraccion(c);
          const h = c.hecho;
          const voz = h?.hablante ? (hablantes || []).find((v) => v.id === h.hablante) : null;
          const ancha = !!h || String(c.valor).length > 7 || variable.length > 26 || (hacia || '').length > 26;
          return (
            <Pieza
              key={c.id || `${i}-${c.valor}`}
              id={c.id}
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

              {h ? (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    gap: 14,
                    marginTop: 12,
                    paddingTop: 11,
                    borderTopWidth: 1,
                    borderTopColor: RAYA,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: MONO, fontSize: 12.5, color: INK.title, lineHeight: 19 }}>{h.texto}</Text>
                    {h.cita && h.cita_en_texto ? (
                      <Text style={{ fontFamily: MONO, fontSize: 12, color: TENUE, lineHeight: 18, marginTop: 6 }}>«{h.cita}»</Text>
                    ) : null}
                    <LoDice voz={voz} quienDeVoz={quienDeVoz} />
                  </View>
                  {onGuardar ? (
                    <GuardarHecho hecho={h} ocupado={ocupado === `hecho:${h.texto}`} onGuardar={() => onGuardar(h)} />
                  ) : null}
                </View>
              ) : null}

              <Refs ids={c.fuentes} arriba={10} />
            </Pieza>
          );
        })}
      </View>
    </Bloque>
  );
}

/** Lo que explica la app y no dijo el post, marcado para que no se confunda. */
function Explicacion({ children }) {
  return (
    <View style={{ paddingVertical: 11, paddingHorizontal: 14, borderRadius: RADIUS.md, backgroundColor: 'rgba(75,79,166,0.06)' }}>
      <Text style={{ fontFamily: MONO, fontSize: 11, color: 'rgba(75,79,166,0.75)', marginBottom: 5 }}>explicación</Text>
      <Text style={{ fontFamily: MONO, fontSize: 12.5, color: INK.body, lineHeight: 20 }}>{children}</Text>
    </View>
  );
}

/**
 * Para entender más, en tres pasos.
 *
 *  1. **El concepto, explicado simple.** Marcado como explicación: es de la app,
 *     no algo que dijo el post.
 *  2. **En esta nota.** Dónde aparece ese concepto en el post: una referencia a
 *     la cifra o al hecho, que es donde está su cita. Esta sección no es dueña
 *     de nada de lo que el post dijo; solo lo señala.
 *  3. **Para seguir.** Por dónde explorarlo fuera de esta nota.
 *
 * Lo que el post enseña y ya está contado como hecho o como cifra no se vuelve
 * a escribir: va como referencia.
 */
export function Aprender({ aprender, piezas }) {
  const visual = piezas?.visual;
  if (!aprender) return null;
  const conceptos = aprender.conceptos || [];
  const pasos = aprender.pasos || [];
  // Los puntos que no son ya una pieza se leen; los que sí, se señalan.
  const propios = [];
  const yaContado = [];
  for (const [i, t] of (aprender.puntos || []).entries()) {
    // Lo que enlazó el servidor, o lo que se lee igual en el texto.
    const delServidor = piezas?.resolver?.([aprender.puntos_en?.[i]]) || [];
    const ids = delServidor.length ? delServidor : piezas?.dondeAparece(t) || [];
    if (ids.length) yaContado.push(...ids);
    else propios.push(t);
  }
  return (
    <View style={{ marginTop: 14 }}>
      {aprender.idea ? (
        <Text style={{ fontFamily: MONO, fontSize: 14, color: INK.title, lineHeight: 22 }}>{aprender.idea}</Text>
      ) : null}

      {visual ? <Comparacion visual={visual} /> : null}

      {conceptos.map((c, i) => (
        <View key={c.termino} style={{ marginTop: i || aprender.idea ? 16 : 0 }}>
          <Text style={{ fontFamily: MONO, fontSize: 13.5, color: INK.title, marginBottom: 8 }}>{c.termino}</Text>
          <Explicacion>{c.explicacion}</Explicacion>
          <EnEstaNota ids={[...(piezas?.resolver?.(c.en) || []), ...(piezas?.dondeSeNombra(c.termino) || [])]} />
        </View>
      ))}

      {aprender.contexto ? (
        <View style={{ marginTop: 16 }}>
          <Explicacion>{aprender.contexto}</Explicacion>
        </View>
      ) : null}

      {propios.length ? (
        <View style={{ marginTop: 12 }}>
          {propios.map((t, i) => (
            <View key={`${i}-${t}`} style={{ flexDirection: 'row', gap: 10, paddingVertical: 6 }}>
              <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(28,43,34,0.3)', marginTop: 8 }} />
              <Text style={{ flex: 1, fontFamily: MONO, fontSize: 13, color: INK.title, lineHeight: 21 }}>{t}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {pasos.length ? <Numerada items={pasos} arriba={12} /> : null}

      {/* Lo que el post enseña y ya está más arriba, sin volver a escribirlo. */}
      {!conceptos.length ? <EnEstaNota ids={yaContado} /> : null}

      {aprender.preguntas?.length ? (
        <View style={{ marginTop: 16 }}>
          <Text style={{ fontFamily: MONO, fontSize: 11, color: TENUE, marginBottom: 4 }}>para seguir</Text>
          {aprender.preguntas.map((t, i) => (
            <Text key={`${i}-${t}`} style={{ fontFamily: MONO, fontSize: 12.5, color: INK.body, lineHeight: 20, paddingVertical: 3 }}>
              {t}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/**
 * Las cifras del post que se miden en lo mismo, una contra otra.
 *
 * Cada barra es una cifra que el post dijo, a escala de la más grande; tocarla
 * lleva a la cifra. No hay ningún número que no esté en el post.
 */
function Comparacion({ visual }) {
  return (
    <View style={{ marginTop: 16, paddingVertical: 14, paddingHorizontal: 14, borderRadius: RADIUS.md, borderWidth: 1, borderColor: 'rgba(28,43,34,0.09)', backgroundColor: 'rgba(255,255,255,0.55)' }}>
      {visual.titulo ? (
        <Text style={{ fontFamily: MONO, fontSize: 11.5, color: TENUE, marginBottom: 12 }}>{visual.titulo}</Text>
      ) : null}
      {visual.filas.map((f, i) => (
        <View key={f.id} style={{ marginTop: i ? 14 : 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', letterSpacing: -0.3, color: INK.title }}>{f.valor}</Text>
            <Text numberOfLines={1} style={{ flex: 1, fontFamily: MONO, fontSize: 11.5, color: TENUE }}>{f.de}</Text>
          </View>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: 'rgba(15,118,110,0.10)', marginTop: 6 }}>
            <View style={{ height: 8, borderRadius: 4, width: `${Math.max(3, f.parte * 100)}%`, backgroundColor: COLOR_CIFRA, opacity: f.parte === 1 ? 1 : 0.6 }} />
          </View>
        </View>
      ))}
      <Refs ids={visual.filas.map((f) => f.id)} arriba={12} />
    </View>
  );
}

function EnEstaNota({ ids }) {
  if (!ids?.length) return null;
  return (
    <View style={{ marginTop: 10 }}>
      <Text style={{ fontFamily: MONO, fontSize: 11, color: TENUE }}>en esta nota</Text>
      <Refs ids={ids} arriba={6} />
    </View>
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
