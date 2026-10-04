import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { X } from 'lucide-react-native';
import { INK } from '../theme';
import { PAPEL } from '../codex/Papel';
import { MONO } from '../codex/mono';
import PostDetailSheet from './PostDetailSheet';
import { CASOS } from './casosDeMuestra';
import { roce } from '../../utils/haptics';

/**
 * La galería de casos de muestra: una fila por clase de post.
 *
 * Tocar una abre la ficha de verdad —la misma `PostDetailSheet`— con un post
 * inventado. Sirve para aprobar el diseño caso por caso sin traer ni analizar
 * nada. Solo existe en desarrollo.
 */
export default function CasosDeMuestra({ onClose, topInset = 0, bottomInset = 0 }) {
  const [abierto, setAbierto] = useState(null);

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: PAPEL }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: topInset + 12, paddingHorizontal: 18 }}>
          <Pressable onPress={onClose} hitSlop={12} style={{ padding: 6 }}>
            <X size={19} color={INK.faint} />
          </Pressable>
          <Text style={{ fontFamily: MONO, fontSize: 13, color: INK.title, marginLeft: 8 }}>casos de muestra</Text>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 30, paddingTop: 18, paddingBottom: bottomInset + 40 }}>
          {CASOS.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => {
                roce();
                setAbierto(c);
              }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                gap: 12,
                paddingVertical: 13,
                borderBottomWidth: 1,
                borderBottomColor: 'rgba(28,43,34,0.07)',
                opacity: pressed ? 0.5 : 1,
              })}
            >
              <Text style={{ fontFamily: MONO, fontSize: 12, color: 'rgba(28,43,34,0.35)', width: 22, textAlign: 'right' }}>
                {c._muestra.n}
              </Text>
              <Text style={{ flex: 1, fontFamily: MONO, fontSize: 13, color: INK.title, lineHeight: 19 }}>
                {c._muestra.titulo}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Cuelga de esta hoja: iOS presenta un Modal a la vez. La `key` hace que
          cada caso arranque de cero, sin lo que dejó el anterior. */}
      {abierto ? (
        <PostDetailSheet
          key={abierto.id}
          post={abierto}
          onClose={() => setAbierto(null)}
          topInset={topInset}
          bottomInset={bottomInset}
        />
      ) : null}
    </Modal>
  );
}
