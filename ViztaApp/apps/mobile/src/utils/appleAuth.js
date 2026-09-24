import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { supabase } from './supabase';

/**
 * Acceso con Apple para usuarios de solo móvil.
 *
 * El flujo: Apple devuelve un identityToken, Supabase lo canjea por sesión con
 * `signInWithIdToken`, y si el usuario es nuevo se le crea el perfil con
 * `user_type: 'phone'` — la marca de cuenta nacida en el teléfono.
 *
 * Dos cosas que Apple hace distinto y hay que tener en cuenta:
 *
 *  · El nombre y el correo **solo llegan la primera vez**. En los accesos
 *    siguientes vienen null aunque el usuario exista. Por eso el nombre se
 *    guarda al crear, no después.
 *  · Con «Ocultar mi correo», el email es un alias `@privaterelay.appleid.com`.
 *    Es un correo válido y estable para esa cuenta, pero no sirve para
 *    identificar a la persona fuera de la app.
 *
 * El `nonce` va en dos formas: Apple recibe el SHA-256 y Supabase el original,
 * que es como se verifica que el token no fue interceptado.
 */

export const APPLE_USER_TYPE = 'phone';

export function appleDisponible() {
  return Platform.OS === 'ios' && AppleAuthentication.isAvailableAsync();
}

export async function signInWithApple() {
  if (Platform.OS !== 'ios') {
    throw new Error('El acceso con Apple solo está disponible en iOS');
  }

  const disponible = await AppleAuthentication.isAvailableAsync();
  if (!disponible) {
    throw new Error('Este dispositivo no tiene acceso con Apple');
  }

  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);

  const credencial = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
    nonce: hashedNonce,
  });

  if (!credencial.identityToken) {
    throw new Error('Apple no devolvió el token de identidad');
  }

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credencial.identityToken,
    nonce: rawNonce,
  });

  if (error) throw error;

  const usuario = data.user;
  if (!usuario) throw new Error('No se pudo abrir la sesión');

  // Nombre completo: solo viene en el primer acceso.
  const nombre = [credencial.fullName?.givenName, credencial.fullName?.familyName]
    .filter(Boolean)
    .join(' ')
    .trim();

  const perfil = await asegurarPerfil(usuario, nombre);
  return { usuario, perfil, esNuevo: perfil?._recienCreado === true };
}

/**
 * Devuelve el perfil del usuario; lo crea con `user_type: 'phone'` si no existe.
 *
 * `profiles` es una tabla privada administrada por el sistema. El alta normal
 * ocurre desde el disparador de `auth.users`; la RPC solo recupera cuentas
 * antiguas o altas parciales sin permitir escritura directa sobre la tabla.
 */
async function asegurarPerfil(usuario, nombre) {
  const { data: existente, error: errorLectura } = await supabase
    .from('profiles')
    .select('id, email, user_type, role, roles, credits')
    .eq('id', usuario.id)
    .maybeSingle();

  if (errorLectura) {
    console.warn('[appleAuth] no se pudo leer el perfil:', errorLectura.message);
  }
  if (existente) {
    if (nombre) await guardarNombrePublico(usuario.id, nombre);
    return existente;
  }

  const { error: errorAlta } = await supabase.rpc('ensure_my_account_profile');

  if (errorAlta) {
    console.warn('[appleAuth] no se pudo recuperar el perfil privado:', errorAlta.message);
    return {
      id: usuario.id,
      email: usuario.email ?? null,
      user_type: APPLE_USER_TYPE,
      role: 'user',
      _sinPerfil: true,
      _motivo: errorAlta.message,
    };
  }

  if (nombre) await guardarNombrePublico(usuario.id, nombre);

  const { data: creado, error: errorLecturaFinal } = await supabase
    .from('profiles')
    .select('id, email, user_type, role, roles, credits')
    .eq('id', usuario.id)
    .single();

  if (errorLecturaFinal) {
    console.warn('[appleAuth] el perfil privado no quedó disponible:', errorLecturaFinal.message);
    return {
      id: usuario.id,
      email: usuario.email ?? null,
      user_type: APPLE_USER_TYPE,
      role: 'user',
      _sinPerfil: true,
      _motivo: errorLecturaFinal.message,
    };
  }

  return { ...creado, _recienCreado: true };
}

async function guardarNombrePublico(userId, nombre) {
  const { error } = await supabase
    .from('user_public_profiles')
    .update({ display_name: nombre })
    .eq('user_id', userId);

  if (error) {
    console.warn('[appleAuth] no se pudo guardar el nombre público:', error.message);
  }
}
