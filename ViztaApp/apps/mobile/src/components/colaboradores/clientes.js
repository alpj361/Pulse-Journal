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

/**
 * Los pasos van en palabras de quien no programa. `copiar: 'url'` pone el
 * botón para copiar la dirección de Vizta en ese paso. Los menús de cada app
 * cambian de nombre seguido: si cambian, se cambia acá.
 */
export const CLIENTES = [
  {
    id: 'chatgpt',
    nombre: 'ChatGPT',
    basico: true,
    antes: 'Se hace una sola vez, desde la computadora en chatgpt.com. Hace falta un plan pago (Plus, Pro o Business).',
    pasos: [
      { titulo: 'Abrí la configuración', texto: 'En chatgpt.com tocá tu nombre, abajo a la izquierda, y entrá a Configuración › Apps y conectores.' },
      { titulo: 'Prendé el modo desarrollador', texto: 'Abajo de todo, en Configuración avanzada, prendé «Modo desarrollador». Sin esto no aparece el botón para crear.' },
      { titulo: 'Creá el conector de Vizta', texto: 'Volvé a Apps y conectores y tocá «Crear». En Nombre poné Vizta; en URL pegá esta dirección; en Autenticación dejá OAuth. Marcá «Confío en esta aplicación» y tocá Crear.', copiar: 'url' },
      { titulo: 'Conectalo', texto: 'Tocá «Conectar». Se abre una página de Vizta y, en tu teléfono, Vizta te pide autorizarlo: dale autorizar.' },
      { titulo: 'Usalo en un chat', texto: 'En un chat nuevo tocá «+» › Más › Vizta (o Modo desarrollador › Vizta) para que lo use en esa conversación.' },
    ],
  },
  {
    id: 'claude',
    nombre: 'Claude',
    basico: true,
    antes: 'Se hace una sola vez, en claude.ai o en la app de Claude para computadora. Después queda también en el teléfono.',
    pasos: [
      { titulo: 'Abrí los conectores', texto: 'En claude.ai tocá tu nombre, abajo a la izquierda, y entrá a Configuración › Conectores.' },
      { titulo: 'Agregá Vizta', texto: 'Tocá «Agregar conector personalizado». En Nombre poné Vizta y en URL pegá esta dirección. Tocá Agregar.', copiar: 'url' },
      { titulo: 'Conectalo', texto: 'Al lado de Vizta tocá «Conectar». Se abre una página de Vizta y, en tu teléfono, Vizta te pide autorizarlo: dale autorizar.' },
      { titulo: 'Usalo en un chat', texto: 'En un chat tocá el botón de herramientas (al lado del clip) y prendé Vizta.' },
    ],
  },
  // De código: no se muestran (ver clientesPara).
  { id: 'hermes', nombre: 'Hermes', donde: 'En su configuración, sumá un servidor MCP con esta dirección.' },
  { id: 'gemini', nombre: 'Gemini CLI', donde: 'En Gemini CLI: gemini mcp add --transport http vizta y esta dirección.' },
  { id: 'cursor', nombre: 'Cursor', donde: 'Ajustes › MCP › Agregar servidor, con esta dirección.' },
  { id: 'codex', nombre: 'Codex', donde: 'En Codex: codex mcp add vizta --url y esta dirección.' },
  { id: 'otro', nombre: 'Otro', donde: 'Cualquier cliente que acepte servidores MCP remotos: agregá esta dirección.' },
];

/**
 * Los que se muestran: solo los chats de siempre (ChatGPT, Claude), para
 * todos. Los de código (Cursor, Codex, Gemini CLI…) quedan en la lista por si
 * vuelven, pero no se ofrecen: la app es para gente que no programa.
 */
export const clientesPara = () => CLIENTES.filter((c) => c.basico);

/** Lo que se le pide al agente para que se cree su cuenta. */
export const pedidoDeCuenta = (nombre) =>
  `Usá el conector de Vizta que acabo de agregar y creá tu cuenta de agente con la acción agent_account_create. Llamate «${(nombre || '').trim() || 'Agente'}».`;

/** Los agentes que aparecieron desde que se abrió la hoja. */
export const nuevosAgentes = (antes, ahora) => {
  const ya = new Set((antes || []).map((c) => c.id));
  return (ahora || []).filter((c) => c.cuenta_tipo === 'agente' && !ya.has(c.id));
};
