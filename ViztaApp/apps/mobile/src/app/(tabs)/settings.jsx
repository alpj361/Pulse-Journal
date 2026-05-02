import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Modal,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Linking,
  InteractionManager,
} from 'react-native';
import { useState, useCallback, useRef, useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';
import {
  Eye,
  EyeOff,
  LogOut,
  CheckCircle,
  BookOpen,
  FileText,
  User,
  Globe,
  ChevronDown,
  ChevronUp,
  X,
  Mail,
  Heart,
} from 'lucide-react-native';
import { usePulseConnectionStore } from '../../state/pulseConnectionStore';
import * as Notifications from 'expo-notifications';
import { Avatar, AvatarBuilderModal } from '../../components/avatar';
import AsyncStorage from '@react-native-async-storage/async-storage';

const APP_VERSION = 'V.002';

function formatDate(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleDateString('es-GT', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ─── Modal de login ───────────────────────────────────────────────────────────
function LoginModal({ visible, onClose, onSuccess }) {
  const insets = useSafeAreaInsets();
  const { isConnecting, error, connect, clearError } = usePulseConnectionStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleClose = () => {
    clearError();
    setEmail('');
    setPassword('');
    setShowPassword(false);
    onClose();
  };

  const handleConnect = async () => {
    if (!email.trim() || !password.trim()) return;
    clearError();
    const ok = await connect(email.trim(), password);
    if (ok) {
      handleClose();
      onSuccess?.();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' }}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />

          <View style={{
            backgroundColor: '#0b0d22',
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            borderTopWidth: 1,
            borderColor: 'rgba(99,102,241,0.2)',
            paddingBottom: insets.bottom + 24,
          }}>
            {/* Handle + close */}
            <View style={{ alignItems: 'center', paddingTop: 12, marginBottom: 8 }}>
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)' }} />
            </View>

            <View style={{ paddingHorizontal: 24, paddingTop: 8 }}>
              {/* Header */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <View>
                  <Text style={{ fontSize: 20, fontWeight: '800', color: '#fff' }}>
                    Iniciar sesión
                  </Text>
                  <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 3 }}>
                    Portal Web · Vizta
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={handleClose}
                  style={{
                    width: 34, height: 34, borderRadius: 17,
                    backgroundColor: 'rgba(255,255,255,0.08)',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <X size={17} color="rgba(255,255,255,0.6)" />
                </TouchableOpacity>
              </View>

              {/* Email */}
              <View style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: '700', letterSpacing: 0.5, marginBottom: 8 }}>
                  CORREO ELECTRÓNICO
                </Text>
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  borderRadius: 13,
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.1)',
                  paddingHorizontal: 14,
                  height: 50,
                }}>
                  <User size={16} color="rgba(255,255,255,0.35)" />
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="tu@correo.com"
                    placeholderTextColor="rgba(255,255,255,0.22)"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={{ flex: 1, color: '#fff', fontSize: 15, marginLeft: 10 }}
                  />
                </View>
              </View>

              {/* Password */}
              <View style={{ marginBottom: 20 }}>
                <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: '700', letterSpacing: 0.5, marginBottom: 8 }}>
                  CONTRASEÑA
                </Text>
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  borderRadius: 13,
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.1)',
                  paddingHorizontal: 14,
                  height: 50,
                }}>
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="••••••••"
                    placeholderTextColor="rgba(255,255,255,0.22)"
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={{ flex: 1, color: '#fff', fontSize: 15 }}
                  />
                  <TouchableOpacity onPress={() => setShowPassword((v) => !v)} style={{ padding: 4 }}>
                    {showPassword
                      ? <EyeOff size={18} color="rgba(255,255,255,0.35)" />
                      : <Eye size={18} color="rgba(255,255,255,0.35)" />
                    }
                  </TouchableOpacity>
                </View>
              </View>

              {/* Error */}
              {error ? (
                <View style={{
                  backgroundColor: 'rgba(239,68,68,0.1)',
                  borderRadius: 10,
                  padding: 12,
                  marginBottom: 16,
                  borderWidth: 1,
                  borderColor: 'rgba(239,68,68,0.2)',
                }}>
                  <Text style={{ fontSize: 13, color: '#f87171', lineHeight: 18 }}>{error}</Text>
                </View>
              ) : null}

              {/* Connect button */}
              <TouchableOpacity
                onPress={handleConnect}
                disabled={isConnecting || !email.trim() || !password.trim()}
                style={{
                  backgroundColor:
                    isConnecting || !email.trim() || !password.trim()
                      ? 'rgba(99,102,241,0.3)'
                      : '#6366f1',
                  borderRadius: 14,
                  paddingVertical: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {isConnecting ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff', marginLeft: 10 }}>
                      Conectando...
                    </Text>
                  </View>
                ) : (
                  <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>
                    Conectar
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Modal de Términos y Condiciones ─────────────────────────────────────────
function TermsModal({ visible, onClose }) {
  const insets = useSafeAreaInsets();

  const sections = [
    {
      title: '1. Sobre Vizta',
      content:
        'Vizta es una herramienta digital hecha por StandAtPD, un colectivo diseñador de herramientas digitales enfocado en la comunicación. Es una aplicación de noticias e información pública para usuarios en Guatemala y Centroamérica. Su uso es gratuito y no requiere registro.',
    },
    {
      title: '2. Uso de la aplicación',
      content:
        'Al usar la app, aceptas utilizarla de forma legal y responsable. Está diseñada para informar, no para sustituir criterio profesional en ningún ámbito.',
    },
    {
      title: '3. Contenido y pluralidad',
      content:
        'El contenido mostrado en Vizta proviene de diferentes medios de comunicación y fuentes públicas de la web. Esta información no garantiza ser la verdad absoluta — su propósito es ofrecer distintos puntos de vista para que el usuario forme su propio criterio. No nos hacemos responsables por la veracidad del contenido de terceros.',
    },
    {
      title: '4. Curación de fuentes',
      content:
        'El contenido se cuida y selecciona a partir de medios y fuentes ampliamente reconocidos en el país. Si deseas sugerir un medio adicional, puedes solicitarlo escribiéndonos a contacto@standatpd.com — toda solicitud será revisada y deberá ser aprobada antes de ser integrada.',
    },
    {
      title: '5. Propiedad intelectual',
      content:
        'El diseño, marca, código y funcionalidades propias de Vizta son creación de nuestro equipo. El contenido de noticias pertenece a sus respectivos autores y medios. Queda prohibida la reproducción comercial sin autorización.',
    },
    {
      title: '6. Privacidad',
      content:
        'Vizta no recopila datos personales de usuarios sin cuenta. Si conectas el Portal Web, se usa tu correo electrónico únicamente para autenticación. No compartimos datos con terceros con fines comerciales.',
    },
    {
      title: '7. Búsqueda con Inteligencia Artificial',
      content:
        'Vizta incluye una función de búsqueda de personas en el Codex mediante inteligencia artificial. Al ingresar un nombre, este se envía como consulta a motores de búsqueda e IA para obtener información pública disponible en internet. El nombre ingresado se usa exclusivamente para ejecutar la búsqueda y no se almacena ni asocia a tu perfil. Los resultados provienen de fuentes públicas y no garantizamos su exactitud.',
    },
    {
      title: '8. Posts y guardado de contenido',
      content:
        'Vizta permite guardar artículos y enlaces como posts en tu perfil. Esta función actúa como un marcador personal (bookmark) de contenido web. Los posts que guardes se almacenan asociados a tu cuenta en el Portal Web si estás conectado. Puedes eliminarlos en cualquier momento. No vendemos ni compartimos esta información con terceros.',
    },
    {
      title: '9. Sin suscripciones',
      content:
        'Vizta no ofrece ni cobra suscripciones. Todas las funciones de la app son completamente gratuitas. El Portal Web es una herramienta separada en acceso cerrado para periodistas y comunicadores.',
    },
    {
      title: '10. Limitación de responsabilidad',
      content:
        'No garantizamos disponibilidad continua del servicio. La app se ofrece "tal como está". No somos responsables por decisiones tomadas basadas en el contenido de la aplicación.',
    },
    {
      title: '11. Cambios en los términos',
      content:
        'Podemos actualizar estos términos en cualquier momento. Los cambios se notificarán mediante actualizaciones de la app. El uso continuado de Vizta implica la aceptación de los términos vigentes.',
    },
    {
      title: '12. Contacto',
      content:
        'Para dudas o consultas sobre estos términos, escríbenos a: contacto@standatpd.com',
    },
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' }}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={{
          backgroundColor: '#0b0d22',
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          borderTopWidth: 1,
          borderColor: 'rgba(99,102,241,0.2)',
          maxHeight: '90%',
          paddingBottom: insets.bottom + 16,
        }}>
          {/* Handle */}
          <View style={{ alignItems: 'center', paddingTop: 12, marginBottom: 4 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)' }} />
          </View>

          {/* Header */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 24,
            paddingTop: 12,
            paddingBottom: 16,
            borderBottomWidth: 1,
            borderColor: 'rgba(255,255,255,0.07)',
          }}>
            <View>
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#fff' }}>
                Términos y Condiciones
              </Text>
              <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 3 }}>
                Vizta · StandAtPD
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={{
                width: 34, height: 34, borderRadius: 17,
                backgroundColor: 'rgba(255,255,255,0.08)',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <X size={17} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 32 }}
            showsVerticalScrollIndicator={false}
          >
            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginBottom: 20, lineHeight: 18 }}>
              Última actualización: abril 2026 · Versión Alpha
            </Text>

            {sections.map((section, i) => (
              <View key={i} style={{ marginBottom: 20 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#a5b4fc', marginBottom: 6 }}>
                  {section.title}
                </Text>
                <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', lineHeight: 22 }}>
                  {section.content}
                </Text>
              </View>
            ))}

            <View style={{
              backgroundColor: 'rgba(99,102,241,0.08)',
              borderRadius: 12,
              padding: 14,
              borderWidth: 1,
              borderColor: 'rgba(99,102,241,0.2)',
              marginTop: 4,
            }}>
              <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 18, textAlign: 'center' }}>
                Al usar Vizta aceptas estos términos.{'\n'}
                <Text style={{ color: '#a5b4fc' }}>contacto@standatpd.com</Text>
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Modal de Política de Privacidad ─────────────────────────────────────────
function PrivacyModal({ visible, onClose }) {
  const insets = useSafeAreaInsets();

  const sections = [
    {
      title: '1. Sin recopilación de datos',
      content:
        'Vizta no recopila, almacena ni comparte datos personales de sus usuarios. No usamos cookies de rastreo, no tenemos analíticas de comportamiento ni vendemos información a terceros.',
    },
    {
      title: '2. Uso sin cuenta',
      content:
        'Todas las funciones principales de Vizta son accesibles sin necesidad de crear una cuenta o proporcionar ningún dato personal.',
    },
    {
      title: '3. Portal Web',
      content:
        'El Portal Web es la plataforma de donde nació Vizta. Es un servicio con sus propios términos y condiciones de uso, independientes a los de esta app. Si decides conectarlo, tu correo electrónico se usa únicamente para autenticarte. Puedes desconectarte en cualquier momento desde Ajustes.',
    },
    {
      title: '4. Búsqueda de personas en el Codex',
      content:
        'Cuando utilizas la función "Buscar más información" en el Codex, el nombre que ingresas se envía como consulta a servicios externos de búsqueda e inteligencia artificial para obtener información pública disponible en internet. Este nombre se utiliza únicamente para ejecutar la consulta puntual y no se guarda en nuestros servidores ni se asocia a tu identidad o perfil de usuario.',
    },
    {
      title: '5. Posts y bookmarks',
      content:
        'Si guardas artículos o enlaces como posts desde la app, estos se almacenan en tu cuenta del Portal Web (si estás conectado). Esta información es exclusivamente tuya: no la compartimos con terceros ni la usamos con fines publicitarios. Puedes eliminar tus posts en cualquier momento.',
    },
    {
      title: '6. Contenido de terceros',
      content:
        'La app muestra contenido proveniente de medios de comunicación externos. Estos medios pueden tener sus propias políticas de privacidad. Vizta no tiene control sobre el contenido ni las prácticas de esos sitios.',
    },
    {
      title: '7. Cambios a esta política',
      content:
        'Esta política puede actualizarse conforme Vizta expanda sus funcionalidades. Cualquier cambio relevante en el manejo de datos será notificado mediante una actualización de la app. Te recomendamos revisar esta sección periódicamente.',
    },
    {
      title: '8. Contacto',
      content:
        'Si tienes preguntas sobre privacidad, escríbenos a: contacto@standatpd.com',
    },
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' }}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={{
          backgroundColor: '#0b0d22',
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          borderTopWidth: 1,
          borderColor: 'rgba(16,185,129,0.2)',
          maxHeight: '90%',
          paddingBottom: insets.bottom + 16,
        }}>
          {/* Handle */}
          <View style={{ alignItems: 'center', paddingTop: 12, marginBottom: 4 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)' }} />
          </View>

          {/* Header */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 24,
            paddingTop: 12,
            paddingBottom: 16,
            borderBottomWidth: 1,
            borderColor: 'rgba(255,255,255,0.07)',
          }}>
            <View>
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#fff' }}>
                Política de Privacidad
              </Text>
              <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 3 }}>
                Vizta · StandAtPD
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={{
                width: 34, height: 34, borderRadius: 17,
                backgroundColor: 'rgba(255,255,255,0.08)',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <X size={17} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 32 }}
            showsVerticalScrollIndicator={false}
          >
            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginBottom: 20, lineHeight: 18 }}>
              Última actualización: abril 2026 · Versión Alpha
            </Text>

            {/* Highlight box */}
            <View style={{
              backgroundColor: 'rgba(16,185,129,0.08)',
              borderRadius: 12,
              padding: 14,
              borderWidth: 1,
              borderColor: 'rgba(16,185,129,0.2)',
              marginBottom: 24,
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: 10,
            }}>
              <Text style={{ fontSize: 18 }}>🔒</Text>
              <Text style={{ fontSize: 13, color: 'rgba(110,231,183,0.9)', lineHeight: 20, flex: 1, fontWeight: '600' }}>
                Vizta no recopila ni vende datos personales. Tu privacidad es una prioridad.
              </Text>
            </View>

            {sections.map((section, i) => (
              <View key={i} style={{ marginBottom: 20 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#6ee7b7', marginBottom: 6 }}>
                  {section.title}
                </Text>
                <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', lineHeight: 22 }}>
                  {section.content}
                </Text>
              </View>
            ))}

            <View style={{
              backgroundColor: 'rgba(16,185,129,0.06)',
              borderRadius: 12,
              padding: 14,
              borderWidth: 1,
              borderColor: 'rgba(16,185,129,0.15)',
              marginTop: 4,
            }}>
              <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 18, textAlign: 'center' }}>
                ¿Tienes preguntas sobre tu privacidad?{'\n'}
                <Text style={{ color: '#6ee7b7' }}>contacto@standatpd.com</Text>
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Modal de Apoyo ───────────────────────────────────────────────────────────
function SupportModal({ visible, onClose }) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' }}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={{
          backgroundColor: '#0b0d22',
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          borderTopWidth: 1,
          borderColor: 'rgba(244,114,182,0.2)',
          maxHeight: '90%',
          paddingBottom: insets.bottom + 16,
        }}>
          {/* Handle */}
          <View style={{ alignItems: 'center', paddingTop: 12, marginBottom: 4 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)' }} />
          </View>

          {/* Header */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 24,
            paddingTop: 12,
            paddingBottom: 16,
            borderBottomWidth: 1,
            borderColor: 'rgba(255,255,255,0.07)',
          }}>
            <View>
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#fff' }}>
                Apoyo
              </Text>
              <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 3 }}>
                Únete a la misión
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={{
                width: 34, height: 34, borderRadius: 17,
                backgroundColor: 'rgba(255,255,255,0.08)',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <X size={17} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 32 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Icon */}
            <View style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              backgroundColor: 'rgba(244,114,182,0.12)',
              borderWidth: 1,
              borderColor: 'rgba(244,114,182,0.25)',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 20,
            }}>
              <Heart size={24} color="#f472b6" />
            </View>

            <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.7)', lineHeight: 26, marginBottom: 28 }}>
              Siempre estamos buscando personas que nos apoyen a lograr la misión de diversificar los puntos de vista y poder tener una amplia variedad de noticias.{'\n\n'}
              Si deseas colaborar, no dudes en escribirnos con tus datos y razón de interés.
            </Text>

            {/* Account info */}
            <View style={{
              backgroundColor: 'rgba(99,102,241,0.08)',
              borderRadius: 14,
              padding: 16,
              marginBottom: 24,
              borderWidth: 1,
              borderColor: 'rgba(99,102,241,0.2)',
            }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#a5b4fc', letterSpacing: 0.5, marginBottom: 8 }}>
                ¿CÓMO PUEDO CREAR UNA CUENTA?
              </Text>
              <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 20 }}>
                Vizta es gratuita y no requiere cuenta. El Portal Web funciona por invitación, pero cualquier usuario puede registrarse y solicitar acceso en:
              </Text>
              <TouchableOpacity
                onPress={() => Linking.openURL('https://jornal.standatpd.com')}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginTop: 12,
                  gap: 6,
                }}
              >
                <Globe size={13} color="#a5b4fc" />
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#a5b4fc' }}>
                  jornal.standatpd.com
                </Text>
              </TouchableOpacity>
            </View>

            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              marginTop: 4,
            }}>
              <Mail size={14} color="rgba(244,114,182,0.6)" />
              <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 20 }}>
                Escríbenos a{' '}
                <Text style={{ color: '#f472b6', fontWeight: '700' }}>contacto@standatpd.com</Text>
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── FAQ Item colapsable ──────────────────────────────────────────────────────
function FaqItem({ question, children }) {
  const [open, setOpen] = useState(false);

  return (
    <View style={{
      backgroundColor: 'rgba(8,10,24,0.72)',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
      overflow: 'hidden',
    }}>
      <TouchableOpacity
        onPress={() => setOpen((v) => !v)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          padding: 18,
        }}
        activeOpacity={0.7}
      >
        <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,0.85)', lineHeight: 20 }}>
          {question}
        </Text>
        {open
          ? <ChevronUp size={17} color="rgba(255,255,255,0.4)" />
          : <ChevronDown size={17} color="rgba(255,255,255,0.4)" />
        }
      </TouchableOpacity>

      {open && (
        <View style={{
          paddingHorizontal: 18,
          paddingBottom: 18,
          borderTopWidth: 1,
          borderColor: 'rgba(255,255,255,0.06)',
        }}>
          {children}
        </View>
      )}
    </View>
  );
}

// ─── Pantalla principal ───────────────────────────────────────────────────────
export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { isConnected, connectedUser, connectedAt, disconnect } = usePulseConnectionStore();

  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [avatarConfig, setAvatarConfig] = useState(null);
  const [showAvatarBuilder, setShowAvatarBuilder] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('@pulzos_avatar').then(json => {
      if (json) setAvatarConfig(JSON.parse(json));
    });
  }, []);

  const player = useVideoPlayer(
    require('../../../assets/videos/feed-background.mp4'),
    (p) => {
      p.loop = true;
      p.muted = true;
      p.play();
    }
  );

  const initials = connectedUser?.email
    ? connectedUser.email.slice(0, 2).toUpperCase()
    : '??';

  return (
    <View style={{ flex: 1 }}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
        allowsFullscreen={false}
      />
      <BlurView intensity={55} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(4, 5, 18, 0.55)' }]} />

      <StatusBar style="light" />

      <LoginModal
        visible={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onSuccess={() => setShowLoginModal(false)}
      />

      <TermsModal
        visible={showTermsModal}
        onClose={() => setShowTermsModal(false)}
      />

      <PrivacyModal
        visible={showPrivacyModal}
        onClose={() => setShowPrivacyModal(false)}
      />

      <SupportModal
        visible={showSupportModal}
        onClose={() => setShowSupportModal(false)}
      />

      <AvatarBuilderModal
        visible={showAvatarBuilder}
        onClose={() => setShowAvatarBuilder(false)}
        onSave={async (cfg) => {
          await AsyncStorage.setItem('@pulzos_avatar', JSON.stringify(cfg));
          setAvatarConfig(cfg);
        }}
        initialConfig={avatarConfig}
        seed={connectedUser?.email}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: insets.top + 20,
          paddingBottom: insets.bottom + 40,
          paddingHorizontal: 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header + versión ── */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }}>
          <View>
            <Text style={{ fontSize: 32, fontWeight: '800', color: '#ffffff', letterSpacing: -0.5 }}>
              Ajustes
            </Text>
            <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>
              Vizta App
            </Text>
          </View>
          <View style={{
            backgroundColor: 'rgba(99,102,241,0.15)',
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderWidth: 1,
            borderColor: 'rgba(99,102,241,0.3)',
            marginTop: 6,
          }}>
            <Text style={{ fontSize: 12, fontWeight: '800', color: '#a5b4fc', letterSpacing: 0.5 }}>
              {APP_VERSION}
            </Text>
          </View>
        </View>

        {/* ── Visión ── */}
        <View style={{ marginBottom: 24 }}>
          <View style={{
            borderRadius: 20,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.1)',
            overflow: 'hidden',
            backgroundColor: 'rgba(8,10,24,0.72)',
          }}>
            <LinearGradient
              colors={['rgba(99,102,241,0.1)', 'rgba(139,92,246,0.05)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={{ padding: 22 }}>
              <Text style={{
                fontSize: 13,
                color: 'rgba(255,255,255,0.55)',
                lineHeight: 22,
                fontStyle: 'italic',
              }}>
                "Vizta es una herramienta nacida de la conexión entre la tecnología y la comunicación, espacios para empoderar la fiscalización y co-existencia de diferentes medios de noticias. La información es pública y siempre deberá de serlo."
              </Text>
            </View>
          </View>
        </View>

        {/* ── Portal Web: conectado o botón ── */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', fontWeight: '700', letterSpacing: 0.5, marginBottom: 12 }}>
            PORTAL WEB
          </Text>

          {isConnected ? (
            /* Estado conectado */
            <View style={{
              borderRadius: 20,
              borderWidth: 1,
              borderColor: 'rgba(74,222,128,0.2)',
              overflow: 'hidden',
              backgroundColor: 'rgba(8,10,24,0.72)',
            }}>
              <LinearGradient
                colors={['rgba(74,222,128,0.07)', 'rgba(34,197,94,0.03)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={{ padding: 20 }}>
                {/* Avatar row */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                  <TouchableOpacity
                    onPress={() => setShowAvatarBuilder(true)}
                    style={{ marginRight: 12 }}
                    activeOpacity={0.8}
                  >
                    <Avatar
                      seed={connectedUser?.email}
                      config={avatarConfig}
                      size={44}
                      showBorder={false}
                    />
                    <View style={{
                      position: 'absolute', bottom: -2, right: -2,
                      width: 18, height: 18, borderRadius: 9,
                      backgroundColor: '#6366f1',
                      alignItems: 'center', justifyContent: 'center',
                      borderWidth: 1.5, borderColor: '#0b0d22',
                    }}>
                      <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800', lineHeight: 14 }}>+</Text>
                    </View>
                  </TouchableOpacity>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }} numberOfLines={1}>
                      {connectedUser?.email}
                    </Text>
                    {connectedUser?.role === 'admin' && (
                      <Text style={{ fontSize: 12, color: 'rgba(165,180,252,0.75)', marginTop: 2 }}>
                        Administrador
                      </Text>
                    )}
                  </View>
                  <View style={{
                    backgroundColor: 'rgba(74,222,128,0.15)',
                    borderRadius: 8,
                    paddingHorizontal: 9,
                    paddingVertical: 4,
                    borderWidth: 1,
                    borderColor: 'rgba(74,222,128,0.3)',
                  }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#4ade80' }}>Activo</Text>
                  </View>
                </View>

                {connectedAt && (
                  <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginBottom: 16 }}>
                    Conectado desde el {formatDate(connectedAt)}
                  </Text>
                )}

                {/* Unlocked */}
                <View style={{
                  backgroundColor: 'rgba(255,255,255,0.04)',
                  borderRadius: 12,
                  padding: 14,
                  marginBottom: 16,
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.07)',
                }}>
                  <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: '700', letterSpacing: 0.5, marginBottom: 10 }}>
                    EN LA APP TIENES ACCESO A:
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 7 }}>
                    <CheckCircle size={14} color="#4ade80" />
                    <BookOpen size={13} color="rgba(165,180,252,0.7)" style={{ marginLeft: 8 }} />
                    <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginLeft: 6 }}>Wiki personal</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <CheckCircle size={14} color="#4ade80" />
                    <FileText size={13} color="rgba(165,180,252,0.7)" style={{ marginLeft: 8 }} />
                    <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginLeft: 6 }}>Codex de documentos</Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() => {
                    console.log('[Settings] Cerrar sesión pressed');
                    // Run disconnect AFTER all pending interactions/animations finish
                    // to prevent expo-router crash when tab href changes mid-render
                    InteractionManager.runAfterInteractions(() => {
                      console.log('[Settings] InteractionManager fired → calling disconnect()');
                      disconnect();
                    });
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(239,68,68,0.1)',
                    borderRadius: 12,
                    paddingVertical: 13,
                    borderWidth: 1,
                    borderColor: 'rgba(239,68,68,0.2)',
                  }}
                >
                  <LogOut size={15} color="#f87171" />
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#f87171', marginLeft: 7 }}>
                    Cerrar sesión
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            /* Botón de conectar */
            <TouchableOpacity
              onPress={() => setShowLoginModal(true)}
              activeOpacity={0.85}
              style={{
                borderRadius: 18,
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: 'rgba(99,102,241,0.4)',
              }}
            >
              <LinearGradient
                colors={['rgba(99,102,241,0.6)', 'rgba(79,70,229,0.75)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 18, gap: 10 }}
              >
                <Globe size={20} color="#fff" />
                <Text style={{ fontSize: 16, fontWeight: '800', color: '#fff', letterSpacing: 0.2 }}>
                  Conectar con Portal Web
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>

        {/* ── FAQ ── */}
        <View style={{ marginBottom: 8 }}>
          <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', fontWeight: '700', letterSpacing: 0.5, marginBottom: 12 }}>
            PREGUNTAS FRECUENTES
          </Text>

          <FaqItem question="¿Qué es el Portal Web?">
            <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', lineHeight: 22, marginTop: 12 }}>
              Es una herramienta en estado de prueba cerrada para periodistas y comunicadores.
            </Text>
            <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', lineHeight: 22, marginTop: 8 }}>
              Si deseas acceso, no dudes en contactarnos y contarnos por qué te gustaría colaborar con nuestro proyecto.
            </Text>
            <TouchableOpacity
              onPress={() => Linking.openURL('mailto:contacto@standatpd.com?subject=Solicitud%20de%20acceso%20al%20Portal%20Web')}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginTop: 16,
                backgroundColor: 'rgba(99,102,241,0.12)',
                borderRadius: 10,
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderWidth: 1,
                borderColor: 'rgba(99,102,241,0.25)',
                alignSelf: 'flex-start',
              }}
            >
              <Mail size={14} color="#a5b4fc" />
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#a5b4fc', marginLeft: 7 }}>
                contacto@standatpd.com
              </Text>
            </TouchableOpacity>
          </FaqItem>

          <View style={{ marginTop: 10 }}>
            <FaqItem question="¿Cómo puedo crear una cuenta?">
              <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', lineHeight: 22, marginTop: 12 }}>
                Vizta es de acceso completamente gratuito y no requiere cuenta para usar la aplicación.
              </Text>
              <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', lineHeight: 22, marginTop: 8 }}>
                El Portal Web — herramienta avanzada para periodistas y comunicadores — funciona por invitación. Sin embargo, cualquier usuario puede registrarse y solicitar acceso desde nuestro sitio web.
              </Text>
              <TouchableOpacity
                onPress={() => Linking.openURL('https://jornal.standatpd.com')}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginTop: 16,
                  backgroundColor: 'rgba(99,102,241,0.12)',
                  borderRadius: 10,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderWidth: 1,
                  borderColor: 'rgba(99,102,241,0.25)',
                  alignSelf: 'flex-start',
                }}
              >
                <Globe size={14} color="#a5b4fc" />
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#a5b4fc', marginLeft: 7 }}>
                  jornal.standatpd.com
                </Text>
              </TouchableOpacity>
            </FaqItem>
          </View>
        </View>

        {/* ── Legal ── */}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
          <TouchableOpacity
            onPress={() => setShowTermsModal(true)}
            activeOpacity={0.7}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 14,
              borderRadius: 14,
              backgroundColor: 'rgba(255,255,255,0.04)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.08)',
            }}
          >
            <FileText size={14} color="rgba(255,255,255,0.35)" />
            <Text style={{ fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.4)', marginLeft: 7 }}>
              Términos y Condiciones
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setShowPrivacyModal(true)}
            activeOpacity={0.7}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 14,
              borderRadius: 14,
              backgroundColor: 'rgba(255,255,255,0.04)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.08)',
            }}
          >
            <Text style={{ fontSize: 14 }}>🔒</Text>
            <Text style={{ fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.4)', marginLeft: 7 }}>
              Privacidad
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Apoyo ── */}
        <TouchableOpacity
          onPress={() => setShowSupportModal(true)}
          activeOpacity={0.7}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 10,
            paddingVertical: 14,
            borderRadius: 14,
            backgroundColor: 'rgba(244,114,182,0.06)',
            borderWidth: 1,
            borderColor: 'rgba(244,114,182,0.15)',
          }}
        >
          <Heart size={14} color="rgba(244,114,182,0.6)" />
          <Text style={{ fontSize: 12, fontWeight: '600', color: 'rgba(244,114,182,0.7)', marginLeft: 7 }}>
            Apoyo
          </Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}
