import { useCallback, useEffect, useMemo, useState } from 'react';
import { getCodexSchema, presetFor, INTERNAL_KEYS } from '../../utils/codexSchema';
import { supabase } from '../../utils/supabase';

/**
 * Edición de los campos de un item.
 *
 * Vive en un hook y no dentro de una pantalla porque la ficha y la hoja de
 * edición hacen exactamente lo mismo con los datos, y el guardado tiene detalles
 * que no conviene tener escritos dos veces: distinguir universo de wiki, y sobre
 * todo preservar los blobs anidados que el editor no muestra. Si esa parte se
 * duplica, tarde o temprano una de las dos copias los pisa y se pierde geo,
 * refs y repetibles sin que nadie lo note.
 *
 * Los valores se indexan por etiqueta, así que renombrar mueve el valor con él.
 */

// Identidad estable de cada campo, independiente de su etiqueta. Usar la
// etiqueta como key de React se rompe justo al renombrar: mientras se escribe, un
// nombre a medias puede coincidir con otro campo (o quedar vacío), las keys
// chocan y las filas desaparecen o se duplican debajo del dedo.
let contador = 0;
const conKey = (f) => ({ ...f, _k: f._k ?? `f${++contador}` });

// Formas compatibles entre sí. Cambiar de texto a párrafo no pierde nada;
// cambiar de texto a geo dejaría un string donde el editor espera un objeto.
const PLANOS = new Set(['texto', 'parrafo', 'link', 'email', 'telefono', 'id', 'color', 'formula']);
const NUMERICOS = new Set(['numero', 'porcentaje', 'escala']);

export default function useCamposEditables(item, tipo) {
  const isUniverse = item?._source === 'universe' || !!item?._sourceId;
  const dbId = item?._sourceId || item?.id;

  const [schema, setSchema] = useState(null);
  const [campos, setCampos] = useState([]); // [{ label, type, options, poles, extra }]
  const [values, setValues] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  // Valores crudos guardados, sin claves internas ni las estructuras anidadas
  // que este editor no toca (esas se preservan al guardar).
  const raw = useMemo(() => {
    const fuente = isUniverse ? item?.details || item?.metadata?.details || {} : item?.metadata || {};
    return Object.fromEntries(
      Object.entries(fuente).filter(
        ([k, v]) => !INTERNAL_KEYS.has(k.toLowerCase()) && (typeof v !== 'object' || v === null || Array.isArray(v))
      )
    );
  }, [item, isUniverse]);

  useEffect(() => {
    let vivo = true;
    getCodexSchema().then((s) => {
      if (!vivo) return;
      setSchema(s);

      const preset = presetFor(tipo, s);
      const porLabel = new Map(preset.map((f) => [f.label.toLowerCase(), f]));

      // Arranca con los campos que ya tienen dato: los del preset conservan su
      // tipo; los que no están en el catálogo entran como texto.
      const iniciales = [];
      const vals = {};
      for (const [k, v] of Object.entries(raw)) {
        const def = porLabel.get(k.toLowerCase());
        iniciales.push(conKey(def ? { ...def } : { label: k, type: 'texto', extra: true }));
        vals[def ? def.label : k] = v;
      }
      setCampos(iniciales);
      setValues(vals);
    });
    return () => { vivo = false; };
  }, [tipo, raw]);

  const preset = useMemo(() => (schema ? presetFor(tipo, schema) : []), [tipo, schema]);

  const disponibles = useMemo(
    () => preset.filter((p) => !campos.some((c) => c.label.toLowerCase() === p.label.toLowerCase())),
    [preset, campos]
  );

  const setField = useCallback((label, v) => setValues((prev) => ({ ...prev, [label]: v })), []);

  const agregarCampo = useCallback((f) => {
    setCampos((prev) =>
      prev.some((c) => c.label.toLowerCase() === f.label.toLowerCase()) ? prev : [...prev, conKey(f)]
    );
  }, []);

  const quitarCampo = useCallback(
    (key) => {
      const c = campos.find((x) => x._k === key);
      setCampos((prev) => prev.filter((x) => x._k !== key));
      if (!c) return;
      setValues((prev) => {
        const { [c.label]: _, ...resto } = prev;
        return resto;
      });
    },
    [campos]
  );

  /** Renombrar mueve el valor: los valores están indexados por etiqueta. */
  const renombrarCampo = useCallback(
    (key, despues) => {
      const c = campos.find((x) => x._k === key);
      if (!c) return;
      const antes = c.label;
      setCampos((prev) => prev.map((x) => (x._k === key ? { ...x, label: despues } : x)));
      setValues((prev) => {
        if (!(antes in prev)) return prev;
        const { [antes]: valor, ...resto } = prev;
        return { ...resto, [despues]: valor };
      });
    },
    [campos]
  );

  /**
   * Cambiar el tipo de dato. El valor sobrevive solo entre formas compatibles;
   * si no, se limpia — preferible a dejar el campo roto al renderizar.
   */
  const cambiarTipo = useCallback(
    (key, nuevoTipo) => {
    const actual = campos.find((x) => x._k === key);
    const anterior = actual?.type;
    const etiqueta = actual?.label;
    setCampos((prev) =>
      prev.map((c) => {
        if (c._k !== key) return c;
        // Opciones y polos pertenecen al tipo viejo; con otro no significan nada.
        const { options, poles, ...base } = c;
        return {
          ...base,
          type: nuevoTipo,
          ...(nuevoTipo === 'dropdown' && options ? { options } : {}),
          ...(nuevoTipo === 'eje' && poles ? { poles } : {}),
        };
      })
    );

    const conserva =
      anterior === nuevoTipo ||
      (PLANOS.has(anterior) && PLANOS.has(nuevoTipo)) ||
      (NUMERICOS.has(anterior) && NUMERICOS.has(nuevoTipo));

      if (!conserva && etiqueta) {
        setValues((prev) => {
          const { [etiqueta]: _, ...resto } = prev;
          return resto;
        });
      }
    },
    [campos]
  );

  /**
   * Guardar. `name`, `description` y `tags` vienen de quien llama cuando también
   * los edita; si no, se conservan los del item.
   *
   * Sin `dbId` el item todavía no existe, así que se inserta en vez de
   * actualizar — es lo que permite que la misma ficha sirva para crear. Un item
   * nuevo siempre nace en `codex_universe_items`: los archivos van a
   * `codex_items` por otro camino (la subida de documentos).
   */
  const guardar = useCallback(
    async ({ name, description, tags, aliases, geo, tipo: tipoNuevo } = {}) => {
      setGuardando(true);
      setError(null);
      try {
        // Solo los campos con dato y con etiqueta se escriben.
        const editados = Object.fromEntries(
          campos
            .filter((c) => c.label?.trim())
            .map((c) => [c.label.trim(), values[c.label]])
            .filter(([, v]) => v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && !v.length))
        );

        const fuenteOriginal = isUniverse ? item?.details || item?.metadata?.details || {} : item?.metadata || {};
        // Las estructuras anidadas que este editor no muestra se conservan tal cual.
        const sistema = Object.fromEntries(
          Object.entries(fuenteOriginal).filter(
            ([, v]) => typeof v === 'object' && v !== null && !Array.isArray(v)
          )
        );

        const detalles = { ...sistema, ...editados };
        const nombreFinal = (name ?? item?.name ?? item?.titulo ?? '').trim();
        const descFinal = (description ?? item?.description ?? item?.descripcion ?? '').trim() || null;
        const tagsFinal = tags ?? (Array.isArray(item?.tags) ? item.tags : []);

        // Los alias son los otros nombres por los que se reconoce a un item, y
        // son los que alimentan el resaltado dentro de las notas. Solo existen
        // en el universo: `wiki_items` no tiene la columna, así que escribirla
        // ahí sería un error de Postgres, no un campo vacío.
        const aliasFinal = aliases ?? (Array.isArray(item?.aliases) ? item.aliases : []);

        // `geo` solo se escribe si la pantalla lo mandó. Mandar el valor actual
        // por defecto haría que guardar un cambio de nombre reescriba la
        // geometría —normalizada, con otra forma— sin que nadie lo pidiera.
        const escribeGeo = geo !== undefined;

        // ── Crear ──
        if (!dbId) {
          const { data: sesion } = await supabase.auth.getSession();
          const userId = sesion?.session?.user?.id;
          if (!userId) throw new Error('Sin sesión activa');
          if (!nombreFinal) throw new Error('Falta el nombre');

          const { data, error: errIns } = await supabase
            .from('codex_universe_items')
            .insert({
              user_id: userId,
              tipo: tipoNuevo || tipo,
              name: nombreFinal,
              description: descFinal,
              ...(tagsFinal?.length ? { tags: tagsFinal } : {}),
              ...(aliasFinal?.length ? { aliases: aliasFinal } : {}),
              ...(escribeGeo && geo ? { geo } : {}),
              details: editados,
            })
            .select('id, name, tipo, description, tags, aliases, details, geo, created_at')
            .single();

          if (errIns) throw errIns;
          setGuardando(false);
          return { ...data, _source: 'universe' };
        }

        let err;
        if (isUniverse) {
          ({ error: err } = await supabase
            .from('codex_universe_items')
            .update({
              name: nombreFinal,
              description: descFinal,
              tags: tagsFinal,
              aliases: aliasFinal,
              ...(escribeGeo ? { geo } : {}),
              details: detalles,
              updated_at: new Date().toISOString(),
            })
            .eq('id', dbId));
        } else {
          ({ error: err } = await supabase
            .from('wiki_items')
            .update({
              name: nombreFinal,
              description: descFinal,
              tags: tagsFinal,
              metadata: detalles,
            })
            .eq('id', dbId));
        }

        if (err) throw err;

        setGuardando(false);
        return {
          ...item,
          name: nombreFinal,
          description: descFinal,
          tags: tagsFinal,
          ...(escribeGeo ? { geo } : {}),
          ...(isUniverse ? { aliases: aliasFinal, details: detalles } : { metadata: detalles }),
        };
      } catch (e) {
        setError(e.message || 'No se pudo guardar');
        setGuardando(false);
        return null;
      }
    },
    [campos, values, item, isUniverse, dbId, tipo]
  );

  return {
    schema,
    campos,
    values,
    preset,
    disponibles,
    setField,
    agregarCampo,
    quitarCampo,
    renombrarCampo,
    cambiarTipo,
    guardar,
    guardando,
    error,
  };
}
