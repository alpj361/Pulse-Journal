import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Fingerprint, X } from 'lucide-react-native';
import { INK } from '../theme';
import { PAPEL } from '../codex/Papel';
import { MONO } from '../codex/mono';
import PostDetailSheet from './PostDetailSheet';
import { CASOS, POSTS_DE_PRUEBA } from './casosDeMuestra';
import { falla, roce } from '../../utils/haptics';
import { supabase } from '../../utils/supabase';

const CAMPOS_POST = 'id, name, tipo, description, tags, thumbnail_url, details, aliases, created_at, folder_id';

/**
 * La galería de casos de muestra: una fila por clase de post.
 *
 * Tocar una abre la ficha de verdad —la misma `PostDetailSheet`— con un post
 * inventado. Sirve para aprobar el diseño caso por caso sin traer ni analizar
 * nada. Solo existe en desarrollo.
 *
 * Arriba van los posts reales de prueba: esos se leen de la base y se abren
 * como en Posts, con su análisis y la huella del autor.
 */
export default function CasosDeMuestra({ onClose, topInset = 0, bottomInset = 0 }) {
  const [abierto, setAbierto] = useState(null);
  const [trayendo, setTrayendo] = useState(null);
  const [faltan, setFaltan] = useState({});

  const abrirReal = async (p) => {
    roce();
    setTrayendo(p.id);
    const { data } = await supabase.from('codex_universe_items').select(CAMPOS_POST).eq('id', p.id).maybeSingle();
    setTrayendo(null);
    if (data) setAbierto(data);
    else {
      falla();
      setFaltan((f) => ({ ...f, [p.id]: true }));
    }
  };

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
          <Text style={{ fontFamily: MONO, fontSize: 11.5, color: 'rgba(28,43,34,0.4)', marginBottom: 4 }}>posts reales</Text>
          {POSTS_DE_PRUEBA.map((p) => (
            <Pressable
              key={p.id}
              onPress={() => abrirReal(p)}
              disabled={trayendo === p.id}
              style={({ pressed }) => ({
                flexDirection: 'row',
                gap: 12,
                paddingVertical: 13,
                borderBottomWidth: 1,
                borderBottomColor: 'rgba(28,43,34,0.07)',
                opacity: pressed || trayendo === p.id ? 0.5 : 1,
              })}
            >
              <View style={{ width: 22, alignItems: 'flex-end', paddingTop: 2 }}>
                <Fingerprint size={14} color="rgba(28,43,34,0.45)" />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontFamily: MONO, fontSize: 13, color: INK.title, lineHeight: 19 }}>{p.titulo}</Text>
                {faltan[p.id] ? (
                  <Text style={{ fontFamily: MONO, fontSize: 11.5, color: 'rgba(28,43,34,0.45)' }}>esta cuenta no tiene acceso a ese post</Text>
                ) : null}
              </View>
            </Pressable>
          ))}

          <Text style={{ fontFamily: MONO, fontSize: 11.5, color: 'rgba(28,43,34,0.4)', marginTop: 24, marginBottom: 4 }}>inventados</Text>
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
