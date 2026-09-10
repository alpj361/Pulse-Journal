const supabase = require('./server/utils/supabase');
const contract = require('./server/services/codexContractV4');
const resources = require('./server/services/codexResourceService');

(async () => {
  const cleanup = { itemIds: [], relationIds: [], fieldKey: null, presetKey: null, userId: null };
  try {
    const { data: owners, error: ownerError } = await supabase.from('profiles').select('id').limit(1);
    if (ownerError || !owners?.[0]?.id) throw new Error(`test owner unavailable: ${ownerError?.message || 'none'}`);
    const userId = owners[0].id;
    cleanup.userId = userId;

    const field = await contract.createUserField(supabase, userId, {
      field_key: 'usr_v41_contract_test',
      label: 'Prueba contrato v41 zeta',
      field_type: 'texto',
      reason: 'Validación automatizada temporal del contrato v4.1',
      item_types: ['Actor'],
    }, 'migration');
    cleanup.fieldKey = field.field_key;
    const renamed = await contract.updateUserField(supabase, userId, field.field_key, {
      label: 'Prueba contrato v41 renombrada',
    });

    const preset = await contract.createUserPreset(supabase, userId, {
      preset_key: 'usr_preset_v41_contract_test',
      label: 'Preset temporal v41',
      item_types: ['Actor'],
      field_keys: [field.field_key],
    });
    cleanup.presetKey = preset.preset_key;
    const updatedPreset = await contract.updateUserPreset(supabase, userId, preset.preset_key, {
      description: 'Preset temporal actualizado',
    });

    let rejectedSource = false;
    try {
      await resources.createSource(supabase, userId, {
        name: '__v41_invalid_source__',
        fields: { sys_source_kind: 'Web' },
      });
    } catch (error) {
      rejectedSource = error.code === 'SOURCE_URL_REQUIRED';
    }
    if (!rejectedSource) throw new Error('invalid Web Source was not rejected');

    const source = await resources.createSource(supabase, userId, {
      name: '__v41_source_test__',
      description: 'Source temporal de integración',
      fields: {
        sys_source_kind: 'Web',
        sys_source_url: 'https://example.com/v41-test',
        sys_source_accessed_at: '2026-08-29',
      },
    });
    cleanup.itemIds.push(source.id);

    const profile = await resources.createProfile(supabase, userId, {
      name: '__v41_profile_test__',
      target: 'Jóvenes que frecuentan Zona 1',
      goal: 'Entender percepción de seguridad',
      known: 'Llegan por actividades culturales',
      fields: { sys_actor_profile_age_min: 18, sys_actor_profile_age_max: 30 },
    });
    cleanup.itemIds.push(profile.id);

    const citation = await resources.citeSource(supabase, userId, source.id, {
      subject_id: profile.id,
      note: 'Cita temporal de integración',
      date: '2026-08-29',
    });
    cleanup.relationIds.push(citation.relation.id);

    const sourceRead = await resources.getSource(supabase, userId, source.id);
    const profileRead = await resources.getProfile(supabase, userId, profile.id);
    if (!sourceRead.preset_keys.includes('sys_base_source')) throw new Error('Source preset missing');
    if (!profileRead.preset_keys.includes('sys_profile_actor')) throw new Error('Profile preset missing');
    if (profileRead.tipo !== 'Actor' || profileRead.is_profile !== true) throw new Error('Profile identity invalid');

    await contract.deactivateUserPreset(supabase, userId, preset.preset_key);
    await contract.deactivateUserField(supabase, userId, field.field_key);

    console.log(JSON.stringify({
      ok: true,
      field: { key: renamed.field_key, label: renamed.label },
      preset: { key: updatedPreset.preset_key },
      source: { type: sourceRead.tipo, preset: sourceRead.preset_keys[0] },
      profile: { type: profileRead.tipo, is_profile: profileRead.is_profile, preset: profileRead.preset_keys[0] },
      citationVerb: citation.relation.verb,
      invalidSourceRejected: rejectedSource,
    }));
  } finally {
    if (cleanup.userId) {
      if (cleanup.relationIds.length) await supabase.from('codex_relations').delete().eq('user_id', cleanup.userId).in('id', cleanup.relationIds);
      if (cleanup.itemIds.length) await supabase.from('codex_universe_items').delete().eq('user_id', cleanup.userId).in('id', cleanup.itemIds);
      if (cleanup.presetKey) await supabase.from('codex_user_presets').delete().eq('user_id', cleanup.userId).eq('preset_key', cleanup.presetKey);
      if (cleanup.fieldKey) await supabase.from('codex_user_fields').delete().eq('user_id', cleanup.userId).eq('field_key', cleanup.fieldKey);
    }
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
