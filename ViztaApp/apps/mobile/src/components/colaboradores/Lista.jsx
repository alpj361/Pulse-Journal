import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Bell, ChevronRight, Plus, X } from 'lucide-react-native';
import { INK } from '../theme';
import { usePistasStore, PISTA } from '../../state/pistasStore';
import { NoDisponible, humanosHabilitados } from './api';
import { filtrar, horaCorta, ordenar, porAprobar, previa, queHace } from './logica';
import { Avatar, Boton, Chip, EstadoCentro, TONO, nombreDe, Refrescar } from './piezas';
import { TarjetaConexion } from './AutorizarConexion';

const FILTROS = ['todos', 'agentes', 'personas'];

/**
 * La lista de Colaboradores (pantallas 1 y 3 del diseño): los chats y sus
 * estados. Recibe la consulta ya hecha; la pantalla que la monta decide a
 * dónde lleva cada fila.
 */
export default function Lista({
  consulta,
  porAprobar: cuantosPorAprobar = 0,
  sinLeer = 0,
  topInset,
  bottomInset,
  onAbrir,
  onSumar,
  onCerrar,
  onEntrar,
  onPorAprobar,
  onAvisos,
  conexiones = [],
  onAutorizar,
}) {
  const { data, error, isLoading, refetch } = consulta;
  const [filtro, setFiltro] = useState('todos');
  const humanos = humanosHabilitados();
  const lista = useMemo(() => ordenar(filtrar(data || [], filtro)), [data, filtro]);

  const titulo = (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Text
        style={{ flex: 1, fontSize: 40, lineHeight: 44, fontWeight: '800', letterSpacing: -1.3, color: INK.title }}
        accessibilityRole="header"
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        Colaboradores
      </Text>
      {data && !error ? <Campana sinLeer={sinLeer} onPress={onAvisos} /> : null}
      <Pressable
        onPress={onCerrar}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Volver al feed"
        style={({ pressed }) => ({ width: 44, height: 44, marginRight: -10, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.5 : 1 })}
      >
        <X size={22} color={INK.title} strokeWidth={1.8} />
      </Pressable>
    </View>
  );
  const marco = (cuerpo) => (
    <View style={{ flex: 1, paddingTop: topInset + 20, paddingHorizontal: 24, paddingBottom: bottomInset + 20 }}>
      {titulo}
      {cuerpo}
    </View>
  );

  if (isLoading) return marco(<Cargando />);

  if (error) {
    const motivo = error instanceof NoDisponible ? error.motivo : null;
    if (motivo === 'beta') {
      return marco(
        <EstadoCentro
          titulo="Trabajar con agentes y colegas llega pronto"
          texto="Hoy está abierto para la beta. Te avisamos cuando se abra para tu cuenta."
        />
      );
    }
    if (motivo === 'sesion') {
      return marco(
        <EstadoCentro
          icono={<Avatar tipo="agente" nombre="Ag" size={68} />}
          titulo="Entrá con tu cuenta para trabajar con agentes"
          texto="Tus agentes, sus chats y lo que guardan quedan en tu cuenta."
        >
          {onEntrar ? <Boton texto="entrar" primario onPress={onEntrar} /> : null}
        </EstadoCentro>
      );
    }
    if (motivo === 'apagado') {
      return marco(
        <EstadoCentro titulo="Colaboradores no está disponible ahora" texto="Tus chats y lo que compartiste siguen guardados." />
      );
    }
    return marco(
      <EstadoCentro titulo="No se pudo traer la lista" texto="Revisá la conexión y probá de nuevo.">
        <Boton texto="probar de nuevo" onPress={() => refetch()} />
      </EstadoCentro>
    );
  }

  if (!data?.length) {
    return marco(
      <>
        {humanos ? (
          // «invitar a un colega» todavía no tiene cómo hacerse: el botón
          // entra cuando el backend diga cómo se invita (duda 4 del README).
          <EstadoCentro
            titulo="Todavía no trabajás con nadie"
            texto="Conectá un agente que investigue por vos, o invitá a un colega a compartir lo que tienen."
          >
            <Boton texto="conectar un agente" primario onPress={onSumar} />
          </EstadoCentro>
        ) : (
          <EstadoCentro
            icono={<Avatar tipo="agente" nombre="Ag" size={68} />}
            titulo="Todavía no tenés agentes"
            texto="Un agente investiga y guarda en su propio Codex, y vos decidís qué pasa al tuyo."
          >
            <Boton texto="conectar un agente" primario onPress={onSumar} />
          </EstadoCentro>
        )}
        {humanos ? null : <AvisoColegas />}
      </>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: topInset + 20, paddingHorizontal: 24, paddingBottom: 24, gap: 16 }}
        refreshControl={<Refrescar onRefresh={refetch} />}
      >
        {titulo}

        {/* Con solo agentes, filtrar no separa nada: aparece cuando hay personas. */}
        {humanos ? (
          <View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: 6 }}>
            {FILTROS.map((f) => {
              const activo = f === filtro;
              return (
                <Pressable
                  key={f}
                  onPress={() => setFiltro(f)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: activo }}
                  style={{
                    height: 32,
                    paddingHorizontal: 14,
                    borderRadius: 16,
                    justifyContent: 'center',
                    backgroundColor: activo ? INK.title : 'transparent',
                    borderWidth: activo ? 0 : 1,
                    borderColor: TONO.borde,
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '600', color: activo ? '#FFFFFF' : INK.body }}>{f}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {conexiones.map((s) => (
          <TarjetaConexion key={s.req_id} solicitud={s} onPress={() => onAutorizar?.(s)} />
        ))}

        {cuantosPorAprobar ? (
          <Pressable
            onPress={() => onPorAprobar(null)}
            accessibilityRole="button"
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              backgroundColor: '#FFFFFF',
              borderWidth: 1,
              borderColor: 'rgba(154,83,71,0.28)',
              borderRadius: 16,
              paddingVertical: 12,
              paddingHorizontal: 14,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text style={{ flex: 1, fontSize: 14.5, fontWeight: '600', color: INK.title }}>
              <Text style={{ color: TONO.ladrillo }}>{cuantosPorAprobar}</Text> {cuantosPorAprobar === 1 ? 'cosa por aprobar' : 'cosas por aprobar'}
            </Text>
            <ChevronRight size={18} color={TONO.ladrillo} />
          </Pressable>
        ) : null}

        <View>
          {lista.map((c, i) => (
            <Fila
              key={c.id}
              colaborador={c}
              ultima={i === lista.length - 1}
              onPress={() => onAbrir(c)}
              onPorAprobar={() => onPorAprobar(c)}
            />
          ))}
        </View>
      </ScrollView>

      <View style={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: bottomInset + 16, gap: 12 }}>
        {humanos ? null : <AvisoColegas />}
        <Pressable
          onPress={onSumar}
          accessibilityRole="button"
          style={({ pressed }) => ({
            height: 50,
            borderRadius: 15,
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: 'rgba(61,95,70,0.45)',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Plus size={16} color={TONO.verde} strokeWidth={2.2} />
          <Text style={{ fontSize: 14.5, fontWeight: '600', color: TONO.verde }}>conectar un agente</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Fila({ colaborador: c, ultima, onPress, onPorAprobar }) {
  const texto = previa(c);
  const pendientes = porAprobar(c.solicitudes_pendientes);
  const nombre = nombreDe(c);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[nombre, c.cuenta_tipo === 'agente' ? 'agente' : null, texto, pendientes].filter(Boolean).join(', ')}
      style={({ pressed }) => ({
        flexDirection: 'row',
        gap: 14,
        alignItems: 'flex-start',
        paddingVertical: 12,
        paddingHorizontal: 2,
        borderBottomWidth: ultima ? 0 : 1,
        borderBottomColor: TONO.raya,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Avatar tipo={c.cuenta_tipo} nombre={nombre} />
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: INK.title, flexShrink: 1 }} numberOfLines={1}>
            {nombre}
          </Text>
          {c.cuenta_tipo === 'agente' ? <Text style={{ fontSize: 11.5, color: INK.meta }}>agente</Text> : null}
          <View style={{ flex: 1 }} />
          <Text style={{ fontSize: 12, color: INK.meta }}>{horaCorta(c.ultimo_mensaje?.created_at)}</Text>
        </View>
        {texto ? (
          <Text
            style={{ fontSize: 13.5, color: pendientes ? '#2E3B33' : INK.body, fontWeight: pendientes ? '600' : '400' }}
            numberOfLines={1}
          >
            {texto}
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          {pendientes ? (
            <Pressable onPress={onPorAprobar} hitSlop={6} accessibilityRole="button" accessibilityLabel={`Ver ${pendientes}`}>
              <Chip texto={pendientes} />
            </Pressable>
          ) : null}
          <Text style={{ fontSize: 11.5, color: INK.meta }}>{queHace(c.permisos)}</Text>
        </View>
      </View>
    </Pressable>
  );
}

/** Tres renglones vacíos mientras llega la lista. */
function Cargando() {
  const fila = (ancho, redondo) => (
    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
      <View style={{ width: 46, height: 46, borderRadius: redondo ? 23 : 13, backgroundColor: 'rgba(28,43,34,0.07)' }} />
      <View style={{ flex: 1, gap: 8 }}>
        <View style={{ height: 12, width: `${ancho}%`, borderRadius: 6, backgroundColor: 'rgba(28,43,34,0.08)' }} />
        <View style={{ height: 10, width: `${ancho + 22}%`, borderRadius: 5, backgroundColor: 'rgba(28,43,34,0.05)' }} />
      </View>
    </View>
  );
  return (
    <View style={{ gap: 18, marginTop: 22 }} accessibilityLabel="Cargando" accessible>
      {fila(60)}
      {fila(45, true)}
      {fila(55)}
    </View>
  );
}

/**
 * «Pronto vas a poder colaborar también con colegas y amigos.» Se ve hasta que
 * se cierra, y no vuelve: queda anotado en el teléfono.
 */
function AvisoColegas() {
  const pendiente = usePistasStore((s) => !s.hechas[PISTA.COLAB_COLEGAS]);
  const marcar = usePistasStore((s) => s.marcar);
  if (!pendiente) return null;
  return (
    <View
      accessibilityRole="text"
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        paddingVertical: 12,
        paddingLeft: 14,
        paddingRight: 8,
        flexDirection: 'row',
        gap: 10,
        alignItems: 'flex-start',
        shadowColor: '#1E3326',
        shadowOpacity: 0.14,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 6 },
        elevation: 4,
      }}
    >
      <Text style={{ flex: 1, fontSize: 13.5, lineHeight: 19, color: '#2E3B33' }}>
        Pronto vas a poder colaborar también con colegas y amigos.
      </Text>
      <Pressable
        onPress={() => marcar(PISTA.COLAB_COLEGAS)}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Cerrar"
        style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center', marginTop: -4 }}
      >
        <X size={16} color={INK.meta} strokeWidth={2} />
      </Pressable>
    </View>
  );
}

/** La campana de avisos, con cuántos hay sin leer. */
function Campana({ sinLeer, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={sinLeer ? `Avisos, ${sinLeer} sin leer` : 'Avisos'}
      style={({ pressed }) => ({ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.5 : 1 })}
    >
      <Bell size={22} color={INK.title} strokeWidth={1.8} />
      {sinLeer ? (
        <View
          accessible={false}
          style={{
            position: 'absolute',
            top: 5,
            right: 4,
            minWidth: 17,
            height: 17,
            borderRadius: 9,
            paddingHorizontal: 4,
            backgroundColor: TONO.rojo,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 10.5, fontWeight: '700', color: '#FFFFFF' }}>{sinLeer > 9 ? '9+' : sinLeer}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}
