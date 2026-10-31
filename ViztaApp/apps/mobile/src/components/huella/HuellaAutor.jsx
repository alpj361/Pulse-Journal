import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import {
  BadgeCheck,
  CalendarCheck,
  CalendarX,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleQuestionMark,
  FileVideo,
  Fingerprint,
  History,
  Hourglass,
  Layers,
  Mic,
  Newspaper,
  RefreshCw,
  ShieldAlert,
  Sprout,
  TriangleAlert,
  UserRound,
  UserRoundCheck,
  X,
} from 'lucide-react-native';
import { INK, SERIF } from '../theme';
import { PAPEL } from '../codex/Papel';
import { falla, listo, roce } from '../../utils/haptics';
import { supabase } from '../../utils/supabase';
import MorphingInfinity from '../MorphingInfinity';
import { Boton, EstadoCentro, ROTULO, TONO } from '../colaboradores/piezas';
import PostDetailSheet from '../posts/PostDetailSheet';
import useHuellaAutor from './useHuellaAutor';
import GuiaHuella from './GuiaHuella';
import IdentificarVoces from './IdentificarVoces';
import HuellaLlena from './HuellaLlena';
import { TONOS } from './tonos';
import {
  FACETAS,
  MADUREZ,
  NIVELES,
  PESTANAS,
  RESPALDO,
  TRAYECTORIA,
  delAutor,
  enfriamientoRestante,
  faltaDe,
  fechaPublicacion,
  fechasCubiertas,
  llenadoHuella,
  motivoDeError,
  nivelDimension,
  publicacionesDe,
  quienHabla,
  repartir,
  revisionDeVoz,
  situacion,
  vocesPendientes,
} from './logica';

const capital = (t) => (t ? t[0].toUpperCase() + t.slice(1) : t);
const CAMPOS_POST ='id, name, tipo, description, tags, thumbnail_url, details, aliases, created_at, folder_id';
const GUIA_VISTA = 'vizta-huella-guia-vista';
const DE_A = 20;

/** Los nombres de las personas del Codex vinculadas a voces, para rotular quién habla. */
const Personas = createContext({});

const ICONO_MADUREZ = { sin_observaciones: Hourglass, impresiones_iniciales: Sprout, en_formacion: Layers, dimensiones_respaldadas: BadgeCheck };
const ICONO_NIVEL = { sin_observaciones: Hourglass, impresion_inicial: Sprout, en_formacion: Layers, en_revision: TriangleAlert, huella_respaldada: BadgeCheck };

/**
 * La huella de autor de una cuenta. Diseño tomado de la referencia hecha con
 * OpenUI (openui-demo/huella): la huella grande que se llena, etiquetas con
 * ícono, pestañas y tarjetas con la cita.
 *
 * Muestra lo observado aunque todavía no haya huella respaldada: terminar el
 * cálculo no completa la huella, pero las impresiones con su evidencia sí se
 * pueden revisar. Lo que explica —niveles, pestañas, qué falta comprobar—
 * vive en la guía (GuiaHuella), que se abre sola la primera vez.
 *
 * `autorId` es el autor social (`post_analisis.autor_id` / `autores.id`), no
 * quien creó un registro del Codex.
 */
export default function HuellaAutor({ autorId, nombre, topInset = 0, bottomInset = 0, onClose }) {
  const h = useHuellaAutor(autorId);
  const [abierta, setAbierta] = useState(null);
  const [pidiendo, setPidiendo] = useState(false);
  const [errorAccion, setErrorAccion] = useState(null);
  const [postAbierto, setPostAbierto] = useState(null);
  const [guia, setGuia] = useState(false);
  const [identificando, setIdentificando] = useState(null);

  const r = h.respuesta;
  const caso = h.consulta.error ? 'error' : situacion(r);
  const breve = caso === 'lista' ? r?.lectura_breve || null : null;
  const madurez = caso === 'lista' ? r?.impresiones?.madurez || breve?.madurez || 'sin_observaciones' : null;
  const cuenta = h.cuenta;
  const espera = enfriamientoRestante(h.ultimoPedido, h.ahora);
  const llenado = llenadoHuella(breve);
  const tonoHuella = MADUREZ[madurez]?.tono === 'verde' ? 'verde' : 'ambar';
  const tarjetas = h.tarjetas.data || [];
  const pendientes = useMemo(() => vocesPendientes(tarjetas, h.identidad), [tarjetas, h.identidad]);

  // La guía se abre sola la primera vez que se ve una huella; después, con el «?».
  useEffect(() => {
    if (caso !== 'lista') return;
    AsyncStorage.getItem(GUIA_VISTA)
      .then((v) => {
        if (!v) setGuia(true);
      })
      .catch(() => {});
  }, [caso]);
  const cerrarGuia = () => {
    setGuia(false);
    AsyncStorage.setItem(GUIA_VISTA, '1').catch(() => {});
  };

  const actualizar = async () => {
    if (pidiendo || espera) return;
    roce();
    setPidiendo(true);
    setErrorAccion(null);
    try {
      await h.actualizar();
    } catch (e) {
      falla();
      setErrorAccion(motivoDeError(e));
    } finally {
      setPidiendo(false);
    }
  };

  const abrirPost = async (postId) => {
    roce();
    const { data } = await supabase.from('codex_universe_items').select(CAMPOS_POST).eq('id', postId).maybeSingle();
    if (data) setPostAbierto(data);
  };

  // La tarjeta abierta, siempre de la revisión vigente (si cambió, se cierra).
  const tarjeta = abierta ? tarjetas.find((t) => t.id === abierta) || null : null;
  const titulo = cuenta?.nombre || nombre || (cuenta?.usuario ? `@${cuenta.usuario}` : 'Autor');
  const subtitulo = [cuenta?.usuario ? `@${cuenta.usuario}` : null, cuenta?.plataforma].filter(Boolean).join(' · ');

  return (
    <Modal visible animationType="slide" onRequestClose={tarjeta ? () => setAbierta(null) : onClose}>
      <Personas.Provider value={h.personas}>
      <View style={{ flex: 1, backgroundColor: PAPEL }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: topInset + 12, paddingHorizontal: 18, paddingBottom: 4 }}>
          <Pressable
            onPress={tarjeta ? () => setAbierta(null) : onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={tarjeta ? 'Volver' : 'Cerrar'}
            style={{ padding: 6 }}
          >
            {tarjeta ? <ChevronLeft size={22} color={INK.title} /> : <X size={19} color={INK.faint} />}
          </Pressable>
          <Pressable
            onPress={() => {
              roce();
              setGuia(true);
            }}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Cómo leer la huella"
            style={{ padding: 6 }}
          >
            <CircleQuestionMark size={21} color={INK.meta} strokeWidth={1.8} />
          </Pressable>
        </View>

        {tarjeta ? (
          <DetalleTarjeta
            tarjeta={tarjeta}
            posicion={posicionDe(r, tarjeta)}
            titulos={h.titulos}
            identidad={h.identidad}
            bottomInset={bottomInset}
            onAbrirPost={abrirPost}
            onIdentificar={(voz) => setIdentificando([voz])}
          />
        ) : (
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: bottomInset + 32, gap: 18 }} keyboardShouldPersistTaps="handled">
            <Cabecera
              titulo={titulo}
              subtitulo={subtitulo}
              madurez={madurez}
              cuenta={cuenta}
              llenado={llenado}
              tono={tonoHuella}
              voces={caso === 'lista' ? pendientes.length : 0}
              onIdentificar={() => {
                roce();
                setIdentificando(pendientes);
              }}
              onHuella={() => {
                roce();
                setGuia(true);
              }}
            />

            {caso === 'cargando' ? (
              <MorphingInfinity size={28} color={INK.meta} style={{ alignSelf: 'center', marginTop: 40 }} />
            ) : caso === 'error' ? (
              <EstadoCentro titulo="No se pudo abrir la huella" texto={motivoDeError(h.consulta.error)}>
                {[401, 403, 404, 422].includes(h.consulta.error?.status) ? null : <Boton texto="probar de nuevo" onPress={() => h.consulta.refetch()} />}
              </EstadoCentro>
            ) : caso === 'calculando' || caso === 'recalculando' ? (
              <Aviso Icono={RefreshCw} tono="azul" titulo={caso === 'recalculando' ? 'Actualizando con publicaciones nuevas' : 'Analizando sus publicaciones'}>
                Tarda unos segundos.
              </Aviso>
            ) : caso === 'sin_calcular' || caso === 'fallo' ? (
              <View style={{ gap: 12 }}>
                <Aviso Icono={caso === 'fallo' ? ShieldAlert : Fingerprint} tono={caso === 'fallo' ? 'rojo' : 'neutro'} titulo={caso === 'fallo' ? 'No se pudo crear la huella' : 'Esta cuenta todavía no tiene huella'}>
                  {caso === 'fallo' ? 'Se vuelve a intentar automáticamente.' : 'Se crea a partir de sus publicaciones ya analizadas.'}
                </Aviso>
                <Boton texto={espera ? `en ${espera} s` : caso === 'fallo' ? 'volver a intentar' : 'crear la huella'} primario cargando={pidiendo} disabled={!!espera} onPress={actualizar} />
              </View>
            ) : (
              <Observado
                respuesta={r}
                consulta={h.tarjetas}
                tarjetas={tarjetas}
                titulos={h.titulos}
                identidad={h.identidad}
                onAbrir={(t) => {
                  roce();
                  setAbierta(t.id);
                }}
                onAbrirPost={abrirPost}
              />
            )}

            {caso === 'lista' ? (
              <Boton texto={espera ? `actualizar en ${espera} s` : 'actualizar'} alto={42} cargando={pidiendo} disabled={!!espera} onPress={actualizar} />
            ) : null}
            {errorAccion ? <Text style={{ fontSize: 13, color: TONO.rojo }}>{errorAccion}</Text> : null}
          </ScrollView>
        )}

        {guia ? (
          <GuiaHuella
            lecturaBreve={breve}
            parcial={!!breve?.procesamiento?.parcial || !!r?.impresiones?.parcial}
            nombre={titulo}
            llenado={llenado}
            tono={tonoHuella}
            bottomInset={bottomInset}
            onClose={cerrarGuia}
          />
        ) : null}
        {identificando ? (
          <IdentificarVoces voces={identificando} identidad={h.identidad} personas={h.personas} revisar={h.revisar} bottomInset={bottomInset} onClose={() => setIdentificando(null)} />
        ) : null}
        {postAbierto ? <PostDetailSheet post={postAbierto} topInset={topInset} bottomInset={bottomInset} onClose={() => setPostAbierto(null)} /> : null}
      </View>
      </Personas.Provider>
    </Modal>
  );
}

/** La posición de la caracterización que corresponde a una lectura por dimensión. */
const posicionDe = (r, t) => (t?.dimension_id ? (r?.caracterizacion?.posiciones || []).find((p) => p.dimension_id === t.dimension_id) || null : null);

// ─── Piezas ────────────────────────────────────────────────────────────────

/** Etiqueta con ícono: niveles, quién habla, respaldo. */
function Etiqueta({ Icono, texto, tono = 'neutro', chica = false }) {
  const t = TONOS[tono] || TONOS.neutro;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: t.fondo,
        borderRadius: 8,
        paddingHorizontal: chica ? 7 : 9,
        paddingVertical: chica ? 3 : 5,
      }}
    >
      {Icono ? <Icono size={chica ? 12 : 14} color={t.tinta} strokeWidth={2} /> : null}
      <Text style={{ fontSize: chica ? 12 : 13.5, fontWeight: '600', color: t.tinta }}>{texto}</Text>
    </View>
  );
}

function EtiquetaNivel({ nivel, chica }) {
  const n = NIVELES[nivel] || NIVELES.impresion_inicial;
  return <Etiqueta chica={chica} Icono={ICONO_NIVEL[nivel] || Sprout} texto={n.texto} tono={n.tono} />;
}

/** Quién habla, solo cuando se sabe; sin nadie identificado no se dibuja. */
function EtiquetaVoz({ evidencia, revision, chica = true }) {
  const q = quienHabla(evidencia, revision, useContext(Personas));
  if (!q) return null;
  return <Etiqueta chica={chica} Icono={q.tono === 'verde' ? UserRoundCheck : UserRound} texto={q.texto} tono={q.tono} />;
}

/** Caja con ícono, título y una línea: avisos y estados vacíos. */
function Aviso({ Icono, tono = 'azul', titulo, children }) {
  const t = TONOS[tono] || TONOS.neutro;
  return (
    <View style={{ flexDirection: 'row', gap: 12, backgroundColor: t.fondo, borderRadius: 14, padding: 14 }}>
      <Icono size={18} color={t.tinta} strokeWidth={2} style={{ marginTop: 1 }} />
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={{ fontSize: 14.5, fontWeight: '700', color: t.tinta }}>{titulo}</Text>
        {children ? <Text style={{ fontSize: 13.5, lineHeight: 19, color: INK.body }}>{children}</Text> : null}
      </View>
    </View>
  );
}

/**
 * Microbanner bajo la madurez: hay voces sin identificar. Abre el flujo para
 * decir quién habla; mientras tanto, las tarjetas no rotulan esas voces.
 */
function BannerVoces({ cuantas, onPress }) {
  const t = TONOS.ambar;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${cuantas} ${cuantas === 1 ? 'voz sin identificar' : 'voces sin identificar'}. Identificar`}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: t.fondo, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, opacity: pressed ? 0.8 : 1 })}
    >
      <Mic size={15} color={t.tinta} strokeWidth={2} />
      <Text style={{ flex: 1, fontSize: 13.5, fontWeight: '600', color: t.tinta }}>{`${cuantas} ${cuantas === 1 ? 'voz sin identificar' : 'voces sin identificar'}`}</Text>
      <Text style={{ fontSize: 13.5, fontWeight: '700', color: t.tinta }}>identificar</Text>
      <ChevronRight size={15} color={t.tinta} strokeWidth={2.2} />
    </Pressable>
  );
}

/** Nombre de la cuenta con la huella grande al lado, que se llena con lo que hay. */
function Cabecera({ titulo, subtitulo, madurez, cuenta, llenado, tono, voces = 0, onIdentificar, onHuella }) {
  const m = madurez ? MADUREZ[madurez] || MADUREZ.sin_observaciones : null;
  const IconoMadurez = ICONO_MADUREZ[madurez] || Hourglass;
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={ROTULO}>HUELLA DE AUTOR</Text>
          <Text style={{ fontFamily: SERIF, fontSize: 34, lineHeight: 38, color: INK.title }} accessibilityRole="header">
            {titulo}
          </Text>
          {subtitulo ? <Text style={{ fontSize: 14, color: INK.meta }}>{subtitulo}</Text> : null}
        </View>
        <Pressable onPress={onHuella} hitSlop={8} accessibilityRole="button" accessibilityHint="Abre la guía">
          <HuellaLlena llenado={llenado} tono={tono} size={78} />
        </Pressable>
      </View>
      {m ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          <Etiqueta Icono={IconoMadurez} texto={m.texto} tono={m.tono} />
          {cuenta ? (
            cuenta.usuario_confirmado ? (
              <Etiqueta Icono={BadgeCheck} texto="Cuenta confirmada" tono="verde" />
            ) : (
              <Etiqueta Icono={ShieldAlert} texto="Cuenta sin confirmar" tono="ambar" />
            )
          ) : null}
        </View>
      ) : null}
      {voces ? <BannerVoces cuantas={voces} onPress={onIdentificar} /> : null}
    </View>
  );
}

/** Una cifra en su recuadro: ícono, el número grande y qué es. */
function Cifra({ Icono, tono = 'neutro', etiqueta, valor }) {
  const t = TONOS[tono] || TONOS.neutro;
  return (
    <View style={{ flex: 1, gap: 8, backgroundColor: TONO.tarjeta, borderWidth: 1, borderColor: TONO.raya, borderRadius: 14, padding: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: t.fondo, alignItems: 'center', justifyContent: 'center' }}>
          <Icono size={15} color={t.tinta} strokeWidth={1.9} />
        </View>
        <Text style={{ fontSize: 20, fontWeight: '800', color: INK.title }}>{valor}</Text>
      </View>
      <Text style={{ fontSize: 13.5, color: INK.body }}>{etiqueta}</Text>
    </View>
  );
}

/** Una pestaña sin contenido: una línea, sin caja. */
function Vacio({ children }) {
  return <Text style={{ fontSize: 15, color: INK.meta, paddingVertical: 8 }}>{children}</Text>;
}

/** La cita, en su recuadro. */
function Cita({ texto, lineas }) {
  return (
    <View style={{ backgroundColor: 'rgba(28,43,34,0.04)', borderRadius: 12, padding: 12 }}>
      <View style={{ borderLeftWidth: 3, borderLeftColor: 'rgba(28,43,34,0.35)', paddingLeft: 10 }}>
        <Text style={{ fontSize: 15, lineHeight: 21, color: INK.title }} numberOfLines={lineas}>{`«${texto}»`}</Text>
      </View>
    </View>
  );
}

/** Una publicación de donde sale algo: su título y su fecha de publicación. */
function Fuente({ postId, fecha, titulos, numero, onPress }) {
  const titulo = String(titulos?.[postId] || 'Publicación').replace(/^@[^—]+—\s*/, '');
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, opacity: pressed ? 0.6 : 1 })}>
      <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: 'rgba(28,43,34,0.06)', alignItems: 'center', justifyContent: 'center' }}>
        {numero ? <Text style={{ fontSize: 12.5, fontWeight: '700', color: INK.meta }}>{numero}</Text> : <FileVideo size={15} color={INK.meta} />}
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={{ fontSize: 14, color: INK.title }} numberOfLines={1}>
          {titulo}
        </Text>
        <Text style={{ fontSize: 12.5, color: INK.meta }}>{fechaPublicacion(fecha)}</Text>
      </View>
    </Pressable>
  );
}

// ─── Lo observado ──────────────────────────────────────────────────────────

function Observado({ respuesta: r, consulta, tarjetas, titulos, identidad, onAbrir, onAbrirPost }) {
  const breve = r?.lectura_breve || null;
  const carac = r?.caracterizacion || null;
  const { temas, declaraciones } = useMemo(() => repartir(tarjetas), [tarjetas]);
  const argumentos = carac?.argumentos || [];
  const evolucion = carac?.evolucion || {};
  const nTiempo = (evolucion.eventos || []).length + (evolucion.linea_tiempo || []).length;
  const cuantos = { temas: temas.length, declaraciones: declaraciones.length, argumentos: argumentos.length, tiempo: nTiempo };
  const [pestana, setPestana] = useState(null);
  const activa = pestana || PESTANAS.find((p) => cuantos[p.id] > 0)?.id || 'temas';
  const fechas = fechasCubiertas(tarjetas);
  const publicaciones = breve?.cobertura?.publicaciones_con_observaciones ?? r?.cobertura?.n_items ?? 0;
  const nivel = nivelDimension(breve, PESTANAS.find((p) => p.id === activa).dimension);

  return (
    <Animated.View entering={FadeIn.duration(200)} style={{ gap: 18 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Cifra Icono={Newspaper} etiqueta="publicaciones analizadas" valor={publicaciones} />
        {fechas.total ? (
          <Cifra
            Icono={fechas.con < fechas.total ? CalendarX : CalendarCheck}
            tono={fechas.con < fechas.total ? 'ambar' : 'verde'}
            etiqueta="tienen fecha"
            valor={`${fechas.con} de ${fechas.total}`}
          />
        ) : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 18 }} style={{ borderBottomWidth: 1, borderBottomColor: TONO.raya, flexGrow: 0 }}>
        <View style={{ flexDirection: 'row', gap: 18 }} accessibilityRole="tablist">
          {PESTANAS.map((p) => {
            const on = activa === p.id;
            return (
              <Pressable
                key={p.id}
                onPress={() => setPestana(p.id)}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                style={{ paddingBottom: 9, borderBottomWidth: 2, borderBottomColor: on ? INK.title : 'transparent' }}
              >
                <Text style={{ fontSize: 15, fontWeight: on ? '700' : '500', color: on ? INK.title : INK.meta }}>{`${p.titulo} · ${cuantos[p.id]}`}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {/* El nivel de la dimensión; «sin observaciones» no se rotula sobre una lista con contenido. */}
      {nivel !== 'sin_observaciones' ? (
        <View style={{ flexDirection: 'row' }}>
          <EtiquetaNivel nivel={nivel} />
        </View>
      ) : null}

      {(activa === 'temas' || activa === 'declaraciones') && consulta.isLoading ? (
        <MorphingInfinity size={22} color={INK.meta} style={{ alignSelf: 'center', marginVertical: 12 }} />
      ) : (activa === 'temas' || activa === 'declaraciones') && consulta.error ? (
        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 13.5, color: INK.body }}>{motivoDeError(consulta.error)}</Text>
          <Boton texto="probar de nuevo" alto={40} onPress={() => consulta.refetch()} />
        </View>
      ) : activa === 'temas' ? (
        temas.length ? (
          <View style={{ gap: 2 }}>
            {temas.map((t, i) => (
              <FilaTema key={t.id} tarjeta={t} titulos={titulos} borde={i > 0} onAbrirPost={onAbrirPost} />
            ))}
          </View>
        ) : (
          <Vacio>Todavía no aparece ningún tema.</Vacio>
        )
      ) : activa === 'declaraciones' ? (
        <Declaraciones lista={declaraciones} titulos={titulos} identidad={identidad} onAbrir={onAbrir} onAbrirPost={onAbrirPost} carac={carac} />
      ) : activa === 'argumentos' ? (
        argumentos.length ? (
          <View style={{ gap: 12 }}>
            {argumentos.map((a) => (
              <Argumento key={a.faceta} argumento={a} titulos={titulos} onAbrirPost={onAbrirPost} />
            ))}
          </View>
        ) : (
          <Vacio>Todavía no hay argumentos explícitos comprobados.</Vacio>
        )
      ) : (
        <Tiempo evolucion={evolucion} titulos={titulos} onAbrirPost={onAbrirPost} />
      )}
    </Animated.View>
  );
}

/** Un tema: en cuántas publicaciones aparece y, al abrirlo, cuáles son. */
function FilaTema({ tarjeta: t, titulos, borde, onAbrirPost }) {
  const [abierto, setAbierto] = useState(false);
  const n = publicacionesDe(t);
  return (
    <View style={{ borderTopWidth: borde ? 1 : 0, borderTopColor: TONO.raya }}>
      <Pressable onPress={() => setAbierto((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: abierto }} style={{ paddingVertical: 13 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: INK.title }} numberOfLines={2}>
            {capital(t.titulo)}
          </Text>
          <Text style={{ fontSize: 13, fontWeight: '700', color: INK.meta }}>{`${n} ${n === 1 ? 'publicación' : 'publicaciones'}`}</Text>
          <ChevronDown size={18} color={INK.meta} style={{ transform: [{ rotate: abierto ? '180deg' : '0deg' }] }} />
        </View>
      </Pressable>
      {abierto ? (
        <Animated.View entering={FadeIn.duration(160)} style={{ gap: 10, paddingBottom: 14 }}>
          {t.evidencia.map((e, i) => (
            <Fuente key={`${e.post_id}-${i}`} postId={e.post_id} fecha={e.fecha} titulos={titulos} numero={i + 1} onPress={() => onAbrirPost(e.post_id)} />
          ))}
        </Animated.View>
      ) : null}
    </View>
  );
}

/** Las declaraciones con cita; si hay de los dos tipos, se filtran por quién habla. */
function Declaraciones({ lista, titulos, identidad, carac, onAbrir, onAbrirPost }) {
  const [filtro, setFiltro] = useState('todas');
  const [cuantas, setCuantas] = useState(DE_A);
  const propias = lista.filter(delAutor);
  const otras = lista.filter((t) => !delAutor(t));
  const visibles = filtro === 'cuenta' ? propias : filtro === 'otras' ? otras : lista;
  if (!lista.length) return <Vacio>Todavía no hay declaraciones con cita.</Vacio>;
  return (
    <View style={{ gap: 12 }}>
      {propias.length && otras.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {[
            ['todas', `todas · ${lista.length}`],
            ['cuenta', `de la cuenta · ${propias.length}`],
            ['otras', `sin identificar · ${otras.length}`],
          ].map(([k, texto]) => {
            const on = filtro === k;
            return (
              <Pressable
                key={k}
                onPress={() => {
                  setFiltro(k);
                  setCuantas(DE_A);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: on ? INK.title : 'rgba(28,43,34,0.06)' }}
              >
                <Text style={{ fontSize: 13.5, fontWeight: '600', color: on ? '#FFFFFF' : INK.body }}>{texto}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      {visibles.slice(0, cuantas).map((t) =>
        t.clase === 'lectura_por_dimension' ? (
          <TarjetaLectura key={t.id} tarjeta={t} carac={carac} onAbrir={() => onAbrir(t)} />
        ) : (
          <TarjetaDeclaracion key={t.id} tarjeta={t} titulos={titulos} identidad={identidad} onAbrir={() => onAbrir(t)} onAbrirPost={onAbrirPost} />
        )
      )}
      {visibles.length > cuantas ? <Boton texto={`ver más · ${visibles.length - cuantas}`} alto={40} onPress={() => setCuantas((n) => n + DE_A)} /> : null}
    </View>
  );
}

/** Una declaración: la cita, quién la dice y de qué publicación sale. */
function TarjetaDeclaracion({ tarjeta: t, titulos, identidad, onAbrir, onAbrirPost }) {
  const e = t.evidencia[0] || {};
  const r = RESPALDO[t.respaldo];
  return (
    <Pressable
      onPress={onAbrir}
      accessibilityRole="button"
      style={({ pressed }) => ({ backgroundColor: TONO.tarjeta, borderWidth: 1, borderColor: TONO.raya, borderRadius: 16, padding: 14, gap: 10, opacity: pressed ? 0.85 : 1 })}
    >
      {e.cita ? <Cita texto={e.cita} lineas={5} /> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        <EtiquetaVoz evidencia={e} revision={revisionDeVoz(identidad, e.post_id, e.voz_local)} />
        {r ? <Etiqueta chica Icono={r.tono === 'verde' ? Check : TriangleAlert} texto={r.texto} tono={r.tono} /> : null}
      </View>
      <Fuente postId={e.post_id} fecha={e.fecha} titulos={titulos} onPress={() => onAbrirPost(e.post_id)} />
    </Pressable>
  );
}

/** Una lectura que reúne declaraciones equivalentes de varias fuentes. */
function TarjetaLectura({ tarjeta: t, carac, onAbrir }) {
  const p = (carac?.posiciones || []).find((x) => x.dimension_id === t.dimension_id);
  const titulo = p?.proposiciones?.[0] || (p?.referentes || []).filter(Boolean).join(', ') || NIVELES[t.nivel]?.texto;
  const n = publicacionesDe(t);
  return (
    <Pressable
      onPress={onAbrir}
      accessibilityRole="button"
      style={({ pressed }) => ({ backgroundColor: TONO.tarjeta, borderWidth: 1, borderColor: TONO.raya, borderRadius: 16, padding: 14, gap: 10, opacity: pressed ? 0.85 : 1 })}
    >
      <Text style={{ fontSize: 16.5, fontWeight: '800', color: INK.title }}>{titulo}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        <EtiquetaNivel chica nivel={t.nivel} />
        <Etiqueta chica Icono={Newspaper} texto={`${n} ${n === 1 ? 'publicación' : 'publicaciones'}`} />
      </View>
    </Pressable>
  );
}

/** Un tipo de argumento explícito, con sus citas. */
function Argumento({ argumento: a, titulos, onAbrirPost }) {
  const citas = (a.evidencia || []).filter((e) => e.cita);
  return (
    <View style={{ backgroundColor: TONO.tarjeta, borderWidth: 1, borderColor: TONO.raya, borderRadius: 16, padding: 14, gap: 10 }}>
      <Text style={{ fontSize: 16.5, fontWeight: '800', color: INK.title }}>{FACETAS[a.faceta] || a.faceta}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {a.alcance === 'intervenciones_atribuidas' ? <Etiqueta chica Icono={UserRoundCheck} texto="Lo dijo la cuenta" tono="verde" /> : null}
        <Etiqueta chica Icono={Newspaper} texto={`${a.publicaciones} ${a.publicaciones === 1 ? 'publicación' : 'publicaciones'}`} />
      </View>
      {citas.slice(0, 3).map((e) => (
        <View key={e.observacion_id} style={{ gap: 8 }}>
          <Cita texto={e.cita} lineas={4} />
          <Fuente postId={e.post_id} fecha={e.fecha} titulos={titulos} onPress={() => onAbrirPost(e.post_id)} />
        </View>
      ))}
    </View>
  );
}

/** Lo que se puede ordenar en el tiempo: relaciones entre intervenciones y la línea por fecha. */
function Tiempo({ evolucion, titulos, onAbrirPost }) {
  const eventos = evolucion.eventos || [];
  const linea = evolucion.linea_tiempo || [];
  const sinFecha = (evolucion.sin_fecha || []).length;
  if (!eventos.length && !linea.length) {
    return <Vacio>{sinFecha ? `Hay ${sinFecha} ${sinFecha === 1 ? 'declaración comprobada' : 'declaraciones comprobadas'} sin fecha; sin fecha no se pueden ordenar.` : 'Todavía no hay declaraciones con fecha para comparar.'}</Vacio>;
  }
  return (
    <View style={{ gap: 16 }}>
      {eventos.map((ev, i) => {
        const tipo = TRAYECTORIA[ev.tipo] || { texto: ev.tipo, tono: 'neutro' };
        return (
          <View key={`${ev.tipo}-${i}`} style={{ backgroundColor: TONO.tarjeta, borderWidth: 1, borderColor: TONO.raya, borderRadius: 16, padding: 14, gap: 10 }}>
            <View style={{ flexDirection: 'row' }}>
              <Etiqueta chica Icono={History} texto={tipo.texto} tono={tipo.tono} />
            </View>
            {(ev.evidencia || []).map((e) => (
              <View key={e.observacion_id} style={{ gap: 6 }}>
                {e.cita ? <Cita texto={e.cita} lineas={3} /> : null}
                <Fuente postId={e.post_id} fecha={e.fecha} titulos={titulos} onPress={() => onAbrirPost(e.post_id)} />
              </View>
            ))}
          </View>
        );
      })}
      {linea.length ? (
        <View style={{ gap: 10 }}>
          <Text style={{ fontSize: 16, fontWeight: '800', color: INK.title }}>Por fecha de publicación</Text>
          {linea.map((e) => (
            <Pressable key={e.observacion_id} onPress={() => onAbrirPost(e.post_id)} accessibilityRole="button" style={({ pressed }) => ({ flexDirection: 'row', gap: 12, opacity: pressed ? 0.6 : 1 })}>
              <Text style={{ width: 84, fontSize: 12.5, fontWeight: '700', color: INK.meta, paddingTop: 2 }}>{fechaPublicacion(e.fecha)}</Text>
              <Text style={{ flex: 1, fontSize: 14.5, lineHeight: 20, color: INK.title }} numberOfLines={3}>{`«${e.cita}»`}</Text>
            </Pressable>
          ))}
          {sinFecha ? <Text style={{ fontSize: 13.5, color: INK.meta }}>{`${sinFecha} sin fecha, fuera de la línea.`}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

// ─── Una tarjeta abierta: sus citas y quién las dice ───────────────────────

function DetalleTarjeta({ tarjeta: t, posicion, titulos, identidad, bottomInset, onAbrirPost, onIdentificar }) {
  const lectura = t.clase === 'lectura_por_dimension';
  const faltan = faltaDe(t);
  const r = RESPALDO[t.respaldo];
  const contra = (t.contraevidencia || []).length;
  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: bottomInset + 32, gap: 18 }} keyboardShouldPersistTaps="handled">
      <View style={{ gap: 8 }}>
        <Text style={ROTULO}>{lectura ? 'LECTURA' : 'DECLARACIÓN'}</Text>
        {lectura ? (
          <Text style={{ fontFamily: SERIF, fontSize: 28, lineHeight: 32, color: INK.title }} accessibilityRole="header">
            {posicion?.proposiciones?.[0] || NIVELES[t.nivel]?.texto}
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          <EtiquetaNivel nivel={t.nivel} />
          {r ? <Etiqueta Icono={r.tono === 'verde' ? Check : TriangleAlert} texto={r.texto} tono={r.tono} /> : null}
          {contra ? <Etiqueta Icono={TriangleAlert} texto={`${contra} ${contra === 1 ? 'evidencia' : 'evidencias'} en contra`} tono="rojo" /> : null}
        </View>
        {faltan.length ? <Text style={{ fontSize: 13.5, lineHeight: 19, color: INK.meta }}>{`Falta ${faltan.join(', ')}.`}</Text> : null}
      </View>

      <View style={{ gap: 14 }}>
        {lectura ? <Text style={{ fontSize: 16, fontWeight: '800', color: INK.title }}>{`De dónde sale · ${t.evidencia.length}`}</Text> : null}
        {t.evidencia.map((e) => (
          <View key={e.observacion_id} style={{ gap: 10 }}>
            {e.cita ? <Cita texto={e.cita} /> : null}
            <View style={{ flexDirection: 'row' }}>
              <EtiquetaVoz chica={false} evidencia={e} revision={revisionDeVoz(identidad, e.post_id, e.voz_local)} />
            </View>
            <Fuente postId={e.post_id} fecha={e.fecha} titulos={titulos} onPress={() => onAbrirPost(e.post_id)} />
            {e.voz_local && (!e.atribuida_al_autor || revisionDeVoz(identidad, e.post_id, e.voz_local)) ? (
              <Boton
                texto={revisionDeVoz(identidad, e.post_id, e.voz_local) ? 'cambiar quién habla' : 'decir quién habla'}
                alto={40}
                onPress={() => {
                  roce();
                  onIdentificar({ clave: `${e.post_id}|${e.voz_local}`, post_id: e.post_id, voz: e.voz_local, fecha: e.fecha, citas: e.cita ? [e.cita] : [] });
                }}
              />
            ) : null}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
