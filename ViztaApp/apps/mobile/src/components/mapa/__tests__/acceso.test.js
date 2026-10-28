import { puedeVerMapa } from '../acceso';

describe('puedeVerMapa', () => {
  test('alfa (por rol o por tipo de cuenta) y admin lo ven', () => {
    expect(puedeVerMapa({ id: '1', role: 'admin', user_type: 'Alpha' })).toBe(true);
    expect(puedeVerMapa({ id: '1', role: 'alfa', roles: ['alfa'] })).toBe(true);
    expect(puedeVerMapa({ id: '1', role: 'user', roles: ['user'], user_type: 'Alpha' })).toBe(true);
  });
  test('beta, phone y sin sesión no', () => {
    expect(puedeVerMapa({ id: '1', role: 'beta', roles: ['beta'], user_type: 'Beta' })).toBe(false);
    expect(puedeVerMapa({ id: '1', role: 'user', user_type: 'phone' })).toBe(false);
    expect(puedeVerMapa(null)).toBe(false);
  });
});
