const fs = require('fs');

{
  const path = 'server/services/mcp.js';
  let source = fs.readFileSync(path, 'utf8');
  const definitionsStart = source.indexOf('  // ===================================================================\n  // TOOL: CODEX_ADD_CUSTOM_FIELD');
  const definitionsEnd = source.indexOf('  // ===================================================================\n  // TOOL: CODEX_BULK_UPDATE', definitionsStart);
  if (definitionsStart < 0 || definitionsEnd < 0) throw new Error('No se encontraron definiciones legacy MCP');
  source = source.slice(0, definitionsStart) + source.slice(definitionsEnd);
  source = source.replace(
    "    'codex_list_items', 'codex_update_item', 'codex_add_custom_field', 'codex_set_custom_field', 'codex_bulk_update',",
    "    'codex_list_items', 'codex_update_item', 'codex_bulk_update',"
  );
  const casesStart = source.indexOf("      case 'codex_add_custom_field': {");
  const casesEnd = source.indexOf("      case 'codex_bulk_update': {", casesStart);
  if (casesStart < 0 || casesEnd < 0) throw new Error('No se encontraron cases legacy MCP');
  const rejected = `      case 'codex_add_custom_field':
      case 'codex_set_custom_field':
        return {
          success: false,
          error: 'CUSTOM_FIELD_TOOL_RETIRED',
          message: 'Los campos libres por nombre fueron retirados. Usa codex action=resolve_field; si no existe, create_field con field_key, field_type, field_label y field_reason; luego update_universe_item con fields keyed por field_key.'
        };

`;
  source = source.slice(0, casesStart) + rejected + source.slice(casesEnd);
  source = source.replace(
    '// CODEX WRITE TOOLS — codex_list_items, codex_update_item,\n      //   codex_add_custom_field, codex_set_custom_field, codex_bulk_update',
    '// CODEX WRITE TOOLS — codex_list_items, codex_update_item, codex_bulk_update'
  );
  fs.writeFileSync(path, source);
}

{
  const path = 'server/services/viztaAgenticPlanner.js';
  let source = fs.readFileSync(path, 'utf8');
  for (const name of ['codex_add_custom_field', 'codex_set_custom_field']) {
    const startToken = `  {\n    type: 'function',\n    function: {\n      name: '${name}',`;
    const start = source.indexOf(startToken);
    const end = source.indexOf("\n  {\n    type: 'function',", start + startToken.length);
    if (start < 0 || end < 0) throw new Error(`No se encontró tool legacy ${name} en planner`);
    source = source.slice(0, start) + source.slice(end);
  }
  fs.writeFileSync(path, source);
}
