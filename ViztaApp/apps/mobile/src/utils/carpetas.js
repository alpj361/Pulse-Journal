import { supabase } from './supabase';

/**
 * Carpetas de notas.
 *
 * Viven en `post_folders`, la misma tabla que usan las carpetas de Posts. No es
 * un préstamo casual: `codex_universe_items.folder_id` ya apunta ahí, y esa
 * tabla guarda tanto Posts como Snippets, así que la membresía ya existía —
 * faltaba solamente una página que la mostrara para las notas.
 *
 * `scope` separa los dos espacios de nombres. Sin él, una carpeta de reels
 * aparecería en el historial diciendo «0 notas» para siempre, y una carpeta de
 * notas ensuciaría la grilla de Posts. Son la misma mecánica sobre la misma
 * tabla, pero no son la misma lista.
 *
 * **Borrar una carpeta no borra sus notas.** La foreign key es
 * `ON DELETE SET NULL`: las notas se quedan sin `folder_id` y vuelven solas al
 * historial suelto. Es la garantía que hace que borrar una carpeta no sea una
 * decisión que dé miedo, y está en el esquema, no en este archivo.
 */

/**
 * Los dos espacios de nombres. Las notas y los posts usan la misma mecánica
 * sobre la misma tabla, pero nunca ven las carpetas del otro: una carpeta de
 * reels listada en el historial aparecería siempre vacía, y una de notas
 * ensuciaría la galería.
 */
export const NOTA = 'nota';
export const POST = 'post';
export const TERRITORIO = 'territorio';

/** Filtro especial: territorios sin carpeta asignada. No es un id real —los
 *  ids de Postgres nunca empiezan con guion bajo— así que no puede
 *  colisionar con una carpeta de verdad. */
export const SIN_CARPETA = '__sin_carpeta__';

/**
 * Colores de lomo. Son los mismos acentos que usa la taxonomía del universo
 * (`TYPE_ACCENT`), no una paleta nueva: sobre papel crema los tonos saturados
 * de Instagram —que es el default de la columna— se ven de otra app.
 */
export const COLORES = ['#4B4FA6', '#B45309', '#0E7490', '#15803D', '#9D2A6B', '#6B21A8'];

/** Elige el color que menos se repite, para que dos carpetas seguidas no coincidan. */
export function colorParaNueva(existentes = []) {
  const uso = COLORES.map((c) => existentes.filter((f) => f.color === c).length);
  return COLORES[uso.indexOf(Math.min(...uso))];
}

async function idDeUsuario() {
  const { data } = await supabase.auth.getSession();
  const id = data?.session?.user?.id;
  if (!id) throw new Error('Sin sesión activa');
  return id;
}

/**
 * Cuando RLS bloquea un update o un delete, Supabase **no devuelve error**:
 * afecta cero filas y contesta ok. Sin pedir de vuelta lo que se tocó, la
 * pantalla muestra el cambio y la base no lo tiene — el peor modo de fallar,
 * porque parece que funcionó hasta que se recarga.
 */
function verificar({ data, error }) {
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('sin permiso');
  return data;
}

// ─── Lectura ──────────────────────────────────────────────────────────────────

export async function listarCarpetas(scope = NOTA) {
  const { data, error } = await supabase
    .from('post_folders')
    .select('id, name, color, position, created_at, updated_at')
    .eq('scope', scope)
    .order('position', { ascending: true });

  if (error) throw error;
  return data || [];
}

// ─── Escritura ────────────────────────────────────────────────────────────────

export async function crearCarpeta(nombre, existentes = [], scope = NOTA) {
  const n = String(nombre || '').trim();
  if (!n) throw new Error('La carpeta necesita un nombre');

  const user_id = await idDeUsuario();
  const { data, error } = await supabase
    .from('post_folders')
    .insert({
      user_id,
      name: n,
      scope,
      color: colorParaNueva(existentes),
      // Al final de la fila. El historial igual las mezcla por fecha, pero
      // `position` es NOT NULL y una tabla llena de ceros no deja reordenar
      // después sin una migración de datos.
      position: existentes.length,
    })
    .select('id, name, color, position, created_at, updated_at')
    .single();

  if (error) throw error;
  return data;
}

export async function renombrarCarpeta(id, nombre) {
  const n = String(nombre || '').trim();
  if (!n) throw new Error('La carpeta necesita un nombre');

  return verificar(
    await supabase
      .from('post_folders')
      .update({ name: n, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id, name')
  )[0];
}

/** Las notas de adentro sobreviven: la FK las deja con `folder_id` en null. */
export async function eliminarCarpeta(id) {
  verificar(await supabase.from('post_folders').delete().eq('id', id).select('id'));
}

/**
 * Mueve un item a una carpeta. `carpetaId` en null lo saca de donde esté.
 *
 * Sirve igual para una nota y para un post porque los dos son filas de
 * `codex_universe_items` — la carpeta no distingue, y el `scope` de la carpeta
 * ya se encarga de que nadie ofrezca la carpeta equivocada.
 */
export async function moverItem(itemId, carpetaId) {
  verificar(
    await supabase
      .from('codex_universe_items')
      .update({ folder_id: carpetaId })
      .eq('id', itemId)
      .select('id')
  );
}
