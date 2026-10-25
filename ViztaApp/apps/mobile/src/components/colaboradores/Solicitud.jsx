import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronLeft, TriangleAlert } from 'lucide-react-native';
import { INK, SERIF } from '../theme';
import { falla, listo } from '../../utils/haptics';
import { aprobarSolicitud, rechazarSolicitud, vistaDeSolicitud } from './api';
import { ETIQUETA_CAMPO, camposLegibles, cambiosDeSolicitud, cambiosReales, claveParaAprobar, difEtiquetas, traeAntes, venceEn } from './logica';
import { Avatar, Boton, EstadoCentro, ROTULO, TONO } from './piezas';
import MorphingInfinity from '../MorphingInfinity';

/**
 * Una propuesta de cambio (pantallas 16 y 17): antes y después por campo,
 * siempre contra la versión de ahora.
 *
 * Cada campo lleva su casilla: se aprueban solo los marcados (`campos`, PR
 * #56). Si la propuesta ya trae el antes (fichas del universo), se muestra tal
 * cual; si no, se pide la vista previa contra la versión de ahora. Si la nota
 * cambió desde la propuesta (`conflicto`), aprobar no se puede: se le pide que
 * la vuelva a proponer, o se rechaza.
 */
export default function Solicitud({ solicitud: s, titulo, otro, topInset, bottomInset, onVolver, onPedirDeNuevo }) {
  const queryClient = useQueryClient();
  const [ocupado, setOcupado] = useState(null);
  const propia = traeAntes(s);
  const vista = useQuery({
    queryKey: ['colab-vista-solicitud', s.id],
    queryFn: () => vistaDeSolicitud(s),
    enabled: !propia,
    staleTime: 0,
    retry: false,
  });
  const cambios = cambiosReales(propia ? cambiosDeSolicitud(s) : vista.data?.cambios);
  const [choco, setChoco] = useState(false);
  const conflicto = choco || !!vista.data?.conflicto;
  // Todos marcados al abrir; se desmarca lo que no se quiere.
  const [fuera, setFuera] = useState(() => new Set());
  const marcados = cambios.filter((c) => !fuera.has(c.campo));
  const alternar = (campo) =>
    setFuera((prev) => {
      const n = new Set(prev);
      if (n.has(campo)) n.delete(campo);
      else n.add(campo);
      return n;
    });
  const nombreTitulo = titulo || cambios.find((c) => c.campo === 'titulo' || c.campo === 'title')?.antes || 'Sin título';

  const terminar = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['colab-solicitudes'] }),
      queryClient.invalidateQueries({ queryKey: ['colab-lista'] }),
      queryClient.invalidateQueries({ queryKey: ['colab-avisos'] }),
    ]);
    onVolver();
  };

  const aprobar = async () => {
    setOcupado('si');
    try {
      // Todos marcados: se aprueba entera (sirve también con el backend viejo).
      await aprobarSolicitud(s.id, marcados.length < cambios.length ? { campos: [...new Set(marcados.map((c) => claveParaAprobar(s, c.campo)))] } : {});
      listo();
      await terminar();
    } catch (e) {
      setOcupado(null);
      if (e?.code === 'conflicto_version') {
        falla();
        setChoco(true);
        if (!propia) vista.refetch();
        return;
      }
      Alert.alert('No se pudo aprobar', e?.code === 'solicitud_vencida' ? 'La propuesta venció.' : 'Revisá la conexión y probá de nuevo.');
    }
  };

  const rechazar = async () => {
    setOcupado('no');
    try {
      await rechazarSolicitud(s.id);
      await terminar();
    } catch {
      setOcupado(null);
      Alert.alert('No se pudo rechazar', 'Revisá la conexión y probá de nuevo.');
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingTop: topInset + 10, paddingHorizontal: 20, paddingBottom: 14, gap: 10, borderBottomWidth: 1, borderBottomColor: TONO.raya }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Pressable
            onPress={onVolver}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Volver"
            style={({ pressed }) => ({ width: 44, height: 44, marginLeft: -10, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.5 : 1 })}
          >
            <ChevronLeft size={24} color={INK.title} strokeWidth={2} />
          </Pressable>
          <Avatar tipo={otro.tipo} nombre={otro.nombre} size={28} />
          <Text style={{ flex: 1, fontSize: 14, color: INK.title }} numberOfLines={1}>
            <Text style={{ fontWeight: '700' }}>{otro.nombre}</Text> propone cambios
          </Text>
          {conflicto ? null : <Text style={{ fontSize: 12, color: INK.meta }}>{venceEn(s.vence_at)}</Text>}
        </View>
        <Text style={{ fontFamily: SERIF, fontSize: 28, lineHeight: 32, color: INK.title }} accessibilityRole="header">
          {nombreTitulo}
        </Text>
      </View>

      {!propia && vista.isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <MorphingInfinity size={28} color={INK.meta} />
        </View>
      ) : !propia && vista.error ? (
        <EstadoCentro
          titulo={vista.error?.code === 'recurso_no_encontrado' ? 'Eso ya no existe' : 'No se pudo abrir la propuesta'}
          texto={vista.error?.code === 'recurso_no_encontrado' ? 'Lo borraste después de que llegó la propuesta.' : 'Revisá la conexión y probá de nuevo.'}
        >
          {vista.error?.code === 'recurso_no_encontrado' ? (
            <Boton texto="descartar la propuesta" onPress={rechazar} cargando={ocupado === 'no'} />
          ) : (
            <Boton texto="probar de nuevo" onPress={() => vista.refetch()} />
          )}
        </EstadoCentro>
      ) : (
        <>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
            {conflicto ? (
              <View accessibilityRole="alert" style={{ flexDirection: 'row', gap: 10, backgroundColor: TONO.arenaLavado, borderRadius: 14, padding: 14 }}>
                <TriangleAlert size={18} color={TONO.arena} style={{ marginTop: 1 }} />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ fontSize: 14.5, fontWeight: '700', color: TONO.arena }}>Cambió mientras tanto</Text>
                  <Text style={{ fontSize: 13, lineHeight: 18, color: TONO.arena }}>
                    La propuesta se hizo sobre una versión anterior. Abajo la ves contra la de ahora; para aprobarla, {otro.nombre} tiene que volver a proponerla.
                  </Text>
                </View>
              </View>
            ) : null}

            {cambios.length ? (
              cambios.map((c) => (
                <Campo key={c.campo} cambio={c} marcado={!fuera.has(c.campo)} onAlternar={conflicto ? null : () => alternar(c.campo)} />
              ))
            ) : (
              <Text style={{ fontSize: 14, color: INK.body }}>La propuesta no cambia nada de lo que ya tenés.</Text>
            )}
          </ScrollView>

          <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: bottomInset + 14, gap: 8, borderTopWidth: 1, borderTopColor: TONO.raya }}>
            {conflicto ? (
              <Boton texto="pedirle que la vuelva a proponer" primario onPress={onPedirDeNuevo} disabled={!!ocupado} />
            ) : cambios.length ? (
              <Boton
                texto={marcados.length === 1 ? 'aprobar el cambio' : marcados.length ? `aprobar ${marcados.length} cambios` : 'elegí qué aprobar'}
                primario
                onPress={aprobar}
                cargando={ocupado === 'si'}
                disabled={!!ocupado || !marcados.length}
              />
            ) : null}
            <Boton texto="rechazar" peligro alto={44} onPress={rechazar} cargando={ocupado === 'no'} disabled={!!ocupado} />
          </View>
        </>
      )}
    </View>
  );
}

/**
 * Los campos de una ficha (`details`) que cambian, en texto: clave, lo que
 * había y lo que quedaría. Lo anidado no se muestra.
 */
function difDetalles(antes, despues) {
  const a = Object.fromEntries(camposLegibles(antes).map((c) => [c.clave, c.valor]));
  return camposLegibles(despues)
    .filter((c) => a[c.clave] !== c.valor)
    .map((c) => ({ clave: c.clave, antes: a[c.clave] ?? null, despues: c.valor }));
}

/**
 * Un campo: lo que hay tachado y lo que quedaría, con su casilla. Las
 * etiquetas, una por una; los campos de la ficha, renglón por renglón.
 */
function Campo({ cambio, marcado, onAlternar }) {
  const etiqueta = (ETIQUETA_CAMPO[cambio.campo] || cambio.campo).toUpperCase();
  const esLista = Array.isArray(cambio.antes) || Array.isArray(cambio.despues);
  const esFicha = !esLista && [cambio.antes, cambio.despues].some((v) => v && typeof v === 'object');
  return (
    <View
      style={{
        backgroundColor: 'rgba(255,255,255,0.86)',
        borderWidth: 1,
        borderColor: 'rgba(28,43,34,0.08)',
        borderRadius: 16,
        padding: 14,
        gap: 8,
        opacity: marcado ? 1 : 0.55,
      }}
    >
      <Pressable
        onPress={onAlternar}
        disabled={!onAlternar}
        hitSlop={8}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: marcado, disabled: !onAlternar }}
        accessibilityLabel={etiqueta.toLowerCase()}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
      >
        {onAlternar ? (
          <View
            style={{
              width: 20,
              height: 20,
              borderRadius: 6,
              borderWidth: marcado ? 0 : 1.5,
              borderColor: 'rgba(28,43,34,0.25)',
              backgroundColor: marcado ? TONO.verde : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {marcado ? <Check size={13} color="#FFFFFF" strokeWidth={3} /> : null}
          </View>
        ) : null}
        <Text style={ROTULO}>{etiqueta}</Text>
      </Pressable>
      {esFicha ? (
        difDetalles(cambio.antes, cambio.despues).map((d) => (
          <View key={d.clave} style={{ gap: 2 }}>
            <Text style={{ fontSize: 11.5, fontWeight: '700', color: INK.meta }}>{d.clave}</Text>
            {d.antes ? <Text style={{ fontSize: 13.5, color: INK.meta, textDecorationLine: 'line-through' }}>{d.antes}</Text> : null}
            <Text style={{ fontSize: 14, color: TONO.verde, fontWeight: '600' }}>{d.despues}</Text>
          </View>
        ))
      ) : esLista ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {difEtiquetas(cambio.antes, cambio.despues).map((t) => (
            <View
              key={`${t.estado}-${t.texto}`}
              style={{
                borderRadius: 8,
                paddingHorizontal: 9,
                paddingVertical: 4,
                backgroundColor: t.estado === 'suma' ? TONO.verdeLavado : t.estado === 'quita' ? TONO.ladrilloLavado : 'rgba(28,43,34,0.05)',
              }}
            >
              <Text
                style={{
                  fontSize: 12.5,
                  fontWeight: t.estado === 'queda' ? '400' : '600',
                  color: t.estado === 'suma' ? TONO.verde : t.estado === 'quita' ? TONO.ladrilloTinta : INK.body,
                  textDecorationLine: t.estado === 'quita' ? 'line-through' : 'none',
                }}
              >
                {t.estado === 'suma' ? `+ ${t.texto}` : t.texto}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <>
          {cambio.antes != null && cambio.antes !== '' ? (
            <Text style={{ fontSize: 14, lineHeight: 20, color: INK.meta, textDecorationLine: 'line-through' }} accessibilityLabel={`Antes: ${cambio.antes}`}>
              {String(cambio.antes)}
            </Text>
          ) : null}
          {cambio.despues != null && cambio.despues !== '' ? (
            <Text style={{ fontSize: 14.5, lineHeight: 21, color: TONO.verde, fontWeight: '600' }} accessibilityLabel={`Queda: ${cambio.despues}`}>
              {String(cambio.despues)}
            </Text>
          ) : (
            <Text style={{ fontSize: 13.5, color: INK.meta, fontStyle: 'italic' }}>queda vacío</Text>
          )}
        </>
      )}
    </View>
  );
}
