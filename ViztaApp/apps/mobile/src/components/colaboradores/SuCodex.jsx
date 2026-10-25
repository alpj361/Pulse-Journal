import { useEffect, useMemo, useState } from 'react';
import { Linking, Modal, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlignLeft,
  BookOpen,
  BookText,
  Check,
  Box,
  Building2,
  CalendarDays,
  ExternalLink,
  FileText,
  Lightbulb,
  Link2,
  MapPin,
  Quote,
  Search,
  User,
  X,
} from 'lucide-react-native';
import { CARD_SHADOW, INK, SERIF } from '../theme';
import { TEMAS } from '../feed/temas';
import { listo } from '../../utils/haptics';
import TextoMarkdown from '../codex/TextoMarkdown';
import { parsear } from '../codex/markdown';
import { itemDeColaborador, itemsDeColaborador, traerAMiCodex } from './api';
import { camposLegibles, claveTipo, cuerpoDe, filtrosDeTipos, nombreTipo, resumenPlano, sinTituloRepetido } from './logica';
import { Boton, EstadoCentro, TONO } from './piezas';
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
export default function SuCodex({ colaborador, bottomInset, abrirId, onAbierto, onPedir }) {
  const [abierto, setAbierto] = useState(null);
  const [filtro, setFiltro] = useState(null);
  const consulta = useQuery({
    queryKey: ['colab-items', colaborador.id],
    queryFn: () => itemsDeColaborador(colaborador.id, { limit: 100 }),
    staleTime: 1000 * 60,
  });
  const items = useMemo(() => consulta.data?.items || [], [consulta.data]);
  const filtros = useMemo(() => filtrosDeTipos(items), [items]);
  const visibles = filtro ? items.filter((it) => claveTipo(it) === filtro) : items;

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
  if (!items.length) {
    return <EstadoCentro titulo="Todavía no guardó nada" texto="Lo que investigue va a aparecer acá." />;
  }

  return (
    <>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: bottomInset + 24, gap: 10 }}
        refreshControl={<RefreshControl refreshing={consulta.isRefetching} onRefresh={consulta.refetch} tintColor={INK.meta} />}
      >
        {filtros.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 4 }} style={{ marginHorizontal: -20 }}>
            <View style={{ width: 14 }} />
            <Chip texto={`todo · ${items.length}`} activo={!filtro} onPress={() => setFiltro(null)} />
            {filtros.map((f) => (
              <Chip key={f.clave} texto={`${f.etiqueta} · ${f.n}`} activo={filtro === f.clave} onPress={() => setFiltro(filtro === f.clave ? null : f.clave)} />
            ))}
            <View style={{ width: 14 }} />
          </ScrollView>
        ) : null}
        {visibles.map((it) => (
          <Tarjeta key={`${it.origen_tabla || 'codex'}-${it.id}`} item={it} onPress={() => setAbierto(it)} />
        ))}
      </ScrollView>
      {abierto ? (
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
function Ficha({ colaborador, item: deLista, bottomInset, onClose, onPedir }) {
  const queryClient = useQueryClient();
  const [trayendo, setTrayendo] = useState(false);
  const [traido, setTraido] = useState(false);
  const [fallo, setFallo] = useState(false);
  const completo = useQuery({
    queryKey: ['colab-item', colaborador.id, deLista.id],
    queryFn: () => itemDeColaborador(colaborador.id, deLista.id),
    staleTime: 1000 * 60,
    retry: false,
  });
  const item = { ...deLista, ...(completo.data || {}) };
  const { tema } = estiloDe(item);
  const etiquetas = (Array.isArray(item.etiquetas) ? item.etiquetas : Array.isArray(item.tags) ? item.tags : []).filter(Boolean);
  const fecha = item.created_at || item.fecha;
  const cuerpo = sinTituloRepetido(cuerpoDe(item));
  const campos = camposLegibles(item.details);
  const lineas = useMemo(() => (cuerpo ? parsear(cuerpo) : []), [cuerpo]);
  const loTenes = !!(item.ya_en_mi_codex || traido);
  const parecido = !loTenes && !!item.coincidencia_humano_id;

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

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(28,43,34,0.35)' }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Cerrar" accessibilityRole="button" />
        <View style={{ backgroundColor: '#FBFAF6', borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '90%' }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 24, paddingTop: 22, gap: 12 }}>
            <View style={{ flex: 1, gap: 8 }}>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <View style={{ backgroundColor: tema.lavado[0], borderRadius: 8, paddingHorizontal: 9, paddingVertical: 3 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: tema.tinta }}>{nombreTipo(claveTipo(item))}</Text>
                </View>
                {fecha ? (
                  <Text style={{ fontSize: 12, color: INK.meta }}>
                    {new Date(fecha).toLocaleDateString('es-GT', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </Text>
                ) : null}
              </View>
              <Text style={{ fontFamily: SERIF, fontSize: 28, lineHeight: 32, color: INK.title }} accessibilityRole="header">
                {item.titulo || 'Sin título'}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Cerrar" style={{ padding: 6 }}>
              <X size={19} color={INK.faint} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 14, paddingBottom: 18, gap: 16 }}>
            {lineas.length ? <TextoMarkdown lineas={lineas} color="#2E3B33" size={15} /> : null}
            {!lineas.length && completo.isLoading ? <MorphingInfinity size={28} color={INK.meta} /> : null}

            {campos.length ? (
              <View style={{ backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(28,43,34,0.07)' }}>
                {campos.map((c, i) => (
                  <View
                    key={c.clave}
                    style={{ paddingVertical: 10, paddingHorizontal: 14, gap: 2, borderTopWidth: i ? 1 : 0, borderTopColor: 'rgba(28,43,34,0.06)' }}
                  >
                    <Text style={{ fontSize: 11.5, fontWeight: '700', color: INK.meta }}>{c.clave}</Text>
                    {c.enlace ? (
                      <Pressable onPress={() => Linking.openURL(c.valor).catch(() => {})} accessibilityRole="link">
                        <Text style={{ fontSize: 14, color: TONO.verde, fontWeight: '600' }} numberOfLines={1}>
                          {c.valor.replace(/^https?:\/\/(www\.)?/, '')}
                        </Text>
                      </Pressable>
                    ) : (
                      <Text selectable style={{ fontSize: 14, lineHeight: 20, color: INK.title }}>
                        {c.valor}
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            ) : null}

            {item.url ? (
              <Pressable
                onPress={() => Linking.openURL(item.url).catch(() => {})}
                accessibilityRole="link"
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 8, opacity: pressed ? 0.6 : 1 })}
              >
                <ExternalLink size={15} color={TONO.verde} />
                <Text style={{ flex: 1, fontSize: 14, color: TONO.verde, fontWeight: '600' }} numberOfLines={1}>
                  {item.url.replace(/^https?:\/\/(www\.)?/, '')}
                </Text>
              </Pressable>
            ) : null}

            {etiquetas.length ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {etiquetas.map((e) => (
                  <View key={String(e)} style={{ backgroundColor: 'rgba(28,43,34,0.05)', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 }}>
                    <Text style={{ fontSize: 12, color: INK.body }}>{String(e)}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </ScrollView>

          <View style={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: bottomInset + 16, gap: 8 }}>
            {loTenes ? (
              <View style={{ height: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Check size={17} color={TONO.verde} strokeWidth={2.4} />
                <Text style={{ fontSize: 14.5, fontWeight: '600', color: TONO.verde }}>en tu Codex</Text>
              </View>
            ) : parecido ? (
              <>
                <Text style={{ fontSize: 13, lineHeight: 18, color: TONO.ladrilloTinta, textAlign: 'center' }}>
                  Ya tenés «{item.titulo}» en tu Codex.
                </Text>
                {onPedir ? (
                  <Boton
                    texto="pedirle que lo una al tuyo"
                    primario
                    onPress={() =>
                      onPedir(`Tengo «${item.titulo}» en mi Codex. Proponeme unir el tuyo con el mío (colab_merge_proponer), así lo reviso campo por campo.`)
                    }
                  />
                ) : null}
              </>
            ) : (
              <>
                {fallo ? <Text style={{ fontSize: 12.5, color: TONO.rojo, textAlign: 'center' }}>No se pudo traer. Probá de nuevo.</Text> : null}
                <Boton texto="traer a mi Codex" onPress={traer} cargando={trayendo} />
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}
