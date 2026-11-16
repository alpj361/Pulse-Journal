import { origenDe, pareceUnoTuyo } from '../logica';

jest.mock('../../../utils/supabase', () => ({ supabase: {} }));

test('lo que el agente creó en tu cuenta es tuyo, y no se parece a sí mismo', () => {
  // El caso real: «Brief y tablas» lo creó Morrow en la cuenta de PJ.
  const brief = { id: 'u1', titulo: 'Brief y tablas', cuenta_tipo: 'humano', autor_tipo: 'agente', coincidencia_humano_id: 'u1' };
  expect(origenDe(brief)).toBe('para_ti');
  expect(pareceUnoTuyo(brief)).toBe(false);
});

test('lo suyo, lo que está en los dos y lo que se parece', () => {
  expect(origenDe({ cuenta_tipo: 'agente' })).toBe('suyo');
  expect(origenDe({ cuenta_tipo: 'agente', ya_en_mi_codex: true })).toBe('unido');
  expect(origenDe({ dueno_tipo: 'agente' })).toBe('suyo');
  expect(origenDe({ cuenta: 'humano' })).toBe('para_ti');
  expect(pareceUnoTuyo({ id: 'a1', cuenta_tipo: 'agente', coincidencia_humano_id: 'h2' })).toBe(true);
  expect(pareceUnoTuyo({ id: 'a1', cuenta_tipo: 'agente', ya_en_mi_codex: true, coincidencia_humano_id: 'h2' })).toBe(false);
});
