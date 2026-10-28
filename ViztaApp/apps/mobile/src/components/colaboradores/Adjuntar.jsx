import { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useQuery } from "@tanstack/react-query";
import { Check, Code, Folder, Quote, Search } from "lucide-react-native";
import { INK, MOTION, SERIF } from "../theme";
import { roce } from "../../utils/haptics";
import { buscarEnMiCodex, misEspaciosParaAdjuntar, tiposDeMiCodex } from "./api";
import { claveTipo, nombreTipo } from "./logica";
import { Boton, ROTULO, TONO } from "./piezas";
import MorphingInfinity from "../MorphingInfinity";
import { Cara, estiloDe } from "./Elemento";

/** Lo que acepta un mensaje. */
const MAX_ADJUNTOS = 20;

const MODOS = [
  { clave: "codex", texto: "de mi Codex", Icono: Search },
  { clave: "fragmento", texto: "fragmento", Icono: Quote },
  { clave: "codigo", texto: "código", Icono: Code },
];

/**
 * Adjuntar (pantalla 5): algo de mi Codex, un fragmento o código. Hoja sobre
 * el chat. Noticia, del feed y artifact entran cuando haya de dónde listarlos.
 *
 * Lo de mi Codex va por referencia (`ref_id`, con título y tipo en `meta`);
 * fragmento y código van embebidos (`contenido`).
 */
export default function Adjuntar({
  userId,
  bottomInset,
  onAdjuntar,
  onCerrar,
}) {
  const [modo, setModo] = useState("codex");
  const [busqueda, setBusqueda] = useState("");
  const [elegidos, setElegidos] = useState([]);
  const [texto, setTexto] = useState("");

  // Por espacio y por tipo, para encontrar lo que se quiere compartir.
  const [espacioId, setEspacioId] = useState(null);
  const [tipo, setTipo] = useState(null);
  const espacios = useQuery({
    queryKey: ["colab-adjuntar-espacios", userId],
    queryFn: () => misEspaciosParaAdjuntar(userId),
    enabled: modo === "codex" && !!userId,
    staleTime: 1000 * 60 * 5,
  });
  const espacio = useMemo(
    () => (espacios.data || []).find((e) => e.id === espacioId) || null,
    [espacios.data, espacioId],
  );
  const ids = espacio ? espacio.ids : null;
  const tipos = useQuery({
    queryKey: ["colab-adjuntar-tipos", userId, espacioId],
    queryFn: () => tiposDeMiCodex(userId, { ids }),
    enabled: modo === "codex" && !!userId && (!espacioId || !!espacio),
    staleTime: 1000 * 60 * 5,
  });
  const resultados = useQuery({
    queryKey: ["colab-buscar-codex", busqueda.trim(), espacioId, tipo],
    queryFn: () => buscarEnMiCodex(busqueda, userId, { tipo, ids }),
    enabled: modo === "codex" && !!userId && (!espacioId || !!espacio),
    staleTime: 1000 * 30,
  });
  const lista = resultados.data || [];
  // Elegir todo lo que se ve (un espacio entero, o un tipo dentro de él), hasta 20.
  const todosElegidos = lista.length > 0 && lista.every((it) => elegidos.some((x) => x.id === it.id));
  const elegirTodos = () => {
    roce();
    setElegidos((prev) => {
      if (todosElegidos) return prev.filter((x) => !lista.some((it) => it.id === x.id));
      const nuevos = lista.filter((it) => !prev.some((x) => x.id === it.id));
      return [...prev, ...nuevos].slice(0, MAX_ADJUNTOS);
    });
  };

  const alternar = (it) => {
    roce();
    setElegidos((prev) =>
      prev.some((x) => x.id === it.id)
        ? prev.filter((x) => x.id !== it.id)
        : prev.length >= MAX_ADJUNTOS
          ? prev
          : [...prev, it],
    );
  };

  const listos =
    modo === "codex"
      ? elegidos.map((it) => ({
          tipo: "item",
          ref_id: it.id,
          meta: {
            titulo: String(it.titulo || "").slice(0, 500),
            tipo: nombreTipo(claveTipo(it)),
            // La foto no viaja: el servidor no acepta textos de más de 500
            // caracteres y los enlaces de Instagram pasan de eso (y vencen).
            clave: claveTipo(it),
          },
        }))
      : texto.trim()
        ? [
            {
              tipo: modo === "codigo" ? "code" : "snippet",
              contenido: texto.trim().slice(0, 20000),
            },
          ]
        : [];

  // En su propio Modal: el chat está debajo de la cabecera, y la hoja tiene
  // que tapar la pantalla entera.
  return (
    <Modal visible transparent animationType="none" onRequestClose={onCerrar}>
      <View style={StyleSheet.absoluteFill}>
        <Animated.View
          entering={FadeIn.duration(180)}
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: "rgba(28,43,34,0.35)" },
          ]}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onCerrar}
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
          />
        </Animated.View>
        <KeyboardAvoidingView
          style={{ flex: 1, justifyContent: "flex-end" }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          pointerEvents="box-none"
        >
          <Animated.View
            entering={FadeInDown.springify()
              .damping(MOTION.enter.damping)
              .stiffness(MOTION.enter.stiffness)}
            style={{
              backgroundColor: "#FBFAF6",
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              maxHeight: "86%",
              paddingTop: 10,
              paddingHorizontal: 24,
              paddingBottom: bottomInset + 18,
              gap: 14,
            }}
          >
            <View
              style={{
                alignSelf: "center",
                width: 34,
                height: 4,
                borderRadius: 2,
                backgroundColor: "rgba(28,43,34,0.18)",
              }}
            />
            <Text
              style={{ fontFamily: SERIF, fontSize: 28, color: INK.title }}
              accessibilityRole="header"
            >
              Adjuntar
            </Text>

            <View style={{ flexDirection: "row", gap: 6 }}>
              {MODOS.map(({ clave, texto: t, Icono }) => {
                const activo = clave === modo;
                return (
                  <Pressable
                    key={clave}
                    onPress={() => {
                      setModo(clave);
                      setTexto("");
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: activo }}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      height: 34,
                      paddingHorizontal: 12,
                      borderRadius: 17,
                      backgroundColor: activo ? INK.title : "transparent",
                      borderWidth: activo ? 0 : 1,
                      borderColor: TONO.borde,
                    }}
                  >
                    <Icono
                      size={14}
                      color={activo ? "#FFFFFF" : INK.body}
                      strokeWidth={2}
                    />
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "600",
                        color: activo ? "#FFFFFF" : INK.body,
                      }}
                    >
                      {t}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {modo === "codex" ? (
              <>
                <TextInput
                  value={busqueda}
                  onChangeText={setBusqueda}
                  placeholder="buscar en tu Codex"
                  placeholderTextColor={INK.faint}
                  autoCorrect={false}
                  accessibilityLabel="Buscar en tu Codex"
                  style={{
                    height: 44,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: TONO.borde,
                    backgroundColor: "#FFFFFF",
                    paddingHorizontal: 12,
                    fontSize: 15,
                    color: INK.title,
                  }}
                />
                {(espacios.data || []).length ? (
                  <Fila>
                    <Filtro
                      texto="todo tu Codex"
                      activo={!espacioId}
                      onPress={() => {
                        setEspacioId(null);
                        setTipo(null);
                      }}
                    />
                    {espacios.data.map((e) => (
                      <Filtro
                        key={e.id}
                        texto={e.nombre}
                        Icono={Folder}
                        activo={espacioId === e.id}
                        onPress={() => {
                          setEspacioId(espacioId === e.id ? null : e.id);
                          setTipo(null);
                        }}
                      />
                    ))}
                  </Fila>
                ) : null}
                {(tipos.data || []).length > 1 ? (
                  <Fila>
                    {tipos.data.map(({ clave, n }) => (
                      <Filtro
                        key={clave}
                        texto={`${nombreTipo(clave, n !== 1)} · ${n}`}
                        estilo={estiloDe({ tipo: clave })}
                        activo={tipo === clave}
                        onPress={() => setTipo(tipo === clave ? null : clave)}
                      />
                    ))}
                  </Fila>
                ) : null}
                <ScrollView
                  style={{ maxHeight: 300 }}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={{ gap: 2 }}
                >
                  {busqueda.trim() || espacioId || tipo ? null : (
                    <Text style={[ROTULO, { marginBottom: 4 }]}>
                      LO MÁS RECIENTE
                    </Text>
                  )}
                  {(espacioId || tipo) && lista.length > 1 && lista.length <= MAX_ADJUNTOS ? (
                    <Pressable
                      onPress={elegirTodos}
                      accessibilityRole="button"
                      style={({ pressed }) => ({ alignSelf: "flex-start", paddingVertical: 6, opacity: pressed ? 0.6 : 1 })}
                    >
                      <Text style={{ fontSize: 13.5, fontWeight: "700", color: TONO.verde }}>
                        {todosElegidos ? "quitar todos" : `elegir los ${lista.length}`}
                      </Text>
                    </Pressable>
                  ) : null}
                  {resultados.isLoading ? (
                    <MorphingInfinity
                      size={20}
                      color={INK.meta}
                      style={{ marginVertical: 12, alignSelf: "center" }}
                    />
                  ) : null}
                  {lista.map((it) => {
                    const si = elegidos.some((x) => x.id === it.id);
                    return (
                      <Pressable
                        key={it.id}
                        onPress={() => alternar(it)}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: si }}
                        style={({ pressed }) => ({
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 12,
                          paddingVertical: 10,
                          opacity: pressed ? 0.6 : 1,
                        })}
                      >
                        <Cara item={it} imagen={it.imagen} size={36} />
                        <View style={{ flex: 1, gap: 2 }}>
                          <Text
                            style={{
                              fontSize: 14.5,
                              fontWeight: "600",
                              color: INK.title,
                            }}
                            numberOfLines={1}
                          >
                            {it.titulo || "Sin título"}
                          </Text>
                          <Text style={{ fontSize: 12, color: INK.meta }}>
                            {nombreTipo(claveTipo(it))}
                          </Text>
                        </View>
                        <View
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: 12,
                            borderWidth: si ? 0 : 1.5,
                            borderColor: "rgba(28,43,34,0.2)",
                            backgroundColor: si ? TONO.verde : "transparent",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {si ? (
                            <Check size={14} color="#FFFFFF" strokeWidth={3} />
                          ) : null}
                        </View>
                      </Pressable>
                    );
                  })}
                  {!resultados.isLoading && !lista.length ? (
                    <Text
                      style={{
                        fontSize: 13.5,
                        color: INK.body,
                        paddingVertical: 10,
                      }}
                    >
                      {busqueda.trim() ? "Nada con ese nombre." : "Nada por acá."}
                    </Text>
                  ) : null}
                </ScrollView>
              </>
            ) : (
              <TextInput
                value={texto}
                onChangeText={setTexto}
                placeholder={
                  modo === "codigo" ? "pegá el código" : "pegá el fragmento"
                }
                placeholderTextColor={INK.faint}
                multiline
                autoCorrect={modo !== "codigo"}
                autoCapitalize={modo === "codigo" ? "none" : "sentences"}
                maxLength={20000}
                accessibilityLabel={modo === "codigo" ? "Código" : "Fragmento"}
                style={{
                  minHeight: 140,
                  maxHeight: 280,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: TONO.borde,
                  backgroundColor: modo === "codigo" ? "#1F2A24" : "#FFFFFF",
                  padding: 12,
                  fontSize: modo === "codigo" ? 13 : 15,
                  fontFamily: modo === "codigo" ? "Menlo" : undefined,
                  color: modo === "codigo" ? "#D9E4DC" : INK.title,
                  textAlignVertical: "top",
                }}
              />
            )}

            <Boton
              texto={
                listos.length > 1 ? `adjuntar ${listos.length}` : "adjuntar"
              }
              primario
              disabled={!listos.length}
              onPress={() => onAdjuntar(listos)}
            />
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

/** Una fila de filtros que se desliza de lado. */
function Fila({ children }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      style={{ marginHorizontal: -24, flexGrow: 0 }}
      contentContainerStyle={{ paddingHorizontal: 24, gap: 6 }}
    >
      {children}
    </ScrollView>
  );
}

/** Un filtro: un espacio (con su carpeta) o un tipo (con su ícono y color). */
function Filtro({ texto, activo, onPress, Icono, estilo }) {
  const I = estilo?.Icono || Icono;
  const tinta = activo ? "#FFFFFF" : estilo?.tema?.tinta || INK.body;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: activo }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        height: 32,
        maxWidth: 220,
        paddingHorizontal: 11,
        borderRadius: 16,
        backgroundColor: activo ? INK.title : estilo ? estilo.tema.lavado[0] : "transparent",
        borderWidth: activo ? 0 : 1,
        borderColor: estilo ? estilo.tema.lavado[1] : TONO.borde,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {I ? <I size={13} color={tinta} strokeWidth={2} /> : null}
      <Text style={{ fontSize: 13, fontWeight: "600", color: tinta, flexShrink: 1 }} numberOfLines={1}>
        {texto}
      </Text>
    </Pressable>
  );
}
