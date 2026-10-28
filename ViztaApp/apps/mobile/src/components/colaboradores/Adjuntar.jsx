import { useState } from "react";
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
import { Check, Code, Quote, Search } from "lucide-react-native";
import { INK, MOTION, SERIF } from "../theme";
import { roce } from "../../utils/haptics";
import { buscarEnMiCodex } from "./api";
import { claveTipo, nombreTipo } from "./logica";
import { Boton, ROTULO, TONO } from "./piezas";
import MorphingInfinity from "../MorphingInfinity";
import { Cara } from "./Elemento";

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

  const resultados = useQuery({
    queryKey: ["colab-buscar-codex", busqueda.trim()],
    queryFn: () => buscarEnMiCodex(busqueda, userId),
    enabled: modo === "codex" && !!userId,
    staleTime: 1000 * 30,
  });

  const alternar = (it) => {
    roce();
    setElegidos((prev) =>
      prev.some((x) => x.id === it.id)
        ? prev.filter((x) => x.id !== it.id)
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
            clave: claveTipo(it),
            ...(it.imagen ? { imagen: it.imagen } : {}),
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
                <ScrollView
                  style={{ maxHeight: 320 }}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={{ gap: 2 }}
                >
                  {busqueda.trim() ? null : (
                    <Text style={[ROTULO, { marginBottom: 4 }]}>
                      LO MÁS RECIENTE
                    </Text>
                  )}
                  {resultados.isLoading ? (
                    <MorphingInfinity
                      size={20}
                      color={INK.meta}
                      style={{ marginVertical: 12, alignSelf: "center" }}
                    />
                  ) : null}
                  {(resultados.data || []).map((it) => {
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
                  {!resultados.isLoading && !(resultados.data || []).length ? (
                    <Text
                      style={{
                        fontSize: 13.5,
                        color: INK.body,
                        paddingVertical: 10,
                      }}
                    >
                      Nada con ese nombre en tu Codex.
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
