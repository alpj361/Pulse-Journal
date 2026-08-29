const assert = require('assert');
require('dotenv').config({ path: '.env' });

const mcp = require('./server/services/mcp');
const vizta = require('./server/services/agents/vizta');
const planner = require('./server/services/viztaAgenticPlanner');

const expectedSimulationOps = ['crear','actuar','reporte','estado','listar','obtener','guardar_analisis','archivar','cancelar'];
const expectedCodexActions = ['update_field','deactivate_field','update_preset','deactivate_preset','create_source','cite_source','create_profile','update_profile'];

const mcpSimulation = mcp.AVAILABLE_TOOLS.simular;
assert(mcpSimulation);
assert.deepEqual(mcpSimulation.parameters.operation.enum, expectedSimulationOps);
for (const field of ['turn_token','seed','source_ids','context_item_ids','parent_simulation_id','analisis']) {
  assert(mcpSimulation.parameters[field], `MCP simular missing ${field}`);
}
assert.equal(mcp.AVAILABLE_TOOLS.codex_add_custom_field, undefined);
assert.equal(mcp.AVAILABLE_TOOLS.codex_set_custom_field, undefined);
assert.equal(mcp.TOOL_MODE_ACCESS.agentic.has('codex_add_custom_field'), false);
assert.equal(mcp.TOOL_MODE_ACCESS.mcp.has('codex_set_custom_field'), false);

const mcpCodexActions = mcp.AVAILABLE_TOOLS.codex.parameters.action.enum;
for (const action of expectedCodexActions) assert(mcpCodexActions.includes(action), `MCP codex missing ${action}`);

const viztaSimulation = vizta.VIZTA_TOOLS.find((tool) => tool.function.name === 'simular');
const viztaCodex = vizta.VIZTA_TOOLS.find((tool) => tool.function.name === 'codex');
assert(viztaSimulation && viztaCodex);
assert.deepEqual(viztaSimulation.function.parameters.properties.operation.enum, expectedSimulationOps);
for (const action of expectedCodexActions) {
  assert(viztaCodex.function.parameters.properties.action.enum.includes(action), `Vizta codex missing ${action}`);
}
assert(viztaCodex.function.description.includes('Post y Snippet son contenido auxiliar'));
assert(viztaCodex.function.description.includes('Source es un item oficial'));

const plannerSimulation = planner.CODEX_TOOLS_SCHEMA.find((tool) => tool.function.name === 'simular');
const plannerCodex = planner.CODEX_TOOLS_SCHEMA.find((tool) => tool.function.name === 'codex');
assert(plannerSimulation && plannerCodex);
assert.deepEqual(plannerSimulation.function.parameters.properties.operation.enum, expectedSimulationOps);
for (const action of expectedCodexActions) {
  assert(plannerCodex.function.parameters.properties.action.enum.includes(action), `Planner codex missing ${action}`);
}
assert.equal(planner.CODEX_TOOLS_SCHEMA.some((tool) => ['codex_add_custom_field','codex_set_custom_field'].includes(tool.function.name)), false);

console.log(JSON.stringify({
  passed: true,
  simulation_operations: expectedSimulationOps.length,
  mcp_synced: true,
  vizta_synced: true,
  planner_synced: true,
  legacy_free_field_tools_hidden: true,
}));
