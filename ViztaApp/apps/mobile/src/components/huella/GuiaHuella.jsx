import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import {
  BadgeCheck,
  CalendarX,
  History,
  Layers,
  ListChecks,
  MessageSquareQuote,
  Mic,
  Scale,
  Sprout,
  Tags,
  TriangleAlert,
  UserRound,
  UserRoundCheck,
  UserRoundSearch,
  X,
} from 'lucide-react-native';
import { INK, SERIF } from '../theme';
import { PAPEL } from '../codex/Papel';
import { Boton, ROTULO, TONO } from '../colaboradores/piezas';
import HuellaLlena from './HuellaLlena';
import { TONOS } from './tonos';

/** El ícono de cada cosa que falta comprobar (`lectura_breve.que_falta[].motivo`). */
const ICONO_FALTA = {
  atribucion_insuficiente: UserRoundSearch,
  independencia_no_resuelta: Layers,
  respaldo_pendiente: MessageSquareQuote,
  fechas_incompletas: CalendarX,
  contraevidencia_pendiente: TriangleAlert,
  politica_no_calibrada: Scale,
};

/**
 * La guía de la huella: todo lo que explica vive acá y no en la pantalla, que
 * queda solo con la información. Se abre sola la primera vez y después con el
 * «?». Redactada en frases completas y en registro neutro, porque explica; el
 * resto de la pantalla solo rotula (ver docs/DESIGN.md › Ayudas).
 *
 * «Qué falta comprobar», las preguntas y las salvedades vienen del contrato
 * (`lectura_breve`), así que cambian con cada cuenta.
 */
export default function GuiaHuella({ lecturaBreve, parcial = false, nombre, llenado, tono, bottomInset = 0, onClose }) {
  const falta = lecturaBreve?.que_falta || [];
  const pistas = lecturaBreve?.pistas || [];
  const limites = [
    ...(parcial ? ['La revisión de esta cuenta quedó incompleta: algunas declaraciones todavía no se contrastaron.'] : []),
    ...(lecturaBreve?.limites || []),
  ];
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
              La huella de autor es una forma de entender, de manera cualitativa, las posturas de una persona o de un medio a partir de muchos datos: los temas que publica, lo que se dice en sus publicaciones y quién lo dice.
            </Text>
            <Text style={{ fontSize: 15.5, lineHeight: 22, color: INK.body }}>
              Su propósito es que puedas interpretar esa información y llegar a más. Cada lectura muestra de dónde sale, con la frase exacta y la publicación, para que la revises y saques tus propias conclusiones.
            </Text>
            <Text style={{ fontSize: 14.5, lineHeight: 21, color: INK.meta }}>
              Describe lo que aparece en las publicaciones analizadas; no define la ideología ni las intenciones de nadie.
            </Text>
          </View>

          <Seccion titulo="El ícono de la huella">
            <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
              <HuellaLlena llenado={llenado} tono={tono} size={56} />
              <Text style={{ flex: 1, fontSize: 15, lineHeight: 21, color: INK.body }}>
                Se llena a medida que cada parte gana respaldo: temas, voces, posiciones, argumentos y evolución en el tiempo. Llena por completo indica una huella respaldada.
              </Text>
            </View>
          </Seccion>

          <Seccion titulo="Las pestañas">
            <Concepto Icono={Tags} titulo="Temas">
              Los asuntos que el análisis marcó en sus publicaciones y en cuántas aparece cada uno. Publicar sobre un tema no significa estar a favor de algo.
            </Concepto>
            <Concepto Icono={MessageSquareQuote} titulo="Declaraciones">
              Frases exactas que aparecen en sus publicaciones, con quién las dice. Pueden ser de la cuenta, de un invitado o de alguien citado.
            </Concepto>
            <Concepto Icono={ListChecks} titulo="Argumentos">
              Cómo sostiene lo que dice: si plantea un problema, señala una causa, usa datos o apela a una autoridad. Solo cuentan las declaraciones comprobadas en su contexto.
            </Concepto>
            <Concepto Icono={History} titulo="En el tiempo">
              Las declaraciones comprobadas ordenadas por fecha de publicación, y si se repiten o cambian entre ocasiones distintas. La fecha es la de publicación, no necesariamente la del hecho narrado.
            </Concepto>
          </Seccion>

          <Seccion titulo="Los niveles">
            <Concepto Icono={Sprout} tono="ambar" titulo="Impresión inicial">
              Algo que aparece en las fuentes. Sirve como pista para revisar, no como conclusión sobre la cuenta.
            </Concepto>
            <Concepto Icono={Layers} tono="azul" titulo="En formación">
              Varias fuentes independientes dicen lo mismo y el contexto lo sostiene. Todavía no es una característica de la cuenta.
            </Concepto>
            <Concepto Icono={BadgeCheck} tono="verde" titulo="Respaldada">
              Cumple el criterio de suficiencia: se puede atribuir a la cuenta.
            </Concepto>
            <Concepto Icono={TriangleAlert} tono="rojo" titulo="En revisión">
              Hay evidencia en contra o el contexto no la sostiene. Hay que revisarla aunque antes estuviera respaldada.
            </Concepto>
          </Seccion>

          <Seccion titulo="Quién lo dice">
            <Concepto Icono={UserRoundCheck} tono="verde" titulo="Lo dijo la cuenta">
              La frase se atribuye a quien habla por la cuenta.
            </Concepto>
            <Concepto Icono={UserRound} titulo="Lo dijo una persona">
              Alguien identificó quién habla: una persona de tu Codex, un invitado o un personaje. Queda vinculado a esa persona.
            </Concepto>
            <Concepto Icono={Mic} tono="ambar" titulo="Voces sin identificar">
              Si no se sabe quién habla, la frase no lleva nombre. El aviso «voces sin identificar» muestra cada voz con sus frases para que digas quién es; queda registrado y la huella se vuelve a calcular.
            </Concepto>
          </Seccion>

          {falta.length ? (
            <Seccion titulo={`Qué falta comprobar en ${nombre}`}>
              {falta.map((f) => (
                <Concepto key={f.id} Icono={ICONO_FALTA[f.motivo] || ListChecks} tono="ambar" titulo={f.texto} />
              ))}
            </Seccion>
          ) : null}

          {pistas.length ? (
            <Seccion titulo="Preguntas para revisar">
              {pistas.map((p) => (
                <View key={p.id} style={{ borderLeftWidth: 3, borderLeftColor: TONO.raya, paddingLeft: 12 }}>
                  <Text style={{ fontSize: 14.5, lineHeight: 21, color: INK.body }}>{p.pregunta}</Text>
                </View>
              ))}
            </Seccion>
          ) : null}

          {limites.length ? (
            <Seccion titulo="A tener en cuenta">
              {limites.map((a) => (
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
      <View style={{ flex: 1, gap: 3, justifyContent: 'center' }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: INK.title }}>{titulo}</Text>
        {children ? <Text style={{ fontSize: 14.5, lineHeight: 21, color: INK.body }}>{children}</Text> : null}
      </View>
    </View>
  );
}
