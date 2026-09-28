import { useCallback, useEffect, useMemo, useState } from 'react';
import { presetFor, collectFields } from '../../utils/codexSchema';
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
 * Bajo qué clave vive el valor de un campo.
 *
 * **Tiene que ser la misma al guardar y al leer**, y no lo era: el hook
 * indexaba por `storage_key || label` y la ficha leía solo por `label`. Para un
 * campo del catálogo las dos coinciden y nadie lo notaba; para un campo propio
 * con `storage_key` distinto del label —«Sintético» guardado como
 * `usr_sintetico`— el valor se escribía en un lado y se buscaba en otro, así
 * que el control aparecía siempre vacío: un interruptor en «No» sobre un item
 * que decía que sí.
 *
 * Se exporta para que quien pinte los campos use esta y no arme la suya.
 *
 * Los campos renombrables no traen `storage_key`, así que siguen indexados por
 * etiqueta y `renombrarCampo` los sigue moviendo bien.
 */
export const claveDeCampo = (f) => f?.storage_key || f?.label;

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

  const schemaUsuario = useSchemaDelUsuario();

  // El catálogo del tipo: lo que el editor ofrece para agregar.
  const preset = useMemo(() => (schemaUsuario ? presetFor(tipo, schemaUsuario) : []), [tipo, schemaUsuario]);

  /**
   * Los campos que se editan son **los mismos que se leen**.
   *
   * Antes el editor armaba su propia lista desde `details`, con reglas propias
   * para decidir qué era campo y qué no, mientras la ficha en lectura usaba
   * `collectFields`. Eran dos lecturas del mismo dato que no coincidían: la
   * ficha mostraba campos que el editor no cargaba, y lo que el editor no
   * cargaba se perdía al guardar. Ahora las dos salen de `collectFields`, con
   * los mismos campos, las mismas etiquetas y los mismos valores.
   */
  const leidos = useMemo(
    () => (schemaUsuario ? collectFields(item, schemaUsuario, tipo) : { conDato: [], extra: [] }),
    [item, schemaUsuario, tipo]
  );

  // Las claves de `details` que el editor puso en pantalla. Son las únicas que
  // le toca reescribir al guardar; todo lo demás se conserva como está.
  const mostradas = useMemo(
    () =>
      new Set(
        [...leidos.conDato, ...leidos.extra]
          .map((f) => f.clave)
          .filter(Boolean)
          .map((k) => String(k).toLowerCase())
      ),
    [leidos]
  );

  useEffect(() => {
    if (!schemaUsuario) return;
    setSchema(schemaUsuario);
    const iniciales = [];
    const vals = {};
    for (const f of [...leidos.conDato, ...leidos.extra]) {
      const def = {
        field_key: f.field_key,
        storage_key: f.storage_key,
        label: f.label,
        type: f.type,
        options: f.options,
        poles: f.poles,
        cols: f.cols,
        readonly: f.readonly,
        // Un campo que el catálogo no conoce se puede renombrar y cambiar de
        // tipo; uno del catálogo no.
        ...(f.field_key ? {} : { extra: true }),
      };
      iniciales.push(conKey(def));
      vals[claveDeCampo(def)] = f.crudo;
    }
    setCampos(iniciales);
    setValues(vals);
    // `schemaUsuario` entra en las dependencias: el schema llega asíncrono y
    // sin él los campos nunca se poblarían.
  }, [leidos, schemaUsuario]);

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
        /**
         * Solo los campos con dato y con etiqueta se escriben.
         *
         * **Bajo `claveDeCampo`, igual que en todos lados.** Acá se indexaba
         * por `label` mientras el resto del hook —al cargar, al editar y al
         * mandar el PATCH— usa `storage_key || label`. Para un campo cuyo
         * `storage_key` difiere de su etiqueta («Sintético» guardado como
         * `usr_sintetico`), `values[c.label]` es `undefined`: el campo se caía
         * de `editados` y se borraba del item al guardar, además de escribirse
         * bajo la clave equivocada si tenía valor.
         */
        const editados = Object.fromEntries(
          campos
            .filter((c) => c.label?.trim())
            .map((c) => [String(claveDeCampo(c) || c.label).trim(), values[claveDeCampo(c)]])
            .filter(([, v]) => v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && !v.length))
        );

        /**
         * Cómo queda `details` después de guardar, **sin perder nada**.
         *
         * Se parte de lo que hay en la base en este momento —no de la copia que
         * tiene la pantalla, que puede venir incompleta o vieja— y se toca solo
         * lo que el editor mostró: esas claves se reescriben con lo que hay en
         * el editor ahora (y si alguien quitó un campo, se va). Todo lo demás
         * queda exactamente como estaba.
         *
         * Antes, después de mandar los campos del catálogo al servidor, se
         * reemplazaba `details` entero con lo que no era del catálogo: el
         * segundo paso borraba lo que acababa de escribir el primero, y cada
         * guardado arrancaba los campos estándar del ítem.
         *
         * `servidor` es lo que el servidor validó y guardó: para los campos del
         * catálogo manda eso, no el valor crudo del editor.
         */
        const armarDetalles = (base, servidor = {}) => {
          const final = {};
          for (const [k, v] of Object.entries(base || {})) {
            if (!mostradas.has(k.toLowerCase())) final[k] = v;
          }
          const buscar = (obj, ...claves) => {
            const lower = claves.filter(Boolean).map((c) => String(c).toLowerCase());
            return Object.keys(obj || {}).find((k) => lower.includes(k.toLowerCase()));
          };
          for (const c of campos) {
            if (!c.label?.trim()) continue;
            const clave = String(claveDeCampo(c) || c.label).trim();
            const v = values[claveDeCampo(c)];
            if (v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length)) continue;
            const delServidor = c.field_key ? buscar(servidor, clave, c.field_key) : null;
            if (delServidor) final[delServidor] = servidor[delServidor];
            else final[clave] = v;
          }
          return final;
        };

        // Lo que se devuelve y lo que usa `wiki_items`: sin servidor de campos.
        const detalles = armarDetalles(
          isUniverse ? item?.details || item?.metadata?.details || {} : item?.metadata || {}
        );

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
          /**
           * Las referencias viajan como `{ id }` y nada más.
           *
           * El contrato es explícito —`hasOnlyKeys(value, ['id'])`— y el
           * servidor hidrata `name` y `tipo` él mismo con el item real. El
           * picker, en cambio, guarda `{id, name, tipo}` porque necesita el
           * nombre para dibujar la pastilla; mandar eso tal cual devolvía
           * `INVALID_FIELD_SHAPE` y **tumbaba el guardado entero**, no solo ese
           * campo.
           *
           * Y hay un caso peor: los items importados traen la referencia en
           * texto plano («Partido»: «VAMOS»). Ese valor no tiene UUID que
           * mandar, así que se omite del PATCH —queda como está, que es lo que
           * la persona ve— en vez de hacer fallar el guardado de todo lo demás
           * cada vez que se abre una ficha vieja.
           */
          const REFERENCIAS = new Set(['ref', 'refs', 'archivo', 'imagen']);
          const soloId = (v) => (v && typeof v === 'object' && v.id ? { id: v.id } : null);

          const porClave = {};
          for (const c of campos) {
            if (!c.field_key || c.readonly || c.type === 'formula') continue;
            const v = values[c.storage_key || c.label];
            if (v === undefined) continue;

            if (REFERENCIAS.has(c.type)) {
              if (v === null) {
                porClave[c.field_key] = null;
                continue;
              }
              if (c.type === 'refs') {
                const ids = (Array.isArray(v) ? v : [v]).map(soloId).filter(Boolean);
                if (ids.length) porClave[c.field_key] = ids;
                continue;
              }
              const uno = soloId(v);
              if (uno) porClave[c.field_key] = uno;
              continue;
            }

            /**
             * El eje viaja como `{ value }` y nada más.
             *
             * Mismo caso que las referencias: el contrato exige exactamente esa
             * clave («los polos viven en la definición del campo»), pero el
             * editor conserva `poles` dentro del valor y 14 de los 15 ejes
             * guardados lo traen. Mandarlo tal cual devolvía
             * `INVALID_FIELD_SHAPE` y tumbaba el guardado entero de la ficha.
             * Los polos no se pierden: están en el catálogo, que es de donde
             * el control los lee para dibujarse.
             */
            if (c.type === 'eje') {
              if (v === null) {
                porClave[c.field_key] = null;
              } else if (v && typeof v === 'object' && Number.isInteger(v.value)) {
                porClave[c.field_key] = { value: v.value };
              }
              continue;
            }

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

          // Lo que hay ahora en la base, ya con lo que el servidor validó.
          const { data: fila, error: errLeer } = await supabase
            .from('codex_universe_items')
            .select('details')
            .eq('id', dbId)
            .single();
          if (errLeer) throw errLeer;
          const final = armarDetalles(fila?.details || {}, fila?.details || {});

          ({ error: err } = await supabase
            .from('codex_universe_items')
            .update({
              name: nombreFinal,
              description: descFinal,
              tags: tagsFinal,
              aliases: aliasFinal,
              ...(escribeGeo ? { geo } : {}),
              details: final,
              updated_at: new Date().toISOString(),
            })
            .eq('id', dbId));
          if (!err) Object.assign(detalles, final);
        } else {
          const { data: fila, error: errLeer } = await supabase
            .from('wiki_items')
            .select('metadata')
            .eq('id', dbId)
            .single();
          if (errLeer) throw errLeer;
          const final = armarDetalles(fila?.metadata || {});
          ({ error: err } = await supabase
            .from('wiki_items')
            .update({
              name: nombreFinal,
              description: descFinal,
              tags: tagsFinal,
              metadata: final,
            })
            .eq('id', dbId));
          if (!err) Object.assign(detalles, final);
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
    [campos, values, item, isUniverse, dbId, tipo, mostradas]
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
