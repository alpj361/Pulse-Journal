import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Eye, EyeOff, Landmark, MapPin, Search, Shapes, Spline, X } from 'lucide-react-native';
import { INK, RADIUS, SERIF } from '../theme';
import { MONO } from '../codex/mono';
import { PAPEL } from '../codex/Papel';
import { inputStyle } from '../codex/FieldInput';
import { roce } from '../../utils/haptics';

const AMBAR = '#B45309';
const VERDE = 'rgba(58,96,73,0.72)';

/**
 * Qué territorios se ven.
 *
 * **Absorbe los filtros que ya existían.** Antes había tres en lugares
 * distintos: el nivel administrativo en el selector de capas, y dos
 * interruptores flotantes —pines y rutas— apilados en la esquina. Tres
 * controles que responden la misma pregunta, «qué estoy viendo», repartidos por
 * la pantalla; la respuesta completa no estaba en ningún lado. Acá está junta.
 *
 * **Dos escalas de filtro, y el orden importa.** Arriba las clases —áreas,
 * puntos, recorridos—, que es como se piensa el mapa cuando hay demasiado
 * encima. Abajo los territorios uno por uno, para cuando el problema es un
 * territorio concreto y no una familia entera. Empezar por lo grueso resuelve
 * la mayoría de los casos sin tener que leer una lista de trescientos nombres.
 *
 * **Una clase apagada apaga sus territorios sin olvidarlos.** El estado
 * individual se conserva debajo: volver a prender «áreas» devuelve exactamente
 * lo que estaba visible antes, no todo. Apagar una familia para mirar otra cosa
 * un momento no debería costar rehacer el filtro.
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
  onAlternarClase,
  onMostrarTodo,
}) {
  const [texto, setTexto] = useState('');

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
  const algoApagado = cuantosOcultos > 0 || !clases.area || !clases.pin || !clases.ruta;

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
            maxHeight: '80%',
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

          {/* ── Las familias ── */}
          <View style={{ gap: 2 }}>
            <FilaClase
              Icono={Shapes}
              color={VERDE}
              texto="áreas y fronteras"
              cuantos={areas.length}
              activo={clases.area}
              onPress={() => onAlternarClase('area')}
            />
            <FilaClase
              Icono={MapPin}
              color={AMBAR}
              texto="puntos"
              cuantos={pines.length}
              activo={clases.pin}
              onPress={() => onAlternarClase('pin')}
            />
            <FilaClase
              Icono={Spline}
              color={VERDE}
              texto="recorridos"
              cuantos={recorridos.length}
              activo={clases.ruta}
              onPress={() => onAlternarClase('ruta')}
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

          <ScrollView style={{ marginTop: 8 }} keyboardShouldPersistTaps="handled">
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
                <Pressable
                  key={`${t._clase}-${t.id}`}
                  onPress={() => {
                    if (porClase) return;
                    roce();
                    onAlternarOculto(t.id);
                  }}
                  disabled={porClase}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 11,
                    paddingVertical: 11,
                    borderTopWidth: 1,
                    borderTopColor: 'rgba(28,43,34,0.06)',
                    opacity: porClase ? 0.3 : oculto ? 0.45 : 1,
                    backgroundColor: pressed ? 'rgba(28,43,34,0.04)' : 'transparent',
                  })}
                >
                  <IconoDe clase={t._clase} />
                  <Text numberOfLines={1} style={{ flex: 1, fontSize: 13.5, color: INK.title }}>
                    {t.name}
                  </Text>
                  {oculto ? <EyeOff size={15} color={INK.faint} /> : <Eye size={15} color={INK.meta} />}
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Solo cuando hay algo que restaurar: un botón permanente que la
              mitad de las veces no hace nada enseña a ignorarlo. */}
          {algoApagado ? (
            <Pressable
              onPress={() => {
                roce();
                onMostrarTodo();
              }}
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
      </View>
    </Modal>
  );
}

function IconoDe({ clase }) {
  if (clase === 'pin') return <MapPin size={14} color={AMBAR} />;
  if (clase === 'ruta') return <Spline size={14} color={VERDE} />;
  return <Shapes size={14} color={VERDE} />;
}

function FilaClase({ Icono, color, texto, cuantos, activo, onPress }) {
  return (
    <Pressable
      onPress={() => {
        roce();
        onPress();
      }}
      accessibilityRole="switch"
      accessibilityState={{ checked: activo }}
      accessibilityLabel={texto}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 11,
        paddingVertical: 11,
        paddingHorizontal: 12,
        borderRadius: RADIUS.sm,
        backgroundColor: pressed ? 'rgba(28,43,34,0.06)' : 'rgba(28,43,34,0.035)',
        opacity: activo ? 1 : 0.45,
      })}
    >
      <Icono size={15} color={color} />
      <Text style={{ flex: 1, fontSize: 13.5, color: INK.title }}>{texto}</Text>
      <Text style={{ fontFamily: MONO, fontSize: 11, color: INK.meta }}>{cuantos}</Text>
      {activo ? <Eye size={15} color={INK.meta} /> : <EyeOff size={15} color={INK.faint} />}
    </Pressable>
  );
}
