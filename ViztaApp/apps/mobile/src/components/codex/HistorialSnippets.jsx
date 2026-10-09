import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { ChevronLeft, FolderInput, FolderMinus, FolderPlus, Layers, Pencil, Trash2 } from 'lucide-react-native';
import { INK, RADIUS } from '../theme';
import { MONO } from './mono';
import { PAPEL } from './Papel';
import { supabase } from '../../utils/supabase';
import { ponerFila, useEnVivo, useFilasEnVivo } from '../../utils/enVivo';
import {
  NOTA,
  crearCarpeta,
  eliminarCarpeta,
  listarCarpetas,
  moverItem,
  renombrarCarpeta,
} from '../../utils/carpetas';
import { Nombrador, Opcion, RESALTADOR, TENUE, etiquetaConteo } from './piezasCarpeta';
import { TYPE_ACCENT, normalizeTipo } from './tipos';
import { listSpaces, addItemsToSpace } from '../../utils/codexSpaces';
import { roce, toque, agarre, falla } from '../../utils/haptics';

const MENU_ANCHO = 190;
const HAIRLINE = 'rgba(28,43,34,0.07)';

// Con 57 notas en la base, 60 era un techo a punto de tocarse — y las carpetas
// lo empeoran, porque el contador «N notas» se calcula sobre lo que se bajó: si
// la lista viene cortada, una carpeta miente sobre cuánto tiene adentro.
const TECHO = 300;

// Los elementos del Codex se traen de a pocos. Acá no se viene a recorrer el
// universo entero —son más de mil y para eso está el buscador—, sino a tener a
// mano lo último que se tocó.
const TECHO_CODEX = 80;

const CAMPOS_NOTA = 'id, name, tipo, description, tags, aliases, details, created_at, folder_id';
const CAMPOS_ITEM = 'id, name, tipo, description, aliases, created_at, folder_id';

// Snippets y Posts quedan afuera de la lista del Codex por razones distintas:
// los Snippets **son** esta página, y los Posts tienen su propia galería con
// sus propias carpetas. Es el mismo recorte que hace el índice de menciones.
// Los Facts tampoco: son sub-items de un post y se ven adentro de ese post.
const FUERA = '("Snippet","Post","Fact")';
// Lo mismo que `FUERA`, para decidir sobre una fila que llega en vivo.
const NO_CODEX = new Set(['Snippet', 'Post', 'Fact']);

/**
 * Historial de notas — la página de la izquierda.
 *
 * Es la lista de tus Snippets, del más nuevo al más viejo, **mezclada con tus
 * carpetas** por la misma fecha. No hay dos listas ni dos pestañas: una carpeta
 * es una fila más, con el lomo de color a la izquierda y un `›` que avisa que
 * navega en vez de abrir.
 *
 * Se muestra la primera línea como título y dos renglones del cuerpo. El título
 * de un Snippet ES su primera línea, así que repetirla completa abajo sería
 * decir dos veces lo mismo — por eso el cuerpo que se muestra empieza después
 * de esa primera línea.
 *
 * **El filtro no existe hasta que haya algo que filtrar.** Sin carpetas y sin
 * Codex la página queda exactamente como estaba: sin buscador, sin filtros, sin
 * categorías. Que la función no le cobre nada a quien no la usa es la única
 * razón por la que se puede agregar sin ensuciar una pantalla cuyo trabajo es
 * responder «¿qué escribí ayer?».
 *
 * **`todo` sigue siendo solo notas.** Los elementos del Codex viven en su
 * propio filtro, no mezclados en la raíz: son otra cosa —un actor no es algo
 * que escribiste— y meterlos en la lista de siempre convertiría el historial en
 * un cajón. Adentro de una carpeta sí conviven, porque ahí la mezcla es una
 * decisión que tomó la persona.
 *
 * **Abrir una carpeta no abre otra hoja.** Esta página ya vive dentro de un
 * pager que vive dentro de un Modal; un tercer nivel dejaría el gesto de volver
 * sin dueño claro. La carpeta reemplaza el contenido en el lugar y volver es un
 * tap explícito — el swipe horizontal sigue siendo del pager, y nunca compiten.
 *
 * **Las acciones salen de un menú contextual**, no de iconos en cada fila.
 * Mantener presionado es el clic derecho del teléfono: lo peligroso vive ahí,
 * escondido hasta que lo pedís, y la lista queda limpia.
 */
/**
 * `arriba`: lo que va antes de las notas. Con la historia como datasheet,
 * sus filas: el historial de esa historia son sus entradas.
 */
export default function HistorialSnippets({ onAbrir, onAbrirItem, topInset = 0, bottomInset = 0, arriba = null }) {
  const { width: W, height: H } = useWindowDimensions();

  const [notas, setNotas] = useState(null); // null = cargando
  const [items, setItems] = useState([]); // elementos del Codex
  const [carpetas, setCarpetas] = useState([]);
  const [error, setError] = useState(null);
  // Las notas cargaron pero alguna consulta del Codex no: el historial se ve,
  // aunque con carpetas que pueden estar incompletas.
  const [avisoCodex, setAvisoCodex] = useState(null);

  const [filtro, setFiltro] = useState('todo');
  const [abierta, setAbierta] = useState(null); // carpeta abierta
  const [menu, setMenu] = useState(null); // { clase, item, x, y, vista }
  const [nombrando, setNombrando] = useState(null); // { modo, carpeta?, fila? }
  const [espacios, setEspacios] = useState(null); // null = todavía no se pidieron
  const [recarga, setRecarga] = useState(0); // se sube para volver a pedir todo

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const base = () =>
          supabase.from('codex_universe_items').select(CAMPOS_ITEM).not('tipo', 'in', FUERA);

        const [{ data, error: e }, recientes, guardados, cs] = await Promise.all([
          supabase
            .from('codex_universe_items')
            .select(CAMPOS_NOTA)
            .eq('tipo', 'Snippet')
            .order('created_at', { ascending: false })
            .limit(TECHO),
          base().order('created_at', { ascending: false }).limit(TECHO_CODEX),
          // Lo que está guardado en una carpeta se pide aparte y sin importar la
          // fecha: si solo trajéramos los recientes, agrupar un actor de hace un
          // año lo haría desaparecer de su propia carpeta.
          base().not('folder_id', 'is', null).limit(TECHO),
          listarCarpetas(NOTA),
        ]);
        if (e) throw e;
        if (!vivo) return;
        setNotas(data || []);
        // Si falla la parte del Codex, el historial abre igual. Las notas son lo
        // que se vino a buscar; el resto es de paso.
        // Si una de las dos falla, lo que trajo la otra se muestra igual, pero no
        // en silencio: sin aviso, un elemento guardado en una carpeta
        // desaparecía de ella y del conteo como si no existiera.
        if (recientes.error || guardados.error) {
          setAvisoCodex('No se pudieron traer todos tus elementos del Codex: alguna carpeta puede verse incompleta.');
        }
        setItems(unir(recientes.data, guardados.data));
        setCarpetas(cs);
      } catch (e) {
        if (vivo) {
          setError(e.message || 'No se pudo cargar');
          setNotas([]);
        }
      }
    })();
    return () => {
      vivo = false;
    };
  }, [recarga]);

  // Una nota nueva, un título que cambió, algo que se borró o se movió de
  // carpeta: entra a la lista al momento, venga de acá o de otro lado.
  useFilasEnVivo(
    'codex_universe_items',
    CAMPOS_NOTA,
    ({ id, fila }) => {
      setNotas((prev) => (prev ? ponerFila(prev, id, fila, (f) => f.tipo === 'Snippet') : prev));
      setItems((prev) => ponerFila(prev, id, fila, (f) => !NO_CODEX.has(f.tipo)));
    },
    () => setRecarga((n) => n + 1)
  );
  useEnVivo(['post_folders'], () => {
    listarCarpetas(NOTA).then(setCarpetas).catch(() => {});
  });

  /** Cuánto tiene cada carpeta, separado por naturaleza para poder nombrarlo. */
  const conteo = useMemo(() => {
    const m = new Map();
    const sumar = (id, clave) => {
      if (!id) return;
      const c = m.get(id) || { notas: 0, items: 0 };
      c[clave] += 1;
      m.set(id, c);
    };
    for (const n of notas || []) sumar(n.folder_id, 'notas');
    for (const it of items) sumar(it.folder_id, 'items');
    return m;
  }, [notas, items]);

  const hayCarpetas = carpetas.length > 0;
  const hayCodex = items.length > 0;

  /**
   * La fila de filtros lista **solo lo que existe**. Ofrecer «carpetas» a quien
   * no tiene ninguna es mandarlo a una pantalla vacía, y ofrecer «codex» a quien
   * no cargó nada es prometer algo que no está.
   */
  const filtros = useMemo(() => {
    const f = [{ id: 'todo', label: 'todo' }];
    if (hayCarpetas) f.push({ id: 'notas', label: 'notas' });
    if (hayCodex) f.push({ id: 'codex', label: 'codex' });
    if (hayCarpetas) f.push({ id: 'carpetas', label: 'carpetas' });
    return f.length > 1 ? f : [];
  }, [hayCarpetas, hayCodex]);

  // Borrar la última carpeta estando en «carpetas» dejaba un filtro activo que
  // ya no está en la fila: la lista quedaba vacía sin que se viera por qué.
  useEffect(() => {
    if (filtro !== 'todo' && !filtros.some((f) => f.id === filtro)) setFiltro('todo');
  }, [filtros, filtro]);

  /**
   * La lista de la raíz: carpetas y notas sueltas ordenadas por la misma fecha.
   * Una carpeta se fecha por su última actividad, no por cuándo se creó — si no,
   * una carpeta vieja que usás todos los días se hundiría hasta el fondo.
   */
  const filas = useMemo(() => {
    if (!notas) return [];

    const acc = [];
    if (filtro === 'todo' || filtro === 'carpetas') {
      for (const c of carpetas) {
        acc.push({ clase: 'carpeta', item: c, cuando: c.updated_at || c.created_at });
      }
    }
    if (filtro === 'todo' || filtro === 'notas') {
      for (const n of notas) {
        if (!n.folder_id) acc.push({ clase: 'nota', item: n, cuando: n.created_at });
      }
    }
    if (filtro === 'codex') {
      for (const it of items) {
        if (!it.folder_id) acc.push({ clase: 'item', item: it, cuando: it.created_at });
      }
    }

    return acc.sort((a, b) => new Date(b.cuando || 0) - new Date(a.cuando || 0));
  }, [notas, items, carpetas, filtro]);

  /** Adentro de una carpeta sí se mezclan: notas y elementos, por fecha. */
  const dentro = useMemo(() => {
    if (!abierta) return [];
    const acc = [];
    for (const n of notas || []) {
      if (n.folder_id === abierta.id) acc.push({ clase: 'nota', item: n, cuando: n.created_at });
    }
    for (const it of items) {
      if (it.folder_id === abierta.id) acc.push({ clase: 'item', item: it, cuando: it.created_at });
    }
    return acc.sort((a, b) => new Date(b.cuando || 0) - new Date(a.cuando || 0));
  }, [notas, items, abierta]);

  // ─── Acciones ───────────────────────────────────────────────────────────────

  const abrirMenu = (clase, item, ev) => {
    agarre();
    const { pageX = 0, pageY = 0 } = ev?.nativeEvent || {};
    // El menú se ancla donde estuvo el dedo, pero sin salirse de la pantalla: en
    // una fila del borde derecho o del pie quedaría medio cortado. El margen de
    // abajo contempla la vista más alta, que es la lista de carpetas o espacios.
    setMenu({
      clase,
      item,
      vista: 'acciones',
      x: Math.min(Math.max(pageX - MENU_ANCHO / 2, 14), W - MENU_ANCHO - 14),
      y: Math.min(pageY + 8, H - 300),
    });
  };

  const abrirEspacios = async () => {
    setMenu((m) => (m ? { ...m, vista: 'espacio' } : null));
    if (espacios !== null) return;
    try {
      setEspacios(await listSpaces());
    } catch {
      setError('No se pudieron traer tus espacios');
      setMenu((m) => (m ? { ...m, vista: 'acciones' } : null));
    }
  };

  const ponerEnEspacio = async (espacio) => {
    const item = menu?.item;
    if (!item?.id) return;
    setMenu(null);
    try {
      await addItemsToSpace(espacio.id, [item.id]);
      setEspacios((es) =>
        (es || []).map((s) =>
          s.id === espacio.id ? { ...s, itemIds: [...(s.itemIds || []), item.id] } : s
        )
      );
      toque();
    } catch (e) {
      setError(e.message || 'No se pudo agregar al espacio');
      falla();
    }
  };

  const borrarNota = async (nota) => {
    setMenu(null);

    // Optimista: la fila se va en el acto. Esperar a la red para que desaparezca
    // hace sentir la app trabada, y si falla se repone.
    const antes = notas;
    setNotas((n) => (n || []).filter((x) => x.id !== nota.id));

    try {
      // El `.select()` no es decorativo: si RLS no deja borrar, Supabase **no
      // devuelve error** — borra cero filas y contesta ok. Sin pedir de vuelta
      // lo borrado, la nota desaparecía de la pantalla y reaparecía al volver a
      // entrar, que es la peor forma de fallar porque parece que funcionó.
      const { data, error: e } = await supabase
        .from('codex_universe_items')
        .delete()
        .eq('id', nota.id)
        .select('id');
      if (e) throw e;
      if (!data || data.length === 0) throw new Error('sin permiso para eliminar');
      toque();
    } catch {
      falla();
      setNotas(antes);
      setError('No se pudo eliminar. Intentá de nuevo.');
    }
  };

  /**
   * Mover a una carpeta. Sirve igual para una nota y para un elemento del Codex
   * porque los dos son filas de `codex_universe_items` y la carpeta no
   * distingue; lo único que cambia acá es de qué lista sale la fila.
   */
  const mover = async (clase, item, carpetaId) => {
    setMenu(null);
    const poner = (lista) =>
      (lista || []).map((x) => (x.id === item.id ? { ...x, folder_id: carpetaId } : x));

    const antesN = notas;
    const antesI = items;
    if (clase === 'item') setItems(poner);
    else setNotas(poner);

    try {
      await moverItem(item.id, carpetaId);
      toque();
    } catch {
      falla();
      setNotas(antesN);
      setItems(antesI);
      setError(clase === 'item' ? 'No se pudo mover el elemento.' : 'No se pudo mover la nota.');
    }
  };

  const borrarCarpeta = (carpeta) => {
    setMenu(null);
    const cuantas = conteo.get(carpeta.id);
    const total = (cuantas?.notas || 0) + (cuantas?.items || 0);

    Alert.alert(
      `Eliminar "${carpeta.name}"`,
      total > 0
        ? `Lo que tiene adentro vuelve al historial: ${resumen(cuantas)}. No se borra nada.`
        : 'La carpeta está vacía.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            const antesC = carpetas;
            const antesN = notas;
            const antesI = items;
            const soltar = (lista) =>
              (lista || []).map((x) => (x.folder_id === carpeta.id ? { ...x, folder_id: null } : x));

            setCarpetas((c) => c.filter((x) => x.id !== carpeta.id));
            // La foreign key es ON DELETE SET NULL, así que en la base las filas
            // quedan sueltas solas. Acá se espeja para no tener que recargar.
            setNotas(soltar);
            setItems(soltar);
            if (abierta?.id === carpeta.id) setAbierta(null);

            try {
              await eliminarCarpeta(carpeta.id);
              toque();
            } catch {
              falla();
              setCarpetas(antesC);
              setNotas(antesN);
              setItems(antesI);
              setError('No se pudo eliminar la carpeta.');
            }
          },
        },
      ]
    );
  };

  /**
   * Confirmar el nombre. Sirve para los tres caminos que piden uno: crear suelta,
   * crear desde una fila (que además la guarda adentro) y renombrar.
   */
  const confirmarNombre = async (texto) => {
    const destino = nombrando;
    setNombrando(null);
    Keyboard.dismiss();

    try {
      if (destino.modo === 'renombrar') {
        const r = await renombrarCarpeta(destino.carpeta.id, texto);
        setCarpetas((c) => c.map((x) => (x.id === r.id ? { ...x, name: r.name } : x)));
        if (abierta?.id === r.id) setAbierta((a) => ({ ...a, name: r.name }));
      } else {
        const nueva = await crearCarpeta(texto, carpetas, NOTA);
        setCarpetas((c) => [...c, nueva]);
        if (destino.fila) await mover(destino.fila.clase, destino.fila.item, nueva.id);
      }
      toque();
    } catch (e) {
      falla();
      setError(e.message === 'sin permiso' ? 'No tenés permiso para eso.' : 'No se pudo guardar la carpeta.');
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  const lista = abierta ? dentro : filas;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: topInset + 66,
          paddingBottom: bottomInset + 40,
          paddingHorizontal: 30,
        }}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!menu && !nombrando}
      >
        {arriba && !abierta ? arriba : null}
        {abierta ? (
          <Pressable
            onPress={() => {
              roce();
              setAbierta(null);
            }}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              marginBottom: 26,
              opacity: pressed ? 0.5 : 1,
            })}
            accessibilityRole="button"
            accessibilityLabel={`Volver al historial desde ${abierta.name}`}
          >
            <ChevronLeft size={15} color="rgba(28,43,34,0.4)" />
            <View style={{ width: 3, height: 12, backgroundColor: abierta.color }} />
            <Text numberOfLines={1} style={{ fontFamily: MONO, fontSize: 11.5, color: INK.title, flex: 1 }}>
              {abierta.name}
            </Text>
            <Text style={{ fontFamily: MONO, fontSize: 11, color: 'rgba(28,43,34,0.26)' }}>
              {resumen(conteo.get(abierta.id))}
            </Text>
          </Pressable>
        ) : (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: filtros.length ? 18 : 26,
            }}
          >
            <Text style={{ fontFamily: MONO, fontSize: 11.5, color: TENUE }}>historial</Text>

            <Pressable
              onPress={() => {
                roce();
                setNombrando({ modo: 'crear' });
              }}
              hitSlop={12}
              style={({ pressed }) => ({ opacity: pressed ? 0.4 : 1 })}
              accessibilityRole="button"
              accessibilityLabel="Carpeta nueva"
            >
              <FolderPlus size={16} color={TENUE} />
            </Pressable>
          </View>
        )}

        {!abierta && filtros.length ? (
          <Animated.View
            entering={FadeIn.duration(200)}
            style={{ flexDirection: 'row', gap: 14, marginBottom: 20 }}
          >
            {filtros.map((f) => {
              const activo = filtro === f.id;
              return (
                <Pressable
                  key={f.id}
                  onPress={() => {
                    roce();
                    setFiltro(f.id);
                  }}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityState={{ selected: activo }}
                  accessibilityLabel={`Mostrar ${f.label}`}
                >
                  <Text
                    style={{
                      fontFamily: MONO,
                      fontSize: 11.5,
                      color: activo ? INK.title : TENUE,
                      backgroundColor: activo ? RESALTADOR : 'transparent',
                      paddingHorizontal: 4,
                      paddingVertical: 1,
                    }}
                  >
                    {f.label}
                  </Text>
                </Pressable>
              );
            })}
          </Animated.View>
        ) : null}

        {notas === null ? (
          <ActivityIndicator size="small" color={INK.faint} style={{ marginTop: 30 }} />
        ) : lista.length === 0 ? (
          <Text style={{ fontFamily: MONO, fontSize: 13, color: TENUE, lineHeight: 21 }}>
            {error || avisoCodex || vacio(abierta, filtro)}
          </Text>
        ) : (
          <>
            {error || avisoCodex ? (
              <Text style={{ fontFamily: MONO, fontSize: 12, color: '#B91C1C', lineHeight: 19, marginBottom: 16 }}>
                {error || avisoCodex}
              </Text>
            ) : null}

            {lista.map((f, i) => (
              <Animated.View
                key={`${f.clase}-${f.item.id}`}
                entering={FadeIn.duration(240).delay(Math.min(i, 8) * 26)}
                exiting={FadeOut.duration(180)}
                layout={LinearTransition.springify().damping(22)}
              >
                {f.clase === 'carpeta' ? (
                  <>
                    <FilaCarpeta
                      carpeta={f.item}
                      resumen={resumen(conteo.get(f.item.id))}
                      atenuada={!!menu && menu.item.id !== f.item.id}
                      onPress={() => {
                        roce();
                        setAbierta(f.item);
                      }}
                      onLongPress={(ev) => abrirMenu('carpeta', f.item, ev)}
                    />
                    <LineaCarpeta />
                  </>
                ) : f.clase === 'item' ? (
                  <FilaItem
                    item={f.item}
                    atenuada={!!menu && menu.item.id !== f.item.id}
                    onPress={() => {
                      roce();
                      onAbrirItem?.(f.item);
                    }}
                    onLongPress={(ev) => abrirMenu('item', f.item, ev)}
                  />
                ) : (
                  <FilaNota
                    nota={f.item}
                    atenuada={!!menu && menu.item.id !== f.item.id}
                    onPress={() => {
                      roce();
                      onAbrir?.(f.item);
                    }}
                    onLongPress={(ev) => abrirMenu('nota', f.item, ev)}
                  />
                )}
              </Animated.View>
            ))}
          </>
        )}
      </ScrollView>

      {/* Menú contextual. La capa de atrás lo cierra al tocar en cualquier lado:
          es lo que uno intenta primero para salir de un menú así. */}
      {menu ? (
        <>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenu(null)} />

          <Animated.View
            entering={FadeIn.duration(130)}
            exiting={FadeOut.duration(100)}
            style={{
              position: 'absolute',
              left: menu.x,
              top: menu.y,
              width: MENU_ANCHO,
              maxHeight: 268,
              borderRadius: RADIUS.md,
              backgroundColor: PAPEL,
              borderWidth: 1,
              borderColor: 'rgba(28,43,34,0.10)',
              shadowColor: '#1E3326',
              shadowOpacity: 0.16,
              shadowRadius: 20,
              shadowOffset: { width: 0, height: 8 },
              elevation: 10,
              overflow: 'hidden',
            }}
          >
            {menu.vista === 'mover' ? (
              <ScrollView keyboardShouldPersistTaps="handled">
                <Opcion
                  icono={<FolderPlus size={15} color={INK.title} />}
                  texto="carpeta nueva"
                  onPress={() => {
                    const fila = { clase: menu.clase, item: menu.item };
                    setMenu(null);
                    setNombrando({ modo: 'crear', fila });
                  }}
                />
                {carpetas
                  .filter((c) => c.id !== menu.item.folder_id)
                  .map((c) => (
                    <Opcion
                      key={c.id}
                      lomo={c.color}
                      texto={c.name}
                      onPress={() => mover(menu.clase, menu.item, c.id)}
                    />
                  ))}
              </ScrollView>
            ) : menu.vista === 'espacio' ? (
              <ScrollView keyboardShouldPersistTaps="handled">
                {espacios === null ? (
                  <ActivityIndicator size="small" color={INK.faint} style={{ marginVertical: 18 }} />
                ) : (() => {
                  const candidatos = espacios.filter((s) => !(s.itemIds || []).includes(menu.item.id));
                  if (!espacios.length) {
                    return (
                      <Text
                        style={{
                          fontFamily: MONO,
                          fontSize: 12.5,
                          color: 'rgba(28,43,34,0.38)',
                          paddingHorizontal: 14,
                          paddingVertical: 16,
                          lineHeight: 18,
                        }}
                      >
                        todavía no hay espacios
                      </Text>
                    );
                  }
                  if (!candidatos.length) {
                    return (
                      <Text
                        style={{
                          fontFamily: MONO,
                          fontSize: 12.5,
                          color: 'rgba(28,43,34,0.38)',
                          paddingHorizontal: 14,
                          paddingVertical: 16,
                          lineHeight: 18,
                        }}
                      >
                        ya está en tus espacios
                      </Text>
                    );
                  }
                  return candidatos.map((s) => (
                    <Opcion
                      key={s.id}
                      icono={<Layers size={15} color={INK.title} />}
                      texto={s.name}
                      onPress={() => ponerEnEspacio(s)}
                    />
                  ));
                })()}
              </ScrollView>
            ) : menu.clase === 'carpeta' ? (
              <>
                <Opcion
                  icono={<Pencil size={15} color={INK.title} />}
                  texto="renombrar"
                  onPress={() => {
                    const carpeta = menu.item;
                    setMenu(null);
                    setNombrando({ modo: 'renombrar', carpeta });
                  }}
                />
                <Opcion
                  icono={<Trash2 size={15} color="#B91C1C" />}
                  texto="eliminar carpeta"
                  peligro
                  onPress={() => borrarCarpeta(menu.item)}
                />
              </>
            ) : (
              <>
                <Opcion
                  icono={<FolderInput size={15} color={INK.title} />}
                  texto="mover a…"
                  onPress={() => setMenu((m) => ({ ...m, vista: 'mover' }))}
                />
                <Opcion
                  icono={<Layers size={15} color={INK.title} />}
                  texto="a un espacio…"
                  onPress={abrirEspacios}
                />
                {menu.item.folder_id ? (
                  <Opcion
                    icono={<FolderMinus size={15} color={INK.title} />}
                    texto="sacar de la carpeta"
                    onPress={() => mover(menu.clase, menu.item, null)}
                  />
                ) : null}
                {/* Eliminar solo aparece para notas. Un elemento del Codex es una
                    entidad del universo con relaciones colgando: borrarlo desde
                    acá, de un toque largo y sin confirmar, sería una puerta
                    trasera a una decisión que se toma en su ficha. */}
                {menu.clase === 'nota' ? (
                  <Opcion
                    icono={<Trash2 size={15} color="#B91C1C" />}
                    texto="eliminar"
                    peligro
                    onPress={() => borrarNota(menu.item)}
                  />
                ) : null}
              </>
            )}
          </Animated.View>
        </>
      ) : null}

      {nombrando ? (
        <Nombrador
          modo={nombrando.modo}
          inicial={nombrando.carpeta?.name || ''}
          topInset={topInset}
          onCancel={() => {
            Keyboard.dismiss();
            setNombrando(null);
          }}
          onConfirm={confirmarNombre}
        />
      ) : null}
    </View>
  );
}

// ─── Piezas ───────────────────────────────────────────────────────────────────

/**
 * Una carpeta en la lista. Se distingue por el lomo de color y por el `›`, no
 * por un icono de carpetita: sobre una lista de puro texto en monoespaciada, una
 * regla de 3px al borde izquierdo se lee con el rabo del ojo, y el `›` es la
 * única señal honesta de que esta fila navega en vez de abrir.
 */
function FilaCarpeta({ carpeta, resumen, atenuada, onPress, onLongPress }) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={380}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'stretch',
        gap: 11,
        paddingVertical: 13,
        opacity: atenuada ? 0.35 : pressed ? 0.55 : 1,
      })}
      accessibilityRole="button"
      accessibilityLabel={`Carpeta ${carpeta.name}, ${resumen}`}
      accessibilityHint="Mantené presionado para más acciones"
    >
      <View style={{ width: 3, backgroundColor: carpeta.color, marginTop: 2 }} />

      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ fontFamily: MONO, fontSize: 14, color: INK.title, lineHeight: 21 }}>
          {carpeta.name}
        </Text>
        <Text style={{ fontFamily: MONO, fontSize: 11, color: 'rgba(28,43,34,0.26)', marginTop: 6 }}>
          {resumen}
        </Text>
      </View>

      <Text style={{ fontFamily: MONO, fontSize: 13, color: 'rgba(28,43,34,0.22)', alignSelf: 'center' }}>
        ›
      </Text>
    </Pressable>
  );
}

/** La línea de una carpeta va un punto más marcada que la de una nota: separa
    dos cosas de distinta naturaleza, no dos renglones del mismo tipo. */
function LineaCarpeta() {
  return <View style={{ height: 1, backgroundColor: 'rgba(28,43,34,0.13)' }} />;
}

function FilaNota({ nota, atenuada, onPress, onLongPress }) {
  const lineas = String(nota.description || '').split('\n').map((l) => l.trim()).filter(Boolean);
  // La primera línea ya es el título; el resumen arranca en la segunda.
  const resumen = lineas.slice(1).join(' ');

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={380}
      style={({ pressed }) => ({
        paddingVertical: 15,
        // Con el menú abierto, el resto se apaga para que se vea sobre cuál.
        opacity: atenuada ? 0.35 : pressed ? 0.55 : 1,
      })}
      accessibilityRole="button"
      accessibilityLabel={nota.name}
      accessibilityHint="Mantené presionado para más acciones"
    >
      <Text numberOfLines={2} style={{ fontFamily: MONO, fontSize: 14, color: INK.title, lineHeight: 21 }}>
        {nota.name || 'sin título'}
      </Text>

      {resumen ? (
        <Text numberOfLines={2} style={{ fontFamily: MONO, fontSize: 12.5, color: 'rgba(28,43,34,0.42)', lineHeight: 20, marginTop: 5 }}>
          {resumen}
        </Text>
      ) : null}

      <Text style={{ fontFamily: MONO, fontSize: 11, color: 'rgba(28,43,34,0.26)', marginTop: 7 }}>
        {fecha(nota.created_at)}
      </Text>

      <View style={{ height: 1, backgroundColor: HAIRLINE, marginTop: 15 }} />
    </Pressable>
  );
}

/**
 * Un elemento del Codex en la lista.
 *
 * Lo que lo separa de una nota es el tipo escrito en su color —el mismo acento
 * que usa la taxonomía en todo el resto de la app— y no un icono ni un lomo. El
 * lomo ya significa carpeta acá, y un segundo elemento con lomo haría dudar de
 * cuál de los dos navega.
 *
 * El nombre no se corta en dos renglones como el de una nota: el de una nota es
 * la primera línea de un texto y puede ser larga; el de un actor es un nombre.
 */
function FilaItem({ item, atenuada, onPress, onLongPress }) {
  const tipo = normalizeTipo(item.tipo);
  const color = TYPE_ACCENT[tipo] || INK.faint;
  const resumen = String(item.description || '').replace(/\s+/g, ' ').trim();

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={380}
      style={({ pressed }) => ({
        paddingVertical: 15,
        opacity: atenuada ? 0.35 : pressed ? 0.55 : 1,
      })}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${tipo}`}
      accessibilityHint="Mantené presionado para más acciones"
    >
      <Text numberOfLines={1} style={{ fontFamily: MONO, fontSize: 14, color: INK.title, lineHeight: 21 }}>
        {item.name || 'sin nombre'}
      </Text>

      {resumen ? (
        <Text numberOfLines={2} style={{ fontFamily: MONO, fontSize: 12.5, color: 'rgba(28,43,34,0.42)', lineHeight: 20, marginTop: 5 }}>
          {resumen}
        </Text>
      ) : null}

      {/* El tipo va en su color y la fecha en el gris de siempre. Adentro de una
          carpeta las dos clases de fila conviven, y si esta perdiera la fecha el
          orden por fecha se leería roto justo donde importa. */}
      <Text style={{ fontFamily: MONO, fontSize: 11, marginTop: 7 }}>
        <Text style={{ color, opacity: 0.75 }}>{tipo.toLowerCase()}</Text>
        <Text style={{ color: 'rgba(28,43,34,0.26)' }}>{` · ${fecha(item.created_at)}`}</Text>
      </Text>

      <View style={{ height: 1, backgroundColor: HAIRLINE, marginTop: 15 }} />
    </Pressable>
  );
}

// ─── Texto ────────────────────────────────────────────────────────────────────

/** Junta las dos consultas del Codex sin repetir a los que caen en las dos. */
function unir(...listas) {
  const vistos = new Map();
  for (const lista of listas) {
    for (const fila of lista || []) if (!vistos.has(fila.id)) vistos.set(fila.id, fila);
  }
  return [...vistos.values()].sort(
    (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)
  );
}

/**
 * Qué tiene una carpeta. Mientras sean solo notas se cuentan como notas; en
 * cuanto hay algo del Codex adentro, decir «3 notas» sería mentir sobre lo que
 * hay, así que pasa a contar elementos.
 */
function resumen(c) {
  const notas = c?.notas || 0;
  const items = c?.items || 0;
  if (!items) return etiquetaConteo(notas);
  return etiquetaConteo(notas + items, 'elemento', 'elementos');
}

function vacio(abierta, filtro) {
  if (abierta) return 'esta carpeta está vacía.';
  if (filtro === 'carpetas') return 'todavía no hay carpetas.';
  if (filtro === 'notas') return 'todas tus notas están en carpetas.';
  if (filtro === 'codex') return 'todo lo del Codex está en carpetas.';
  return 'todavía no hay notas.';
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** «hoy» / «ayer» / «14 ago» — la fecha exacta importa poco en una nota reciente. */
function fecha(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';

  const hoy = new Date();
  const dia = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dias = Math.round((dia(hoy) - dia(d)) / 86400000);

  if (dias === 0) return 'hoy';
  if (dias === 1) return 'ayer';
  if (dias < 7) return `hace ${dias} días`;

  const base = `${d.getDate()} ${MESES[d.getMonth()]}`;
  return d.getFullYear() === hoy.getFullYear() ? base : `${base} ${d.getFullYear()}`;
}
