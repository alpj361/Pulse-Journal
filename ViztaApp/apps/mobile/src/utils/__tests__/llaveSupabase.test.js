import {
  LLAVE_PUBLICA_POR_DEFECTO,
  SUPABASE_URL_POR_DEFECTO,
  esLlavePublishable,
  resolverLlavePublica,
  resolverUrl,
} from '../llaveSupabase';

describe('llave pública de Supabase', () => {
  test('acepta sb_publishable_ y rechaza un JWT leftover', () => {
    expect(esLlavePublishable('sb_publishable_abc')).toBe(true);
    expect(esLlavePublishable('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.sig')).toBe(false);
    expect(esLlavePublishable('')).toBe(false);
    expect(esLlavePublishable(undefined)).toBe(false);
  });

  test('prefiere EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', () => {
    expect(
      resolverLlavePublica({
        EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_nueva',
        EXPO_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_vieja',
      })
    ).toBe('sb_publishable_nueva');
  });

  test('ignora la anon JWT deshabilitada y usa la publishable del repo', () => {
    expect(
      resolverLlavePublica({
        EXPO_PUBLIC_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.sig',
      })
    ).toBe(LLAVE_PUBLICA_POR_DEFECTO);
  });

  test('acepta ANON_KEY solo si ya es publishable', () => {
    expect(
      resolverLlavePublica({
        EXPO_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_renombrada_en_eas',
      })
    ).toBe('sb_publishable_renombrada_en_eas');
  });

  test('resuelve la URL del proyecto', () => {
    expect(resolverUrl({})).toBe(SUPABASE_URL_POR_DEFECTO);
    expect(resolverUrl({ EXPO_PUBLIC_SUPABASE_URL: 'https://otro.supabase.co' })).toBe(
      'https://otro.supabase.co'
    );
  });
});
