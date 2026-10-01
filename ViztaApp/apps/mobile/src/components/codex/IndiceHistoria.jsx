import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { ChevronRight, FileText } from 'lucide-react-native';
import { MONO } from './mono';
import { contar, nivelesDe } from './ontologia';
import { leerIdeas, resumen } from './historiaArbol';
import { roce } from '../../utils/haptics';

const INDIGO = '#4B4FA6';
const NUMERO = 'rgba(75,79,166,0.45)';
const TENUE = 'rgba(28,43,34,0.36)';

/**
 * El índice de la historia de un espacio, en árbol (Task 8.1).
 *
 * Antes era la lista plana de las secciones de la nota abierta: con dos
 * snippets como historia, el segundo no aparecía en ningún lado. Ahora es la
 * historia entera, en tres niveles —cada snippet, sus partes, sus párrafos—
 * con los nombres que le tocan al tipo de espacio (capítulo y escena en
 * ficción, expediente y artículo en legal…).
 *
 * Se pliega: cerrado es una línea («2 capítulos · 16 escenas»). Abierto, se
 * ven los snippets y, desplegado, el que se está leyendo; los demás se abren
 * con su flecha. Los párrafos se piden a la base recién al abrir su parte.
 *
 * Tocar un nombre lleva ahí: `onIr({ nota, seccion?, idea? })`. Si es de otro
 * snippet, la hoja lo abre y después salta.
 */
export default function IndiceHistoria({ arbol, notaActual, onIr }) {
  const niveles = nivelesDe(arbol?.espacio?.aspectos, arbol?.espacio?.hibrido);
  const historias = arbol?.historias || [];
  const [abierto, setAbierto] = useState(true);
  // Qué snippets están desplegados. El que se lee, de entrada.
  const [desplegados, setDesplegados] = useState(() => new Set(notaActual ? [notaActual] : []));
  useEffect(() => {
    if (notaActual) setDesplegados((d) => (d.has(notaActual) ? d : new Set([...d, notaActual])));
  }, [notaActual]);

  if (!historias.length) return null;

  const alternar = (id) =>
    setDesplegados((d) => {
      const n = new Set(d);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <Animated.View entering={FadeIn.duration(200)} style={{ marginBottom: 20 }}>
      <Pressable
        onPress={() => {
          roce();
          setAbierto((a) => !a);
        }}
        hitSlop={6}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, opacity: pressed ? 0.5 : 1 })}
        accessibilityRole="button"
        accessibilityState={{ expanded: abierto }}
        accessibilityLabel={abierto ? 'Plegar el índice' : 'Desplegar el índice'}
      >
        <Flecha abierta={abierto} />
        <Text style={{ fontFamily: MONO, fontSize: 11.5, color: TENUE }}>
          la historia · {resumen(arbol, niveles, contar)}
        </Text>
      </Pressable>

      {abierto
        ? historias.map((h) => (
            <Snippet
              key={h.nota}
              h={h}
              niveles={niveles}
              actual={h.nota === notaActual}
              desplegado={desplegados.has(h.nota)}
              onAlternar={() => alternar(h.nota)}
              onIr={onIr}
            />
          ))
        : null}
    </Animated.View>
  );
}

function Snippet({ h, niveles, actual, desplegado, onAlternar, onIr }) {
  const secciones = h.secciones || [];
  return (
    <View style={{ marginTop: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Pressable
          onPress={() => {
            roce();
            onAlternar();
          }}
          disabled={!secciones.length}
          hitSlop={8}
          style={{ width: 18, paddingVertical: 4 }}
          accessibilityRole="button"
          accessibilityState={{ expanded: desplegado }}
          accessibilityLabel={`${desplegado ? 'Plegar' : 'Desplegar'} ${h.titulo}`}
        >
          {secciones.length ? <Flecha abierta={desplegado} /> : null}
        </Pressable>
        <Pressable
          onPress={() => {
            roce();
            onIr({ nota: h.nota });
          }}
          hitSlop={3}
          style={({ pressed }) => ({ flex: 1, flexDirection: 'row', gap: 8, paddingVertical: 4, opacity: pressed ? 0.5 : 1 })}
          accessibilityRole="button"
          accessibilityLabel={`Ir a ${h.titulo}`}
        >
          <Text style={{ fontFamily: MONO, fontSize: 11.5, lineHeight: 18, color: NUMERO }}>{h.numero}</Text>
          <Text
            numberOfLines={1}
            style={{ flex: 1, fontFamily: MONO, fontSize: 12.5, lineHeight: 18, color: INDIGO, fontWeight: actual ? '700' : '500' }}
          >
            {h.titulo}
          </Text>
          {!desplegado && secciones.length ? (
            <Text style={{ fontFamily: MONO, fontSize: 11, lineHeight: 18, color: TENUE }}>{contar(secciones.length, niveles[1])}</Text>
          ) : null}
        </Pressable>
      </View>

      {desplegado
        ? secciones.map((s, i) => <Seccion key={s.id} h={h} s={s} i={i} niveles={niveles} onIr={onIr} />)
        : null}
    </View>
  );
}

function Seccion({ h, s, i, niveles, onIr }) {
  const [ideas, setIdeas] = useState(null); // null = cerrada
  const [cargando, setCargando] = useState(false);

  const alternarIdeas = async () => {
    roce();
    if (ideas) {
      setIdeas(null);
      return;
    }
    setCargando(true);
    try {
      setIdeas(await leerIdeas(s.id));
    } catch {
      setIdeas([]);
    } finally {
      setCargando(false);
    }
  };

  // Un documento leído no tiene lugar en el texto: se abre para ver lo que
  // se sacó de él, no para saltar.
  const ir = () => {
    if (s.documento) {
      alternarIdeas();
      return;
    }
    roce();
    onIr({ nota: h.nota, seccion: s });
  };

  return (
    <View style={{ marginLeft: 18 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Pressable
          onPress={alternarIdeas}
          disabled={!s.ideas}
          hitSlop={8}
          style={{ width: 18, paddingVertical: 3 }}
          accessibilityRole="button"
          accessibilityState={{ expanded: !!ideas }}
          accessibilityLabel={`${ideas ? 'Plegar' : 'Ver'} ${niveles[2][1]} de ${s.titulo}`}
        >
          {cargando ? <ActivityIndicator size="small" color={TENUE} /> : s.ideas ? <Flecha abierta={!!ideas} chica /> : null}
        </Pressable>
        <Pressable
          onPress={ir}
          hitSlop={3}
          style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3, opacity: pressed ? 0.5 : 1 })}
          accessibilityRole="button"
          accessibilityLabel={`Ir a ${s.titulo}`}
        >
          {s.documento ? (
            <FileText size={11} color={NUMERO} />
          ) : (
            <Text style={{ fontFamily: MONO, fontSize: 11, lineHeight: 18, color: NUMERO, minWidth: 14 }}>{i + 1}</Text>
          )}
          <Text numberOfLines={1} style={{ flex: 1, fontFamily: MONO, fontSize: 12, lineHeight: 18, color: INDIGO }}>
            {s.titulo}
          </Text>
        </Pressable>
      </View>

      {ideas?.length
        ? ideas.slice(0, 40).map((idea) => (
            <Pressable
              key={idea.id}
              disabled={s.documento}
              onPress={() => {
                roce();
                onIr({ nota: h.nota, seccion: s, idea });
              }}
              hitSlop={2}
              style={({ pressed }) => ({ marginLeft: 36, paddingVertical: 2, opacity: pressed ? 0.5 : 1 })}
              accessibilityRole="button"
            >
              <Text numberOfLines={1} style={{ fontFamily: MONO, fontSize: 11.5, lineHeight: 17, color: 'rgba(28,43,34,0.55)' }}>
                {idea.texto}
              </Text>
            </Pressable>
          ))
        : null}
      {ideas && ideas.length > 40 ? (
        <Text style={{ marginLeft: 36, fontFamily: MONO, fontSize: 11, color: TENUE }}>
          y {contar(ideas.length - 40, niveles[2])} más
        </Text>
      ) : null}
    </View>
  );
}

function Flecha({ abierta, chica }) {
  return (
    <View style={{ transform: [{ rotate: abierta ? '90deg' : '0deg' }] }}>
      <ChevronRight size={chica ? 11 : 13} color={TENUE} />
    </View>
  );
}
