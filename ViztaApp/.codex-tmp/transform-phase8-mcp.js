const fs = require('fs');
const path = 'server/services/mcp.js';
const source = fs.readFileSync(path, 'utf8');
const startToken = "  simular: {\n    name: 'simular',";
const endToken = '\n\n  // ===================================================================\n  // TOOL: MAPA';
const start = source.indexOf(startToken);
const end = source.indexOf(endToken, start);
if (start < 0 || end < 0) throw new Error('No se encontró el bloque MCP simular');
const block = `  simular: {
    name: 'simular',
    description: 'Simulación multiagente persistente y reproducible. Puede usar Actores, Perfiles (Actor con is_profile=true), Sources y personas sintéticas. El servidor congela snapshots, genera una cola determinista por seed y avanza cada lote de forma atómica e idempotente. En cada respuesta interpreta SOLO las personas de turno; usa el turn_token devuelto al llamar actuar. Al completar, pide reporte y guarda el análisis.',
    parameters: {
      operation: {
        type: 'string', required: true,
        enum: ['crear', 'actuar', 'reporte', 'estado', 'listar', 'obtener', 'guardar_analisis', 'archivar', 'cancelar'],
        description: 'crear/actuar/reporte/estado operan el motor. listar/obtener consultan ejecuciones persistidas. guardar_analisis conserva la interpretación final. archivar/cancelar cambian su estado.'
      },
      titulo: { type: 'string', required: false, description: 'Título legible. Si se omite, se deriva del escenario.' },
      escenario: { type: 'string', required: false, description: 'Hecho o situación concreta a la que reaccionan las personas. Requerido para crear.' },
      personas: {
        type: 'array', required: false,
        description: 'Participantes Codex y/o sintéticos. Ej: [{"fuente":"codex","ids":["uuid"]},{"fuente":"sintetica","n":30,"perfil":"votantes urbanos","etiqueta":"Votante"}]. Los Actores con is_profile=true se leen como Perfiles.',
        items: { type: 'object' }
      },
      turnos: { type: 'integer', required: false, default: 20, min: 1, max: 200, description: 'Turnos totales. Default 20.' },
      batch: { type: 'integer', required: false, default: 1, min: 1, max: 10, description: 'Personas por llamada. Default 1.' },
      seed: { type: 'string', required: false, description: 'Semilla reproducible. Con los mismos snapshots, config y seed se obtiene la misma cola.' },
      source_ids: { type: 'array', required: false, items: { type: 'string' }, description: 'Sources oficiales que fundamentan la simulación. También se adjuntan las Sources vinculadas a Perfiles participantes.' },
      context_item_ids: { type: 'array', required: false, items: { type: 'string' }, description: 'Items adicionales del Codex usados como contexto trazable.' },
      parent_simulation_id: { type: 'string', required: false, description: 'UUID de una simulación propia anterior para variantes o nuevas corridas.' },
      sim_id: { type: 'string', required: false, description: 'UUID requerido para actuar/reporte/estado/obtener/guardar_analisis/archivar/cancelar.' },
      turn_token: { type: 'string', required: false, description: 'Token del lote pendiente. En actuar permite avance idempotente y evita duplicar eventos.' },
      acciones: {
        type: 'array', required: false,
        description: 'Exactamente una acción por persona del lote: [{"persona_id":"p3","tipo":"publicar","texto":"..."}]. tipo: publicar | responder | amplificar | callar | otra. Para responder/amplificar, "a" usa el id lógico evt_N.',
        items: { type: 'object' }
      },
      analisis: { type: 'string', required: false, description: 'Interpretación final para guardar_analisis; separa evidencia simulada e inferencia.' },
      status: { type: 'string', required: false, enum: ['active', 'completed', 'failed', 'cancelled', 'archived'], description: 'Filtro para listar.' },
      limit: { type: 'integer', required: false, default: 50, min: 1, max: 100, description: 'Límite para listar.' }
    },
    service_endpoint: 'internal',
    service_url: 'internal',
    category: 'user_data',
    usage_credits: 1,
    features: [
      'Personas del Codex, sintéticas, o mezcla',
      'Perfiles y Sources con snapshots inmutables por ejecución',
      'Red por relaciones reales del Codex; si no hay, por afinidad',
      'Cola reproducible por seed y avance atómico con turn_token',
      'Persistencia consultable para la futura página de Simulaciones',
      'Métricas estructuradas de propagación y silencios'
    ]
  },`;
fs.writeFileSync(path, source.slice(0, start) + block + source.slice(end));
