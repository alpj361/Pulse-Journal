import { CLIENTES, MCP_URL, clientesPara, nuevosAgentes, pedidoDeCuenta } from '../clientes';
import { LOGOS } from '../logos';

describe('conectar un agente', () => {
  it('cada cliente con marca tiene su logo; «otro» no', () => {
    for (const c of CLIENTES) {
      if (c.id === 'otro') expect(LOGOS[c.id]).toBeUndefined();
      else expect(LOGOS[c.id]).toMatch(/^<svg[\s\S]*<\/svg>$/);
    }
  });

  it('los logos no dependen del color del texto', () => {
    for (const xml of Object.values(LOGOS)) expect(xml).not.toMatch(/currentColor/);
  });

  it('el pedido lleva la acción y el nombre', () => {
    expect(pedidoDeCuenta(' Investigador ')).toContain('agent_account_create');
    expect(pedidoDeCuenta(' Investigador ')).toContain('«Investigador»');
    expect(pedidoDeCuenta('')).toContain('«Agente»');
  });

  it('solo cuenta agentes que no estaban', () => {
    const antes = [{ id: 'c1', cuenta_tipo: 'agente' }];
    const ahora = [...antes, { id: 'c2', cuenta_tipo: 'agente' }, { id: 'h1', cuenta_tipo: 'humano' }];
    expect(nuevosAgentes(antes, ahora).map((c) => c.id)).toEqual(['c2']);
    expect(nuevosAgentes(undefined, [{ id: 'c9', cuenta_tipo: 'agente' }])).toHaveLength(1);
  });

  it('la dirección es la del MCP público', () => {
    expect(MCP_URL).toBe('https://mcp.standatpd.com/mcp');
  });

  it('se ven solo los chats de siempre, con su paso a paso', () => {
    const basicos = clientesPara({ id: 'u', role: 'beta' });
    expect(basicos.map((c) => c.id)).toEqual(['chatgpt', 'claude']);
    for (const c of basicos) {
      expect(c.pasos.length).toBeGreaterThan(2);
      expect(c.pasos.some((p) => p.copiar === 'url')).toBe(true);
    }
    expect(clientesPara({ id: 'u', role: 'admin' }).map((c) => c.id)).toEqual(['chatgpt', 'claude']);
  });
});
