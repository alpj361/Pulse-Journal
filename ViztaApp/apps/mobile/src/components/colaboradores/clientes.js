/**
 * Desde dónde se puede conectar un agente a Vizta (STA-259).
 *
 * Un agente no se crea en la app: se conecta al MCP de Vizta desde el cliente
 * donde ya trabaja, entra con la cuenta de quien lo usa y se crea su propia
 * cuenta con la acción `agent_account_create`. La cuenta queda ligada a esa
 * persona y aparece en Colaboradores.
 *
 * `donde` dice dónde se agrega el conector en cada cliente. Si un cliente
 * cambia sus menús, se cambia acá.
 */

export const MCP_URL = 'https://mcp.standatpd.com/mcp';

export const CLIENTES = [
  { id: 'chatgpt', nombre: 'ChatGPT', donde: 'Ajustes › Apps y conectores › Crear. Si no aparece «Crear», prendé el modo desarrollador en Avanzado.' },
  { id: 'claude', nombre: 'Claude', donde: 'Ajustes › Conectores › Agregar conector personalizado.' },
  { id: 'hermes', nombre: 'Hermes', donde: 'En su configuración, sumá un servidor MCP con esta dirección.' },
  { id: 'gemini', nombre: 'Gemini', donde: 'En Gemini CLI: gemini mcp add --transport http vizta y esta dirección.' },
  { id: 'cursor', nombre: 'Cursor', donde: 'Ajustes › MCP › Agregar servidor, con esta dirección.' },
  { id: 'codex', nombre: 'Codex', donde: 'En Codex: codex mcp add vizta --url y esta dirección.' },
  { id: 'otro', nombre: 'Otro', donde: 'Cualquier cliente que acepte servidores MCP remotos: agregá esta dirección.' },
];

/** Lo que se le pide al agente para que se cree su cuenta. */
export const pedidoDeCuenta = (nombre) =>
  `Usá el conector de Vizta que acabo de agregar y creá tu cuenta de agente con la acción agent_account_create. Llamate «${(nombre || '').trim() || 'Agente'}».`;

/** Los agentes que aparecieron desde que se abrió la hoja. */
export const nuevosAgentes = (antes, ahora) => {
  const ya = new Set((antes || []).map((c) => c.id));
  return (ahora || []).filter((c) => c.cuenta_tipo === 'agente' && !ya.has(c.id));
};
