import { useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlignLeft,
  LayoutDashboard,
  Brain,
  BookOpen,
  BookText,
  Check,
  ChevronRight,
  Box,
  Building2,
  CalendarDays,
  ExternalLink,
  FileText,
  Lightbulb,
  Link2,
  MapPin,
  Newspaper,
  Quote,
  Search,
  User,
  X,
} from 'lucide-react-native';
import { CARD_SHADOW, INK, SERIF } from '../theme';
import { TEMAS } from '../feed/temas';
import { listo, roce } from '../../utils/haptics';
import { espaciosDe, itemDeColaborador, itemsDeColaborador, quitarRecuerdo, traerAMiCodex } from './api';
import PortadaEspacio from '../codex/PortadaEspacio';
import { camposDeFuente, esArtifact, claveTipo, cuerpoDe, dominioDe, enlaceDeFuente, esDocumento, esFuente, sinTituloRepetido, espaciosParaCarrusel, itemsDelEspacio, memoriasComoItems, filtrosDeTipos, nombreTipo, resumenPlano } from './logica';
import ItemDetailSheet from '../codex/ItemDetailSheet';
import TextoMarkdown from '../codex/TextoMarkdown';
import { parsear } from '../codex/markdown';
import { Boton, EstadoCentro, ROTULO, TONO, Refrescar } from './piezas';
import MorphingInfinity from '../MorphingInfinity';

/** Ícono y lavado por tipo (pantalla 8). Un tipo nuevo cae al de documento. */
const ESTILO = {
  actor: { Icono: User, tema: TEMAS.Política },
  entidad: { Icono: Building2, tema: TEMAS.Movilidad },
  source: { Icono: BookOpen, tema: TEMAS.Economía },
  fuente: { Icono: BookOpen, tema: TEMAS.Economía },
  evidencia: { Icono: BookOpen, tema: TEMAS.Economía },
  evento: { Icono: CalendarDays, tema: TEMAS.Entretenimiento },
  historia: { Icono: BookText, tema: TEMAS.Cultura },
  snippet: { Icono: Quote, tema: TEMAS.Justicia },
  nota: { Icono: AlignLeft, tema: TEMAS.Política },
  enlace: { Icono: Link2, tema: TEMAS.Economía },
  investigación: { Icono: Search, tema: TEMAS.Social },
  investigacion: { Icono: Search, tema: TEMAS.Social },
  territorio: { Icono: MapPin, tema: TEMAS.Social },
  concepto: { Icono: Lightbulb, tema: TEMAS.Deportes },
  objeto: { Icono: Box, tema: TEMAS.Tecnología },
  artefacto: { Icono: Box, tema: TEMAS.Tecnología },
  memoria: { Icono: Brain, tema: TEMAS.Cultura },
  artifact: { Icono: LayoutDashboard, tema: TEMAS.Tecnología },
  dashboard: { Icono: LayoutDashboard, tema: TEMAS.Tecnología },
};
const estiloDe = (item) => ESTILO[claveTipo(item)] || { Icono: FileText, tema: TEMAS.Clima };

const haceCuanto = (fecha) => {
  if (!fecha) return '';
  const min = Math.round((Date.now() - new Date(fecha).getTime()) / 60000);
  if (!Number.isFinite(min)) return '';
  if (min < 60) return `hace ${Math.max(min, 1)} min`;
  if (min < 60 * 24) return `hace ${Math.round(min / 60)} h`;
  return new Date(fecha).toLocaleDateString('es-GT', { day: 'numeric', month: 'short' });
};

/**
 * Su Codex: lo que el agente guardó en el suyo (pantalla 8). Mezcla documentos
 * y fichas del universo (actores, entidades, fuentes, fragmentos…), con un
 * filtro por los tipos que hay.
 *
 * La ficha es de lectura: un documento sin archivo se lee con su contenido,
 * no se busca en Storage.
 *
 * Lo del agente vive en su Codex (PR #56). «ya lo tenés» marca lo que trajiste
 * al tuyo (`ya_en_mi_codex`); «se parece a uno tuyo», lo que tiene un homónimo
 * en el tuyo (`coincidencia_humano_id`). Lo parecido no se trae (sería un
 * duplicado): se le pide al agente que proponga unirlo, y llega para aprobar.
 */
export default function SuCodex({ colaborador, bottomInset, abrirId, onAbierto, onPedir, onAbrirEspacio, onAbrirArtifact }) {
  const [abierto, setAbierto] = useState(null);
  const [filtro, setFiltro] = useState(null);
  const consulta = useQuery({
    queryKey: ['colab-items', colaborador.id],
    queryFn: () => itemsDeColaborador(colaborador.id, { limit: 100 }),
    staleTime: 1000 * 60,
  });
  // Sus Espacios van arriba, como en tu Codex: al tocar uno se entra a él.
  const espaciosConsulta = useQuery({
    queryKey: ['colab-espacios', colaborador.id],
    queryFn: () => espaciosDe(colaborador.id),
    staleTime: 1000 * 60,
    retry: false,
  });
  const espacios = useMemo(() => espaciosParaCarrusel(espaciosConsulta.data), [espaciosConsulta.data]);
  const items = useMemo(() => consulta.data?.items || [], [consulta.data]);

  // Tocar un Espacio lo elige: «Todo lo que guardó» queda con lo de ese
  // Espacio, y lo que recuerda entra como memoria. Otro toque lo suelta.
  const [espacioSel, setEspacioSel] = useState(null);
  const elegido = espacios.find((e) => e.id === espacioSel) || null;
  const base = useMemo(() => {
    const memorias = memoriasComoItems(espaciosConsulta.data?.espacios || espacios, espacioSel);
    if (!elegido) return [...items, ...memorias];
    // Si el backend todavía no dice qué tiene el Espacio, se ve solo lo que recuerda.
    return [...(itemsDelEspacio(items, elegido) || []), ...memorias];
  }, [items, espacios, espaciosConsulta.data, espacioSel, elegido]);
  const filtros = useMemo(() => filtrosDeTipos(base), [base]);
  const visibles = filtro ? base.filter((it) => claveTipo(it) === filtro) : base;
  const elegir = (e) => {
    roce();
    setFiltro(null);
    setEspacioSel((actual) => (actual === e.id ? null : e.id));
  };

  // Un ítem tocado en el chat se abre acá en cuanto llega la lista.
  useEffect(() => {
    if (!abrirId || !consulta.data) return;
    const it = items.find((i) => i.id === abrirId);
    if (it) setAbierto(it);
    onAbierto?.();
  }, [abrirId, consulta.data]); // eslint-disable-line react-hooks/exhaustive-deps

  if (consulta.isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <MorphingInfinity size={28} color={INK.meta} />
      </View>
    );
  }
  if (consulta.error) {
    return (
      <EstadoCentro titulo="No se pudo traer su Codex" texto="Revisá la conexión y probá de nuevo.">
        <Boton texto="probar de nuevo" onPress={() => consulta.refetch()} />
      </EstadoCentro>
    );
  }
  if (!items.length && !espacios.length) {
    return <EstadoCentro titulo="Todavía no guardó nada" texto="Lo que investigue va a aparecer acá." />;
  }

  return (
    <>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: bottomInset + 24, gap: 10 }}
        refreshControl={<Refrescar onRefresh={consulta.refetch} />}
      >
        {espaciosConsulta.isLoading ? (
          // Mientras llegan, su lugar ya está: sin esto aparecían de golpe y
          // empujaban la lista hacia abajo.
          <View style={{ gap: 10, marginBottom: 8 }}>
            <Text style={ROTULO}>SUS ESPACIOS</Text>
            <View style={{ flexDirection: 'row', gap: 12, overflow: 'hidden', marginRight: -20 }}>
              {[0, 1, 2].map((i) => (
                <EspacioCargando key={i} />
              ))}
            </View>
          </View>
        ) : espacios.length ? (
          <Animated.View entering={FadeIn.duration(260)} style={{ gap: 10, marginBottom: 8 }}>
            <Text style={ROTULO}>SUS ESPACIOS</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={ANCHO_ESPACIO + 12}
              decelerationRate="fast"
              style={{ marginHorizontal: -20 }}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
            >
              {espacios.map((e) => (
                <Espacio key={e.id} espacio={e} activo={espacioSel === e.id} apagado={!!espacioSel && espacioSel !== e.id} onPress={() => elegir(e)} />
              ))}
            </ScrollView>
            {elegido ? (
              <Animated.View entering={FadeIn.duration(180)}>
                <Pressable
                  onPress={() => onAbrirEspacio?.(elegido)}
                  hitSlop={8}
                  accessibilityRole="button"
                  style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start', opacity: pressed ? 0.5 : 1 })}
                >
                  <Text style={{ fontSize: 13.5, fontWeight: '600', color: TONO.verde }}>entrar al espacio</Text>
                  <ChevronRight size={15} color={TONO.verde} />
                </Pressable>
              </Animated.View>
            ) : null}
          </Animated.View>
        ) : null}
        {espacios.length && base.length ? (
          <Text style={[ROTULO, { marginTop: 6 }]}>{elegido ? 'LO DE ESTE ESPACIO' : 'TODO LO QUE GUARDÓ'}</Text>
        ) : null}
        {filtros.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 4 }} style={{ marginHorizontal: -20 }}>
            <View style={{ width: 14 }} />
            <Chip texto={`todo · ${base.length}`} activo={!filtro} onPress={() => setFiltro(null)} />
            {filtros.map((f) => (
              <Chip key={f.clave} texto={`${f.etiqueta} · ${f.n}`} activo={filtro === f.clave} onPress={() => setFiltro(filtro === f.clave ? null : f.clave)} />
            ))}
            <View style={{ width: 14 }} />
          </ScrollView>
        ) : null}
        {elegido && !base.length ? <Text style={{ fontSize: 13.5, color: INK.body, paddingVertical: 8 }}>Todavía no hay nada en este espacio.</Text> : null}
        {visibles.map((it) => (
          <Tarjeta
            key={`${it.origen_tabla || 'codex'}-${it.id}`}
            item={it}
            onPress={() => (esArtifact(it) && onAbrirArtifact ? onAbrirArtifact(it.artifact_id || it.id) : setAbierto(it))}
          />
        ))}
      </ScrollView>
      {abierto && abierto.origen_tabla === 'memoria' ? (
        <FichaMemoria colaborador={colaborador} memoria={abierto} bottomInset={bottomInset} onClose={() => setAbierto(null)} />
      ) : abierto ? (
        <Ficha
          colaborador={colaborador}
          item={abierto}
          bottomInset={bottomInset}
          onClose={() => setAbierto(null)}
          onPedir={
            onPedir
              ? (texto) => {
                  setAbierto(null);
                  onPedir(texto);
                }
              : null
          }
        />
      ) : null}
    </>
  );
}

/**
 * Una carátula chica de sus Espacios. Van en fila y se corren con el dedo: el
 * carrusel grande del Codex se comía la pantalla antes de llegar a lo guardado.
 */
const ANCHO_ESPACIO = 140;

/** El lugar de una carátula mientras carga: late suave, del mismo tamaño. */
function EspacioCargando() {
  const opacidad = useSharedValue(0.5);
  useEffect(() => {
    opacidad.value = withRepeat(withTiming(1, { duration: 700 }), -1, true);
  }, [opacidad]);
  const estilo = useAnimatedStyle(() => ({ opacity: opacidad.value }));
  return (
    <Animated.View style={[{ width: ANCHO_ESPACIO, gap: 8 }, estilo]} accessible={false}>
      <View style={{ width: ANCHO_ESPACIO, height: 96, borderRadius: 16, backgroundColor: 'rgba(28,43,34,0.07)' }} />
      <View style={{ width: ANCHO_ESPACIO * 0.8, height: 11, borderRadius: 6, backgroundColor: 'rgba(28,43,34,0.07)' }} />
      <View style={{ width: ANCHO_ESPACIO * 0.45, height: 9, borderRadius: 5, backgroundColor: 'rgba(28,43,34,0.05)' }} />
    </Animated.View>
  );
}
function Espacio({ espacio: e, activo, apagado, onPress }) {
  const n = e.itemIds?.length || 0;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${e.name}${n ? `, ${n} elementos` : ''}`}
      accessibilityState={{ selected: !!activo }}
      style={({ pressed }) => ({ width: ANCHO_ESPACIO, gap: 7, opacity: apagado ? 0.5 : 1, transform: [{ scale: pressed ? 0.96 : 1 }] })}
    >
      {/* La portada se dibuja con Skia y se quedaba con el toque: no lo recibe. */}
      <View pointerEvents="none" style={{ borderRadius: 19, borderWidth: 3, borderColor: activo ? TONO.verde : 'transparent', margin: -3 }}>
        <PortadaEspacio space={e} radius={16} ancho={ANCHO_ESPACIO} alto={96} style={{ width: ANCHO_ESPACIO, height: 96 }} />
      </View>
      <View style={{ gap: 1 }}>
        <Text style={{ fontSize: 13.5, fontWeight: '700', lineHeight: 17, color: INK.title }} numberOfLines={2}>
          {e.name}
        </Text>
        {n ? <Text style={{ fontSize: 11.5, color: INK.meta }}>{n} {n === 1 ? 'elemento' : 'elementos'}</Text> : null}
      </View>
    </Pressable>
  );
}

/** Lo que recuerda en un Espacio: se lee, y se le puede pedir que lo olvide. */
function FichaMemoria({ colaborador, memoria: m, bottomInset, onClose }) {
  const queryClient = useQueryClient();
  const lineas = useMemo(() => (m.content ? parsear(m.content) : []), [m.content]);
  const olvidar = () => {
    Alert.alert('¿Que lo olvide?', m.titulo || null, [
      { text: 'cancelar', style: 'cancel' },
      {
        text: 'olvidar',
        style: 'destructive',
        onPress: () =>
          quitarRecuerdo(colaborador.id, m.recuerdo_id).then(
            () => {
              queryClient.invalidateQueries({ queryKey: ['colab-espacios', colaborador.id] });
              onClose();
            },
            () => Alert.alert('No se pudo', 'Revisá la conexión y probá de nuevo.')
          ),
      },
    ]);
  };
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(28,43,34,0.35)' }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Cerrar" accessibilityRole="button" />
        <View style={{ backgroundColor: '#FBFAF6', borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '85%' }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 24, paddingTop: 22, gap: 12 }}>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={{ fontSize: 12.5, fontWeight: '700', color: TEMAS.Cultura.tinta }} numberOfLines={1}>
                {['memoria', m.espacio_nombre].filter(Boolean).join(' · ')}
              </Text>
              <Text style={{ fontFamily: SERIF, fontSize: 24, lineHeight: 28, color: INK.title }} accessibilityRole="header">
                {m.titulo}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Cerrar" style={{ padding: 6 }}>
              <X size={19} color={INK.faint} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 14, paddingBottom: 18 }}>
            {lineas.length ? <TextoMarkdown lineas={lineas} color="#2E3B33" size={15} /> : null}
          </ScrollView>
          <View style={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: bottomInset + 16 }}>
            <Boton texto="que lo olvide" onPress={olvidar} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Chip({ texto, activo, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: activo }}
      style={{
        height: 32,
        paddingHorizontal: 12,
        borderRadius: 16,
        justifyContent: 'center',
        backgroundColor: activo ? INK.title : 'transparent',
        borderWidth: activo ? 0 : 1,
        borderColor: TONO.borde,
      }}
    >
      <Text style={{ fontSize: 13, fontWeight: '600', color: activo ? '#FFFFFF' : INK.body }}>{texto}</Text>
    </Pressable>
  );
}

function Tarjeta({ item, onPress }) {
  const { Icono, tema } = estiloDe(item);
  const tipo = nombreTipo(claveTipo(item));
  const resumen = resumenPlano(item.descripcion || item.description);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${item.titulo || 'Sin título'}, ${tipo}`}
      style={({ pressed }) => ({
        backgroundColor: 'rgba(255,255,255,0.78)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.9)',
        borderRadius: 16,
        padding: 16,
        flexDirection: 'row',
        gap: 12,
        opacity: pressed ? 0.7 : 1,
        ...CARD_SHADOW,
        shadowOpacity: 0.05,
      })}
    >
      <View
        accessible={false}
        style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: tema.lavado[0], borderWidth: 1, borderColor: tema.lavado[1], alignItems: 'center', justifyContent: 'center' }}
      >
        <Icono size={18} color={tema.tinta} strokeWidth={1.8} />
      </View>
      <View style={{ flex: 1, gap: 6 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', lineHeight: 21, color: INK.title }} numberOfLines={2}>
          {item.titulo || 'Sin título'}
        </Text>
        {resumen ? (
          <Text style={{ fontSize: 13, lineHeight: 18, color: INK.body }} numberOfLines={2}>
            {resumen}
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <View style={{ backgroundColor: tema.lavado[0], borderWidth: 1, borderColor: tema.lavado[1], borderRadius: 8, paddingHorizontal: 9, paddingVertical: 3 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: tema.tinta }}>{tipo}</Text>
          </View>
          {item.ya_en_mi_codex ? (
            <Text style={{ fontSize: 11, fontWeight: '600', color: TONO.verde }}>ya lo tenés</Text>
          ) : item.coincidencia_humano_id ? (
            <Text style={{ fontSize: 11, fontWeight: '600', color: TONO.ladrillo }}>se parece a uno tuyo</Text>
          ) : (
            <Text style={{ fontSize: 11, color: INK.meta }}>{haceCuanto(item.created_at || item.fecha)}</Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

/**
 * La ficha de un ítem del agente, para leer: su contenido (en markdown), los
 * campos que se leen como texto, el enlace y las etiquetas. Pide el ítem
 * completo; mientras llega, muestra lo que trae la lista.
 */
/**
 * La ficha de algo de su Codex. Actores, entidades, eventos… se abren con la
 * misma ficha que en tu Codex (`ItemDetailSheet`), en lectura. Una fuente
 * tiene la suya: de dónde es, el enlace y dónde aparece.
 */
export function Ficha(props) {
  if (esFuente(props.item)) return <FichaFuente {...props} />;
  if (esDocumento(props.item)) return <FichaDocumento {...props} />;
  return <FichaCodex {...props} />;
}

/** Un documento o fragmento: se lee con su formato, como una nota. */
function FichaDocumento({ colaborador, item: deLista, bottomInset, onClose, onPedir }) {
  const completo = useQuery({
    queryKey: ['colab-item', colaborador.id, deLista.id],
    queryFn: () => itemDeColaborador(colaborador.id, deLista.id),
    staleTime: 1000 * 60,
    retry: false,
  });
  const item = { ...deLista, ...(completo.data || {}) };
  const t = useTraer(colaborador, item);
  const { tema } = estiloDe(item);
  const fecha = item.created_at || item.fecha;
  const cuerpo = sinTituloRepetido(cuerpoDe(item));
  const lineas = useMemo(() => (cuerpo ? parsear(cuerpo) : []), [cuerpo]);
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(28,43,34,0.35)' }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Cerrar" accessibilityRole="button" />
        <View style={{ backgroundColor: '#FBFAF6', borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '92%' }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 24, paddingTop: 22, gap: 12 }}>
            <View style={{ flex: 1, gap: 8 }}>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <View style={{ backgroundColor: tema.lavado[0], borderRadius: 8, paddingHorizontal: 9, paddingVertical: 3 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: tema.tinta }}>{nombreTipo(claveTipo(item))}</Text>
                </View>
                {fecha ? <Text style={{ fontSize: 12, color: INK.meta }}>{fechaLarga(fecha)}</Text> : null}
              </View>
              <Text style={{ fontFamily: SERIF, fontSize: 26, lineHeight: 30, color: INK.title }} accessibilityRole="header">
                {item.titulo || item.name || 'Sin título'}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Cerrar" style={{ padding: 6 }}>
              <X size={19} color={INK.faint} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 14, paddingBottom: 18 }}>
            {lineas.length ? <TextoMarkdown lineas={lineas} color="#2E3B33" size={15} /> : null}
            {!lineas.length && completo.isLoading ? <MorphingInfinity size={28} color={INK.meta} style={{ alignSelf: 'center' }} /> : null}
          </ScrollView>
          <View style={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: bottomInset + 16 }}>
            <Acciones item={item} traer={t} onPedir={onPedir} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

/** Lo que se puede hacer con algo suyo: traerlo, o pedirle que lo una al tuyo. */
function useTraer(colaborador, item) {
  const queryClient = useQueryClient();
  const [trayendo, setTrayendo] = useState(false);
  const [traido, setTraido] = useState(false);
  const [fallo, setFallo] = useState(false);
  const traer = async () => {
    setTrayendo(true);
    setFallo(false);
    try {
      await traerAMiCodex(item.id);
      listo();
      setTraido(true);
      queryClient.invalidateQueries({ queryKey: ['colab-items', colaborador.id] });
    } catch {
      setFallo(true);
    } finally {
      setTrayendo(false);
    }
  };
  return { trayendo, traido, fallo, traer };
}

function Acciones({ item, traer: t, onPedir }) {
  const loTenes = !!(item.ya_en_mi_codex || t.traido);
  const parecido = !loTenes && !!item.coincidencia_humano_id;
  if (loTenes) {
    return (
      <View style={{ height: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <Check size={17} color={TONO.verde} strokeWidth={2.4} />
        <Text style={{ fontSize: 14.5, fontWeight: '600', color: TONO.verde }}>en tu Codex</Text>
      </View>
    );
  }
  const titulo = item.titulo || item.name;
  if (parecido) {
    return (
      <View style={{ gap: 8 }}>
        <Text style={{ fontSize: 13, lineHeight: 18, color: TONO.ladrilloTinta, textAlign: 'center' }}>Ya tenés «{titulo}» en tu Codex.</Text>
        {onPedir ? (
          <Boton
            texto="pedirle que lo una al tuyo"
            primario
            onPress={() => onPedir(`Tengo «${titulo}» en mi Codex. Proponeme unir el tuyo con el mío (colab_merge_proponer), así lo reviso campo por campo.`)}
          />
        ) : null}
      </View>
    );
  }
  return (
    <View style={{ gap: 8 }}>
      {t.fallo ? <Text style={{ fontSize: 12.5, color: TONO.rojo, textAlign: 'center' }}>No se pudo traer. Probá de nuevo.</Text> : null}
      <Boton texto="traer a mi Codex" onPress={t.traer} cargando={t.trayendo} />
    </View>
  );
}

/** Actores, entidades y demás: la ficha del Codex, en lectura, con lo suyo abajo. */
function FichaCodex({ colaborador, item: deLista, bottomInset, onClose, onPedir }) {
  const completo = useQuery({
    queryKey: ['colab-item', colaborador.id, deLista.id],
    queryFn: () => itemDeColaborador(colaborador.id, deLista.id),
    staleTime: 1000 * 60,
    retry: false,
  });
  const item = { ...deLista, ...(completo.data || {}) };
  item.name = item.name || item.titulo;
  const t = useTraer(colaborador, item);
  // La ficha toma el ítem al abrirse: se espera a tenerlo entero.
  if (completo.isLoading) {
    return (
      <Modal visible transparent animationType="fade" onRequestClose={onClose}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(28,43,34,0.35)' }}>
          <MorphingInfinity size={34} color="#FFFFFF" />
        </View>
      </Modal>
    );
  }
  return (
    <ItemDetailSheet
      item={item}
      soloLectura
      bottomInset={bottomInset}
      onClose={onClose}
      pie={<Acciones item={item} traer={t} onPedir={onPedir} />}
    />
  );
}

function FichaFuente({ colaborador, item: deLista, bottomInset, onClose, onPedir, onAbrirOtro }) {
  const completo = useQuery({
    queryKey: ['colab-item', colaborador.id, deLista.id],
    queryFn: () => itemDeColaborador(colaborador.id, deLista.id),
    staleTime: 1000 * 60,
    retry: false,
  });
  const item = { ...deLista, ...(completo.data || {}) };
  const t = useTraer(colaborador, item);
  const d = item.details || {};
  const enlace = enlaceDeFuente(item);
  const dominio = dominioDe(enlace);
  const publicada = d['Fecha de publicación'] || item.fecha;
  const notas = resumenPlano(d['Notas de la fuente'] || item.descripcion || item.description || cuerpoDe(item));
  const campos = camposDeFuente(d);
  // Dónde aparece: lo de su Codex que la cita. Llega con el ítem si el
  // backend ya lo sabe.
  const apariciones = Array.isArray(item.apariciones) ? item.apariciones : [];

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(28,43,34,0.35)' }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Cerrar" accessibilityRole="button" />
        <View style={{ backgroundColor: '#FBFAF6', borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '90%' }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 24, paddingTop: 22, gap: 12 }}>
            <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: TONO.ladrilloLavado, alignItems: 'center', justifyContent: 'center' }} accessible={false}>
              <Newspaper size={21} color={TONO.ladrilloTinta} strokeWidth={1.9} />
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: TONO.ladrilloTinta }} numberOfLines={1}>
                {[dominio, publicada ? fechaLarga(publicada) : null].filter(Boolean).join(' · ') || 'fuente'}
              </Text>
              <Text style={{ fontFamily: SERIF, fontSize: 24, lineHeight: 28, color: INK.title }} accessibilityRole="header">
                {item.titulo || item.name || 'Sin título'}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Cerrar" style={{ padding: 6 }}>
              <X size={19} color={INK.faint} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 18, gap: 18 }}>
            {enlace ? (
              <Pressable
                onPress={() => Linking.openURL(enlace).catch(() => {})}
                accessibilityRole="link"
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  backgroundColor: '#FFFFFF',
                  borderWidth: 1,
                  borderColor: TONO.borde,
                  borderRadius: 14,
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <ExternalLink size={16} color={TONO.verde} />
                <Text style={{ flex: 1, fontSize: 14.5, fontWeight: '600', color: TONO.verde }}>abrir la fuente</Text>
                <Text style={{ fontSize: 12.5, color: INK.meta }} numberOfLines={1}>
                  {dominio}
                </Text>
              </Pressable>
            ) : null}

            {notas ? <Text style={{ fontSize: 15, lineHeight: 22, color: '#2E3B33' }}>{notas}</Text> : null}
            {!notas && completo.isLoading ? <MorphingInfinity size={28} color={INK.meta} /> : null}

            {campos.length ? (
              <View style={{ backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(28,43,34,0.07)' }}>
                {campos.map((c, i) => (
                  <View
                    key={c.clave}
                    style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 11, paddingHorizontal: 14, borderTopWidth: i ? 1 : 0, borderTopColor: 'rgba(28,43,34,0.06)' }}
                  >
                    <Text style={{ fontSize: 13, color: INK.meta }}>{c.clave}</Text>
                    <Text selectable style={{ flexShrink: 1, fontSize: 13.5, fontWeight: '600', color: INK.title, textAlign: 'right' }}>
                      {c.clave === 'Confiabilidad' && /^\d$/.test(c.valor) ? `${c.valor} de 5` : c.valor}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            {apariciones.length ? (
              <View style={{ gap: 8 }}>
                <Text style={ROTULO}>DÓNDE APARECE</Text>
                <View style={{ backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(28,43,34,0.07)', overflow: 'hidden' }}>
                  {apariciones.map((a, i) => (
                    <Pressable
                      key={a.id}
                      onPress={onAbrirOtro ? () => onAbrirOtro(a) : undefined}
                      disabled={!onAbrirOtro}
                      accessibilityRole={onAbrirOtro ? 'button' : undefined}
                      style={({ pressed }) => ({
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 10,
                        paddingVertical: 11,
                        paddingHorizontal: 14,
                        borderTopWidth: i ? 1 : 0,
                        borderTopColor: 'rgba(28,43,34,0.06)',
                        opacity: pressed ? 0.6 : 1,
                      })}
                    >
                      <View style={{ flex: 1, gap: 1 }}>
                        <Text style={{ fontSize: 14.5, fontWeight: '600', color: INK.title }} numberOfLines={2}>
                          {a.titulo || a.name}
                        </Text>
                        {a.tipo ? <Text style={{ fontSize: 12, color: INK.meta }}>{nombreTipo(claveTipo(a))}</Text> : null}
                      </View>
                      {onAbrirOtro ? <ChevronRight size={15} color={INK.meta} /> : null}
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}
          </ScrollView>

          <View style={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: bottomInset + 16 }}>
            <Acciones item={item} traer={t} onPedir={onPedir} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const fechaLarga = (f) => {
  // «2026-10-22» es un día, no un instante: leído como UTC, en Guatemala sale el 21.
  const dia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(f));
  const d = dia ? new Date(Number(dia[1]), Number(dia[2]) - 1, Number(dia[3])) : new Date(f);
  return Number.isNaN(d.getTime()) ? String(f) : d.toLocaleDateString('es-GT', { day: 'numeric', month: 'short', year: 'numeric' });
};
