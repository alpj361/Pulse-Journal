import { useCallback, useState } from 'react';
import { supabase } from '../../utils/supabase';

/**
 * Progresiones y relaciones de un item: cargarlas, editarlas y persistirlas.
 *
 * Las dos tablas llevan RLS con `auth.uid() = user_id` para todas las
 * operaciones, así que se escribe directo — pero `user_id` es NOT NULL y sin
 * default, o sea que hay que ponerlo a mano en cada inserción o la fila rebota
 * contra el check de la política.
 *
 * Obligatorios por esquema: `titulo` en progresiones; `verb` y `object_id` en
 * relaciones. Lo que no cumpla se descarta al guardar en vez de mandar una
 * inserción que la base va a rechazar.
 *
 * Se guarda por diferencia y no borrando todo para reescribir: las filas nuevas
 * se insertan, las tocadas se actualizan y las quitadas se borran por id. Un
 * «borrar todo y reinsertar» perdería los ids, y con ellos cualquier cosa que
 * los referencie.
 */

const nuevoId = () => `nuevo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export default function useVinculos(dbId) {
  const [progresiones, setProgresiones] = useState(null);
  const [relaciones, setRelaciones] = useState(null);
  const [menciones, setMenciones] = useState(null);
  const [borrados, setBorrados] = useState({ prog: [], rel: [] });
  const [error, setError] = useState(null);

  // ─── Carga ──────────────────────────────────────────────────────────────────

  const cargarProgresiones = useCallback(async () => {
    if (!dbId) return setProgresiones([]);
    const { data, error: e } = await supabase
      .from('codex_progresiones')
      .select('id, fecha, titulo, descripcion, tipo, fuente, orden')
      .eq('item_id', dbId)
      .order('orden', { ascending: true });
    setProgresiones(e ? [] : data || []);
  }, [dbId]);

  const cargarRelaciones = useCallback(async () => {
    if (!dbId) return setRelaciones([]);
    const { data, error: e } = await supabase
      .from('codex_relations')
      .select('id, subject_id, verb, object_id, note, date')
      .or(`subject_id.eq.${dbId},object_id.eq.${dbId}`);
    if (e) return setRelaciones([]);

    const otros = [...new Set((data || []).flatMap((r) => [r.subject_id, r.object_id]))].filter(
      (id) => id && id !== dbId
    );
    let nombres = new Map();
    if (otros.length) {
      const { data: items } = await supabase
        .from('codex_universe_items')
        .select('id, name, tipo')
        .in('id', otros);
      nombres = new Map((items || []).map((i) => [i.id, i]));
    }
    setRelaciones(
      (data || []).map((r) => ({
        ...r,
        esSujeto: r.subject_id === dbId,
        otro: nombres.get(r.subject_id === dbId ? r.object_id : r.subject_id),
      }))
    );
  }, [dbId]);

  /**
   * Menciones: dónde aparece este item por su nombre o sus alias.
   *
   * Lo calcula Postgres con `codex_menciones`, que busca en noticias, tarjetas,
   * snippets y otros actores con el texto en minúsculas y sin tildes, y con
   * límites de palabra — así «Mora» no cuenta dentro de «Morales».
   *
   * Se pide solo al abrir la pestaña: la función tarda medio segundo por item
   * porque recorre las 3.139 noticias, y no tiene sentido pagarlo al abrir la
   * ficha si nadie va a mirar esa pestaña.
   */
  const cargarMenciones = useCallback(async () => {
    if (!dbId) return setMenciones([]);
    const { data, error: e } = await supabase.rpc('codex_menciones', { p_item_id: dbId });
    setMenciones(e ? [] : data || []);
  }, [dbId]);

  // ─── Edición local ──────────────────────────────────────────────────────────

  const addProgresion = useCallback(() => {
    setProgresiones((prev) => [
      ...(prev || []),
      { id: nuevoId(), _nuevo: true, titulo: '', fecha: '', descripcion: '', fuente: '', tipo: 'otro', orden: (prev?.length || 0) },
    ]);
  }, []);

  const setProgresion = useCallback((id, patch) => {
    setProgresiones((prev) => (prev || []).map((p) => (p.id === id ? { ...p, ...patch, _sucio: true } : p)));
  }, []);

  const delProgresion = useCallback((id) => {
    setProgresiones((prev) => (prev || []).filter((p) => p.id !== id));
    if (!String(id).startsWith('nuevo-')) {
      setBorrados((b) => ({ ...b, prog: [...b.prog, id] }));
    }
  }, []);

  /** Una relación nueva sale de este item hacia el elegido. */
  const addRelacion = useCallback((otro) => {
    setRelaciones((prev) => [
      ...(prev || []),
      { id: nuevoId(), _nuevo: true, esSujeto: true, verb: '', note: '', date: '', object_id: otro.id, otro },
    ]);
  }, []);

  const setRelacion = useCallback((id, patch) => {
    setRelaciones((prev) => (prev || []).map((r) => (r.id === id ? { ...r, ...patch, _sucio: true } : r)));
  }, []);

  const delRelacion = useCallback((id) => {
    setRelaciones((prev) => (prev || []).filter((r) => r.id !== id));
    if (!String(id).startsWith('nuevo-')) {
      setBorrados((b) => ({ ...b, rel: [...b.rel, id] }));
    }
  }, []);

  /** Buscar items para elegir el otro extremo de una relación. */
  const buscarItems = useCallback(
    async (q) => {
      const t = (q || '').trim();
      if (t.length < 2) return [];
      const { data } = await supabase
        .from('codex_universe_items')
        .select('id, name, tipo')
        .ilike('name', `%${t}%`)
        .neq('id', dbId)
        .limit(8);
      return data || [];
    },
    [dbId]
  );

  // ─── Persistencia ───────────────────────────────────────────────────────────

  const guardar = useCallback(async () => {
    setError(null);
    try {
      const { data: sesion } = await supabase.auth.getSession();
      const userId = sesion?.session?.user?.id;
      if (!userId) throw new Error('Sin sesión activa');

      if (borrados.prog.length) {
        const { error: e } = await supabase.from('codex_progresiones').delete().in('id', borrados.prog);
        if (e) throw e;
      }
      if (borrados.rel.length) {
        const { error: e } = await supabase.from('codex_relations').delete().in('id', borrados.rel);
        if (e) throw e;
      }

      // `titulo` es obligatorio: una progresión sin título no se manda.
      const progNuevas = (progresiones || []).filter((p) => p._nuevo && p.titulo?.trim());
      if (progNuevas.length) {
        const { error: e } = await supabase.from('codex_progresiones').insert(
          progNuevas.map((p, i) => ({
            user_id: userId,
            item_id: dbId,
            titulo: p.titulo.trim(),
            fecha: p.fecha?.trim() || null,
            descripcion: p.descripcion?.trim() || null,
            fuente: p.fuente?.trim() || null,
            tipo: p.tipo || 'otro',
            orden: p.orden ?? i,
          }))
        );
        if (e) throw e;
      }

      for (const p of (progresiones || []).filter((x) => x._sucio && !x._nuevo)) {
        const { error: e } = await supabase
          .from('codex_progresiones')
          .update({
            titulo: (p.titulo || '').trim(),
            fecha: p.fecha?.trim() || null,
            descripcion: p.descripcion?.trim() || null,
            fuente: p.fuente?.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', p.id);
        if (e) throw e;
      }

      // `verb` y `object_id` son obligatorios.
      const relNuevas = (relaciones || []).filter((r) => r._nuevo && r.verb?.trim() && r.object_id);
      if (relNuevas.length) {
        const { error: e } = await supabase.from('codex_relations').insert(
          relNuevas.map((r) => ({
            user_id: userId,
            subject_id: dbId,
            object_id: r.object_id,
            verb: r.verb.trim(),
            note: r.note?.trim() || null,
            date: r.date?.trim() || null,
          }))
        );
        if (e) throw e;
      }

      for (const r of (relaciones || []).filter((x) => x._sucio && !x._nuevo)) {
        const { error: e } = await supabase
          .from('codex_relations')
          .update({
            verb: (r.verb || '').trim(),
            note: r.note?.trim() || null,
            date: r.date?.trim() || null,
          })
          .eq('id', r.id);
        if (e) throw e;
      }

      setBorrados({ prog: [], rel: [] });
      // Se recargan para quedar con los ids reales de lo insertado; sin esto, un
      // segundo guardado volvería a insertar las filas nuevas.
      await Promise.all([cargarProgresiones(), cargarRelaciones()]);
      return true;
    } catch (e) {
      setError(e.message || 'No se pudieron guardar los vínculos');
      return false;
    }
  }, [progresiones, relaciones, borrados, dbId, cargarProgresiones, cargarRelaciones]);

  const hayCambios =
    borrados.prog.length > 0 ||
    borrados.rel.length > 0 ||
    (progresiones || []).some((p) => p._nuevo || p._sucio) ||
    (relaciones || []).some((r) => r._nuevo || r._sucio);

  return {
    progresiones,
    relaciones,
    menciones,
    cargarProgresiones,
    cargarRelaciones,
    cargarMenciones,
    addProgresion,
    setProgresion,
    delProgresion,
    addRelacion,
    setRelacion,
    delRelacion,
    buscarItems,
    guardar,
    hayCambios,
    error,
  };
}
