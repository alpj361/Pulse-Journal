import { useCallback, useEffect, useMemo, useState } from 'react';
import { presetFor, INTERNAL_KEYS } from '../../utils/codexSchema';
import { EXTRACTORW_URL } from '../../utils/servicios';
import { useSchemaDelUsuario } from '../../utils/useSchemaDelUsuario';
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

/**
 * Manda los campos del catálogo por su endpoint.
 *
 * Devuelve `null` si salió bien, o un objeto de error listo para mostrar. El
 * caso que importa es `INVALID_FIELD_SHAPE`: el backend dice qué clave falló,
 * qué forma esperaba y cuál recibió, y eso se traduce a un error atado al campo
 * en vez de un «no se pudo guardar» que no le sirve a nadie.
 */
async function guardarCampos(id, fields) {
  const { data: sesion } = await supabase.auth.getSession();
  const token = sesion?.session?.access_token;
  if (!token) return { mensaje: 'Sin sesión activa' };

  try {
    const res = await fetch(`${EXTRACTORW_URL}/api/codex/universe-items/${id}/fields`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ fields }),
    });
    if (res.ok) return null;

    const cuerpo = await res.json().catch(() => null);
    const d = cuerpo?.details;
    if (d?.field_key) {
      return {
        field_key: d.field_key,
        mensaje: d.correction || `«${d.field_key}» esperaba ${d.expected} y recibió ${d.received}.`,
      };
    }
    return { mensaje: cuerpo?.error || `No se pudieron guardar los campos (HTTP ${res.status}).` };
  } catch (e) {
    // Sin red el resto del item igual debería poder guardarse, pero decirle a
    // alguien «guardado» cuando sus campos no salieron es peor que el error.
    return { mensaje: e?.message || 'Sin conexión al guardar los campos.' };
  }
}

/**
 * Lo que todavía va a `details` por Supabase.
 *
 * Todo lo que tiene `field_key` ya lo escribió el endpoint. Reenviarlo acá
 * pisaría el valor validado con el crudo, y encima bajo otra clave.
 */
function soloFueraDelCatalogo(detalles, campos) {
  const delCatalogo = new Set(
    campos.filter((c) => c.field_key).map((c) => String(c.storage_key || c.label).toLowerCase())
  );
  return Object.fromEntries(
    Object.entries(detalles).filter(([k]) => !delCatalogo.has(k.toLowerCase()))
  );
}

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
  // Qué campo causó el error, cuando el backend lo dice. Deja marcarlo en su
  // fila en vez de mostrar solo un mensaje arriba.
  const [errorCampo, setErrorCampo] = useState(null);

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

  const schemaUsuario = useSchemaDelUsuario();

  useEffect(() => {
    let vivo = true;
    (async () => {
      const s = schemaUsuario;
      if (!s || !vivo) return;
      setSchema(s);

      const preset = presetFor(tipo, s);

      // Dos índices, y se consulta el canónico primero. Un valor puede estar
      // guardado bajo `field_key` —si el backfill ya corrió— o bajo el label
      // que usaba el contrato viejo; el schema publica las dos claves en la
      // misma definición, así que no hay que adivinar cuál es cuál.
      const porKey = new Map(preset.filter((f) => f.field_key).map((f) => [f.field_key, f]));
      const porLabel = new Map(
        preset.map((f) => [String(f.storage_key || f.label).toLowerCase(), f])
      );

      // Arranca con los campos que ya tienen dato: los del preset conservan su
      // tipo; los que no están en el catálogo entran como texto.
      const iniciales = [];
      const vals = {};
      for (const [k, v] of Object.entries(raw)) {
        const def = porKey.get(k) || porLabel.get(k.toLowerCase());
        iniciales.push(conKey(def ? { ...def } : { label: k, type: 'texto', extra: true }));
        // Los valores se siguen indexando como llegaron: `guardar` todavía
        // escribe `details` directo a Supabase. Cambiar esta clave antes de
        // mover la escritura al endpoint dejaría los datos en un lugar que el
        // guardado actual no sabe encontrar.
        vals[def ? def.storage_key || def.label : k] = v;
      }
      setCampos(iniciales);
      setValues(vals);
    })();
    return () => { vivo = false; };
    // `schemaUsuario` entra en las dependencias: el schema llega asíncrono y sin
    // él este efecto correría una sola vez, con `null`, y los campos nunca se
    // poblarían.
  }, [tipo, raw, schemaUsuario]);

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
      setErrorCampo(null);
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
          /**
           * Los campos van por el endpoint; el resto del item, directo.
           *
           * **Por qué separar la escritura en dos.** `PATCH …/fields` valida la
           * forma de cada valor contra el catálogo y devuelve
           * `INVALID_FIELD_SHAPE` con qué esperaba y qué recibió — eso es lo
           * que permite marcar el campo culpable en vez de fallar entero.
           * Nombre, descripción, tags, alias y geo no son campos del catálogo y
           * no tienen ese endpoint, así que siguen yendo por Supabase.
           *
           * **El PATCH mezcla, no reemplaza.** Verificado contra el servidor:
           * mandar una clave sola deja intactas las demás. Por eso acá se
           * envían únicamente los campos que el editor conoce, sin tener que
           * reenviar el resto para no perderlo.
           *
           * El servidor guarda en `details` bajo `storage_key` —el label— y
           * traduce él mismo desde `field_key`. Esa traducción es justamente lo
           * que no hay que replicar en el cliente.
           */
          const porClave = {};
          for (const c of campos) {
            if (!c.field_key || c.readonly || c.type === 'formula') continue;
            const v = values[c.storage_key || c.label];
            if (v === undefined) continue;
            porClave[c.field_key] = v;
          }

          if (Object.keys(porClave).length) {
            const problema = await guardarCampos(dbId, porClave);
            if (problema) {
              // La convención del hook es devolver algo falso cuando falla —el
              // llamador hace `if (!guardado) return`— y dejar el detalle en
              // `error`. Devolver el objeto del problema se leería como éxito y
              // la ficha se cerraría dando por guardado lo que no se guardó.
              setError(problema.mensaje);
              setErrorCampo(problema.field_key || null);
              setGuardando(false);
              return null;
            }
          }

          ({ error: err } = await supabase
            .from('codex_universe_items')
            .update({
              name: nombreFinal,
              description: descFinal,
              tags: tagsFinal,
              aliases: aliasFinal,
              ...(escribeGeo ? { geo } : {}),
              // `details` sigue escribiéndose acá solo con lo que el endpoint no
              // cubre: estructuras que este editor no muestra y campos sueltos
              // sin `field_key` en el catálogo. Los que sí tienen clave ya los
              // escribió el PATCH, y volver a mandarlos por Supabase pisaría su
              // validación con el valor crudo.
              details: soloFueraDelCatalogo(detalles, campos),
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
    errorCampo,
  };
}
