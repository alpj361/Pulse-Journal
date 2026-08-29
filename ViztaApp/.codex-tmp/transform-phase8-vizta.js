const fs = require('fs');
const path = 'server/services/agents/vizta/index.js';
let source = fs.readFileSync(path, 'utf8');

function replaceTool(name, nextName, replacement) {
  const startToken = `  {\n    type: 'function',\n    function: {\n      name: '${name}',`;
  const endToken = `\n  {\n    type: 'function',\n    function: {\n      name: '${nextName}',`;
  const start = source.indexOf(startToken);
  const end = source.indexOf(endToken, start);
  if (start < 0 || end < 0) throw new Error(`No se encontró ${name} → ${nextName}`);
  source = source.slice(0, start) + replacement + source.slice(end);
}

const codex = `  {
    type: 'function',
    function: {
      name: 'codex',
      description: 'Contrato Codex v4.1. Items oficiales: Actor, Entidad, Territorio, Evento, Historia, Objeto, Artefacto y Source. Post y Snippet son contenido auxiliar persistido, no items oficiales. Source es un item oficial con semántica y modal propios. Perfil no es un tipo: es Actor con is_profile=true. Los campos usan field_key estable y los presets son guías combinables por usuario. Para escribir campos, primero resuelve el catálogo; si falta un campo, créalo declarando key, tipo, label y motivo. El backend rechaza valores con shape inválido.',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: [
              'search', 'get_items',
              'search_universe', 'get_universe_item', 'get_relations',
              'filter_universe', 'list_by_dataset', 'lookup_by_names', 'reconcile_dataset',
              'get_schema', 'resolve_field',
              'create_field', 'update_field', 'deactivate_field',
              'create_preset', 'update_preset', 'deactivate_preset',
              'search_sources', 'get_source', 'create_source', 'update_source', 'cite_source',
              'search_profiles', 'get_profile', 'create_profile', 'update_profile',
              'create_universe_item', 'update_universe_item',
              'add_relation', 'delete_relation', 'create_note',
              'add_progresion', 'get_progresiones', 'delete_progresion'
            ],
            description: 'Usa get_schema/resolve_field antes de escribir campos. Source: search/get/create/update/cite_source. Perfil: search/get/create/update_profile. Para texto auxiliar libre usa create_note (Snippet).'
          },
          query: { type: 'string', description: 'Búsqueda para search/search_universe/search_sources/search_profiles.' },
          item_ids: { type: 'array', items: { type: 'string' }, description: 'UUIDs para get_items.' },
          item_id: { type: 'string', description: 'UUID del item para lecturas/actualizaciones/citas.' },
          universe_item_id: { type: 'string', description: 'Alias legacy de item_id; prefiere item_id.' },
          relation_id: { type: 'string', description: 'UUID de relación para delete_relation.' },
          tipo: { type: 'string', enum: ['Actor','Entidad','Territorio','Evento','Historia','Objeto','Artefacto','Source','Post','Snippet'], description: 'Tipo persistido. Post/Snippet son auxiliares.' },
          item_type: { type: 'string', description: 'Alias de tipo para búsquedas legacy; prefiere tipo.' },
          name: { type: 'string', description: 'Nombre del item, campo o preset según la acción.' },
          description: { type: 'string', description: 'Descripción.' },
          content: { type: 'string', description: 'Contenido para create_note.' },
          tags: { type: 'array', items: { type: 'string' }, description: 'Etiquetas.' },
          aliases: { type: 'array', items: { type: 'string' }, description: 'Nombres alternativos.' },
          fields: { type: 'object', additionalProperties: true, description: 'Valores keyed exclusivamente por field_key.' },
          field_key: { type: 'string', description: 'Identidad estable del campo.' },
          field_label: { type: 'string', description: 'Label visible; puede cambiar sin mover datos.' },
          field_type: { type: 'string', enum: ['texto','parrafo','numero','moneda','porcentaje','fecha','rango','hora','booleano','dropdown','tags','escala','ref','refs','id','link','email','telefono','archivo','imagen','geo','color','formula','eje','repetible'], description: 'Tipo normativo e inmutable una vez creado.' },
          field_reason: { type: 'string', description: 'Motivo obligatorio al crear un campo desde el agente.' },
          item_types: { type: 'array', items: { type: 'string' }, description: 'Tipos donde aplica el campo o preset.' },
          config: { type: 'object', additionalProperties: true, description: 'Configuración tipada: options, poles o cols.' },
          field_keys: { type: 'array', items: { type: 'string' }, description: 'Campos de un preset.' },
          preset_key: { type: 'string', description: 'Clave estable del preset.' },
          preset_keys: { type: 'array', items: { type: 'string' }, description: 'Presets aplicados; un item puede tener varios.' },
          target: { type: 'string', description: 'Perfil: a quién representa.' },
          goal: { type: 'string', description: 'Perfil: qué se quiere entender.' },
          known: { type: 'string', description: 'Perfil: evidencia/conocimiento disponible.' },
          geo: { type: 'object', additionalProperties: true, description: 'Contrato geo v2. Solo frontier admite jerarquía 1..6 y postal_codes.' },
          subject_id: { type: 'string', description: 'Sujeto de relación o item que cita una Source.' },
          object_id: { type: 'string', description: 'Objeto de la relación.' },
          verb: { type: 'string', description: 'Verbo de relación.' },
          note: { type: 'string', description: 'Nota de relación/cita.' },
          date: { type: 'string', description: 'Fecha YYYY-MM-DD.' },
          dataset_id: { type: 'string', description: 'Dataset para filtros/reconciliación.' },
          names: { type: 'array', items: { type: 'string' }, description: 'Nombres para lookup_by_names.' },
          filter_details: { type: 'object', additionalProperties: true, description: 'Filtros de campos para filter_universe.' },
          page: { type: 'integer', description: 'Página base 1.' },
          limit: { type: 'integer', description: 'Límite de resultados.' },
          offset: { type: 'integer', description: 'Offset para Sources/Perfiles.' },
          progresion: { type: 'object', description: 'Entrada de timeline: {titulo, fecha?, descripcion?, tipo?, ref_id?, fuente?}.' },
          progresion_id: { type: 'string', description: 'UUID para delete_progresion.' },
          details: { type: 'object', description: 'LEGACY. No enviar: usa fields keyed por field_key.' }
        },
        required: ['action']
      }
    }
  },`;

const simular = `  {
    type: 'function',
    function: {
      name: 'simular',
      description: 'Simulación multiagente persistente y reproducible. Puede usar Actores, Perfiles, Sources y participantes sintéticos. crear devuelve sim_id, turn_token y el lote actual. Actúa exactamente una vez por persona del lote y reenvía turn_token. Continúa hasta completar; luego pide reporte y guarda el análisis. Los snapshots preservan el contexto aun si el Codex cambia después.',
      parameters: {
        type: 'object',
        properties: {
          operation: { type: 'string', enum: ['crear','actuar','reporte','estado','listar','obtener','guardar_analisis','archivar','cancelar'], description: 'Operación del recurso persistente.' },
          titulo: { type: 'string', description: 'Título legible.' },
          escenario: { type: 'string', description: 'Hecho concreto con contexto. Requerido para crear.' },
          personas: { type: 'array', items: { type: 'object' }, description: 'Ej: [{"fuente":"codex","ids":["uuid"]},{"fuente":"sintetica","n":30,"perfil":"votantes","etiqueta":"Votante"}].' },
          turnos: { type: 'integer', description: 'Turnos totales; default 20.' },
          batch: { type: 'integer', description: 'Personas por lote; default 1.' },
          seed: { type: 'string', description: 'Semilla reproducible opcional.' },
          source_ids: { type: 'array', items: { type: 'string' }, description: 'Sources que fundamentan la corrida.' },
          context_item_ids: { type: 'array', items: { type: 'string' }, description: 'Otros items de contexto trazable.' },
          parent_simulation_id: { type: 'string', description: 'Simulación propia anterior para variantes.' },
          sim_id: { type: 'string', description: 'UUID de la simulación.' },
          turn_token: { type: 'string', description: 'Token del lote pendiente para actuar idempotentemente.' },
          acciones: { type: 'array', items: { type: 'object' }, description: 'Exactamente una por persona: {persona_id,tipo,texto?,a?,descripcion?,publico?}. tipo: publicar|responder|amplificar|callar|otra.' },
          analisis: { type: 'string', description: 'Interpretación final para guardar_analisis.' },
          status: { type: 'string', enum: ['active','completed','failed','cancelled','archived'], description: 'Filtro para listar.' },
          limit: { type: 'integer', description: 'Límite para listar.' }
        },
        required: ['operation']
      }
    }
  },`;

replaceTool('codex', 'simular', codex);
replaceTool('simular', 'data_ops', simular);
fs.writeFileSync(path, source);
