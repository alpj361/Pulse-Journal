const fs = require('fs');
const path = '/home/pj/ExtractorW/server/services/mcp.js';
const backup = '/home/pj/ExtractorW/.codex-backups/20260829_contract_taxonomy/mcp.before_phases_3_5.js';
let source = fs.readFileSync(path, 'utf8');

function replaceExact(label, before, after) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly one match, got ${count}`);
  source = source.replace(before, after);
}

replaceExact('contract imports', `const {
  getMergedSchema,
  resolveField,
  createUserField,
  createUserPreset,
  prepareFieldPatch,
  applyPresetKeys,
  resolveItemFields,
} = require('./codexContractV4');
`, `const {
  getMergedSchema,
  resolveField,
  createUserField,
  updateUserField,
  deactivateUserField,
  createUserPreset,
  updateUserPreset,
  deactivateUserPreset,
  prepareFieldPatch,
  applyPresetKeys,
  resolveItemFields,
} = require('./codexContractV4');
const {
  listSources,
  getSource,
  createSource,
  updateSource,
  citeSource,
  listProfiles,
  getProfile,
  createProfile,
  updateProfile,
} = require('./codexResourceService');
`);

replaceExact('tool description', `    description: 'Accede al Codex del usuario: documentos, transcripciones, y el Universo investigativo (actores, entidades, territorios, eventos, historias, objetos, artefactos, posts y snippets) con sus relaciones y detalles. Úsalo para leer, crear o modificar items del universo y sus conexiones.',
`, `    description: 'Accede al Codex del usuario: ocho items oficiales (Actor, Entidad, Territorio, Evento, Historia, Objeto, Artefacto y Source), contenido auxiliar (Post y Snippet), campos/presets personales, citas y Perfiles (Actor con is_profile=true).',
`);

replaceExact('action enum', `          'get_schema', 'resolve_field', 'create_field', 'create_preset',
          'create_universe_item', 'update_universe_item',
`, `          'get_schema', 'resolve_field',
          'create_field', 'update_field', 'deactivate_field',
          'create_preset', 'update_preset', 'deactivate_preset',
          'search_sources', 'get_source', 'create_source', 'update_source', 'cite_source',
          'search_profiles', 'get_profile', 'create_profile', 'update_profile',
          'create_universe_item', 'update_universe_item',
`);

replaceExact('resource parameters', `      field_keys: { type: 'array', required: false, items: { type: 'string' }, description: 'Campos incluidos al crear un preset.' },
`, `      field_keys: { type: 'array', required: false, items: { type: 'string' }, description: 'Campos incluidos al crear o actualizar un preset.' },
      target: { type: 'string', required: false, description: 'Para Perfil: tipo de persona o grupo que representa.' },
      goal: { type: 'string', required: false, description: 'Para Perfil: qué se quiere entender.' },
      known: { type: 'string', required: false, description: 'Para Perfil: evidencia o conocimiento disponible.' },
      offset: { type: 'integer', required: false, description: 'Offset de paginación para search_sources/search_profiles.' },
`);

replaceExact('field and resource actions', `          case 'create_preset': {
            const supabase = require('../utils/supabase');
            if (!user?.id) return { success: false, error: 'Usuario no autenticado' };
            const preset = await createUserPreset(supabase, user.id, {
              preset_key: parameters.preset_key,
              label: parameters.name,
              description: parameters.description,
              item_types: parameters.item_types || (parameters.tipo ? [parameters.tipo] : []),
              field_keys: parameters.field_keys,
            });
            return { success: true, action, preset, formatted_response: \`✓ Preset creado: \${preset.label} (\${preset.preset_key})\` };
          }

          case 'search': {
`, `          case 'create_preset': {
            const supabase = require('../utils/supabase');
            if (!user?.id) return { success: false, error: 'Usuario no autenticado' };
            const preset = await createUserPreset(supabase, user.id, {
              preset_key: parameters.preset_key,
              label: parameters.name,
              description: parameters.description,
              item_types: parameters.item_types || (parameters.tipo ? [parameters.tipo] : []),
              field_keys: parameters.field_keys,
            });
            return { success: true, action, preset, formatted_response: \`✓ Preset creado: \${preset.label} (\${preset.preset_key})\` };
          }

          case 'update_field': {
            const supabase = require('../utils/supabase');
            if (!user?.id) return { success: false, error: 'Usuario no autenticado' };
            if (!parameters.field_key) return { success: false, error: 'field_key es requerido' };
            const field = await updateUserField(supabase, user.id, parameters.field_key, {
              label: parameters.field_label || parameters.name,
              field_type: parameters.field_type,
              reason: parameters.field_reason,
              item_types: parameters.item_types,
              config: parameters.config,
            });
            return { success: true, action, field, formatted_response: \`✓ Campo actualizado: \${field.label} (\${field.field_key})\` };
          }

          case 'deactivate_field': {
            const supabase = require('../utils/supabase');
            if (!user?.id) return { success: false, error: 'Usuario no autenticado' };
            if (!parameters.field_key) return { success: false, error: 'field_key es requerido' };
            const field = await deactivateUserField(supabase, user.id, parameters.field_key);
            return { success: true, action, field, formatted_response: \`✓ Campo desactivado sin borrar valores históricos: \${field.field_key}\` };
          }

          case 'update_preset': {
            const supabase = require('../utils/supabase');
            if (!user?.id) return { success: false, error: 'Usuario no autenticado' };
            if (!parameters.preset_key) return { success: false, error: 'preset_key es requerido' };
            const preset = await updateUserPreset(supabase, user.id, parameters.preset_key, {
              label: parameters.name,
              description: parameters.description,
              item_types: parameters.item_types,
              field_keys: parameters.field_keys,
            });
            return { success: true, action, preset, formatted_response: \`✓ Preset actualizado: \${preset.label} (\${preset.preset_key})\` };
          }

          case 'deactivate_preset': {
            const supabase = require('../utils/supabase');
            if (!user?.id) return { success: false, error: 'Usuario no autenticado' };
            if (!parameters.preset_key) return { success: false, error: 'preset_key es requerido' };
            const preset = await deactivateUserPreset(supabase, user.id, parameters.preset_key);
            return { success: true, action, preset, formatted_response: \`✓ Preset desactivado; los items conservan su snapshot: \${preset.preset_key}\` };
          }

          case 'search_sources': {
            const supabase = require('../utils/supabase');
            if (!user?.id) return { success: false, error: 'Usuario no autenticado' };
            const result = await listSources(supabase, user.id, parameters);
            return { success: true, action, ...result, formatted_response: \`✓ \${result.count} Sources encontradas\` };
          }

          case 'get_source': {
            const supabase = require('../utils/supabase');
            if (!user?.id) return { success: false, error: 'Usuario no autenticado' };
            if (!parameters.item_id) return { success: false, error: 'item_id es requerido' };
            return { success: true, action, source: await getSource(supabase, user.id, parameters.item_id) };
          }

          case 'create_source': {
            const supabase = require('../utils/supabase');
            if (!user?.id) return { success: false, error: 'Usuario no autenticado' };
            const item = await createSource(supabase, user.id, parameters);
            return { success: true, action, item, formatted_response: \`✓ Source creada: \${item.name} (\${item.id})\` };
          }

          case 'update_source': {
            const supabase = require('../utils/supabase');
            if (!user?.id) return { success: false, error: 'Usuario no autenticado' };
            if (!parameters.item_id) return { success: false, error: 'item_id es requerido' };
            const item = await updateSource(supabase, user.id, parameters.item_id, parameters);
            return { success: true, action, item, formatted_response: \`✓ Source actualizada: \${item.name}\` };
          }

          case 'cite_source': {
            const supabase = require('../utils/supabase');
            if (!user?.id) return { success: false, error: 'Usuario no autenticado' };
            if (!parameters.item_id) return { success: false, error: 'item_id debe ser el UUID de Source' };
            const citation = await citeSource(supabase, user.id, parameters.item_id, parameters);
            return { success: true, action, ...citation, formatted_response: \`✓ \${citation.subject.name} cita \${citation.source.name}\` };
          }

          case 'search_profiles': {
            const supabase = require('../utils/supabase');
            if (!user?.id) return { success: false, error: 'Usuario no autenticado' };
            const result = await listProfiles(supabase, user.id, parameters);
            return { success: true, action, ...result, formatted_response: \`✓ \${result.count} Perfiles encontrados\` };
          }

          case 'get_profile': {
            const supabase = require('../utils/supabase');
            if (!user?.id) return { success: false, error: 'Usuario no autenticado' };
            if (!parameters.item_id) return { success: false, error: 'item_id es requerido' };
            return { success: true, action, profile: await getProfile(supabase, user.id, parameters.item_id) };
          }

          case 'create_profile': {
            const supabase = require('../utils/supabase');
            if (!user?.id) return { success: false, error: 'Usuario no autenticado' };
            const item = await createProfile(supabase, user.id, parameters);
            return { success: true, action, item, formatted_response: \`✓ Perfil creado como Actor: \${item.name} (\${item.id})\` };
          }

          case 'update_profile': {
            const supabase = require('../utils/supabase');
            if (!user?.id) return { success: false, error: 'Usuario no autenticado' };
            if (!parameters.item_id) return { success: false, error: 'item_id es requerido' };
            const item = await updateProfile(supabase, user.id, parameters.item_id, parameters);
            return { success: true, action, item, formatted_response: \`✓ Perfil actualizado: \${item.name}\` };
          }

          case 'search': {
`);

replaceExact('generic source create guard', `            if (parameters.details && Object.keys(parameters.details).length) {
              return { success: false, error: 'details es legacy. Usa fields keyed por field_key; ejecuta resolve_field antes de escribir.' };
            }
            const prepared = await prepareFieldPatch(supabase, user.id, tipoCanon, parameters.fields || {});
`, `            if (parameters.details && Object.keys(parameters.details).length) {
              return { success: false, error: 'details es legacy. Usa fields keyed por field_key; ejecuta resolve_field antes de escribir.' };
            }
            if (tipoCanon === 'Source') {
              const item = await createSource(supabase, user.id, parameters);
              return { success: true, action: 'create_universe_item', item, formatted_response: \`✓ Source creada: \${item.name} (\${item.id})\` };
            }
            const prepared = await prepareFieldPatch(supabase, user.id, tipoCanon, parameters.fields || {});
`);

replaceExact('structured update select', `              .select('id, name, tipo, details, field_keys, preset_keys')
`, `              .select('id, name, tipo, is_profile, details, field_keys, preset_keys')
`);

replaceExact('structured update guard', `            if (!existing) return { success: false, error: 'Item no encontrado o no tienes acceso' };

            // geo se valida después de conocer el tipo real del item. null sigue
`, `            if (!existing) return { success: false, error: 'Item no encontrado o no tienes acceso' };

            if (existing.tipo === 'Source') {
              const item = await updateSource(supabase, user.id, existing.id, { ...parameters, description: descValue });
              return { success: true, action: 'update_universe_item', item, formatted_response: \`✓ Source actualizada: \${item.name}\` };
            }
            if (existing.tipo === 'Actor' && existing.is_profile === true) {
              const item = await updateProfile(supabase, user.id, existing.id, { ...parameters, description: descValue });
              return { success: true, action: 'update_universe_item', item, formatted_response: \`✓ Perfil actualizado: \${item.name}\` };
            }

            // geo se valida después de conocer el tipo real del item. null sigue
`);

replaceExact('preserve inactive presets in generic update', `              const presetResult = await applyPresetKeys(
                supabase,
                user.id,
                existing.tipo,
                parameters.preset_keys || existing.preset_keys || []
              );
`, `              const presetResult = parameters.preset_keys === undefined
                ? { presetKeys: existing.preset_keys || [], fieldKeys: [] }
                : await applyPresetKeys(supabase, user.id, existing.tipo, parameters.preset_keys);
`);

fs.mkdirSync('/home/pj/ExtractorW/.codex-backups/20260829_contract_taxonomy', { recursive: true });
if (!fs.existsSync(backup)) fs.copyFileSync(path, backup);
fs.writeFileSync(path, source);
console.log('updated server/services/mcp.js with exact-match transformations');
