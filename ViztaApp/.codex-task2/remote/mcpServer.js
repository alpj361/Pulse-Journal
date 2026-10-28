/**
 * mcpServer.js — Servidor MCP (Model Context Protocol) real de NewsCron.
 *
 * Expone las MISMAS herramientas que usa Vizta (codex, data_ops, mapa, search,
 * datasets, etc.) a clientes externos (Claude Desktop, ChatGPT connectors, …)
 * vía el protocolo MCP estándar. NO reescribe las tools — es un adaptador delgado
 * sobre el registro AVAILABLE_TOOLS y executeTool() de services/mcp.js.
 *
 * Etapa 1 (esta): protocolo + adaptador, transporte Streamable HTTP stateless.
 * Etapa 2 (pendiente): OAuth 2.1 sobre Supabase para multi-usuario.
 */
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { ListToolsRequestSchema, CallToolRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const { AVAILABLE_TOOLS, executeTool, getToolsForMode } = require('./mcp');
const { buildDetailsPromptSection } = require('./codexSchema');

// Modo con el que corren las tools vía MCP: 'mcp' hereda las herramientas
// agentic y excluye solo las operaciones declaradas como demasiado destructivas.
// Ver TOOL_MODE_ACCESS en services/mcp.js.
const MCP_MODE = 'mcp';

/**
 * Instrucciones del servidor (campo `instructions` del handshake `initialize`).
 * El cliente MCP las inyecta como contexto del modelo — es el único canal para
 * darle disciplina de trabajo a un cliente externo (Claude, ChatGPT), que NO pasa
 * por el system prompt de Vizta y solo ve las tools.
 *
 * La tabla de shapes se GENERA desde codexSchema (fuente de verdad única), así el
 * cliente externo recibe exactamente el mismo contrato que Vizta.
 */
function buildMcpInstructions() {
  return `Este servidor da acceso al Codex de Pulzos/NewsCron: un sistema de investigación
periodística sobre Guatemala. El Codex tiene dos capas:
- **Universo investigativo** (codex_universe_items): Actores, Entidades, Territorios,
  Eventos, Historias, Objetos, Artefactos — entidades reales con relaciones entre sí.
- **Items de Codex** (codex_items): documentos, notas, enlaces, transcripciones.

## Disciplina de trabajo (obligatoria)

1. **Verificá antes de escribir.** No guardes en el Codex nada que no hayas
   confirmado con una fuente. Si un dato es incierto, decilo explícitamente en el
   texto o dejá el campo vacío — nunca lo rellenes con una suposición.
2. **Citá la fuente.** Cuando agregues información investigada, indicá de dónde
   salió (medio, fecha, enlace). Un dato sin origen es ruido en una base de
   investigación.
3. **Buscá antes de crear.** Usá codex action=search_universe para ver si la
   entidad ya existe. Crear duplicados es el error más costoso: rompe las
   relaciones y las agregaciones. Si existe, actualizá con update_universe_item.
4. **No inventes UUIDs jamás.** Un id solo es válido si vino de una búsqueda previa
   en esta misma sesión.
5. **Distinguí hecho de inferencia.** Este es un sistema de investigación: si algo
   es tu lectura o hipótesis, marcalo como tal, no lo escribas como hecho.

## Operaciones masivas — no iteres

Para más de ~5 items NO llames create/update en loop. Usá **data_ops**:
- \`operation=enrich\` — investiga y completa perfiles de muchos items en background
  (lanza subagentes; consume créditos del usuario, avisale antes de disparar lotes grandes)
- \`operation=count\` / \`find\` — agregaciones y filtros sin traerte todo el detalle
- \`operation=assign\` — mover muchos items a un espacio/proyecto
Y para leer en bloque: codex con \`filter_universe\`, \`list_by_dataset\`,
\`lookup_by_names\`, \`reconcile_dataset\` (esta última responde "¿están todos los X
mapeados?" en UNA llamada).

Principio: operá por REFERENCIA (mandá instrucciones, el servidor resuelve los ids),
no por VALOR (no te traigas 200 items al contexto para procesarlos uno a uno).

## Conjuntos de datos conectados a Codex

Una fila y un ítem de Codex NO son lo mismo hasta que el usuario confirme su vínculo.
Para conectar un conjunto:
1. Leé las filas con \`dataset_list_rows\` y el catálogo de Codex antes de proponer cambios.
2. Llamá \`dataset_preview_codex_alignment\`. Es de solo lectura y devuelve coincidencias,
   ambigüedades, posibles ítems nuevos y un \`preview_token\`.
3. Mostrá esa vista previa. No elijas candidatos ambiguos ni crees ítems sin aprobación.
4. Solo tras aprobación llamá \`dataset_apply_codex_alignment\` con \`confirmed=true\`,
   decisiones por fila y la lista completa de asignaciones usada en la vista previa
   (mandá \`[]\` si el usuario confirmó que no quiere sincronizar campos).

\`connection_mode=track\` conserva el vínculo sin copiar campos. \`sync\` propaga en ambos
sentidos únicamente las columnas aprobadas. Un destino \`field\` debe usar una \`field_key\`
del catálogo; \`details\` admite una clave libre solo cuando el usuario decidió que ese dato
forme parte de la ficha. Si un vacío usa \`confirm_clear\`, consultá
\`dataset_list_conflicts\`: no lo resuelvas por tu cuenta.

## Búsqueda

- \`search\` — Perplexity + Exa. Es la búsqueda **operativa** de este servidor; usala
  cuando necesites información externa con enfoque en Guatemala. Si tenés buscador
  propio, podés preferirlo para temas genéricos, pero acá funciona y está afinado
  al contexto local.
- \`search_and_save_dataset\` — busca y persiste en un dataset del usuario.
- \`search_parallel\` / \`search_bulk\` — hoy están DEGRADADOS: sus backends de nitter
  y Parallel AI no están configurados, así que devuelven vacío o error. No los uses
  como primera opción; preferí \`search\`.

## Simulación (\`simular\`) — protocolo encadenado

\`simular\` responde "¿qué pasaría si…?" haciendo que muchas personas reaccionen a un
escenario. **El servidor lleva el estado; vos sos el cerebro de cada persona.**

El ciclo es:
1. \`operation="crear"\` — definís el escenario y quiénes participan (actores reales del
   Codex, personas sintéticas, o ambas). Te devuelve el \`sim_id\` y el **primer turno**.
2. \`operation="actuar"\` — te toca UNA persona (o un lote): leés su perfil y **solo lo
   que esa persona ve**, y decidís qué hace. El servidor lo registra, lo propaga por la
   red y te devuelve la siguiente.
3. Repetís el paso 2 **hasta que el servidor te diga que la simulación está completa** —
   normalmente ~20 veces.
4. \`operation="reporte"\` — métricas y línea de tiempo. Recién ahí escribís el análisis.

Reglas que hacen que esto funcione:
- **Cada respuesta te dice qué llamar después y cuántos turnos faltan. Seguí ese hilo.**
  Si te detenés a mitad, la simulación queda inservible — no hay resultado parcial útil.
- **Escribí en la voz de la persona, no en la tuya.** Es la diferencia entre una
  simulación y un resumen tuyo de lo que pasaría.
- **Respetá su horizonte:** decidís con lo que esa persona ve en su timeline, no con
  todo lo que vos sabés de la simulación.
- Si son muchos turnos y el encadenado se te hace largo, subí \`batch\` al crear
  (5 personas por llamada = 4 llamadas en vez de 20).
- No inventes el análisis antes del \`reporte\`: las métricas de propagación salen de los
  datos, no de tu impresión.

## Escritura destructiva

Los delete borran de verdad y no hay papelera. Confirmá con el usuario antes de
ejecutar cualquier borrado, aunque te lo haya pedido en términos generales.

## Contrato de \`details\` (CRÍTICO)

${buildDetailsPromptSection()}`;
}

// ── Conversión: el shape { type, required, enum, items, min, max, default } del
// registro AVAILABLE_TOOLS → JSON Schema estándar que MCP espera en inputSchema.
function paramToJsonSchema(p) {
  const out = {};
  if (p.type) out.type = p.type === 'integer' ? 'integer' : p.type;
  if (p.description) out.description = p.description;
  if (Array.isArray(p.enum)) out.enum = p.enum;
  if (p.items) out.items = p.items;
  if (p.default !== undefined) out.default = p.default;
  if (p.min !== undefined) out.minimum = p.min;
  if (p.max !== undefined) out.maximum = p.max;
  // objetos libres (details, filter, geo…) → object sin restricción de props
  if (p.type === 'object' && !out.properties) out.additionalProperties = true;
  return out;
}

function toolToMcp(tool) {
  const params = tool.parameters || {};
  const properties = {};
  const required = [];
  for (const [name, def] of Object.entries(params)) {
    properties[name] = paramToJsonSchema(def);
    if (def.required) required.push(name);
  }
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: {
      type: 'object',
      properties,
      ...(required.length ? { required } : {}),
    },
  };
}

// Lista de herramientas expuestas por MCP: solo las permitidas en modo mcp
// (así el cliente no ve tools que fallarían al llamarse).
function listMcpTools() {
  const allowed = new Set(getToolsForMode(MCP_MODE));
  return Object.values(AVAILABLE_TOOLS)
    .filter(t => allowed.has(t.name))
    .map(toolToMcp);
}

/**
 * Construye un Server MCP atado a un usuario concreto. El usuario viene de la
 * capa de auth (etapa 1: Bearer→Supabase; etapa 2: OAuth). Todas las tools se
 * ejecutan en su contexto vía executeTool.
 */
function buildMcpServer(user) {
  const server = new Server(
    { name: 'newscron-mcp', version: '1.0.0' },
    {
      capabilities: { tools: {} },
      // Se devuelven en el handshake `initialize`; el cliente las usa como
      // contexto del modelo. Es la única forma de darle disciplina de trabajo a
      // un cliente externo que no pasa por el system prompt de Vizta.
      instructions: buildMcpInstructions(),
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: listMcpTools(),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    console.log(`🔌 [MCP-PROTO] tools/call ${name} | user:${user?.id || 'anon'}`);
    try {
      const result = await executeTool(name, args || {}, user, MCP_MODE);
      const text = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
      return {
        content: [{ type: 'text', text }],
        // señala error de negocio al modelo sin romper el protocolo
        isError: result && result.success === false ? true : false,
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error ejecutando ${name}: ${err.message}` }],
        isError: true,
      };
    }
  });

  return server;
}

module.exports = { buildMcpServer, listMcpTools, toolToMcp };
