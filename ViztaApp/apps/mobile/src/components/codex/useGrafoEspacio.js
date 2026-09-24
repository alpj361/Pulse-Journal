import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../utils/supabase';
import { loadSpaceItems, notaPrincipalDe } from '../../utils/codexSpaces';
import { construirIndice, segmentar } from './menciones';
import { indiceCodex } from './useIndiceCodex';
import { construir, idsIndiceMostrados } from './grafo';

/**
 * Los datos del grafo de un espacio, en sus tres capas.
 *
 * Cada capa se pide por separado y ninguna es obligatoria. Es a propósito: los
 * espacios reales no están parejos —uno tiene 141 aristas del indexador y otro
 * tiene una, uno tiene 36 relaciones a mano y otro ninguna— y el grafo tiene
 * que verse bien en los dos. Si una capa falta o falla, se dibuja sin ella en
 * vez de no dibujar nada.
 *
 *  1. **Los elementos** del espacio. Sin esto no hay grafo; es la única capa
 *     que, si falla, deja la pantalla vacía.
 *  2. **Las relaciones** que hiciste a mano (`codex_relations`). Siempre se
 *     dibujan sólidas, sin el corte de mediana del índice. Al abrir el grafo
 *     también se copian a `workspace_graph_edges` como `confirmed`, para que
 *     GraphRAG las vea —hasta ahora vivían solo en Codex y el índice no las
 *     tenía.
 *  3. **Las aristas del indexador** (`workspace_graph_edges`). El contrato las
 *     deja en `suggested` hasta que alguien las acepta. Acá aceptar es
 *     mostrarlas: lo que sobrevive el corte y queda dibujado pasa a
 *     `confirmed`. Lo que no se ve se queda sugerido. Las rechazadas no
 *     vuelven.
 *
 * Y el peso: cuántas veces nombraste cada elemento en tus notas. Eso no está en
 * ninguna tabla —se cuenta acá, con el mismo reconocedor que pinta los nombres
 * mientras escribís—, así que el tamaño de cada palabra sale de lo que
 * escribiste y no de lo que alguien catalogó.
 */

// Las notas se cachean a nivel de módulo: se usan enteras para contar, se
// vuelven a necesitar cada vez que se abre otro espacio, y no cambian entre un
// espacio y el siguiente. Sin esto, mirar tres espacios seguidos bajaba el
// mismo corpus tres veces.
const VIGENCIA_MS = 5 * 60 * 1000;
const TECHO_NOTAS = 400;
let corpus = { textos: null, cuando: 0 };
let enVuelo = null;

async function traerNotas() {
  const fresco = corpus.textos && Date.now() - corpus.cuando < VIGENCIA_MS;
  if (fresco) return corpus.textos;

  if (!enVuelo) {
    enVuelo = supabase
      .from('codex_universe_items')
      .select('description')
      .eq('tipo', 'Snippet')
      .order('created_at', { ascending: false })
      .limit(TECHO_NOTAS)
      .then(({ data, error }) => {
        if (error) throw error;
        const textos = (data || []).map((r) => r.description || '').filter(Boolean);
        corpus = { textos, cuando: Date.now() };
        return textos;
      })
      .finally(() => {
        enVuelo = null;
      });
  }
  return enVuelo;
}

/** `.in()` viaja en la URL, así que los ids van en tandas. */
async function enTandas(ids, tamano, fn) {
  const salida = [];
  for (let i = 0; i < ids.length; i += tamano) {
    const parte = await fn(ids.slice(i, i + tamano));
    if (parte?.length) salida.push(...parte);
  }
  return salida;
}

/**
 * Cuántas veces aparece cada elemento en tus notas.
 *
 * Se reusa el reconocedor de menciones en vez de buscar el nombre como
 * subcadena. La diferencia no es de estilo: `segmentar` respeta los límites de
 * palabra, entiende los alias y prefiere el nombre más largo cuando dos se
 * pisan —así «Bernardo Arévalo» cuenta una vez para él y ninguna para un
 * «Bernardo» suelto que también esté en el Codex.
 */
function contarMenciones(items, textos) {
  const cuenta = new Map();
  if (!items?.length || !textos?.length) return cuenta;

  const indice = construirIndice(items);
  if (!indice.size) return cuenta;

  for (const texto of textos) {
    for (const tramo of segmentar(texto, indice)) {
      if (tramo.item?.id) cuenta.set(tramo.item.id, (cuenta.get(tramo.item.id) || 0) + 1);
    }
  }
  return cuenta;
}

/**
 * La memoria de la historia, lista para el grafo.
 *
 * La base parte la historia en ideas —una por oración— y el indexador
 * vectoriza cada una, la une con lo que se le parece y agrupa las parecidas en
 * conceptos con nombre sacado del propio texto. `historia_grafo` devuelve eso
 * tal cual lo guardó el indexador; acá solo se traduce a ids de nodo y se
 * resuelve qué elementos del Codex nombra cada idea.
 *
 * @returns `{ ideas, conceptos, lazos, nombrados: Map<id, item>, externos: Set<id> }`
 */
function historiaDe(datos, codex, propioId) {
  const porCodex = new Map();
  for (const it of codex?.values?.() || []) if (it?.id) porCodex.set(it.id, it);

  const ideas = (datos?.ideas || []).map((i) => ({
    id: i.id,
    texto: i.texto || '',
    seccion: Number(i.seccion) || 0,
    orden: Number(i.orden) || 0,
    indexada: !!i.indexada,
    menciona: (Array.isArray(i.menciona) ? i.menciona : []).filter((id) => id && id !== propioId),
  }));

  const nombrados = new Map();
  for (const i of ideas) {
    for (const id of i.menciona) {
      const it = porCodex.get(id);
      if (it) nombrados.set(id, it);
    }
  }

  // Los extremos del índice vienen con su tipo; una idea es una sección de la
  // historia y lleva prefijo para no confundirse con un elemento.
  const nodo = (id, tipo) => (tipo === 'space_section' ? `idea:${id}` : id);
  const lazos = (datos?.lazos || []).map((l) => ({
    a: nodo(l.a, l.a_tipo),
    b: nodo(l.b, l.b_tipo),
    tipo: l.tipo,
    peso: Number(l.peso) || 0,
  }));

  // Un concepto que ya existe en el Codex con ese mismo nombre es ese elemento:
  // se abre su ficha en vez de ofrecer crearlo otra vez.
  const plano = (t) =>
    String(t || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  const yaEnCodex = (nombre) => {
    if (!codex?.size || !nombre) return null;
    for (const tramo of segmentar(nombre, codex)) {
      if (tramo.item && plano(tramo.item.name) === plano(nombre)) return tramo.item;
    }
    return null;
  };

  const conceptos = (datos?.conceptos || []).map((c) => ({
    id: c.id,
    nombre: c.nombre || '',
    terminos: c.terminos || [],
    ideas: c.ideas || [],
    item: yaEnCodex(c.nombre),
  }));

  return { ideas, conceptos, lazos, nombrados, externos: new Set() };
}

/** La historia recién guardada tarda unos segundos en vectorizarse. */
const ESPERA_INDICE_MS = 5000;
const REINTENTOS_INDICE = 5;

async function traerHistoria(espacioId) {
  const { data, error } = await supabase.rpc('historia_grafo', { p_space_id: espacioId });
  if (error) throw error;
  return data || null;
}

export default function useGrafoEspacio(espacio, marco, recarga = 0) {
  const [datos, setDatos] = useState(null); // { items, relaciones, aristas, menciones }
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const espacioId = espacio?.id || null;
  // Los ids se comparan por su firma y no por identidad: `listSpaces` devuelve
  // un arreglo nuevo en cada lectura, y sin esto el efecto corría de más.
  const firma = (espacio?.itemIds || []).join(',');

  useEffect(() => {
    if (!espacioId) return undefined;
    let vivo = true;
    setDatos(null);
    setCargando(true);
    setError(null);

    (async () => {
      try {
        const ids = firma ? firma.split(',') : [];
        if (!ids.length) {
          if (vivo) {
            setDatos({ espacioId, items: [], miembros: [], relaciones: [], aristas: [], menciones: new Map() });
            setCargando(false);
          }
          return;
        }

        const [{ items: todos }, textos, principalId, codex, filasHistoria] = await Promise.all([
          loadSpaceItems(ids),
          traerNotas().catch(() => []),
          // Si alguna de estas falla, el grafo se dibuja igual, sin la capa de
          // la historia.
          notaPrincipalDe(espacioId).catch(() => null),
          indiceCodex().catch(() => null),
          traerHistoria(espacioId).catch(() => null),
        ]);
        if (!vivo) return;
        // Un Ref —una película, un libro guardado como material— vive en tu
        // universo de información pero no en el modelo analítico, y el grafo
        // dibuja el modelo. Queda en el espacio; no en su grafo.
        const delEspacio = (todos || []).filter((it) => String(it?.tipo || '').toLowerCase() !== 'ref');

        /**
         * La historia, disuelta en el grafo.
         *
         * La nota principal no es un nodo: sus ideas lo son, agrupadas en los
         * conceptos que armó el indexador. Cada idea se une a lo que nombra y
         * a lo que se le parece, y así el grafo muestra lo que el espacio
         * cuenta además de lo que tiene catalogado.
         *
         * Lo que una idea nombra y no está en el espacio entra igual, marcado
         * como de afuera: la historia lo trae al tema.
         */
        const items = delEspacio.filter((it) => it.id !== principalId);
        const nota = principalId && filasHistoria?.ideas?.length ? historiaDe(filasHistoria, codex, principalId) : null;
        if (nota) {
          const enEspacio = new Set(items.map((it) => it.id));
          for (const it of nota.nombrados.values()) {
            if (!enEspacio.has(it.id)) {
              items.push(it);
              nota.externos.add(it.id);
            }
          }
        }

        // Las dos capas de lazos van juntas y ninguna puede tumbar a la otra.
        // Pero una que falla no se disimula como vacía: un grafo sin tus
        // conexiones manuales parece correcto y no lo es. Se dibuja lo que llegó
        // y se marca incompleto.
        let incompleto = false;
        const [relaciones, aristas] = await Promise.all([
          enTandas(ids, 60, async (parte) => {
            const [{ data: comoSujeto, error: e1 }, { data: comoObjeto, error: e2 }] = await Promise.all([
              supabase.from('codex_relations').select('subject_id, object_id, verb').in('subject_id', parte),
              supabase.from('codex_relations').select('subject_id, object_id, verb').in('object_id', parte),
            ]);
            if (e1 || e2) throw e1 || e2;
            const vistos = new Set();
            const filas = [];
            for (const r of [...(comoSujeto || []), ...(comoObjeto || [])]) {
              const clave = `${r.subject_id}|${r.verb}|${r.object_id}`;
              if (vistos.has(clave)) continue;
              vistos.add(clave);
              filas.push(r);
            }
            return filas;
          }).catch(() => {
            incompleto = true;
            return [];
          }),
          supabase
            .from('workspace_graph_edges')
            .select('id, source_id, target_id, relation_type, weight, status, origin')
            .eq('space_id', espacioId)
            .in('status', ['suggested', 'confirmed'])
            .limit(400)
            .then(({ data, error: e }) => {
              if (e) throw e;
              return data || [];
            })
            .catch(() => {
              incompleto = true;
              return [];
            }),
        ]);
        if (!vivo) return;

        const vistosRel = new Set();
        const relacionesUnicas = [];
        for (const r of relaciones || []) {
          const clave = `${r.subject_id}|${r.verb}|${r.object_id}`;
          if (vistosRel.has(clave)) continue;
          vistosRel.add(clave);
          relacionesUnicas.push(r);
        }

        setDatos({
          espacioId,
          items,
          relaciones: relacionesUnicas,
          aristas: aristas || [],
          menciones: contarMenciones(items, textos),
          nota,
          principalId,
          // Los miembros de verdad, para la lista «en este espacio»: sin lo que
          // la nota nombra desde afuera, y con la nota principal, que sí es
          // parte del espacio aunque en el grafo no sea un nodo.
          miembros: delEspacio,
          incompleto,
        });
        setCargando(false);
      } catch (e) {
        if (vivo) {
          setError(e.message || 'No se pudo armar el grafo');
          setCargando(false);
        }
      }
    })();

    return () => {
      vivo = false;
    };
  }, [espacioId, firma, recarga]);

  /**
   * Una historia recién escrita llega antes que su memoria: la base la parte
   * al guardar, pero el indexador tarda unos segundos en vectorizar las ideas y
   * un poco más en armar los conceptos. Mientras falte algo se vuelve a
   * preguntar, pocas veces, y solo se cambia la capa de la historia.
   */
  const pendiente =
    !!datos?.nota?.ideas?.length &&
    !datos.nota.esperado &&
    (datos.nota.ideas.some((i) => !i.indexada) || (datos.nota.ideas.length > 1 && !datos.nota.conceptos.length));
  useEffect(() => {
    if (!pendiente || !espacioId) return undefined;
    let vivo = true;
    let intentos = 0;
    let reloj = null;

    const probar = () => {
      reloj = setTimeout(async () => {
        intentos += 1;
        try {
          const crudo = await traerHistoria(espacioId);
          if (!vivo) return;
          const lista = crudo?.ideas?.length && crudo.ideas.every((i) => i.indexada) && crudo.conceptos?.length;
          if (lista || intentos >= REINTENTOS_INDICE) {
            const codex = await indiceCodex().catch(() => null);
            if (!vivo) return;
            setDatos((d) => {
              if (!d || d.espacioId !== espacioId || !d.nota || !crudo) return d;
              const nota = historiaDe(crudo, codex, d.principalId);
              // Lo que ya estaba como de afuera sigue marcado igual; lo nuevo
              // que nombre la historia aparece la próxima vez que se abra.
              nota.externos = d.nota.externos;
              // Terminado de esperar: lo que no llegó no se vuelve a pedir.
              if (!lista) nota.ideas = nota.ideas.map((i) => ({ ...i, indexada: true }));
              return { ...d, nota: { ...nota, esperado: true } };
            });
            return;
          }
        } catch {
          if (!vivo) return;
        }
        if (intentos < REINTENTOS_INDICE) probar();
      }, ESPERA_INDICE_MS);
    };
    probar();

    return () => {
      vivo = false;
      clearTimeout(reloj);
    };
  }, [pendiente, espacioId]);

  // El acomodo es lo caro —compara todos contra todos, varias vueltas— así que
  // solo se rehace cuando cambian los datos o el marco, no en cada render.
  const grafo = useMemo(() => {
    if (!datos || !marco?.ancho || !marco?.alto) return null;
    return construir({ ...datos, marco });
  }, [datos, marco?.ancho, marco?.alto]);

  // Aceptar es mostrar. Se dispara una vez por espacio+dibujo, en silencio:
  // si el RPC falla el grafo igual se ve, solo que GraphRAG no se entera.
  const aceptado = useRef('');
  useEffect(() => {
    if (!espacioId || !grafo || cargando) return undefined;
    if (datos?.espacioId !== espacioId) return undefined;
    if (!grafo.nodos?.length) return undefined;
    const ids = idsIndiceMostrados(datos?.aristas || [], grafo.lazos || []);
    const clave = `${espacioId}:${ids.slice().sort().join(',')}`;
    if (aceptado.current === clave) return undefined;
    aceptado.current = clave;

    let vivo = true;
    supabase
      .rpc('workspace_accept_displayed_graph', {
        p_space_id: espacioId,
        p_edge_ids: ids,
      })
      .then(({ error: e }) => {
        if (!vivo || !e) return;
        console.warn('No se pudieron aceptar las aristas del grafo', e.message || e);
      });

    return () => {
      vivo = false;
    };
  }, [espacioId, grafo, datos, cargando]);

  return { grafo, items: datos?.miembros || [], cargando, error, incompleto: !!datos?.incompleto };
}
