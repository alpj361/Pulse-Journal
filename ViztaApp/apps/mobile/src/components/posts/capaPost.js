import { supabase } from '../../utils/supabase';
import { claveDe } from '../codex/menciones';
import { invalidarIndice } from '../codex/useIndiceCodex';

/**
 * La capa de un post y lo que se puede sacar de ella.
 *
 * El análisis de un post deja tres cosas —menciones, hechos y relaciones— y
 * **ninguna sale sola al Codex.** Viven en `details.analysis` del post, como
 * capa aparte, hasta que el usuario decide:
 *
 *  · **guardar un hecho** lo vuelve un `Fact`, sub-item del post
 *    (`parent_id`), que se borra si se borra el post.
 *  · **el + de una relación** la vuelve una conexión de verdad
 *    (`codex_relations`), y si alguna de sus dos puntas todavía no está en el
 *    Codex, la crea en el mismo paso.
 *  · **guardar un material** —una película, un libro, un lugar— lo vuelve un
 *    `Ref` con su `material`, o, si la persona lo pide, un elemento del tipo
 *    que propuso el modelo (Antigua como Territorio), con el material igual.
 *
 * Todo lo que se hace acá queda anotado de vuelta en el análisis del post
 * —`fact_id` en el hecho, `relation_id` en la relación, `codex` en la mención—,
 * así la pantalla sabe qué ya se guardó sin consultar nada más.
 */

const FUERA = '("Snippet","Post","Fact")';

/**
 * Las menciones de un análisis, sea de la forma nueva o de la vieja.
 *
 * Un análisis viejo solo trae dos listas de texto. Se traducen a menciones sin
 * vínculo para que la pantalla tenga una sola forma que pintar.
 */
export function mencionesDe(analisis) {
  if (!analisis) return [];
  if (Array.isArray(analisis.menciones)) return analisis.menciones;
  const de = (lista, tipo) =>
    (lista || []).filter(Boolean).map((texto) => ({ texto: String(texto), tipo, codex: null, candidatos: [] }));
  return [...de(analisis.actores, 'Actor'), ...de(analisis.entidades, 'Entidad')];
}

async function idDeUsuario() {
  const { data } = await supabase.auth.getSession();
  const id = data?.session?.user?.id;
  if (!id) throw new Error('Sin sesión activa');
  return id;
}

/**
 * Marcar elementos del análisis —un hecho, una relación, una mención— sin
 * reescribir el resto.
 *
 * Antes se leía `details` entero, se cambiaba acá y se escribía de vuelta: si
 * entre la lectura y la escritura el servidor terminaba un análisis o guardaba
 * el detalle de un material, este guardado lo borraba. Ahora cada operación la
 * aplica la base sobre la fila bloqueada (`post_analysis_patch`), así que dos
 * guardados a la vez se suman en vez de pisarse.
 *
 * Un `null` de vuelta es que la fila no se pudo tocar: RLS no deja cambiar un
 * post ajeno, y en ese caso no hay error, solo nada.
 */
async function aplicarAlAnalisis(postId, ops) {
  const { data, error } = await supabase.rpc('post_analysis_patch', { p_post_id: postId, p_ops: ops });
  if (error) throw error;
  if (!data) throw new Error('No tenés permiso para cambiar este post');
  return data;
}

// ─── Hechos ───────────────────────────────────────────────────────────────────

/**
 * Guardar un hecho como Fact.
 *
 * Antes de crear, se busca uno igual colgado del mismo post: si una vez se creó
 * el Fact pero falló la marca en el análisis, volver a tocar guardar no puede
 * dejar dos.
 */
export async function guardarFact({ post, analisis, hecho }) {
  if (hecho?.fact_id) return post.details;

  const user_id = await idDeUsuario();
  const nombre = String(hecho?.texto || '').trim().slice(0, 200);
  if (!nombre) throw new Error('Ese hecho está vacío');

  const { data: previos } = await supabase
    .from('codex_universe_items')
    .select('id')
    .eq('parent_id', post.id)
    .eq('tipo', 'Fact')
    .eq('name', nombre)
    .limit(1);

  let factId = previos?.[0]?.id || null;

  if (!factId) {
    const menciones = mencionesDe(analisis);
    const d = post.details || {};
    const { data, error } = await supabase
      .from('codex_universe_items')
      .insert({
        user_id,
        tipo: 'Fact',
        name: nombre,
        description: hecho.cita || null,
        parent_id: post.id,
        tags: [],
        aliases: [],
        details: {
          cita: hecho.cita || null,
          cita_en_texto: !!hecho.cita_en_texto,
          cifra: hecho.cifra || null,
          menciones: (hecho.menciones || []).map((texto) => {
            const m = menciones.find((x) => x.texto === texto);
            return { texto, tipo: m?.tipo || null, codex_id: m?.codex?.id || null };
          }),
          fuente: {
            post_id: post.id,
            url: d.source_url || null,
            autor: d.author_name || d.author || null,
          },
        },
      })
      .select('id')
      .single();
    if (error) throw error;
    factId = data.id;
  }

  return aplicarAlAnalisis(post.id, [{ op: 'hecho', texto: hecho.texto, set: { fact_id: factId } }]);
}

// ─── Conexiones ───────────────────────────────────────────────────────────────

/**
 * Que una mención tenga su elemento en el Codex.
 *
 * Primero lo que ya dejó vinculado el análisis. Si no hay, se busca uno con el
 * mismo nombre o alias —el Codex pudo cambiar desde que se analizó el post—, con
 * las mismas reglas del resaltado. Si tampoco, se crea. Y si hay varios con ese
 * nombre no se elige a ciegas: conectar con el «San Pedro» equivocado es peor
 * que no conectar.
 */
async function asegurarElemento(mencion, user_id) {
  if (!mencion) throw new Error('Esa relación apunta a algo que no está en el post');
  if (mencion.codex?.id) return { codex: mencion.codex, creado: false };
  if ((mencion.candidatos || []).length > 1) {
    throw new Error(`Hay varios «${mencion.texto}» en tu Codex`);
  }

  const clave = claveDe(mencion.texto);
  const palabra = String(mencion.texto)
    .split(/\s+/)
    .sort((x, y) => y.length - x.length)[0]
    ?.replace(/[%_,()*]/g, '');

  if (clave && palabra && palabra.length >= 2) {
    const { data: posibles } = await supabase
      .from('codex_universe_items')
      .select('id, name, tipo, aliases')
      .not('tipo', 'in', FUERA)
      .ilike('name', `%${palabra}%`)
      .limit(60);

    const iguales = (posibles || []).filter(
      (p) => claveDe(p.name) === clave || (p.aliases || []).some((al) => claveDe(al) === clave)
    );
    const mismoTipo = iguales.filter((p) => p.tipo === mencion.tipo);
    const elegido = iguales.length === 1 ? iguales[0] : mismoTipo.length === 1 ? mismoTipo[0] : null;
    if (elegido) return { codex: { id: elegido.id, name: elegido.name, tipo: elegido.tipo }, creado: false };
    if (iguales.length > 1) throw new Error(`Hay varios «${mencion.texto}» en tu Codex`);
  }

  const { data, error } = await supabase
    .from('codex_universe_items')
    .insert({
      user_id,
      tipo: mencion.tipo,
      name: mencion.texto,
      description: mencion.pista || null,
      material: mencion.material || null,
      thumbnail_url: mencion.identidad?.imagen || null,
      tags: [],
      aliases: aliasesDe(mencion),
      // Lo que dijo la base al identificarlo (TMDB, Open Library…) viaja con el
      // elemento: su ficha puede mostrar el póster y el año sin volver a buscar.
      details: { flag: 'neut', ...(mencion.identidad ? { identidad: mencion.identidad } : {}) },
    })
    .select('id, name, tipo')
    .single();
  if (error) throw error;
  return { codex: data, creado: true };
}

/**
 * Los otros nombres con que la base conoce un material: «Joker» se estrenó en
 * México como «Guasón», y un post que diga «Guasón» tiene que reconocer al
 * mismo elemento.
 */
function aliasesDe(mencion) {
  const i = mencion.identidad;
  if (!i) return [];
  const nombre = claveDe(mencion.texto);
  return [...new Set([i.titulo, i.titulo_original].filter(Boolean))].filter((a) => claveDe(a) !== nombre);
}

/**
 * Guardar un material del post en el Codex.
 *
 * Por defecto como `Ref`: existe en tu universo de información pero no en tu
 * modelo analítico. Con `comoTipo`, como elemento de ese tipo —Antigua como
 * Territorio—, y el material se queda igual: un lugar puede ser las dos cosas.
 */
export async function guardarMaterial({ post, mencion, comoTipo = null }) {
  if (mencion?.codex?.id) return { details: post.details, codex: mencion.codex, creado: false };

  const user_id = await idDeUsuario();
  const { codex, creado } = await asegurarElemento({ ...mencion, tipo: comoTipo || 'Ref' }, user_id);
  if (creado) invalidarIndice();

  const details = await aplicarAlAnalisis(post.id, [
    { op: 'mencion', texto: mencion.texto, set: { codex, candidatos: [], ...(comoTipo ? { tipo: comoTipo } : {}) } },
  ]);
  return { details, codex, creado };
}

/** El + de una relación: la conexión, y los elementos que falten. */
export async function agregarConexion({ post, analisis, relacion }) {
  if (relacion?.relation_id) return { details: post.details, creados: [] };

  const user_id = await idDeUsuario();
  const menciones = mencionesDe(analisis);
  const buscar = (texto) => menciones.find((m) => m.texto === texto);

  const a = await asegurarElemento(buscar(relacion.a), user_id);
  const b = await asegurarElemento(buscar(relacion.b), user_id);

  const { data: existentes } = await supabase
    .from('codex_relations')
    .select('id')
    .eq('subject_id', a.codex.id)
    .eq('object_id', b.codex.id)
    .eq('verb', relacion.verbo)
    .limit(1);

  let relationId = existentes?.[0]?.id || null;

  if (!relationId) {
    const d = post.details || {};
    const autor = d.author_name || d.author;
    const nota = [autor ? `Del post de ${autor}` : 'De un post', d.source_url].filter(Boolean).join(' · ');
    const { data, error } = await supabase
      .from('codex_relations')
      .insert({ user_id, subject_id: a.codex.id, verb: relacion.verbo, object_id: b.codex.id, note: nota })
      .select('id')
      .single();
    if (error) throw error;
    relationId = data.id;
  }

  const creados = [a, b].filter((x) => x.creado).map((x) => x.codex);
  // Lo creado tiene que empezar a pintarse en las notas sin esperar los cinco
  // minutos de vigencia del índice.
  if (creados.length) invalidarIndice();

  // Las puntas se vinculan solo si todavía no lo estaban: otra acción pudo
  // vincularlas mientras tanto, y esa gana.
  const details = await aplicarAlAnalisis(post.id, [
    { op: 'mencion', texto: relacion.a, set: { codex: a.codex, candidatos: [] }, solo_sin_codex: true },
    { op: 'mencion', texto: relacion.b, set: { codex: b.codex, candidatos: [] }, solo_sin_codex: true },
    { op: 'relacion', a: relacion.a, verbo: relacion.verbo, b: relacion.b, set: { relation_id: relationId } },
  ]);

  return { details, creados };
}
