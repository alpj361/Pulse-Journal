import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../utils/supabase';
import { normalizar } from './menciones';

const ESPERA_MS = 700;
const FUNDIDO_MS = 280;
const PASO_MS = 60;

/** Lo escrito, reducido a palabras: así se comparan el tramo de la app y el de la base. */
const clave = (t) => normalizar(t).replace(/[^a-z0-9]+/g, ' ').trim();

let usuario = null;
async function miId() {
  if (usuario) return usuario;
  const { data } = await supabase.auth.getSession();
  usuario = data?.session?.user?.id || null;
  return usuario;
}

/**
 * Lo que cada mención de la nota es, según la base.
 *
 * La app reconoce los nombres sola y al instante (`segmentar`), pero no sabe
 * si «Vamos» es el partido o el verbo: eso lo decide la base con el contexto
 * (`codex_resolver_texto`), con las mismas reglas que usan la pestaña
 * «Menciones», los conteos y el grafo. Así la nota pinta lo mismo que cuenta
 * todo lo demás.
 *
 * Se pregunta con una pausa después de la última tecla. Mientras llega la
 * respuesta, cada nombre conserva lo que se sabía de él —por lo escrito y por
 * cuántas veces aparece—, para que no parpadee.
 *
 * Cada tramo con mención sale con:
 *   · estado  'si' | 'dudosa' | 'no'  (los 'no' salen sin `item`, sin color)
 *   · item    la ficha que ganó, que puede no ser la que encontró la app
 *   · firma, firmaCorta  para decidir con un toque
 */
export default function useVeredictos(texto, tramos, indice, notaId = null) {
  // La respuesta de la base y el texto al que corresponde: mientras se sigue
  // escribiendo, la respuesta vieja no se usa para lo nuevo.
  const [respuesta, setRespuesta] = useState(null);
  const [fallo, setFallo] = useState(false);
  const [pedido, setPedido] = useState(0);
  const recordado = useRef(new Map());
  // Cuándo apareció cada nombre, para que el color entre despacio.
  const aparecio = useRef(new Map());
  const [, setPulso] = useState(0);
  const reloj = useRef(null);

  // Si el índice del Codex llega después que el texto, recién ahí hay algo que preguntar.
  const hay = (tramos || []).some((t) => t.item);

  useEffect(() => {
    if (!hay) {
      setRespuesta({ texto, filas: [] });
      return undefined;
    }
    let vivo = true;
    // La primera vez se pregunta ya: una nota que se abre no tiene por qué
    // esperar a que alguien teclee.
    const espera = respuesta ? ESPERA_MS : 0;
    const t = setTimeout(async () => {
      try {
        const uid = await miId();
        if (!uid) return;
        const [{ data, error }, guardadas] = await Promise.all([
          supabase.rpc('codex_resolver_texto', { p_user: uid, p_texto: texto }),
          // Si la nota ya está guardada, lo que decidieron la huella o la
          // persona sobre ella vale más que las reglas, que solo miran la frase.
          notaId
            ? supabase
                .from('codex_menciones_resueltas')
                .select('item_id, firma, veredicto, origen')
                .eq('fuente', 'snippet')
                .eq('ref_id', notaId)
                .in('origen', ['huella', 'usuario'])
            : Promise.resolve({ data: [] }),
        ]);
        if (!vivo) return;
        if (error) {
          setFallo(true);
          return;
        }
        const pesa = new Map((guardadas?.data || []).map((g) => [`${g.item_id}|${g.firma}`, g.veredicto]));
        setFallo(false);
        setRespuesta({
          texto,
          filas: (data || []).map((f) =>
            f.origen === 'regla' && pesa.has(`${f.item_id}|${f.firma}`)
              ? { ...f, veredicto: pesa.get(`${f.item_id}|${f.firma}`) }
              : f
          ),
        });
      } catch {
        if (vivo) setFallo(true);
      }
    }, espera);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
    // `tramos` cambia con `texto`; alcanza con el texto, si hay nombres y los pedidos explícitos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto, hay, pedido, notaId]);

  const alDia = respuesta?.texto === texto;

  // Los lugares del texto según la base, en orden, con quién ganó en cada uno.
  const lugares = useMemo(() => {
    if (!respuesta || respuesta.texto !== texto) return null;
    const porLugar = new Map();
    for (const f of respuesta.filas) {
      if (!porLugar.has(f.palabra)) porLugar.set(f.palabra, []);
      porLugar.get(f.palabra).push(f);
    }
    return [...porLugar.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, grupo]) => {
        const si = grupo.find((g) => g.veredicto === 'si');
        const dudosas = grupo.filter((g) => g.veredicto === 'dudosa');
        const base = si || dudosas[0] || grupo[0];
        return {
          clave: clave(base.escrito),
          estado: si ? 'si' : dudosas.length ? 'dudosa' : 'no',
          itemId: base.item_id,
          candidatos: (si ? [si] : dudosas.length ? dudosas : grupo).map((g) => g.item_id),
          firma: base.firma,
          firmaCorta: base.firma_corta,
        };
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [respuesta, alDia]);

  const ahora = Date.now();
  let entrando = false;

  const anotados = (() => {
    const vistos = new Map(); // cuántas veces apareció cada escrito, para recordar
    let j = 0;
    return (tramos || []).map((t) => {
      if (!t.item) return t;
      const k = clave(t.texto);
      const orden = (vistos.get(k) || 0) + 1;
      vistos.set(k, orden);
      const memo = `${k}#${orden}`;

      let lugar = null;
      if (lugares) {
        // Se avanza en paralelo: el tramo de la app y el lugar de la base con
        // lo mismo escrito. Se tolera que la base tenga alguno de más.
        for (let salto = 0; salto < 4 && j + salto < lugares.length; salto++) {
          if (lugares[j + salto].clave === k) {
            lugar = lugares[j + salto];
            j += salto + 1;
            break;
          }
        }
        if (lugar) recordado.current.set(memo, lugar);
      } else {
        // Mientras llega la respuesta, lo que ya se sabía queda quieto.
        lugar = recordado.current.get(memo) || null;
      }

      if (!lugar) {
        // Si la base no contesta, se pinta como siempre: todo lo reconocido cuenta.
        if (fallo) return { ...t, estado: 'si', alfa: 1 };
        // Un nombre recién escrito no se pinta hasta saber qué es. Pintarlo y
        // despintarlo medio segundo después («Vamos por Guate») es peor que esperar.
        aparecio.current.delete(memo);
        return { texto: t.texto, pendiente: true };
      }
      if (lugar.estado === 'no') {
        aparecio.current.delete(memo);
        return { texto: t.texto, descartado: true };
      }

      // El color entra despacio la primera vez que aparece.
      if (!aparecio.current.has(memo)) aparecio.current.set(memo, ahora);
      const pasado = ahora - aparecio.current.get(memo);
      const alfa = pasado >= FUNDIDO_MS ? 1 : 0.2 + 0.8 * (pasado / FUNDIDO_MS);
      if (alfa < 1) entrando = true;

      const item = (lugar.itemId !== t.item.id && indice?.porId?.get(lugar.itemId)) || t.item;
      return {
        ...t,
        item,
        estado: lugar.estado,
        alfa,
        candidatos: lugar.candidatos.map((id) => indice?.porId?.get(id)).filter(Boolean),
        firma: lugar.firma,
        firmaCorta: lugar.firmaCorta,
      };
    });
  })();

  // El fundido va en pasos: un texto dentro de un campo editable no se puede
  // animar de forma continua, pero cuatro o cinco pasos en un cuarto de
  // segundo se ven como un aparecer suave.
  useEffect(() => {
    if (!entrando) return undefined;
    clearTimeout(reloj.current);
    reloj.current = setTimeout(() => setPulso((n) => n + 1), PASO_MS);
    return () => clearTimeout(reloj.current);
  });

  // Después de decidir: se vuelve a preguntar ya, sin esperar otra tecla.
  const releer = useCallback(() => setPedido((n) => n + 1), []);

  return { tramos: anotados, releer };
}
