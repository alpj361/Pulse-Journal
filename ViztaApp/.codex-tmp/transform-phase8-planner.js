const fs = require('fs');
const path = 'server/services/viztaAgenticPlanner.js';
let source = fs.readFileSync(path, 'utf8');
const startToken = "  {\n    type: 'function',\n    function: {\n      name: 'codex',";
const start = source.lastIndexOf(startToken, source.indexOf('const PLANNER_SYSTEM_PROMPT'));
const end = source.indexOf('\n];', start);
if (start < 0 || end < 0) throw new Error('No se encontró codex del planner');
const replacement = `  {
    type: 'function',
    function: {
      name: 'codex',
      description: 'Contrato Codex v4.1: items oficiales, auxiliares, campos/presets, Sources y Perfiles',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['search_universe','get_universe_item','get_relations','get_schema','resolve_field','create_field','update_field','deactivate_field','create_preset','update_preset','deactivate_preset','search_sources','get_source','create_source','update_source','cite_source','search_profiles','get_profile','create_profile','update_profile','create_universe_item','update_universe_item','add_relation','delete_relation']
          },
          query: { type: 'string' },
          item_id: { type: 'string' },
          tipo: { type: 'string', enum: ['Actor','Entidad','Territorio','Evento','Historia','Objeto','Artefacto','Source','Post','Snippet'] },
          name: { type: 'string' },
          description: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
          fields: { type: 'object' },
          field_key: { type: 'string' },
          field_label: { type: 'string' },
          field_type: { type: 'string' },
          field_reason: { type: 'string' },
          field_keys: { type: 'array', items: { type: 'string' } },
          preset_key: { type: 'string' },
          preset_keys: { type: 'array', items: { type: 'string' } },
          item_types: { type: 'array', items: { type: 'string' } },
          config: { type: 'object' },
          target: { type: 'string' },
          goal: { type: 'string' },
          known: { type: 'string' },
          subject_id: { type: 'string' },
          object_id: { type: 'string' },
          verb: { type: 'string' },
          note: { type: 'string' },
          relation_id: { type: 'string' }
        },
        required: ['action']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'simular',
      description: 'Planifica una simulación persistente y reproducible con Actores, Perfiles, Sources o participantes sintéticos',
      parameters: {
        type: 'object',
        properties: {
          operation: { type: 'string', enum: ['crear','actuar','reporte','estado','listar','obtener','guardar_analisis','archivar','cancelar'] },
          titulo: { type: 'string' },
          escenario: { type: 'string' },
          personas: { type: 'array', items: { type: 'object' } },
          turnos: { type: 'integer' },
          batch: { type: 'integer' },
          seed: { type: 'string' },
          source_ids: { type: 'array', items: { type: 'string' } },
          context_item_ids: { type: 'array', items: { type: 'string' } },
          parent_simulation_id: { type: 'string' },
          sim_id: { type: 'string' },
          turn_token: { type: 'string' },
          acciones: { type: 'array', items: { type: 'object' } },
          analisis: { type: 'string' }
        },
        required: ['operation']
      }
    }
  }`;
source = source.slice(0, start) + replacement + source.slice(end);
source = source.replace(
  '- Tipos válidos del Universo: Actor, Entidad, Territorio, Evento, Historia, Objeto, Artefacto, Post, Snippet\n- Cuándo usar cada tipo: Actor (persona/organización), Entidad (institución/empresa), Territorio (lugar/región), Evento (suceso/hecho puntual), Historia (narrativa/análisis/crónica larga), Objeto (cosa física/documento), Artefacto (creación digital/multimedia), Post (contenido de redes sociales), Snippet (fragmento corto de texto)',
  '- Items oficiales: Actor, Entidad, Territorio, Evento, Historia, Objeto, Artefacto y Source.\n- Post y Snippet son contenido auxiliar persistido: conservan tipo, pero no son items oficiales.\n- Source es un item oficial con flujo propio. Perfil es Actor con is_profile=true, no un tipo nuevo.\n- Cuándo usar cada item: Actor (persona real/organización), Entidad (institución/empresa), Territorio (lugar/región), Evento (suceso puntual), Historia (narrativa/análisis largo), Objeto (cosa física/documento), Artefacto (creación digital/multimedia), Source (fuente citable).'
);
source = source.replace(
  '- codex(action) para el Universo Investigativo (actores, entidades, relaciones)',
  '- codex(action) para items oficiales, auxiliares, campos/presets, Sources, Perfiles y relaciones\n- simular(operation) para crear/continuar/consultar simulaciones persistentes; actuar debe reenviar turn_token'
);
fs.writeFileSync(path, source);
