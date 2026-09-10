import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { ChevronLeft, FolderInput, FolderMinus, FolderPlus, Pencil, Trash2 } from 'lucide-react-native';
import { INK, RADIUS } from '../theme';
import { MONO } from './mono';
import { PAPEL } from './Papel';
import { supabase } from '../../utils/supabase';
import {
  NOTA,
  crearCarpeta,
  eliminarCarpeta,
  listarCarpetas,
  moverItem,
  renombrarCarpeta,
} from '../../utils/carpetas';
import { Nombrador, Opcion, RESALTADOR, TENUE, etiquetaConteo } from './piezasCarpeta';
import { roce, toque, agarre, falla } from '../../utils/haptics';

const MENU_ANCHO = 190;
const HAIRLINE = 'rgba(28,43,34,0.07)';

// Con 57 notas en la base, 60 era un techo a punto de tocarse — y las carpetas
// lo empeoran, porque el contador «N notas» se calcula sobre lo que se bajó: si
// la lista viene cortada, una carpeta miente sobre cuánto tiene adentro.
const TECHO = 300;

const FILTROS = [
  { id: 'todo', label: 'todo' },
  { id: 'notas', label: 'notas' },
  { id: 'carpetas', label: 'carpetas' },
];

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
 * **El filtro no existe hasta que exista una carpeta.** Sin carpetas la página
 * queda exactamente como estaba: sin buscador, sin filtros, sin categorías. Que
 * la función no le cobre nada a quien no la usa es la única razón por la que se
 * puede agregar sin ensuciar una pantalla cuyo trabajo es responder «¿qué
 * escribí ayer?».
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
export default function HistorialSnippets({ onAbrir, topInset = 0, bottomInset = 0 }) {
  const { width: W, height: H } = useWindowDimensions();

  const [notas, setNotas] = useState(null); // null = cargando
  const [carpetas, setCarpetas] = useState([]);
  const [error, setError] = useState(null);

  const [filtro, setFiltro] = useState('todo');
  const [abierta, setAbierta] = useState(null); // carpeta abierta
  const [menu, setMenu] = useState(null); // { clase, item, x, y, vista }
  const [nombrando, setNombrando] = useState(null); // { modo, carpeta?, nota? }

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const [{ data, error: e }, cs] = await Promise.all([
          supabase
            .from('codex_universe_items')
            .select('id, name, tipo, description, tags, aliases, details, created_at, folder_id')
            .eq('tipo', 'Snippet')
            .order('created_at', { ascending: false })
            .limit(TECHO),
          listarCarpetas(NOTA),
        ]);
        if (e) throw e;
        if (!vivo) return;
        setNotas(data || []);
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
  }, []);

  const conteo = useMemo(() => {
    const m = new Map();
    for (const n of notas || []) {
      if (n.folder_id) m.set(n.folder_id, (m.get(n.folder_id) || 0) + 1);
    }
    return m;
  }, [notas]);

  /**
   * La lista de la raíz: carpetas y notas sueltas ordenadas por la misma fecha.
   * Una carpeta se fecha por su última actividad, no por cuándo se creó — si no,
   * una carpeta vieja que usás todos los días se hundiría hasta el fondo.
   */
  const filas = useMemo(() => {
    if (!notas) return [];

    const items = [];
    if (filtro !== 'notas') {
      for (const c of carpetas) {
        items.push({ clase: 'carpeta', item: c, cuando: c.updated_at || c.created_at });
      }
    }
    if (filtro !== 'carpetas') {
      for (const n of notas) {
        if (!n.folder_id) items.push({ clase: 'nota', item: n, cuando: n.created_at });
      }
    }

    return items.sort((a, b) => new Date(b.cuando || 0) - new Date(a.cuando || 0));
  }, [notas, carpetas, filtro]);

  const dentro = useMemo(
    () => (abierta ? (notas || []).filter((n) => n.folder_id === abierta.id) : []),
    [notas, abierta]
  );

  // ─── Acciones ───────────────────────────────────────────────────────────────

  const abrirMenu = (clase, item, ev) => {
    agarre();
    const { pageX = 0, pageY = 0 } = ev?.nativeEvent || {};
    // El menú se ancla donde estuvo el dedo, pero sin salirse de la pantalla: en
    // una fila del borde derecho o del pie quedaría medio cortado. El margen de
    // abajo contempla la vista más alta, que es la lista de carpetas.
    setMenu({
      clase,
      item,
      vista: 'acciones',
      x: Math.min(Math.max(pageX - MENU_ANCHO / 2, 14), W - MENU_ANCHO - 14),
      y: Math.min(pageY + 8, H - 300),
    });
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

  const mover = async (nota, carpetaId) => {
    setMenu(null);
    const antes = notas;
    setNotas((n) => (n || []).map((x) => (x.id === nota.id ? { ...x, folder_id: carpetaId } : x)));

    try {
      await moverItem(nota.id, carpetaId);
      toque();
    } catch {
      falla();
      setNotas(antes);
      setError('No se pudo mover la nota.');
    }
  };

  const borrarCarpeta = (carpeta) => {
    setMenu(null);
    const cuantas = conteo.get(carpeta.id) || 0;

    Alert.alert(
      `Eliminar "${carpeta.name}"`,
      cuantas > 0
        ? `Las ${cuantas} notas que tiene adentro vuelven al historial. No se borra ninguna.`
        : 'La carpeta está vacía.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            const antesC = carpetas;
            const antesN = notas;
            setCarpetas((c) => c.filter((x) => x.id !== carpeta.id));
            // La foreign key es ON DELETE SET NULL, así que en la base las notas
            // quedan sueltas solas. Acá se espeja para no tener que recargar.
            setNotas((n) => (n || []).map((x) => (x.folder_id === carpeta.id ? { ...x, folder_id: null } : x)));
            if (abierta?.id === carpeta.id) setAbierta(null);

            try {
              await eliminarCarpeta(carpeta.id);
              toque();
            } catch {
              falla();
              setCarpetas(antesC);
              setNotas(antesN);
              setError('No se pudo eliminar la carpeta.');
            }
          },
        },
      ]
    );
  };

  /**
   * Confirmar el nombre. Sirve para los tres caminos que piden uno: crear suelta,
   * crear desde una nota (que además la guarda adentro) y renombrar.
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
        if (destino.nota) await mover(destino.nota, nueva.id);
      }
      toque();
    } catch (e) {
      falla();
      setError(e.message === 'sin permiso' ? 'No tenés permiso para eso.' : 'No se pudo guardar la carpeta.');
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  const lista = abierta ? dentro.map((n) => ({ clase: 'nota', item: n })) : filas;
  const hayCarpetas = carpetas.length > 0;

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
              {etiquetaConteo(dentro.length)}
            </Text>
          </Pressable>
        ) : (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: hayCarpetas ? 18 : 26,
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

        {/* Sin carpetas no hay nada que filtrar, y una fila de filtros sobre una
            lista de notas sueltas es ruido que no resuelve nada. */}
        {!abierta && hayCarpetas ? (
          <Animated.View
            entering={FadeIn.duration(200)}
            style={{ flexDirection: 'row', gap: 14, marginBottom: 20 }}
          >
            {FILTROS.map((f) => {
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
            {error || vacio(abierta, filtro)}
          </Text>
        ) : (
          <>
            {error ? (
              <Text style={{ fontFamily: MONO, fontSize: 12, color: '#B91C1C', lineHeight: 19, marginBottom: 16 }}>
                {error}
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
                      cuantas={conteo.get(f.item.id) || 0}
                      atenuada={!!menu && menu.item.id !== f.item.id}
                      onPress={() => {
                        roce();
                        setAbierta(f.item);
                      }}
                      onLongPress={(ev) => abrirMenu('carpeta', f.item, ev)}
                    />
                    <LineaCarpeta />
                  </>
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
                    const nota = menu.item;
                    setMenu(null);
                    setNombrando({ modo: 'crear', nota });
                  }}
                />
                {carpetas
                  .filter((c) => c.id !== menu.item.folder_id)
                  .map((c) => (
                    <Opcion
                      key={c.id}
                      lomo={c.color}
                      texto={c.name}
                      onPress={() => mover(menu.item, c.id)}
                    />
                  ))}
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
                {menu.item.folder_id ? (
                  <Opcion
                    icono={<FolderMinus size={15} color={INK.title} />}
                    texto="sacar de la carpeta"
                    onPress={() => mover(menu.item, null)}
                  />
                ) : null}
                <Opcion
                  icono={<Trash2 size={15} color="#B91C1C" />}
                  texto="eliminar"
                  peligro
                  onPress={() => borrarNota(menu.item)}
                />
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
function FilaCarpeta({ carpeta, cuantas, atenuada, onPress, onLongPress }) {
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
      accessibilityLabel={`Carpeta ${carpeta.name}, ${etiquetaConteo(cuantas)}`}
      accessibilityHint="Mantené presionado para más acciones"
    >
      <View style={{ width: 3, backgroundColor: carpeta.color, marginTop: 2 }} />

      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ fontFamily: MONO, fontSize: 14, color: INK.title, lineHeight: 21 }}>
          {carpeta.name}
        </Text>
        <Text style={{ fontFamily: MONO, fontSize: 11, color: 'rgba(28,43,34,0.26)', marginTop: 6 }}>
          {etiquetaConteo(cuantas)}
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

// ─── Texto ────────────────────────────────────────────────────────────────────

function vacio(abierta, filtro) {
  if (abierta) return 'esta carpeta está vacía.';
  if (filtro === 'carpetas') return 'todavía no hay carpetas.';
  if (filtro === 'notas') return 'todas tus notas están en carpetas.';
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
