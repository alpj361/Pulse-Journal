import { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Link2, MapPin, BadgeCheck, Landmark, Spline, Shapes, MapPinOff, PenTool } from 'lucide-react-native';
import { INK, RADIUS } from '../theme';
import { MONO } from './mono';
import { inputStyle } from './FieldInput';
import { roce } from '../../utils/haptics';
import BuscarLimite from './BuscarLimite';
import MiniMapa from './campos/MiniMapa';
import MarcarGeoModal from './campos/MarcarGeoModal';
import {
  ROLES,
  etiquetaNivel,
  nivelDe,
  normalizarGeo,
  representacionDe,
  puntoDe,
  geoDePunto,
  geoDeLimite,
  geoVinculado,
  conRol,
} from './geo';

/**
 * Lo geográfico de un Territorio, dentro de su ficha.
 *
 * **Es una sección de la ficha y no una pestaña.** Un Territorio sin geometría
 * no aparece en el mapa, y hoy hay tres así sin que nadie lo sepa: esconder eso
 * detrás de una pestaña es garantizar que se siga sin saber. Acá el estado se
 * lee al abrir, junto al nombre y la descripción.
 *
 * **El rol y la geometría son dos preguntas separadas.** «Qué es» —una frontera,
 * un área, un punto— lo decide la persona; «cómo se dibuja» lo decide la
 * geometría que tenga. Mezclarlas es lo que producía el desorden anterior, donde
 * `boundary_type` decía «place» y el elemento no se dibujaba en ningún lado
 * aunque tuviera coordenadas perfectamente buenas.
 *
 * **Dibujar polígonos no se hace acá.** Un área o un recorrido se trazan sobre
 * el mapa; esta ficha solo escribe lo que se puede escribir con el teclado —un
 * punto— o copiar del catálogo —una frontera oficial—. Decirlo en pantalla es
 * mejor que ofrecer un control que no lleva a ninguna parte.
 */

const VERDE = '#3A6049';
const AMBAR = '#B45309';

function Rotulo({ children, style }) {
  return (
    <Text
      style={[
        { fontSize: 10, fontWeight: '800', letterSpacing: 1, color: INK.faint, marginBottom: 8 },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

/** Una coordenada suelta, validada mientras se escribe. */
function CampoCoord({ etiqueta, valor, onChange, rango, placeholder }) {
  const n = Number(valor);
  const malo = valor.trim() !== '' && (!Number.isFinite(n) || Math.abs(n) > rango);

  return (
    <View style={{ flex: 1 }}>
      <Text style={{ fontFamily: MONO, fontSize: 10.5, color: INK.meta, marginBottom: 5 }}>{etiqueta}</Text>
      <TextInput
        value={valor}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={INK.faint}
        keyboardType="numbers-and-punctuation"
        autoCorrect={false}
        style={[inputStyle, malo ? { borderColor: 'rgba(180,83,9,0.55)' } : null]}
      />
    </View>
  );
}

/**
 * Una línea que diga qué es esto en el mapa.
 *
 * El orden importa: primero **si se ve o no** —tres territorios hoy no se ven y
 * nada lo decía—, después **qué es** en palabras del país (Departamento,
 * Municipio), y al final si el límite es el oficial. Nada de identificadores del
 * catálogo ni conteos de vértices: eso es cómo está hecho, no qué es.
 */
function Resumen({ geo, punto, dibujo }) {
  if (!dibujo) {
    return (
      <Linea Icono={MapPinOff} color={AMBAR}>
        <Text style={{ fontSize: 13, color: AMBAR, lineHeight: 19 }}>
          Sin ubicación todavía — no aparece en el mapa.
        </Text>
      </Linea>
    );
  }

  if (geo.spatial_role === 'frontier') {
    // El cheque **es** la afirmación de que el límite es el oficial. Escribirlo
    // además al lado —«Departamento · límite oficial ✓»— dice lo mismo dos
    // veces en el mismo renglón. Sin cheque significa trazo propio, que es la
    // otra mitad de la información y no necesita palabra tampoco.
    const respaldada =
      geo.curation.status === 'official' || geo.curation.status === 'verified';
    return (
      <Linea Icono={Landmark} color={INK.meta}>
        <Text style={{ fontSize: 13, color: INK.body, lineHeight: 19 }}>
          {etiquetaNivel(geo) || 'Frontera'}
        </Text>
        {respaldada ? <BadgeCheck size={14} color={VERDE} /> : null}
      </Linea>
    );
  }

  if (geo.spatial_role === 'location') {
    // Un punto se muestra en un mapa, no en dos números.
    //
    // «14.7901, −90.3593» es exacto y no dice nada: nadie ubica un lugar
    // leyendo grados. El mapa contesta la pregunta que se hace de verdad
    // —dónde queda esto— y las coordenadas quedan abajo en gris, para quien
    // necesite la respuesta precisa.
    if (punto) return <MiniMapa lat={punto.lat} lng={punto.lng} />;

    return (
      <Linea Icono={MapPin} color={INK.meta}>
        <Text style={{ fontSize: 13, color: INK.body, lineHeight: 19 }}>Punto sin coordenadas</Text>
      </Linea>
    );
  }

  return (
    <Linea Icono={geo.spatial_role === 'route' ? Spline : Shapes} color={INK.meta}>
      <Text style={{ fontSize: 13, color: INK.body, lineHeight: 19 }}>
        {geo.spatial_role === 'route' ? 'Recorrido trazado' : 'Área trazada'}
      </Text>
    </Linea>
  );
}

function Linea({ Icono, color, children }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 14,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(28,43,34,0.08)',
      }}
    >
      <Icono size={14} color={color} />
      {children}
    </View>
  );
}

export default function GeoTerritorio({ item, nombre, editando, geoEd, onCambiar }) {
  const [buscando, setBuscando] = useState(false);
  // Cuando ya hay polígono propio y se elige un límite, hay que decidir qué
  // geometría queda. Se guarda el candidato hasta que esa pregunta se responda.
  const [pendiente, setPendiente] = useState(null);
  // El mapa de marcado, compartido entre punto, área y ruta: el modo con el que
  // se abre es el único dato que cambia entre los tres.
  const [marcando, setMarcando] = useState(false);

  const geo = normalizarGeo(geoEd ?? item?.geo);
  const rol = geo.spatial_role;
  const dibujo = representacionDe(geo);
  const punto = puntoDe(geo);
  const vinculada = geo.curation.canonical_boundary_id;

  const [latEd, setLatEd] = useState(punto ? String(punto.lat) : '');
  const [lngEd, setLngEd] = useState(punto ? String(punto.lng) : '');

  /**
   * El punto que se está escribiendo, si ya es válido.
   *
   * Se deriva de los dos campos de texto y no del `geo` guardado: mientras se
   * teclea, `geo` todavía tiene el valor anterior —`aplicarPunto` solo escribe
   * cuando las dos coordenadas pasan— y el mapa se quedaría mostrando el punto
   * viejo, que es peor que no mostrar ninguno.
   */
  const puntoEditado = useMemo(() => {
    const a = Number(latEd);
    const o = Number(lngEd);
    if (latEd === '' || lngEd === '') return null;
    if (!Number.isFinite(a) || !Number.isFinite(o)) return null;
    if (Math.abs(a) > 90 || Math.abs(o) > 180) return null;
    return { lat: a, lng: o };
  }, [latEd, lngEd]);

  const aplicarPunto = (lat, lng) => {
    const a = Number(lat);
    const o = Number(lng);
    if (!Number.isFinite(a) || !Number.isFinite(o) || Math.abs(a) > 90 || Math.abs(o) > 180) return;
    onCambiar(geoDePunto({ lat: a, lng: o, base: geo }));
  };

  const alElegirLimite = (limite) => {
    setBuscando(false);
    // Sin geometría propia no hay nada que conservar: se adopta y listo.
    const tienePropia = geo.geometry && geo.curation.geometry_mode === 'original';
    if (!tienePropia) {
      onCambiar(geoDeLimite({ limite, base: geo }));
      return;
    }
    setPendiente(limite);
  };

  return (
    <View style={{ marginTop: 26 }}>
      <Rotulo>EN EL MAPA</Rotulo>

      {/* ── Qué es ── */}
      {editando ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {ROLES.map(({ clave, etiqueta }) => {
            const on = rol === clave;
            return (
              <Pressable
                key={clave}
                onPress={() => {
                  roce();
                  onCambiar(conRol(geo, clave));
                }}
                style={({ pressed }) => ({
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  borderRadius: RADIUS.pill,
                  borderWidth: 1,
                  borderColor: on ? 'rgba(58,96,73,0.5)' : 'rgba(28,43,34,0.12)',
                  backgroundColor: on ? 'rgba(58,96,73,0.10)' : 'transparent',
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <Text style={{ fontSize: 12.5, color: on ? VERDE : INK.body, fontWeight: on ? '700' : '500' }}>
                  {etiqueta}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {editando && rol ? (
        <Text style={{ fontSize: 12, color: INK.meta, lineHeight: 18, marginBottom: 16 }}>
          {ROLES.find((r) => r.clave === rol)?.ayuda}
        </Text>
      ) : null}

      {/* ── Frontera: el límite oficial ──
          Solo en edición. En lectura, la línea de abajo ya dice qué es y si el
          límite es el oficial; la tarjeta repetía el nivel y agregaba un
          subtítulo para decir lo mismo por tercera vez. Acá vive para poder
          cambiar o desvincular, que es una acción, no una descripción. */}
      {rol === 'frontier' && editando ? (
        <View style={{ marginBottom: 4 }}>
          {vinculada ? (
            <View
              style={{
                borderWidth: 1,
                borderColor: 'rgba(58,96,73,0.28)',
                backgroundColor: 'rgba(58,96,73,0.06)',
                borderRadius: 12,
                padding: 13,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <BadgeCheck size={16} color={VERDE} />
                <Text style={{ fontSize: 14, color: INK.title, fontWeight: '700', flex: 1 }}>
                  {etiquetaNivel(geo) || 'Límite oficial'}
                </Text>
              </View>
              <Text style={{ fontSize: 12, color: INK.body, marginTop: 5, lineHeight: 18 }}>
                {geo.curation.geometry_mode === 'canonical'
                  ? 'Con el límite oficial del catálogo.'
                  : 'Vinculado al límite oficial, pero se dibuja tu trazo.'}
              </Text>

              {editando ? (
                <View style={{ flexDirection: 'row', gap: 16, marginTop: 11 }}>
                  <Pressable onPress={() => { roce(); setBuscando(true); }}>
                    <Text style={{ fontSize: 12.5, color: VERDE, fontWeight: '600' }}>Cambiar</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      roce();
                      onCambiar({
                        ...geo,
                        curation: { status: 'user_defined', canonical_boundary_id: null, geometry_mode: 'original', matched_at: null },
                        source: { ...geo.source, kind: 'manual', catalog_id: null },
                      });
                    }}
                  >
                    <Text style={{ fontSize: 12.5, color: INK.meta }}>Desvincular</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          ) : editando ? (
            <Pressable
              onPress={() => { roce(); setBuscando(true); }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 9,
                borderWidth: 1,
                borderStyle: 'dashed',
                borderColor: 'rgba(28,43,34,0.22)',
                borderRadius: 12,
                paddingVertical: 13,
                paddingHorizontal: 13,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Link2 size={15} color={INK.meta} />
              <Text style={{ fontSize: 13.5, color: INK.body }}>Vincular a un límite oficial</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {/* ── Punto: el lápiz vive en la esquina del mapa, no en un botón aparte ──
          El mapa mismo es la vía principal para marcar o ajustar — el lápiz de
          su esquina abre el mismo modal que antes tenía un botón propio. Sin
          punto todavía, el mapa no tiene nada que dibujar: queda un círculo con
          ese mismo lápiz, la misma acción, antes de que haya algo encima.
          Los campos de texto quedan igual disponibles debajo: alguien que ya
          tiene la coordenada exacta de otra fuente la pega directo, sin abrir
          nada. */}
      {rol === 'location' && editando ? (
        <View>
          <MiniMapa
            lat={puntoEditado?.lat}
            lng={puntoEditado?.lng}
            editable
            onEditar={() => { roce(); setMarcando(true); }}
          />

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 12 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(28,43,34,0.08)' }} />
            <Text style={{ fontFamily: MONO, fontSize: 9.5, color: INK.faint }}>o a mano</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(28,43,34,0.08)' }} />
          </View>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <CampoCoord
              etiqueta="LATITUD"
              valor={latEd}
              onChange={(v) => { setLatEd(v); aplicarPunto(v, lngEd); }}
              rango={90}
              placeholder="14.6349"
            />
            <CampoCoord
              etiqueta="LONGITUD"
              valor={lngEd}
              onChange={(v) => { setLngEd(v); aplicarPunto(latEd, v); }}
              rango={180}
              placeholder="-90.5069"
            />
          </View>
          <Text style={{ fontSize: 11.5, color: INK.meta, lineHeight: 17, marginTop: 7 }}>
            {/* En Guatemala la longitud es negativa. Un signo comido manda el
                punto a China, y en un mapa de Guatemala eso no se ve: el
                elemento simplemente no aparece. */}
            Guatemala está cerca de 14.6 y −90.5. La longitud va con signo menos.
          </Text>
        </View>
      ) : null}

      {/* ── Área y recorrido: se trazan en el mapa, ya no dicen «no se puede
          desde acá» ── */}
      {(rol === 'area' || rol === 'route') && editando ? (
        <View>
          <Pressable
            onPress={() => { roce(); setMarcando(true); }}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 9,
              borderWidth: 1,
              borderStyle: 'dashed',
              borderColor: 'rgba(28,43,34,0.22)',
              borderRadius: 12,
              paddingVertical: 13,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <PenTool size={15} color={INK.meta} />
            <Text style={{ fontSize: 13.5, color: INK.body, fontWeight: '600' }}>
              {geo.geometry ? `Ajustar ${rol === 'area' ? 'el área' : 'el recorrido'}` : `Trazar ${rol === 'area' ? 'el área' : 'el recorrido'}`}
            </Text>
          </Pressable>
          <Text style={{ fontSize: 11.5, color: INK.meta, lineHeight: 17, marginTop: 8 }}>
            {geo.geometry ? 'La geometría que ya tiene se conserva hasta que la ajustes.' : 'Todavía no tiene forma.'}
          </Text>
        </View>
      ) : null}

      <MarcarGeoModal
        visible={marcando}
        rol={rol}
        geoActual={{ ...geo, _itemId: item?.id }}
        onCancelar={() => setMarcando(false)}
        onConfirmar={(nuevoGeo) => {
          setMarcando(false);
          if (rol === 'location') {
            const p = puntoDe(nuevoGeo);
            if (p) {
              setLatEd(String(p.lat));
              setLngEd(String(p.lng));
            }
          }
          onCambiar(nuevoGeo);
        }}
      />

      {/* ── Qué es, en una línea que se pueda leer ──
          Antes acá decía «polígono · 1.635 vértices · oficial» y, arriba,
          `dept_quetzaltenango`. Las dos cosas son ciertas y ninguna le importa a
          nadie: el identificador del catálogo es una clave interna y el conteo
          de vértices es un detalle de implementación. Lo que una persona quiere
          saber de un territorio es qué es —un departamento—, si el límite es el
          oficial, y si va a verse en el mapa. */}
      <Resumen geo={geo} punto={punto} dibujo={dibujo} />

      <BuscarLimite
        visible={buscando}
        consultaInicial={nombre || ''}
        onElegir={alElegirLimite}
        onClose={() => setBuscando(false)}
      />

      {/* ── La decisión: qué polígono queda ── */}
      {pendiente ? (
        <Animated.View
          entering={FadeIn.duration(180)}
          style={{
            marginTop: 14,
            borderWidth: 1,
            borderColor: 'rgba(180,83,9,0.35)',
            backgroundColor: 'rgba(180,83,9,0.06)',
            borderRadius: 12,
            padding: 14,
          }}
        >
          <Text style={{ fontSize: 13.5, color: INK.title, fontWeight: '700' }}>
            Ya tenés un polígono propio
          </Text>
          <Text style={{ fontSize: 12.5, color: INK.body, lineHeight: 19, marginTop: 5 }}>
            Vas a vincular con «{pendiente.name}». ¿Cuál de los dos se dibuja?
          </Text>

          {[
            {
              clave: 'original',
              titulo: 'Conservar el mío',
              nota: 'Queda vinculado y verificado, pero el mapa dibuja tu trazo.',
            },
            {
              clave: 'canonical',
              titulo: 'Usar el oficial',
              nota: 'Reemplaza tu polígono por el del catálogo. Tu trazo se pierde.',
            },
          ].map((op) => (
            <Pressable
              key={op.clave}
              onPress={() => {
                roce();
                onCambiar(
                  op.clave === 'canonical'
                    ? geoDeLimite({ limite: pendiente, base: geo })
                    : geoVinculado({ limite: pendiente, base: geo })
                );
                setPendiente(null);
              }}
              style={({ pressed }) => ({
                marginTop: 10,
                borderWidth: 1,
                borderColor: 'rgba(28,43,34,0.14)',
                backgroundColor: '#FFFFFF',
                borderRadius: 10,
                padding: 11,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Text style={{ fontSize: 13, color: INK.title, fontWeight: '600' }}>{op.titulo}</Text>
              <Text style={{ fontSize: 11.5, color: INK.meta, lineHeight: 17, marginTop: 3 }}>{op.nota}</Text>
            </Pressable>
          ))}

          <Pressable onPress={() => { roce(); setPendiente(null); }} style={{ marginTop: 11 }}>
            <Text style={{ fontSize: 12.5, color: INK.meta }}>Cancelar</Text>
          </Pressable>
        </Animated.View>
      ) : null}
    </View>
  );
}
