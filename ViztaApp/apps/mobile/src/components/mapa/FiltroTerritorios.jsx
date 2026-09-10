import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import {
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  Folder,
  FolderOpen,
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
 * Qué territorios se ven.
 *
 * **Absorbe los filtros que ya existían.** El nivel administrativo, y dos
 * interruptores flotantes —pines y rutas— que vivían apilados en la esquina.
 * Tres controles que respondían la misma pregunta, «qué estoy viendo»,
 * repartidos por la pantalla. Acá está junta, y ahora en tres escalas:
 *
 * 1. **Familia** — áreas, puntos, recorridos. Cómo se piensa el mapa cuando hay
 *    demasiado encima.
 * 2. **Subtipo** — dentro de cada familia, por el rol geográfico real o el tipo
 *    del item: una «Frontera» no es un «Área» aunque las dos sean polígonos, y
 *    un «Lugar» de Apple Places no es un Actor aunque las dos sean un punto.
 * 3. **Carpeta** — la organización que la persona armó a mano, ortogonal a las
 *    otras dos: una carpeta puede tener áreas y puntos mezclados a propósito.
 * 4. **Uno por uno** — para cuando el problema es un territorio concreto.
 *
 * **Una clase apagada apaga lo suyo sin olvidarlo.** El estado individual se
 * conserva debajo: volver a prender «áreas» devuelve exactamente lo que estaba
 * visible antes, no todo.
 */
export default function FiltroTerritorios({
  visible,
  onClose,
  areas,
  pines,
  recorridos,
  ocultos,
  clases,
  onAlternarOculto,
  onOcultarLote,
  onAlternarClase,
  onMostrarTodo,
  carpetas,
  carpetaFiltro,
  onCarpetaFiltro,
  onCrearCarpeta,
  onMoverACarpeta,
}) {
  const [texto, setTexto] = useState('');
  const [expandida, setExpandida] = useState(null);
  const [nombrandoCarpeta, setNombrandoCarpeta] = useState(false);
  const [moviendo, setMoviendo] = useState(null); // el territorio que está eligiendo carpeta

  const todos = useMemo(() => {
    const marca = (lista, clase) => lista.map((t) => ({ ...t, _clase: clase }));
    return [...marca(areas, 'area'), ...marca(pines, 'pin'), ...marca(recorridos, 'ruta')];
  }, [areas, pines, recorridos]);

  const filtrados = useMemo(() => {
    const q = texto.trim().toLowerCase();
    if (!q) return todos;
    return todos.filter((t) => String(t.name || '').toLowerCase().includes(q));
  }, [todos, texto]);

  const cuantosOcultos = ocultos.size;
  const algoApagado =
    cuantosOcultos > 0 || !clases.area || !clases.pin || !clases.ruta || Boolean(carpetaFiltro);

  const restaurar = () => {
    roce();
    onCarpetaFiltro(null);
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
            {/* ── Las familias, cada una expandible por subtipo ── */}
            <View style={{ gap: 2 }}>
              <FilaClase
                clave="area"
                Icono={Shapes}
                color={VERDE}
                texto="áreas y fronteras"
                cuantos={areas.length}
                activo={clases.area}
                expandida={expandida === 'area'}
                onPress={() => onAlternarClase('area')}
                onExpandir={() => setExpandida((e) => (e === 'area' ? null : 'area'))}
              >
                <Subgrupos
                  items={areas}
                  ocultos={ocultos}
                  claseActiva={clases.area}
                  etiquetaDe={etiquetaDeArea}
                  onOcultarLote={onOcultarLote}
                />
              </FilaClase>

              <FilaClase
                clave="pin"
                Icono={MapPin}
                color={AMBAR}
                texto="puntos"
                cuantos={pines.length}
                activo={clases.pin}
                expandida={expandida === 'pin'}
                onPress={() => onAlternarClase('pin')}
                onExpandir={() => setExpandida((e) => (e === 'pin' ? null : 'pin'))}
              >
                <Subgrupos
                  items={pines}
                  ocultos={ocultos}
                  claseActiva={clases.pin}
                  etiquetaDe={etiquetaDePunto}
                  onOcultarLote={onOcultarLote}
                />
              </FilaClase>

              <FilaClase
                clave="ruta"
                Icono={Spline}
                color={VERDE}
                texto="recorridos"
                cuantos={recorridos.length}
                activo={clases.ruta}
                expandida={expandida === 'ruta'}
                onPress={() => onAlternarClase('ruta')}
                onExpandir={() => setExpandida((e) => (e === 'ruta' ? null : 'ruta'))}
              >
                <Subgrupos
                  items={recorridos}
                  ocultos={ocultos}
                  claseActiva={clases.ruta}
                  etiquetaDe={(r) => r.itemTipo || 'Recorrido'}
                  onOcultarLote={onOcultarLote}
                />
              </FilaClase>
            </View>

            {/* ── Carpetas ──
              *
              * Ortogonal a la familia: una carpeta filtra sin importar si lo
              * de adentro es un área, un punto o un recorrido. Selección
              * única —«todas» es el estado de reposo, no una opción más—
              * porque mirar dos carpetas a la vez es mirar todo salvo el
              * resto, que rara vez es lo que alguien quiere. */}
            <View style={{ marginTop: 18, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(28,43,34,0.08)' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: 0.08, color: INK.meta, flex: 1 }}>
                  CARPETAS
                </Text>
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

            {/* ── Uno por uno ── */}
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
                placeholder="buscar un territorio"
                placeholderTextColor={INK.faint}
                autoCorrect={false}
                style={[inputStyle, { flex: 1 }]}
              />
            </View>

            <View style={{ marginTop: 8 }}>
              {filtrados.length === 0 ? (
                <Text
                  style={{ fontFamily: MONO, fontSize: 11.5, color: INK.faint, paddingVertical: 20, textAlign: 'center' }}
                >
                  {texto.trim() ? 'ningún territorio con ese nombre' : 'todavía no hay territorios'}
                </Text>
              ) : null}

              {filtrados.map((t) => {
                const oculto = ocultos.has(t.id);
                // Una clase apagada arrastra a los suyos: la fila se ve inerte
                // porque tocarla no cambiaría nada mientras la familia esté
                // apagada, y un control que no hace nada debe parecerlo.
                const porClase = !clases[t._clase];
                return (
                  <View
                    key={`${t._clase}-${t.id}`}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 9,
                      borderTopWidth: 1,
                      borderTopColor: 'rgba(28,43,34,0.06)',
                      opacity: porClase ? 0.3 : oculto ? 0.45 : 1,
                    }}
                  >
                    <Pressable
                      onPress={() => {
                        if (porClase) return;
                        roce();
                        onAlternarOculto(t.id);
                      }}
                      disabled={porClase}
                      style={({ pressed }) => ({
                        flex: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 11,
                        paddingVertical: 11,
                        backgroundColor: pressed ? 'rgba(28,43,34,0.04)' : 'transparent',
                      })}
                    >
                      <IconoDe clase={t._clase} />
                      <Text numberOfLines={1} style={{ flex: 1, fontSize: 13.5, color: INK.title }}>
                        {t.name}
                      </Text>
                      {oculto ? <EyeOff size={15} color={INK.faint} /> : <Eye size={15} color={INK.meta} />}
                    </Pressable>

                    {/* Mover a carpeta. Separado del toque principal —que
                        alterna visibilidad— para que organizar y ocultar no
                        compitan por el mismo gesto. */}
                    <Pressable
                      onPress={() => {
                        roce();
                        setMoviendo(t);
                      }}
                      disabled={porClase}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={`Mover ${t.name} a una carpeta`}
                      style={({ pressed }) => ({ padding: 6, opacity: pressed ? 0.5 : 1 })}
                    >
                      <Folder
                        size={15}
                        color={t.folder_id ? carpetas.find((c) => c.id === t.folder_id)?.color || INK.meta : INK.faint}
                        fill={t.folder_id ? (carpetas.find((c) => c.id === t.folder_id)?.color || INK.meta) : 'none'}
                        fillOpacity={t.folder_id ? 0.18 : 0}
                      />
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </ScrollView>

          {/* Solo cuando hay algo que restaurar: un botón permanente que la
              mitad de las veces no hace nada enseña a ignorarlo. */}
          {algoApagado ? (
            <Pressable
              onPress={restaurar}
              accessibilityRole="button"
              accessibilityLabel="Mostrar todos los territorios"
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

        {/* Nombrar una carpeta nueva. Ancla arriba, como en notas y posts: el
            teclado sube apenas se abre. */}
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

        {/* Elegir carpeta para un territorio puntual. Un menú chico, no un
            modal nuevo: es una decisión de un toque, no una pantalla. */}
        {moviendo ? (
          <Modal visible transparent animationType="fade" onRequestClose={() => setMoviendo(null)}>
            <Pressable
              style={{ flex: 1, backgroundColor: 'rgba(20,28,22,0.4)', justifyContent: 'center', padding: 32 }}
              onPress={() => setMoviendo(null)}
            >
              <Pressable
                onPress={() => {}}
                style={{ backgroundColor: PAPEL, borderRadius: RADIUS.md, overflow: 'hidden' }}
              >
                <Text
                  numberOfLines={1}
                  style={{ fontFamily: MONO, fontSize: 11, color: INK.meta, padding: 14, paddingBottom: 8 }}
                >
                  MOVER «{moviendo.name}»
                </Text>
                <Opcion
                  texto="Sin carpeta"
                  onPress={async () => {
                    setMoviendo(null);
                    await onMoverACarpeta(moviendo.id, null);
                  }}
                />
                {carpetas.map((c) => (
                  <Opcion
                    key={c.id}
                    lomo={c.color}
                    texto={c.name}
                    icono={moviendo.folder_id === c.id ? <Check size={15} color={INK.title} /> : null}
                    onPress={async () => {
                      setMoviendo(null);
                      await onMoverACarpeta(moviendo.id, c.id);
                    }}
                  />
                ))}
              </Pressable>
            </Pressable>
          </Modal>
        ) : null}
      </View>
    </Modal>
  );
}

/** El subtipo real de un área: por lo que es, no por cómo se dibuja. */
function etiquetaDeArea(a) {
  if (a.rol === 'frontier') return 'Frontera';
  if (a.rol === 'area') return 'Área';
  return 'Otra forma';
}

/** El subtipo real de un punto: un lugar de Apple Places no es un Actor,
 *  aunque en el mapa los dos sean el mismo círculo ámbar. */
function etiquetaDePunto(p) {
  if (p.original?.geo?.lugar) return 'Lugar';
  return p.itemTipo || 'Punto';
}

/**
 * Los subtipos de una familia, cada uno con su propio ojo.
 *
 * Se calculan de los datos, no de una lista fija: si mañana aparece un octavo
 * tipo de item con ubicación, entra solo, sin tocar este archivo.
 */
function Subgrupos({ items, ocultos, claseActiva, etiquetaDe, onOcultarLote }) {
  const grupos = useMemo(() => {
    const porEtiqueta = new Map();
    for (const it of items) {
      const et = etiquetaDe(it);
      if (!porEtiqueta.has(et)) porEtiqueta.set(et, []);
      porEtiqueta.get(et).push(it.id);
    }
    return Array.from(porEtiqueta.entries())
      .map(([etiqueta, ids]) => ({ etiqueta, ids }))
      .sort((a, b) => b.ids.length - a.ids.length);
  }, [items, etiquetaDe]);

  // Un solo subtipo no informa nada que la fila de arriba no dijera ya.
  if (grupos.length < 2) return null;

  return (
    <View style={{ paddingLeft: 30, paddingBottom: 4 }}>
      {grupos.map((g) => {
        const visibles = g.ids.filter((id) => !ocultos.has(id)).length;
        const activo = claseActiva && visibles > 0;
        return (
          <Pressable
            key={g.etiqueta}
            onPress={() => {
              roce();
              // Si la mayoría se ve, este toque oculta el resto; si la
              // mayoría está oculta, este toque revela el resto. Así un
              // subgrupo a medio apagar no necesita dos toques para
              // terminar de un lado o del otro.
              onOcultarLote(g.ids, visibles >= g.ids.length / 2);
            }}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 9,
              paddingVertical: 8,
              opacity: !claseActiva ? 0.35 : pressed ? 0.6 : 1,
            })}
          >
            <Text style={{ flex: 1, fontSize: 12.5, color: INK.body }}>{g.etiqueta}</Text>
            <Text style={{ fontFamily: MONO, fontSize: 10.5, color: INK.faint }}>
              {visibles === g.ids.length ? g.ids.length : `${visibles}/${g.ids.length}`}
            </Text>
            {activo ? <Eye size={13} color={INK.meta} /> : <EyeOff size={13} color={INK.faint} />}
          </Pressable>
        );
      })}
    </View>
  );
}

function IconoDe({ clase }) {
  if (clase === 'pin') return <MapPin size={14} color={AMBAR} />;
  if (clase === 'ruta') return <Spline size={14} color={VERDE} />;
  return <Shapes size={14} color={VERDE} />;
}

function FilaCarpeta({ Icono, color, texto, activa, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: activa }}
      accessibilityLabel={texto}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 9,
        paddingHorizontal: 10,
        borderRadius: RADIUS.sm,
        backgroundColor: activa ? 'rgba(28,43,34,0.07)' : pressed ? 'rgba(28,43,34,0.04)' : 'transparent',
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

/**
 * Una familia: su fila y, si está expandida, sus subtipos.
 *
 * El chevron es un botón aparte del cuerpo de la fila. El cuerpo alterna
 * visibilidad de la familia entera; el chevron solo despliega. Fundir los dos
 * gestos en un toque obligaría a elegir cuál gana, y las dos acciones se piden
 * seguido una sin la otra.
 */
function FilaClase({ Icono, color, texto, cuantos, activo, expandida, onPress, onExpandir, children }) {
  return (
    <View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          borderRadius: RADIUS.sm,
          backgroundColor: 'rgba(28,43,34,0.035)',
        }}
      >
        <Pressable
          onPress={() => {
            roce();
            onPress();
          }}
          accessibilityRole="switch"
          accessibilityState={{ checked: activo }}
          accessibilityLabel={texto}
          style={({ pressed }) => ({
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 11,
            paddingVertical: 11,
            paddingLeft: 12,
            paddingRight: 6,
            opacity: activo ? 1 : 0.45,
            backgroundColor: pressed ? 'rgba(28,43,34,0.04)' : 'transparent',
          })}
        >
          <Icono size={15} color={color} />
          <Text style={{ flex: 1, fontSize: 13.5, color: INK.title }}>{texto}</Text>
          <Text style={{ fontFamily: MONO, fontSize: 11, color: INK.meta }}>{cuantos}</Text>
          {activo ? <Eye size={15} color={INK.meta} /> : <EyeOff size={15} color={INK.faint} />}
        </Pressable>

        <Pressable
          onPress={() => {
            roce();
            onExpandir();
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={expandida ? `Ocultar los subtipos de ${texto}` : `Ver los subtipos de ${texto}`}
          style={({ pressed }) => ({
            paddingVertical: 11,
            paddingHorizontal: 10,
            opacity: pressed ? 0.5 : 1,
            transform: [{ rotate: expandida ? '180deg' : '0deg' }],
          })}
        >
          <ChevronDown size={15} color={INK.faint} />
        </Pressable>
      </View>

      {expandida ? children : null}
    </View>
  );
}
