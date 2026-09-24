import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import {
  Check,
  Eye,
  EyeOff,
  Folder,
  FolderOpen,
  LibraryBig,
  MapPin,
  Plus,
  Search,
  Shapes,
  Spline,
  X,
} from 'lucide-react-native';
import { INK, RADIUS, SERIF } from '../theme';
import { MONO } from '../codex/mono';
import { PAPEL } from '../codex/Papel';
import { inputStyle } from '../codex/FieldInput';
import { Nombrador, Opcion } from '../codex/piezasCarpeta';
import { SIN_CARPETA } from '../../utils/carpetas';
import { roce } from '../../utils/haptics';

const AMBAR = '#B45309';
const VERDE = 'rgba(58,96,73,0.72)';

/**
 * Qué se ve en el mapa.
 *
 * **Organizado por de dónde viene, no por cómo está dibujado.** La versión
 * anterior abría con tres familias —«áreas y fronteras», «puntos»,
 * «recorridos»— que son nombres del programa: nadie abre el mapa preguntándose
 * si quiere ver polígonos. Y con los datos reales tampoco separaban nada (359
 * de 366 son polígonos y los recorridos eran cero), así que dedicaban un tercio
 * de la pantalla a una distinción que no existía.
 *
 * Ahora las preguntas son las que uno se hace de verdad, en este orden:
 *
 * 1. **De dónde viene** — todo, lo que cargué yo, lo que mencionan mis notas,
 *    lo que encontraron los posts.
 * (La escala —país, departamento, municipio— no está acá: es el botón de
 * capas sobre el mapa, que es donde se la usa.)
 *    Absorbe el selector que vivía flotando en el borde del mapa: era la misma
 *    pregunta contestada en otro lugar.
 * 3. **En qué carpeta** — la organización hecha a mano, que cruza a las otras
 *    dos.
 * 4. **Uno concreto** — buscar por nombre.
 *
 * **La lista no es lo primero que se ve.** Antes el panel abría con 366
 * renglones y había que bajar por todos para llegar a las carpetas. Ahora
 * aparece cuando se busca, o cuando hay algo oculto que conviene recordar.
 */
export default function FiltroTerritorios({
  visible,
  onClose,
  items,
  ocultos,
  onAlternarOculto,
  onMostrarTodo,
  procedencia,
  onProcedencia,
  conteos,
  cargandoMenciones,
  espacios,
  espacioFiltro,
  onEspacioFiltro,
  carpetas,
  carpetaFiltro,
  onCarpetaFiltro,
  onCrearCarpeta,
  onMoverACarpeta,
}) {
  const [texto, setTexto] = useState('');
  const [nombrandoCarpeta, setNombrandoCarpeta] = useState(false);
  const [moviendo, setMoviendo] = useState(null);

  const q = texto.trim().toLowerCase();

  const encontrados = useMemo(
    () => (q ? items.filter((t) => String(t.name || '').toLowerCase().includes(q)) : []),
    [items, q]
  );

  // Los ocultos se listan sin buscar: son los que alguien apagó y después no
  // recuerda, y es lo único que justifica abrir una lista sin haber preguntado.
  const apagados = useMemo(() => items.filter((t) => ocultos.has(t.id)), [items, ocultos]);
  const listados = q ? encontrados : apagados;

  const algoFiltrado =
    ocultos.size > 0 ||
    procedencia !== 'todo' ||
    Boolean(carpetaFiltro) ||
    Boolean(espacioFiltro);

  const restaurar = () => {
    roce();
    onCarpetaFiltro(null);
    onEspacioFiltro(null);
    onMostrarTodo();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(20,28,22,0.4)', justifyContent: 'flex-end' }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />

        <View
          style={{
            backgroundColor: PAPEL,
            borderTopLeftRadius: RADIUS.xl,
            borderTopRightRadius: RADIUS.xl,
            paddingHorizontal: 20,
            paddingTop: 16,
            paddingBottom: 28,
            maxHeight: '84%',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
            <Text style={{ fontFamily: SERIF, fontSize: 24, color: INK.title, flex: 1 }}>
              Qué se ve
            </Text>
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Cerrar">
              <X size={18} color={INK.faint} />
            </Pressable>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled">
            {/* ── De dónde viene ── */}
            <View style={{ gap: 2 }}>
              <Fuente
                clave="todo"
                Icono={Shapes}
                color={VERDE}
                texto="todo"
                cuantos={conteos.todo}
                activa={procedencia === 'todo'}
                onPress={() => onProcedencia('todo')}
              />
              <Fuente
                clave="items"
                Icono={MapPin}
                color={AMBAR}
                texto="mis lugares"
                cuantos={conteos.items}
                activa={procedencia === 'items'}
                onPress={() => onProcedencia('items')}
              />
              {/* Las dos de menciones dicen cuántas encontraron. Un cero acá no
                  es un error: significa que nada de lo escrito nombra un lugar
                  que esté en el mapa, y eso también es una respuesta. */}
              <Fuente
                clave="notas"
                Icono={Spline}
                color={VERDE}
                texto="lo que mencionan mis notas"
                cuantos={conteos.notas}
                cargando={cargandoMenciones}
                activa={procedencia === 'notas'}
                onPress={() => onProcedencia('notas')}
              />
              <Fuente
                clave="posts"
                Icono={Spline}
                color={VERDE}
                texto="lo que mencionan los posts"
                cuantos={conteos.posts}
                cargando={cargandoMenciones}
                activa={procedencia === 'posts'}
                onPress={() => onProcedencia('posts')}
              />
            </View>

            {/* Los límites no están acá: viven en el botón de capas, sobre el
              * mapa. Cambiar de escala es un gesto que se repite mirando el
              * mapa —bajar a municipios, subir a países— y abrir un panel para
              * cada paso convierte un toque en cuatro. */}

            {/* ── Espacios ──
              *
              * El caso que se está investigando. Cruza con todo lo demás: «los
              * lugares que mencionan las notas del Caso USAC» son dos filtros
              * puestos a la vez, no un modo aparte. Solo aparece si hay
              * espacios — una sección con un solo renglón que dice «Todos» es
              * ruido. */}
            {espacios.length ? (
              <View style={{ marginTop: 18, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(28,43,34,0.08)' }}>
                <Text style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: 0.08, color: INK.meta, marginBottom: 8 }}>
                  ESPACIOS
                </Text>
                <FilaCarpeta
                  Icono={LibraryBig}
                  color={INK.meta}
                  texto="Todos"
                  activa={!espacioFiltro}
                  onPress={() => {
                    roce();
                    onEspacioFiltro(null);
                  }}
                />
                {espacios.map((e) => (
                  <FilaCarpeta
                    key={e.id}
                    Icono={LibraryBig}
                    color={VERDE}
                    texto={e.name || 'sin nombre'}
                    activa={espacioFiltro === e.id}
                    onPress={() => {
                      roce();
                      onEspacioFiltro(espacioFiltro === e.id ? null : e.id);
                    }}
                  />
                ))}
              </View>
            ) : null}

            {/* ── Carpetas ──
              *
              * Cruza a las otras dos: una carpeta puede tener lugares de
              * cualquier escala y de cualquier procedencia. Selección única —
              * «todas» es el reposo, no una opción más— porque mirar dos
              * carpetas a la vez es mirar todo salvo el resto. */}
            <View style={{ marginTop: 18, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(28,43,34,0.08)' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: 0.08, color: INK.meta, flex: 1 }}>
                  {procedencia === 'notas'
                    ? 'CARPETAS DE NOTAS'
                    : procedencia === 'posts'
                      ? 'CARPETAS DE POSTS'
                      : 'CARPETAS'}
                </Text>
                {onCrearCarpeta ? (
                <Pressable
                  onPress={() => {
                    roce();
                    setNombrandoCarpeta(true);
                  }}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Nueva carpeta"
                  style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
                >
                  <Plus size={16} color={INK.meta} />
                </Pressable>
                ) : null}
              </View>

              <FilaCarpeta
                Icono={FolderOpen}
                color={INK.meta}
                texto="Todas"
                activa={!carpetaFiltro}
                onPress={() => {
                  roce();
                  onCarpetaFiltro(null);
                }}
              />
              {carpetas.map((c) => (
                <FilaCarpeta
                  key={c.id}
                  Icono={Folder}
                  color={c.color || INK.meta}
                  texto={c.name}
                  activa={carpetaFiltro === c.id}
                  onPress={() => {
                    roce();
                    onCarpetaFiltro(carpetaFiltro === c.id ? null : c.id);
                  }}
                />
              ))}
              <FilaCarpeta
                Icono={Folder}
                color={INK.faint}
                texto="Sin carpeta"
                activa={carpetaFiltro === SIN_CARPETA}
                onPress={() => {
                  roce();
                  onCarpetaFiltro(carpetaFiltro === SIN_CARPETA ? null : SIN_CARPETA);
                }}
              />
            </View>

            {/* ── Uno concreto ── */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 9,
                marginTop: 18,
                paddingTop: 14,
                borderTopWidth: 1,
                borderTopColor: 'rgba(28,43,34,0.08)',
              }}
            >
              <Search size={15} color={INK.faint} />
              <TextInput
                value={texto}
                onChangeText={setTexto}
                placeholder="buscar un lugar"
                placeholderTextColor={INK.faint}
                autoCorrect={false}
                style={[inputStyle, { flex: 1 }]}
              />
            </View>

            {/* Lo apagado, dicho en voz alta.
              *
              * El estado oculto sobrevive al cierre de la app, así que sin esto
              * alguien apaga algo un martes y el viernes le falta un lugar en
              * el mapa sin ninguna señal de por qué. */}
            {!q && apagados.length ? (
              <Text style={{ fontFamily: MONO, fontSize: 11, color: INK.meta, marginTop: 12 }}>
                {apagados.length === 1 ? '1 lugar oculto' : apagados.length + ' lugares ocultos'}
              </Text>
            ) : null}

            <View style={{ marginTop: 8 }}>
              {q && encontrados.length === 0 ? (
                <Text
                  style={{ fontFamily: MONO, fontSize: 11.5, color: INK.faint, paddingVertical: 20, textAlign: 'center' }}
                >
                  ningún lugar con ese nombre
                </Text>
              ) : null}

              {listados.map((t) => {
                const oculto = ocultos.has(t.id);
                return (
                  <View
                    key={t.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 9,
                      borderTopWidth: 1,
                      borderTopColor: 'rgba(28,43,34,0.06)',
                      opacity: oculto ? 0.45 : 1,
                    }}
                  >
                    <Pressable
                      onPress={() => {
                        roce();
                        onAlternarOculto(t.id);
                      }}
                      style={({ pressed }) => ({
                        flex: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 11,
                        paddingVertical: 11,
                        backgroundColor: pressed ? 'rgba(28,43,34,0.04)' : 'transparent',
                      })}
                    >
                      <IconoDe clase={t.clase} />
                      <Text numberOfLines={1} style={{ flex: 1, fontSize: 13.5, color: INK.title }}>
                        {t.name}
                      </Text>
                      {oculto ? <EyeOff size={15} color={INK.faint} /> : <Eye size={15} color={INK.meta} />}
                    </Pressable>

                    {/* Mover a carpeta, separado del toque que oculta: organizar
                        y esconder no compiten por el mismo gesto. En modo
                        menciones no aparece: la carpeta que se está mirando es
                        la de la nota o el post, y un lugar mencionado no se
                        archiva desde acá. */}
                    {onMoverACarpeta ? (
                    <Pressable
                      onPress={() => {
                        roce();
                        setMoviendo(t);
                      }}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={'Mover ' + t.name + ' a una carpeta'}
                      style={({ pressed }) => ({ padding: 6, opacity: pressed ? 0.5 : 1 })}
                    >
                      <Folder
                        size={15}
                        color={t.folder_id ? carpetas.find((c) => c.id === t.folder_id)?.color || INK.meta : INK.faint}
                        fill={t.folder_id ? carpetas.find((c) => c.id === t.folder_id)?.color || INK.meta : 'none'}
                        fillOpacity={t.folder_id ? 0.18 : 0}
                      />
                    </Pressable>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </ScrollView>

          {/* Solo cuando hay algo que restaurar: un botón permanente que la
              mitad de las veces no hace nada enseña a ignorarlo. */}
          {algoFiltrado ? (
            <Pressable
              onPress={restaurar}
              accessibilityRole="button"
              accessibilityLabel="Quitar los filtros y mostrar todo"
              style={({ pressed }) => ({
                marginTop: 14,
                paddingVertical: 12,
                borderRadius: RADIUS.sm,
                borderWidth: 1,
                borderColor: 'rgba(28,43,34,0.14)',
                alignItems: 'center',
                backgroundColor: pressed ? 'rgba(28,43,34,0.06)' : 'transparent',
              })}
            >
              <Text style={{ fontFamily: MONO, fontSize: 11.5, color: INK.body }}>mostrar todo</Text>
            </Pressable>
          ) : null}
        </View>

        {nombrandoCarpeta ? (
          <Nombrador
            modo="crear"
            onCancel={() => setNombrandoCarpeta(false)}
            onConfirm={async (nombre) => {
              await onCrearCarpeta(nombre);
              setNombrandoCarpeta(false);
            }}
          />
        ) : null}

        {moviendo ? (
          <Modal visible transparent animationType="fade" onRequestClose={() => setMoviendo(null)}>
            <Pressable
              style={{ flex: 1, backgroundColor: 'rgba(20,28,22,0.4)', justifyContent: 'center', padding: 32 }}
              onPress={() => setMoviendo(null)}
            >
              <View style={{ backgroundColor: PAPEL, borderRadius: RADIUS.lg, paddingVertical: 8 }}>
                <Opcion
                  texto="Sin carpeta"
                  activa={!moviendo.folder_id}
                  onPress={async () => {
                    await onMoverACarpeta(moviendo, null);
                    setMoviendo(null);
                  }}
                />
                {carpetas.map((c) => (
                  <Opcion
                    key={c.id}
                    texto={c.name}
                    color={c.color}
                    activa={moviendo.folder_id === c.id}
                    onPress={async () => {
                      await onMoverACarpeta(moviendo, c.id);
                      setMoviendo(null);
                    }}
                  />
                ))}
              </View>
            </Pressable>
          </Modal>
        ) : null}
      </View>
    </Modal>
  );
}

/** El glifo de un lugar según su forma: relleno, punto o trazo. */
function IconoDe({ clase }) {
  if (clase === 'pin') return <MapPin size={14} color={AMBAR} />;
  if (clase === 'ruta') return <Spline size={14} color={VERDE} />;
  return <Shapes size={14} color={VERDE} />;
}

/**
 * Una procedencia.
 *
 * Selección única y no interruptores: las cuatro contestan la misma pregunta y
 * prender dos a la vez no significa nada que «todo» no diga mejor.
 */
function Fuente({ Icono, color, texto, cuantos, activa, cargando, onPress }) {
  return (
    <Pressable
      onPress={() => {
        roce();
        onPress();
      }}
      accessibilityRole="radio"
      accessibilityState={{ selected: activa }}
      accessibilityLabel={texto}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 11,
        paddingVertical: 11,
        paddingHorizontal: 12,
        borderRadius: RADIUS.sm,
        backgroundColor: activa ? 'rgba(28,43,34,0.075)' : pressed ? 'rgba(28,43,34,0.04)' : 'transparent',
      })}
    >
      <Icono size={15} color={color} />
      <Text style={{ flex: 1, fontSize: 13.5, color: INK.title }}>{texto}</Text>
      <Text style={{ fontFamily: MONO, fontSize: 11, color: INK.meta }}>
        {cargando && cuantos == null ? '…' : cuantos}
      </Text>
      {activa ? <Check size={14} color={INK.title} /> : null}
    </Pressable>
  );
}


function FilaCarpeta({ Icono, color, texto, activa, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: activa }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 11,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: RADIUS.sm,
        backgroundColor: activa ? 'rgba(28,43,34,0.075)' : pressed ? 'rgba(28,43,34,0.04)' : 'transparent',
      })}
    >
      <Icono size={15} color={color} />
      <Text numberOfLines={1} style={{ flex: 1, fontSize: 13.5, color: INK.title }}>
        {texto}
      </Text>
      {activa ? <Check size={14} color={INK.title} /> : null}
    </Pressable>
  );
}
