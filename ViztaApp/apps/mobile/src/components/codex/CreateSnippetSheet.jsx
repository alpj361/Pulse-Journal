import { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Keyboard,
  Alert,
  Platform,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedKeyboard,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { X, Plus } from 'lucide-react-native';
import { INK, MOTION } from '../theme';
import MorphingInfinity from '../MorphingInfinity';
import { PAPEL } from './Papel';
import { MONO } from './mono';
import { TYPE_ACCENT, normalizeTipo } from './tipos';
import { segmentar } from './menciones';
import useIndiceCodex from './useIndiceCodex';
import useItemsHidratados from './useItemsHidratados';
import HistorialSnippets from './HistorialSnippets';
import PanelSnippet from './PanelSnippet';
import ItemDetailSheet from './ItemDetailSheet';
import { toque, roce } from '../../utils/haptics';
import { EV, evento } from '../../utils/analitica';
import { supabase } from '../../utils/supabase';

// Las tres páginas. La nota va al medio para que las otras dos estén a un
// deslizamiento de distancia en cualquier dirección, y para que abrir la hoja
// caiga siempre en el lugar donde se escribe.
const HISTORIAL = 0;
const NOTA = 1;
const PANEL = 2;

/**
 * Escribir un fragmento.
 *
 * Un Snippet no se llena: se escribe. Así que esto no es una hoja con campos, es
 * una superficie de escritura — pantalla completa, papel, monoespaciada y mucho
 * aire.
 *
 * Alrededor de esa hoja hay dos páginas más, a un deslizamiento:
 *
 *  · **izquierda, el historial** — qué escribiste antes.
 *  · **derecha, el panel** — a quién nombraste, y los datos de la nota.
 *
 * Las tres viven en un ScrollView horizontal con `pagingEnabled` y no en una
 * librería de pestañas. Con tres páginas fijas, una librería solo agregaría una
 * dependencia y una barra de pestañas que le comería aire a la hoja. El costo
 * de esta decisión es que el gesto es invisible, y por eso abajo hay tres
 * puntos: son lo único que delata que la nota no está sola.
 *
 * Una nota sobre la referencia original: ahí el texto va centrado, y acá no.
 * Centrado se ve precioso en una carta estática, pero al escribir el cursor
 * salta de lugar con cada tecla y se pierde el renglón. Lo que da la sensación
 * de carta no es la centradura sino la medida angosta, el interlineado alto y la
 * monoespaciada — eso sí está.
 *
 * Se guarda como los Snippets que ya existen en la base: el cuerpo va en
 * `description` —con su markdown si lo trae— y el título en `name`. El preset
 * nominal pone el cuerpo en `details.Contenido`, pero ningún registro real lo
 * usa así, y romper esa consistencia dejaría los fragmentos del teléfono
 * invisibles para lo que ya lee la web.
 */
export default function CreateSnippetSheet({ onClose, onCreated, bottomInset = 0, topInset = 0 }) {
  const { width: W } = useWindowDimensions();

  const [titulo, setTitulo] = useState('');
  const [cuerpo, setCuerpo] = useState('');
  const [fuente, setFuente] = useState('');
  const [tags, setTags] = useState('');
  const [fecha, setFecha] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const [pagina, setPagina] = useState(NOTA);

  // Cuál nota del historial se está editando. `null` = nota nueva.
  // De esto depende que guardar actualice en vez de crear un duplicado.
  const [editandoId, setEditandoId] = useState(null);

  /**
   * Leyendo una nota ya escrita, en vez de escribiendo una nueva.
   *
   * Una nota nueva abre el teclado sola: no hay nada que leer y lo único que se
   * puede hacer es escribir. Una nota existente es al revés — lo primero que uno
   * hace es leerla — y ahí el teclado tapa media pantalla, empuja el texto y
   * obliga a bajarlo a mano cada vez que se toca algo. Es lo mismo que hacen las
   * notas de iOS: se abre en lectura, y el teclado aparece recién cuando tocás
   * el texto para escribir.
   */
  const [leyendo, setLeyendo] = useState(false);

  // Item abierto encima de la hoja: puede ser una nota del historial, un
  // mencionado, o uno nuevo a partir del texto seleccionado.
  const [itemAbierto, setItemAbierto] = useState(null);

  const campo = useRef(null);
  const pager = useRef(null);

  // Menciones del Codex: se pintan los nombres de tus items mientras escribís.
  // El índice puede llegar vacío (sin sesión, o si falla la carga); en ese caso
  // `segmentar` devuelve un solo tramo sin color y la nota funciona igual.
  const { indice, refrescar } = useIndiceCodex();
  const tramos = useMemo(() => segmentar(cuerpo, indice), [cuerpo, indice]);

  // Los mencionados, sin repetir: nombrar a alguien tres veces en la nota no
  // son tres chips.
  const mencionadosCrudos = useMemo(() => {
    const vistos = new Map();
    for (const t of tramos) if (t.item && !vistos.has(t.item.id)) vistos.set(t.item.id, t.item);
    return [...vistos.values()];
  }, [tramos]);

  // El índice viene recortado (solo lo necesario para reconocer nombres). Para
  // mostrar la foto en el chip y para abrir la ficha con sus datos hay que
  // pedir la fila entera de esos pocos items.
  const { items: mencionados, actualizar } = useItemsHidratados(mencionadosCrudos);

  /**
   * El item que ve la ficha: la copia del toque, completada con lo que haya
   * llegado después.
   *
   * `setItemAbierto(item)` congela el objeto tal como estaba al tocar el chip.
   * La hidratación es asíncrona, así que tocar apenas aparece el chip guardaba
   * la versión del índice —id, nombre, tipo y alias— y la ficha se quedaba con
   * ella: sin `geo`, mostrando «sin ubicación» para un municipio que tiene su
   * polígono oficial cargado.
   *
   * **Se fusiona en vez de reemplazar.** Tomar la versión de la lista tal cual
   * parece equivalente y no lo es: si por lo que sea la lista devolviera una
   * versión recortada, la ficha abierta se vaciaría de golpe. Al fusionar, las
   * claves que la recortada no trae —`geo`, `description`, `details`— quedan
   * las de la copia previa, así que este merge solo puede agregar información,
   * nunca quitarla.
   */
  const itemVivo = itemAbierto?._nuevo
    ? itemAbierto
    : { ...itemAbierto, ...(mencionados.find((m) => m.id === itemAbierto?.id) || {}) };

  // Selección de texto, para poder crear un item con ella.
  //
  // Se **retiene** la última selección real en vez de leerla en vivo. Sin esto
  // el botón desaparecía justo cuando ibas a tocarlo: cualquier toque fuera del
  // texto colapsa la selección, `onSelectionChange` avisa, y el botón se
  // desmontaba abajo del dedo. Retenida, el botón sigue ahí hasta que escribas
  // otra cosa — que es el único momento en que la selección vieja deja de
  // significar algo.
  const [seleccion, setSeleccion] = useState({ start: 0, end: 0 });
  const [seleccionado, setSeleccionado] = useState('');

  const alSeleccionar = useCallback(
    (e) => {
      const sel = e.nativeEvent.selection;
      setSeleccion(sel);
      const texto = cuerpo.slice(sel.start, sel.end).trim();
      if (texto.length >= 2) setSeleccionado(texto);
    },
    [cuerpo]
  );

  const escribir = useCallback((t) => {
    setCuerpo(t);
    // Al escribir, lo seleccionado antes ya no aplica.
    setSeleccionado('');
  }, []);

  // El título se deduce del cuerpo mientras no se escriba uno propio.
  const [tituloTocado, setTituloTocado] = useState(false);
  const tituloEfectivo = tituloTocado
    ? titulo
    : (cuerpo.split('\n').find((l) => l.trim()) || '').replace(/^#+\s*/, '').slice(0, 70);

  const puedeGuardar = cuerpo.trim().length > 0 && tituloEfectivo.trim().length > 0;

  // El teclado tapaba todo lo anclado abajo: los tres puntos desaparecían y el
  // botón de crear quedaba debajo. `KeyboardAvoidingView` no lo resuelve —
  // achica el contenido, pero los hijos absolutos se siguen posicionando contra
  // el borde de la pantalla. Se sube a mano con la altura real del teclado, que
  // Reanimated expone en el hilo de UI para que acompañe la animación de subida
  // en vez de saltar cuando termina.
  const teclado = useAnimatedKeyboard();
  const sobreTeclado = useAnimatedStyle(() => {
    const alto = teclado.height.value;
    // La altura del teclado ya incluye el área segura de abajo; sin restarla,
    // la barra quedaría flotando ese tanto de más.
    return { transform: [{ translateY: alto > 0 ? -(alto - bottomInset) : 0 }] };
  });

  const irA = useCallback(
    (p) => {
      Keyboard.dismiss();
      pager.current?.scrollTo({ x: p * W, animated: true });
    },
    [W]
  );

  /**
   * Abrir una nota del historial **en la hoja**, no en la ficha del Codex.
   *
   * Antes esto abría `ItemDetailSheet`: la ficha de campos, tipos de dato y
   * relaciones. Para un Snippet eso es la vista equivocada — un fragmento no
   * tiene campos, es un texto que se lee y se sigue escribiendo. Ahora la nota
   * se carga en la misma superficie donde se escribió y la hoja se desliza
   * hasta ella.
   */
  const abrirNota = useCallback(
    (nota) => {
      const cargar = () => {
        setCuerpo(nota.description || '');
        // El nombre guardado manda sobre la primera línea: si alguien le puso
        // un título propio, deducirlo de nuevo se lo pisaría.
        setTitulo(nota.name || '');
        setTituloTocado(true);
        setFuente(nota.details?.Fuente || '');
        setFecha(nota.details?.['Fecha de captura'] || '');
        setTags(Array.isArray(nota.tags) ? nota.tags.join(', ') : '');
        setSeleccionado('');
        setEditandoId(nota.id);
        setLeyendo(true);
        irA(NOTA);
        // `Keyboard.dismiss()` baja el teclado pero deja el campo enfocado, así
        // que el primer toque en cualquier parte lo devolvía. Hay que soltar el
        // foco de verdad.
        campo.current?.blur();
      };

      // Cargar encima de un borrador sin guardar lo borraría sin aviso.
      if (!editandoId && cuerpo.trim().length > 0) {
        Alert.alert(
          'Tenés una nota sin guardar',
          'Si abrís esta, se pierde lo que escribiste.',
          [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Descartar y abrir', style: 'destructive', onPress: cargar },
          ]
        );
        return;
      }
      cargar();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cuerpo, editandoId]
  );


  const guardar = async () => {
    if (!puedeGuardar) return;
    setGuardando(true);
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      if (!userId) throw new Error('Sin sesión activa');

      const details = {};
      if (fuente.trim()) details['Fuente'] = fuente.trim();
      if (fecha.trim()) details['Fecha de captura'] = fecha.trim();

      const etiquetas = tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const campos = {
        tipo: 'Snippet',
        name: tituloEfectivo.trim(),
        description: cuerpo.trim(),
        ...(etiquetas.length ? { tags: etiquetas } : {}),
        details,
      };
      const columnas = 'id, name, tipo, description, tags, aliases, details, created_at';

      // Editar una nota existente **actualiza**; si no, cada vez que abrieras
      // una del historial y tocaras guardar aparecería una copia nueva.
      const { data, error: insertError } = editandoId
        ? await supabase
            .from('codex_universe_items')
            .update(campos)
            .eq('id', editandoId)
            .select(columnas)
            .single()
        : await supabase
            .from('codex_universe_items')
            .insert({ user_id: userId, ...campos })
            .select(columnas)
            .single();

      if (insertError) throw insertError;
      // Se manda el tamaño y la cantidad de menciones, nunca el texto.
      evento(EV.NOTA_GUARDADA, {
        editada: !!editandoId,
        caracteres: cuerpo.trim().length,
        menciones: mencionados.length,
        con_detalles: !!(fuente.trim() || tags.trim() || fecha.trim()),
      });
      toque();
      onCreated?.(data);
      onClose();
    } catch (e) {
      setError(e.message || 'No se pudo guardar');
      setGuardando(false);
    }
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: PAPEL }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          {/* Barra mínima, compartida por las tres páginas. Guardar aparece
              solo cuando hay algo que guardar: un botón permanentemente
              apagado es ruido que nunca sirve. */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingTop: topInset + 12,
              paddingHorizontal: 18,
              paddingBottom: 4,
              zIndex: 2,
            }}
          >
            <Pressable
              onPress={() => {
                // Distingue cerrar con algo escrito de cerrar en blanco: lo
                // primero es abandonar una nota, lo segundo es solo salir.
                evento(EV.NOTA_DESCARTADA, { tenia_texto: cuerpo.trim().length > 0 });
                onClose();
              }}
              hitSlop={12}
              style={{ padding: 6 }}
            >
              <X size={19} color={INK.faint} />
            </Pressable>
            <View style={{ flex: 1 }} />
            {puedeGuardar ? (
              <Animated.View entering={FadeIn.duration(200)}>
                <Pressable onPress={guardar} disabled={guardando} hitSlop={12} style={{ padding: 6 }}>
                  {guardando ? (
                    <MorphingInfinity size={18} color={INK.title} />
                  ) : (
                    <Text style={{ fontFamily: MONO, fontSize: 14, color: INK.title, letterSpacing: -0.2 }}>
                      guardar
                    </Text>
                  )}
                </Pressable>
              </Animated.View>
            ) : null}
          </View>

          <ScrollView
            ref={pager}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentOffset={{ x: W, y: 0 }} // arranca en la nota
            onMomentumScrollEnd={(e) => {
              const p = Math.round(e.nativeEvent.contentOffset.x / W);
              if (p !== pagina) {
                setPagina(p);
                roce();
                evento(EV.NOTA_PAGINA_VISTA, {
                  pagina: p === HISTORIAL ? 'historial' : p === PANEL ? 'panel' : 'nota',
                });
              }
            }}
            style={{ flex: 1, marginTop: -46 }}
          >
            <View style={{ width: W }}>
              <HistorialSnippets
                topInset={topInset}
                bottomInset={bottomInset}
                onAbrir={abrirNota}
              />
            </View>

            <View style={{ width: W }}>
              <Nota
                campo={campo}
                tramos={tramos}
                onChangeText={escribir}
                onSelectionChange={alSeleccionar}
                topInset={topInset}
                bottomInset={bottomInset}
                error={error}
                leyendo={leyendo}
                onEscribir={() => setLeyendo(false)}
              />
            </View>

            <View style={{ width: W }}>
              <PanelSnippet
                items={mencionados}
                onAbrirItem={(item) => {
            evento(EV.MENCION_TOCADA, { tipo: item?.tipo || null });
            setItemAbierto(item);
          }}
                titulo={tituloTocado ? titulo : tituloEfectivo}
                tituloPlaceholder={tituloEfectivo}
                onTitulo={(t) => {
                  setTituloTocado(true);
                  setTitulo(t);
                }}
                fuente={fuente}
                onFuente={setFuente}
                tags={tags}
                onTags={setTags}
                fecha={fecha}
                onFecha={setFecha}
                topInset={topInset}
                bottomInset={bottomInset}
              />
            </View>
          </ScrollView>

          {/* Crear un item con lo que seleccionaste. Aparece solo mientras hay
              selección y solo en la nota — en las otras páginas no hay texto
              del que sacarlo. Va abajo y no arriba para no pelearse con el menú
              de copiar/pegar que iOS pone sobre la selección. */}
          {/* Barra de abajo: o el botón de crear, o los puntos. Una sola capa
              que sube con el teclado, para que ninguno de los dos quede tapado. */}
          <Animated.View
            pointerEvents="box-none"
            style={[
              { position: 'absolute', left: 0, right: 0, bottom: bottomInset + 16, alignItems: 'center' },
              sobreTeclado,
            ]}
          >
          {pagina === NOTA && seleccionado.length >= 2 ? (
            <Animated.View entering={FadeInDown.duration(220).springify().damping(20)}>
              <Pressable
                onPress={() => {
                  roce();
                  Keyboard.dismiss();
                  evento(EV.ITEM_CREADO_DESDE_SELECCION, { largo: seleccionado.length });
                  setItemAbierto({ _nuevo: true, tipo: 'Actor', name: seleccionado, description: '', details: {} });
                }}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 7,
                  paddingHorizontal: 15,
                  paddingVertical: 10,
                  borderRadius: 999,
                  backgroundColor: INK.title,
                  opacity: pressed ? 0.8 : 1,
                })}
                accessibilityRole="button"
                accessibilityLabel={`Crear item del Codex con «${seleccionado}»`}
              >
                <Plus size={14} color={PAPEL} />
                <Text numberOfLines={1} style={{ fontFamily: MONO, fontSize: 12.5, color: PAPEL, maxWidth: 230 }}>
                  crear «{seleccionado}»
                </Text>
              </Pressable>
            </Animated.View>
          ) : (
            <Puntos actual={pagina} onIr={irA} />
          )}
          </Animated.View>
        </KeyboardAvoidingView>
      </View>

      {/* Ficha del Codex encima de la hoja: una nota del historial, un
          mencionado, o uno nuevo salido de la selección. */}
      {itemAbierto ? (
        <ItemDetailSheet
          item={itemVivo}
          creando={!!itemAbierto._nuevo}
          onClose={() => setItemAbierto(null)}
          onSaved={(guardado) => {
            // El item nuevo tiene que pintarse en la nota en el acto; si no, el
            // nombre se queda en negro hasta cerrar y volver a abrir la hoja.
            refrescar();
            // Y el editado se deja en el cache con lo recién guardado. Ver
            // `actualizar`: borrarlo para forzar la relectura dejaba una ventana
            // en la que el chip volvía a estar recortado.
            actualizar(guardado);
            setItemAbierto(null);
          }}
          bottomInset={bottomInset}
        />
      ) : null}
    </Modal>
  );
}

/**
 * La hoja.
 *
 * El texto va como hijos y no como `value`. Es la única forma de pintar tramos
 * sueltos adentro de un TextInput en React Native: `value` acepta una cadena, y
 * una cadena no lleva color por pedazos. Con hijos, cada mención es su propio
 * <Text> con su color, y el resto sigue siendo texto normal — todo dentro del
 * mismo campo editable, sin capas superpuestas que se desalineen al scrollear.
 */
function Nota({ campo, tramos, onChangeText, onSelectionChange, topInset, bottomInset, error, leyendo, onEscribir }) {
  return (
    <ScrollView
      contentContainerStyle={{ flexGrow: 1, paddingTop: topInset + 66, paddingBottom: bottomInset + 70 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
    >
      {/* Medida angosta y centrada en la pantalla; el texto, a la izquierda
          dentro de la columna. */}
      <View style={{ flex: 1, alignSelf: 'center', width: '100%', maxWidth: 420, paddingHorizontal: 30 }}>
        {/* Toda la zona vacía enfoca el campo: la página entera se siente
            escribible, no solo el renglón donde está el cursor. Leyendo una nota
            existente, el mismo toque es el que pasa a escribir — igual que en
            las notas de iOS, donde tocar el texto pone el cursor. */}
        <Pressable
          onPress={() => {
            onEscribir?.();
            campo.current?.focus();
          }}
          style={{ flex: 1 }}
        >
          <TextInput
            ref={campo}
            onChangeText={onChangeText}
            onSelectionChange={onSelectionChange}
            placeholder="escribí lo que quieras…"
            placeholderTextColor="rgba(28,43,34,0.22)"
            multiline
            // Solo la nota nueva abre el teclado sola. `autoFocus` corre una vez
            // al montar, y en ese momento la hoja siempre arranca en nota nueva:
            // las del historial se cargan después, y de esas se encarga `leyendo`.
            autoFocus={!leyendo}
            scrollEnabled={false}
            style={{
              fontFamily: MONO,
              fontSize: 15,
              lineHeight: 27,
              color: INK.title,
              minHeight: 260,
              textAlignVertical: 'top',
              padding: 0,
            }}
          >
            {tramos.map((t, i) =>
              t.item ? (
                <Text key={i} style={{ color: colorDe(t.item) }}>
                  {t.texto}
                </Text>
              ) : (
                t.texto
              )
            )}
          </TextInput>
        </Pressable>

        {error ? (
          <Animated.View entering={FadeIn.duration(200)} style={{ marginTop: 22 }}>
            <Text style={{ fontFamily: MONO, fontSize: 12.5, color: '#B91C1C', lineHeight: 19 }}>{error}</Text>
          </Animated.View>
        ) : null}
      </View>
    </ScrollView>
  );
}

/**
 * Tres puntos.
 *
 * El deslizamiento lateral no se ve, y una hoja en blanco no da ninguna pista
 * de que tiene páginas al lado. Estos puntos son esa pista — y además son
 * tocables, que es la salida para quien nunca prueba deslizar.
 */
function Puntos({ actual, onIr }) {
  return (
    <View
      pointerEvents="box-none"
      style={{ flexDirection: 'row', justifyContent: 'center', gap: 7 }}
    >
      {[HISTORIAL, NOTA, PANEL].map((p) => (
        <Punto key={p} activo={p === actual} onPress={() => onIr(p)} />
      ))}
    </View>
  );
}

function Punto({ activo, onPress }) {
  const animado = useAnimatedStyle(() => ({
    width: withSpring(activo ? 15 : 5, MOTION.tap),
    opacity: withTiming(activo ? 0.42 : 0.16, { duration: 220 }),
  }));

  return (
    <Pressable onPress={onPress} hitSlop={14} accessibilityRole="button">
      <Animated.View style={[{ height: 5, borderRadius: 3, backgroundColor: INK.title }, animado]} />
    </Pressable>
  );
}

/**
 * Color de una mención.
 *
 * Sale de `TYPE_ACCENT`, la misma paleta con la que el Codex ya distingue sus
 * tipos: un Actor se ve del mismo color acá que en su ficha. Inventar una
 * paleta nueva solo para la nota habría hecho que el mismo item tenga dos
 * colores según dónde lo mires.
 */
function colorDe(item) {
  return TYPE_ACCENT[normalizeTipo(item?.tipo)] || '#4B4FA6';
}
