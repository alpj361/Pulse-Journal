import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { BadgeCheck, Check, CircleQuestionMark, MessageSquareQuote, Sprout, Tags, ThumbsUp, UserCheck, X } from 'lucide-react-native';
import { INK, SERIF } from '../theme';
import { PAPEL } from '../codex/Papel';
import { Boton, ROTULO, TONO } from '../colaboradores/piezas';
import HuellaLlena from './HuellaLlena';
import { pasosPatron } from './logica';
import { TONOS } from './tonos';

/**
 * La guía de la huella: todo lo que explica vive acá y no en la pantalla, que
 * queda solo con la información. Se abre sola la primera vez y después con el
 * «?». Redactada en frases completas y en registro neutro, porque explica; el
 * resto de la pantalla solo rotula (ver docs/DESIGN.md › Ayudas).
 */
export default function GuiaHuella({ perfil, nombre, llenado, tono, bottomInset = 0, onClose }) {
  const pasos = perfil ? pasosPatron(perfil) : [];
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: PAPEL }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 16, paddingHorizontal: 18 }}>
          <Text style={[ROTULO, { flex: 1 }]}>GUÍA</Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Cerrar la guía" style={{ padding: 6 }}>
            <X size={19} color={INK.faint} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 6, paddingBottom: bottomInset + 32, gap: 26 }}>
          <View style={{ gap: 10 }}>
            <Text style={{ fontFamily: SERIF, fontSize: 30, lineHeight: 34, color: INK.title }} accessibilityRole="header">
              Cómo leer la huella
            </Text>
            <Text style={{ fontSize: 15.5, lineHeight: 22, color: INK.body }}>
              La huella resume de qué habla una cuenta y qué ideas aparecen en lo que publica. Se arma con sus publicaciones que ya fueron analizadas.
            </Text>
          </View>

          <Seccion titulo="El ícono de la huella">
            <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
              <HuellaLlena llenado={llenado} tono={tono} size={56} />
              <Text style={{ flex: 1, fontSize: 15, lineHeight: 21, color: INK.body }}>
                Se llena a medida que hay más publicaciones sobre un mismo tema, durante más tiempo y con fecha. Llena por completo indica un patrón respaldado.
              </Text>
            </View>
          </Seccion>

          <Seccion titulo="Las tres pestañas">
            <Concepto Icono={Tags} titulo="Temas">
              Los asuntos sobre los que publica la cuenta. La barra muestra cuántas publicaciones hay sobre cada tema y cuántas hacen falta para hablar de un patrón.
            </Concepto>
            <Concepto Icono={MessageSquareQuote} titulo="Narrativas">
              Ideas que aparecen en sus publicaciones, con la frase exacta. No son necesariamente la opinión de la cuenta: la frase puede ser de una persona entrevistada o citada.
            </Concepto>
            <Concepto Icono={UserCheck} titulo="Posturas">
              Opiniones de la propia cuenta. Solo cuentan cuando el análisis confirma que quien habla es el autor y que la frase aparece en el texto.
            </Concepto>
          </Seccion>

          <Seccion titulo="Las etiquetas">
            <Concepto Icono={Sprout} tono="ambar" titulo="Lectura inicial">
              Todavía hay pocas publicaciones. Sirve como pista, no como conclusión.
            </Concepto>
            <Concepto Icono={BadgeCheck} tono="verde" titulo="Patrón respaldado">
              El tema se repite en suficientes publicaciones a lo largo de suficiente tiempo.
            </Concepto>
            <Concepto Icono={CircleQuestionMark} tono="ambar" titulo="No se sabe quién lo dijo">
              La frase está en la publicación, pero no se identificó a la persona que la dice.
            </Concepto>
            <Concepto Icono={ThumbsUp} tono="verde" titulo="A favor, en contra, informa">
              Cómo presenta la publicación esa idea.
            </Concepto>
          </Seccion>

          {pasos.length ? (
            <Seccion titulo={`Qué le falta a ${nombre} para un patrón`}>
              {pasos.map((p, i) => (
                <View key={p.clave} style={{ flexDirection: 'row', gap: 12 }}>
                  <View
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 13,
                      backgroundColor: p.ok ? TONOS.verde.fondo : 'rgba(28,43,34,0.07)',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {p.ok ? <Check size={14} color={TONOS.verde.tinta} strokeWidth={3} /> : <Text style={{ fontSize: 12.5, fontWeight: '700', color: INK.meta }}>{i + 1}</Text>}
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: INK.title }}>{p.titulo}</Text>
                    <Text style={{ fontSize: 14, color: p.ok ? TONOS.verde.tinta : INK.body }}>{p.detalle}</Text>
                    {!p.ok && p.avance > 0 ? (
                      <View style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(28,43,34,0.08)', overflow: 'hidden', marginTop: 3 }}>
                        <View style={{ width: `${Math.round(p.avance * 100)}%`, height: '100%', backgroundColor: TONOS.ambar.tinta }} />
                      </View>
                    ) : null}
                  </View>
                </View>
              ))}
            </Seccion>
          ) : null}

          {perfil?.advertencias?.length ? (
            <Seccion titulo="A tener en cuenta">
              {perfil.advertencias.map((a) => (
                <View key={a} style={{ borderLeftWidth: 3, borderLeftColor: TONO.raya, paddingLeft: 12 }}>
                  <Text style={{ fontSize: 14.5, lineHeight: 21, color: INK.body }}>{a}</Text>
                </View>
              ))}
            </Seccion>
          ) : null}

          <Boton texto="entendido" primario onPress={onClose} />
        </ScrollView>
      </View>
    </Modal>
  );
}

function Seccion({ titulo, children }) {
  return (
    <View style={{ gap: 14 }}>
      <Text style={{ fontSize: 17, fontWeight: '800', color: INK.title }}>{titulo}</Text>
      {children}
    </View>
  );
}

/** Un concepto: ícono en su caja, el nombre como aparece en pantalla y qué significa. */
function Concepto({ Icono, tono = 'neutro', titulo, children }) {
  const t = TONOS[tono] || TONOS.neutro;
  return (
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: t.fondo, alignItems: 'center', justifyContent: 'center' }}>
        <Icono size={17} color={t.tinta} strokeWidth={1.9} />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: INK.title }}>{titulo}</Text>
        <Text style={{ fontSize: 14.5, lineHeight: 21, color: INK.body }}>{children}</Text>
      </View>
    </View>
  );
}
