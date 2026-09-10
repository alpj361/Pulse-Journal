const fs = require('fs');
const path = '/home/pj/ExtractorW/server/routes/codex.js';
const backup = '/home/pj/ExtractorW/.codex-backups/20260829_contract_taxonomy/codex.routes.before_phases_3_5.js';
let source = fs.readFileSync(path, 'utf8');

function replaceExact(label, before, after) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly one match, got ${count}`);
  source = source.replace(before, after);
}

replaceExact('contract imports', `const {
  CodexContractError,
  getMergedSchema,
  resolveField,
  createUserField,
  createUserPreset,
  prepareFieldPatch,
  applyPresetKeys,
  resolveItemFields,
} = require('../services/codexContractV4');
`, `const {
  CodexContractError,
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
} = require('../services/codexContractV4');
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
} = require('../services/codexResourceService');
`);

replaceExact('field routes', `router.post('/fields', verifyUserAccess, async (req, res) => {
  try {
    const field = await createUserField(supabase, req.user.id, req.body || {}, 'user');
    return res.status(201).json({ success: true, field });
  } catch (error) {
    return sendContractError(res, error);
  }
});
`, `router.post('/fields', verifyUserAccess, async (req, res) => {
  try {
    const field = await createUserField(supabase, req.user.id, req.body || {}, 'user');
    return res.status(201).json({ success: true, field });
  } catch (error) {
    return sendContractError(res, error);
  }
});

router.patch('/fields/:fieldKey', verifyUserAccess, async (req, res) => {
  try {
    const field = await updateUserField(supabase, req.user.id, req.params.fieldKey, req.body || {});
    return res.json({ success: true, field });
  } catch (error) {
    return sendContractError(res, error);
  }
});

router.delete('/fields/:fieldKey', verifyUserAccess, async (req, res) => {
  try {
    const field = await deactivateUserField(supabase, req.user.id, req.params.fieldKey);
    return res.json({ success: true, field, deactivated: true });
  } catch (error) {
    return sendContractError(res, error);
  }
});
`);

replaceExact('preset routes', `router.post('/presets', verifyUserAccess, async (req, res) => {
  try {
    const preset = await createUserPreset(supabase, req.user.id, req.body || {});
    return res.status(201).json({ success: true, preset });
  } catch (error) {
    return sendContractError(res, error);
  }
});
`, `router.post('/presets', verifyUserAccess, async (req, res) => {
  try {
    const preset = await createUserPreset(supabase, req.user.id, req.body || {});
    return res.status(201).json({ success: true, preset });
  } catch (error) {
    return sendContractError(res, error);
  }
});

router.patch('/presets/:presetKey', verifyUserAccess, async (req, res) => {
  try {
    const preset = await updateUserPreset(supabase, req.user.id, req.params.presetKey, req.body || {});
    return res.json({ success: true, preset });
  } catch (error) {
    return sendContractError(res, error);
  }
});

router.delete('/presets/:presetKey', verifyUserAccess, async (req, res) => {
  try {
    const preset = await deactivateUserPreset(supabase, req.user.id, req.params.presetKey);
    return res.json({ success: true, preset, deactivated: true });
  } catch (error) {
    return sendContractError(res, error);
  }
});
`);

replaceExact('resolved field response', `    const resolved = await resolveItemFields(supabase, req.user.id, item);
    return res.json({ success: true, item_id: item.id, preset_keys: item.preset_keys || [], fields: resolved.fields });
`, `    const resolved = await resolveItemFields(supabase, req.user.id, item);
    return res.json({
      success: true,
      item_id: item.id,
      preset_keys: item.preset_keys || [],
      fields: resolved.fields,
      new_preset_field_keys: resolved.newPresetFieldKeys,
      stale_preset_keys: resolved.stalePresetKeys,
    });
`);

replaceExact('preserve inactive preset snapshots', `    const presetResult = await applyPresetKeys(supabase, req.user.id, item.tipo, req.body?.preset_keys || item.preset_keys || []);
`, `    const presetResult = req.body?.preset_keys === undefined
      ? { presetKeys: item.preset_keys || [], fieldKeys: [] }
      : await applyPresetKeys(supabase, req.user.id, item.tipo, req.body.preset_keys);
`);

replaceExact('resource routes', `    const resolved = await resolveItemFields(supabase, req.user.id, updated);
    return res.json({ success: true, item: updated, resolved_fields: resolved.fields });
  } catch (error) {
    return sendContractError(res, error);
  }
});

function setupCodexRoutes(app) {
`, `    const resolved = await resolveItemFields(supabase, req.user.id, updated);
    return res.json({
      success: true,
      item: updated,
      resolved_fields: resolved.fields,
      new_preset_field_keys: resolved.newPresetFieldKeys,
      stale_preset_keys: resolved.stalePresetKeys,
    });
  } catch (error) {
    return sendContractError(res, error);
  }
});

// Source es un item oficial, pero usa un flujo visual y semántico propio.
router.get('/sources', verifyUserAccess, async (req, res) => {
  try {
    return res.json({ success: true, ...(await listSources(supabase, req.user.id, req.query || {})) });
  } catch (error) {
    return sendContractError(res, error);
  }
});

router.post('/sources', verifyUserAccess, async (req, res) => {
  try {
    return res.status(201).json({ success: true, source: await createSource(supabase, req.user.id, req.body || {}) });
  } catch (error) {
    return sendContractError(res, error);
  }
});

router.get('/sources/:id', verifyUserAccess, async (req, res) => {
  try {
    return res.json({ success: true, source: await getSource(supabase, req.user.id, req.params.id) });
  } catch (error) {
    return sendContractError(res, error);
  }
});

router.patch('/sources/:id', verifyUserAccess, async (req, res) => {
  try {
    return res.json({ success: true, source: await updateSource(supabase, req.user.id, req.params.id, req.body || {}) });
  } catch (error) {
    return sendContractError(res, error);
  }
});

router.post('/sources/:id/citations', verifyUserAccess, async (req, res) => {
  try {
    return res.status(201).json({ success: true, ...(await citeSource(supabase, req.user.id, req.params.id, req.body || {})) });
  } catch (error) {
    return sendContractError(res, error);
  }
});

// Perfil no es un tipo nuevo: es Actor + is_profile=true y preset especial.
router.get('/profiles', verifyUserAccess, async (req, res) => {
  try {
    return res.json({ success: true, ...(await listProfiles(supabase, req.user.id, req.query || {})) });
  } catch (error) {
    return sendContractError(res, error);
  }
});

router.post('/profiles', verifyUserAccess, async (req, res) => {
  try {
    return res.status(201).json({ success: true, profile: await createProfile(supabase, req.user.id, req.body || {}) });
  } catch (error) {
    return sendContractError(res, error);
  }
});

router.get('/profiles/:id', verifyUserAccess, async (req, res) => {
  try {
    return res.json({ success: true, profile: await getProfile(supabase, req.user.id, req.params.id) });
  } catch (error) {
    return sendContractError(res, error);
  }
});

router.patch('/profiles/:id', verifyUserAccess, async (req, res) => {
  try {
    return res.json({ success: true, profile: await updateProfile(supabase, req.user.id, req.params.id, req.body || {}) });
  } catch (error) {
    return sendContractError(res, error);
  }
});

function setupCodexRoutes(app) {
`);

fs.mkdirSync('/home/pj/ExtractorW/.codex-backups/20260829_contract_taxonomy', { recursive: true });
if (!fs.existsSync(backup)) fs.copyFileSync(path, backup);
fs.writeFileSync(path, source);
console.log('updated server/routes/codex.js with exact-match transformations');
