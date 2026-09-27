import { supabase } from './supabase';
import { asegurarCupo, refrescarUso } from '../state/usoStore';

/**
 * Espacios del Codex.
 *
 * Un espacio es una fila de `spaces`. Espeja
 * ThePulse/src/services/canvasService.ts, con dos diferencias pensadas
 * para teléfono:
 *
 *  · `listSpaces` pide solo `data->canvasItems`, no el `data` completo.
 *    El blob trae además positions, connections, notes, docNodes,
 *    datasetNodes, drawPaths y promptCards — bajarlo entero solo para
 *    saber cuántos items tiene un espacio es caro con red móvil.
 *  · `loadSpace` (canvas completo) queda aparte, para cuando se abra
 *    el espacio de verdad.
 *
 * La membresía item↔espacio vive en `data.canvasItems`: un array de ids
 * que apuntan a codex_universe_items y codex_items indistintamente.
 */

// ─── Lectura ──────────────────────────────────────────────────────────────────

/**
 * Espacios del usuario, ligeros. `project_id` null = espacio suelto.
 * Devuelve { id, name, projectId, updatedAt, itemIds }.
 */
export async function listSpaces() {
  const { data, error } = await supabase
    .from('spaces')
    .select('id, name, project_id, updated_at, data->canvasItems, data->cover, metadata->historias')
    .order('updated_at', { ascending: false });

  if (error) throw error;

  return (data || []).map((row) => ({
    id: row.id,
    name: row.name,
    projectId: row.project_id,
    updatedAt: row.updated_at,
    itemIds: Array.isArray(row.canvasItems) ? row.canvasItems : [],
    // Portada subida por el usuario. Vive en el jsonb `data`, así que no hizo
    // falta migrar la tabla; si no está, el sistema genera una.
    cover: typeof row.cover === 'string' ? row.cover : null,
    // Sus historias, en orden. Un espacio puede tener varias.
    historias: Array.isArray(row.historias) ? row.historias : [],
  }));
}

/**
 * Trae los elementos de un espacio por id.
 *
 * `data.canvasItems` apunta mayormente a `codex_universe_items` y en menor
 * medida a `codex_items`, así que se consultan las dos. No se resuelve contra
 * lo que la pila tenga cargado: eso dependía de un fetch capado en 1000 filas
 * y hacía que un espacio de 55 mostrara 3.
 *
 * `.in()` viaja en la URL, así que los ids van en tandas.
 * Devuelve { items, faltantes } — faltantes son ids que ya no existen en
 * ninguna de las dos tablas, y se reportan en vez de desaparecer.
 */
export async function loadSpaceItems(itemIds) {
  if (!itemIds?.length) return { items: [], faltantes: 0 };

  const CHUNK = 100;
  const chunks = [];
  for (let i = 0; i < itemIds.length; i += CHUNK) chunks.push(itemIds.slice(i, i + CHUNK));

  const encontrados = new Map();

  await Promise.all(
    chunks.flatMap((chunk) => [
      supabase
        .from('codex_universe_items')
        .select('id, name, tipo, description, tags, aliases, details, mentions, created_at')
        .in('id', chunk)
        .then(({ data, error }) => {
          if (error) throw error;
          for (const it of data || []) encontrados.set(it.id, { ...it, _source: 'universe' });
        }),
      supabase
        .from('codex_items')
        .select('id, titulo, descripcion, tipo, url, etiquetas, created_at')
        .in('id', chunk)
        .then(({ data, error }) => {
          if (error) throw error;
          for (const it of data || []) {
            if (encontrados.has(it.id)) continue;
            encontrados.set(it.id, {
              ...it,
              name: it.titulo,
              description: it.descripcion,
              tags: it.etiquetas,
              _source: 'codex',
            });
          }
        }),
    ])
  );

  // Se respeta el orden en que el espacio los guarda.
  const items = itemIds.map((id) => encontrados.get(id)).filter(Boolean);
  return { items, faltantes: itemIds.length - items.length };
}

/** Canvas completo de un espacio — solo al abrirlo. */
export async function loadSpace(spaceId) {
  const { data, error } = await supabase
    .from('spaces')
    .select('*')
    .eq('id', spaceId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const blob = data.data || {};
  return {
    id: data.id,
    name: data.name,
    projectId: data.project_id,
    updatedAt: data.updated_at,
    itemIds: Array.isArray(blob.canvasItems) ? blob.canvasItems : [],
    positions: blob.positions || {},
    connections: blob.connections || [],
    notes: blob.notes || [],
    raw: blob,
  };
}

// ─── Escritura ────────────────────────────────────────────────────────────────

/**
 * Agrega items a un espacio (la operación `Agregar a espacio (N)`).
 *
 * Lee-modifica-escribe sobre el jsonb: hay que releer `data` completo
 * porque el update reemplaza la columna entera y borraríamos positions,
 * notes y el resto. Deduplica contra lo que ya está dentro.
 *
 * Devuelve cuántos se agregaron de verdad.
 */
export async function addItemsToSpace(spaceId, itemIds) {
  if (!itemIds?.length) return 0;

  const { data: current, error: readError } = await supabase
    .from('spaces')
    .select('data')
    .eq('id', spaceId)
    .maybeSingle();

  if (readError) throw readError;
  if (!current) throw new Error('El espacio ya no existe');

  const blob = current.data || {};
  const existing = Array.isArray(blob.canvasItems) ? blob.canvasItems : [];
  const merged = Array.from(new Set([...existing, ...itemIds]));
  const added = merged.length - existing.length;

  if (added === 0) return 0;

  const { error: writeError } = await supabase
    .from('spaces')
    .update({
      data: { ...blob, canvasItems: merged },
      updated_at: new Date().toISOString(),
    })
    .eq('id', spaceId);

  if (writeError) throw writeError;
  return added;
}

/**
 * Aplica un parche parcial al `data` del espacio.
 *
 * El update reemplaza la columna jsonb entera, así que hay que releerla y
 * fusionar: escribir solo `{ positions }` borraría notes, connections,
 * drawPaths, docNodes y todo lo que el canvas de escritorio guarda ahí.
 *
 * Se usa para posiciones, notas y trazos desde el lienzo móvil.
 */
export async function saveCanvasPatch(spaceId, patch) {
  if (!patch || !Object.keys(patch).length) return;

  const { data: current, error: readError } = await supabase
    .from('spaces')
    .select('data')
    .eq('id', spaceId)
    .maybeSingle();

  if (readError) throw readError;
  if (!current) throw new Error('El espacio ya no existe');

  const { error } = await supabase
    .from('spaces')
    .update({
      data: { ...(current.data || {}), ...patch },
      updated_at: new Date().toISOString(),
    })
    .eq('id', spaceId);

  if (error) throw error;
}

/**
 * Escribe una nota libre en el espacio.
 *
 * `data.notes` es un arreglo de `{ id, x, y, content, color? }` — las
 * coordenadas las usa el canvas de escritorio para colocarla. Desde el teléfono
 * no hay lienzo donde apuntar, así que se acomodan en una columna con
 * separación fija: la nota queda usable en la web sin caer encima de otra.
 */
export async function addNote(spaceId, content, color = null) {
  const texto = content?.trim();
  if (!texto) return null;

  const { data: current, error: readError } = await supabase
    .from('spaces')
    .select('data')
    .eq('id', spaceId)
    .maybeSingle();

  if (readError) throw readError;
  if (!current) throw new Error('El espacio ya no existe');

  const blob = current.data || {};
  const notes = Array.isArray(blob.notes) ? blob.notes : [];

  const nota = {
    id: `note-${Date.now()}`,
    x: 80,
    y: 80 + notes.length * 140,
    content: texto,
    ...(color ? { color } : {}),
  };

  const { error: writeError } = await supabase
    .from('spaces')
    .update({
      data: { ...blob, notes: [...notes, nota] },
      updated_at: new Date().toISOString(),
    })
    .eq('id', spaceId);

  if (writeError) throw writeError;
  return nota;
}

/** Borra una nota por id. */
export async function deleteNote(spaceId, noteId) {
  const { data: current, error: readError } = await supabase
    .from('spaces')
    .select('data')
    .eq('id', spaceId)
    .maybeSingle();

  if (readError) throw readError;
  if (!current) return;

  const blob = current.data || {};
  const notes = (Array.isArray(blob.notes) ? blob.notes : []).filter((n) => n.id !== noteId);

  const { error } = await supabase
    .from('spaces')
    .update({ data: { ...blob, notes }, updated_at: new Date().toISOString() })
    .eq('id', spaceId);
  if (error) throw error;
}

/** Crea un espacio suelto (sin proyecto) y lo devuelve ya normalizado. */
export async function createSpace(name, itemIds = []) {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData?.session?.user?.id;
  if (!userId) throw new Error('Sin sesión activa');

  // Antes de crear, no después: enterarse del límite con el espacio ya hecho
  // obligaría a borrarlo, y borrar lo recién creado se siente como un error.
  await asegurarCupo('espacios');

  const { data, error } = await supabase
    .from('spaces')
    .insert({
      user_id: userId,
      name: name?.trim() || 'Espacio sin nombre',
      data: { canvasItems: itemIds, positions: {}, connections: [], notes: [] },
    })
    .select('id, name, project_id, updated_at')
    .single();

  if (error) throw error;

  refrescarUso({ forzar: true });

  return {
    id: data.id,
    name: data.name,
    projectId: data.project_id,
    updatedAt: data.updated_at,
    itemIds,
  };
}

export async function renameSpace(spaceId, name) {
  const { error } = await supabase
    .from('spaces')
    .update({ name: name.trim(), updated_at: new Date().toISOString() })
    .eq('id', spaceId);
  if (error) throw error;
}

// ─── Las historias de un espacio ─────────────────────────────────────────────

/**
 * Las historias de un espacio, en orden: la primera es la 1.
 *
 * **Cada historia es una nota de verdad**, un Snippet como cualquier otro:
 * queda en el historial, resalta menciones y se puede buscar. Lo que la hace
 * historia es estar en la lista `spaces.metadata.historias`. La base mantiene
 * `metadata.nota_principal` igual a la primera, para las versiones de la app que
 * solo conocen esa; acá se lee la lista, y si no está, ese campo.
 *
 * No se usa el rol `output` de `workspace_resources`: el MCP lo expone y la IA
 * puede ponérselo a varias cosas de un espacio —un informe generado, por
 * ejemplo—, y ahí una historia se mezclaría con cualquier salida.
 */
function historiasDeMetadata(metadata) {
  const lista = Array.isArray(metadata?.historias) ? metadata.historias.filter(Boolean) : [];
  if (lista.length) return lista;
  return metadata?.nota_principal ? [metadata.nota_principal] : [];
}

/**
 * Los ids de las historias que siguen existiendo: un puntero a una nota
 * borrada abriría una hoja vacía que dice estar editando algo.
 */
export async function historiasDe(spaceId) {
  if (!spaceId) return [];
  const { data: espacio, error } = await supabase
    .from('spaces')
    .select('metadata')
    .eq('id', spaceId)
    .maybeSingle();
  if (error) throw error;

  const ids = historiasDeMetadata(espacio?.metadata);
  if (!ids.length) return [];

  const { data: vivas } = await supabase.from('codex_universe_items').select('id').in('id', ids);
  const existen = new Set((vivas || []).map((n) => n.id));
  return ids.filter((id) => existen.has(id));
}

/** La primera historia: la que abre el botón «la historia» del espacio. */
export async function notaPrincipalDe(spaceId) {
  const ids = await historiasDe(spaceId);
  return ids[0] || null;
}

/**
 * Suma una nota a las historias del espacio, al final: si ya había una, esta
 * es la 2. Una que ya estaba no se repite ni cambia de lugar.
 *
 * Lee y mezcla antes de escribir: `metadata` puede tener otras claves, y el
 * update reemplaza la columna entera.
 */
export async function agregarHistoria(spaceId, snippetId) {
  const { data: actual, error: errLeer } = await supabase
    .from('spaces')
    .select('metadata')
    .eq('id', spaceId)
    .maybeSingle();
  if (errLeer) throw errLeer;
  if (!actual) throw new Error('El espacio ya no existe');

  const lista = historiasDeMetadata(actual.metadata);
  if (lista.includes(snippetId)) return;
  const historias = [...lista, snippetId];

  const { error } = await supabase
    .from('spaces')
    .update({
      metadata: { ...(actual.metadata || {}), historias, nota_principal: historias[0] },
      updated_at: new Date().toISOString(),
    })
    .eq('id', spaceId);
  if (error) throw error;
}

/**
 * Deja de usar una nota como historia del espacio. La nota no se borra: sigue
 * en el espacio como una nota más. La base se encarga del resto al ver la lista
 * nueva: borra su memoria y sus conceptos, y renumera las demás historias.
 */
export async function quitarHistoria(spaceId, snippetId) {
  const { data: actual, error: errLeer } = await supabase
    .from('spaces')
    .select('metadata')
    .eq('id', spaceId)
    .maybeSingle();
  if (errLeer) throw errLeer;
  if (!actual) throw new Error('El espacio ya no existe');

  const historias = historiasDeMetadata(actual.metadata).filter((id) => id !== snippetId);
  const { historias: _h, nota_principal: _n, ...resto } = actual.metadata || {};
  const { error } = await supabase
    .from('spaces')
    .update({
      metadata: historias.length ? { ...resto, historias, nota_principal: historias[0] } : resto,
      updated_at: new Date().toISOString(),
    })
    .eq('id', spaceId);
  if (error) throw error;
}
