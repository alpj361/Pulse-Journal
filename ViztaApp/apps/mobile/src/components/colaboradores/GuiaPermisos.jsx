import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Eye, FolderInput, Inbox, PencilLine, Send, Trash2, X } from 'lucide-react-native';
import { INK, SERIF } from '../theme';
import { PAPEL } from '../codex/Papel';
import { Boton, ROTULO, TONO } from './piezas';
import { CATALOGO_PERMISOS, PERMISOS } from './logica';

export const ICONO_PERMISO = { leer: Eye, crear: Send, editar: PencilLine, eliminar: Trash2 };

/**
 * La guía de los permisos de un agente: qué hace cada uno y dónde queda lo que
 * el agente crea. Se abre con el «?» de la pantalla de permisos y de la de
 * autorizar una conexión. Va en frases completas y registro formal, como toda
 * ayuda (DESIGN.md › Ayudas); la pantalla solo rotula.
 */
export default function GuiaPermisos({ nombre = 'el agente', bottomInset = 0, onClose }) {
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
              Qué puede hacer un agente
            </Text>
            <Text style={{ fontSize: 15.5, lineHeight: 22, color: INK.body }}>
              Cada permiso se activa o se desactiva por separado. Los mismos permisos valen para el chat de Colaboradores y para la conexión desde ChatGPT, Claude u otro cliente.
            </Text>
          </View>

          <Seccion titulo="Los permisos">
            {PERMISOS.map((k) => (
              <Concepto key={k} Icono={ICONO_PERMISO[k]} titulo={CATALOGO_PERMISOS[k].titulo} tono={k === 'eliminar' ? 'rojo' : k === 'editar' ? 'ambar' : 'neutro'}>
                {CATALOGO_PERMISOS[k].texto}
              </Concepto>
            ))}
          </Seccion>

          <Seccion titulo="Dónde queda lo que crea">
            <Concepto Icono={Inbox} titulo="Sin «Editar tu cuenta»">
              {`Lo que hace ${nombre} queda en su propio espacio de agente. Cada cambio a tus fichas o espacios te llega como propuesta en «por aprobar» y no se aplica hasta que lo apruebes.`}
            </Concepto>
            <Concepto Icono={FolderInput} tono="ambar" titulo="Con «Editar tu cuenta»">
              {`${nombre[0].toUpperCase()}${nombre.slice(1)} crea y actualiza espacios y fichas directamente en tu cuenta personal, sin pedirte aprobación. Todo lo que hace queda marcado como hecho por el agente.`}
            </Concepto>
          </Seccion>

          <Seccion titulo="Recomendación">
            <Text style={{ fontSize: 14.5, lineHeight: 21, color: INK.body }}>
              Para empezar, activa solo «Consultar» y «Proponer». Así revisas cada cambio antes de que llegue a tu cuenta. Activa «Editar tu cuenta» cuando confíes en el trabajo del agente.
            </Text>
            <Text style={{ fontSize: 14.5, lineHeight: 21, color: INK.body }}>
              Si una conexión de ChatGPT o Claude se autorizó solo para consultar, esa conexión no escribe en tu cuenta aunque aquí esté activo «Editar tu cuenta».
            </Text>
          </Seccion>

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

const TONOS = {
  neutro: { fondo: 'rgba(28,43,34,0.06)', tinta: INK.body },
  ambar: { fondo: 'rgba(201,150,60,0.14)', tinta: '#8A6420' },
  rojo: { fondo: 'rgba(154,83,71,0.12)', tinta: TONO.ladrillo },
};

/** Un concepto: ícono en su caja, el nombre como aparece en pantalla y qué significa. */
export function Concepto({ Icono, tono = 'neutro', titulo, children }) {
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
