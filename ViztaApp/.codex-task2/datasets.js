'use strict';

const express = require('express');
const { verifyUserAccess } = require('../middlewares/auth');
const datasetCodex = require('../services/datasetCodexService');

const router = express.Router();

function asyncRoute(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      const status = Number(error.status) || 500;
      const payload = {
        success: false,
        code: error.code || 'DATASET_INTERNAL_ERROR',
        message: status >= 500 ? 'No se pudo completar la operación del conjunto de datos.' : error.message,
      };
      if (error.details && Object.keys(error.details).length) payload.details = error.details;
      if (process.env.NODE_ENV === 'development' && status >= 500) payload.debug = error.message;
      console.error(`[DATASETS] ${req.method} ${req.originalUrl}:`, error.code || error.name, error.message);
      res.status(status).json(payload);
    }
  };
}

function withDatasetId(req, extra = {}) {
  return { ...req.query, ...req.body, ...extra, dataset_id: req.params.datasetId };
}

// Lectura canónica paginada. Los conjuntos públicos pueden leerse; sus vínculos
// privados con Codex solo se incluyen para el propietario.
router.get('/:datasetId/rows', verifyUserAccess, asyncRoute(async (req, res) => {
  const result = await datasetCodex.listRows(withDatasetId(req), req.user.id);
  res.json(result);
}));

// Edición con revisión optimista. Si el conjunto está en modo sync, propaga
// únicamente las columnas que el usuario aprobó como bindings.
router.patch('/:datasetId/rows/:rowId', verifyUserAccess, asyncRoute(async (req, res) => {
  const result = await datasetCodex.updateRow(
    withDatasetId(req, { row_id: req.params.rowId, origin_kind: 'api' }),
    req.user.id
  );
  res.json(result);
}));

router.post('/:datasetId/rows/:rowId/sync', verifyUserAccess, asyncRoute(async (req, res) => {
  const result = await datasetCodex.syncRowToCodex(
    withDatasetId(req, { row_id: req.params.rowId, origin_kind: 'api' }),
    req.user.id
  );
  res.json(result);
}));

// Primer paso obligatorio: no escribe vínculos, campos ni ítems.
router.post('/:datasetId/codex/preview', verifyUserAccess, asyncRoute(async (req, res) => {
  const result = await datasetCodex.previewAlignment(
    withDatasetId(req, { origin_kind: 'api' }),
    req.user.id
  );
  res.json(result);
}));

// Segundo paso: requiere preview_token y decisiones explícitas por fila.
router.post('/:datasetId/codex/apply', verifyUserAccess, asyncRoute(async (req, res) => {
  const result = await datasetCodex.applyAlignment(
    withDatasetId(req, { origin_kind: 'api' }),
    req.user.id
  );
  res.json(result);
}));

router.post('/:datasetId/bindings', verifyUserAccess, asyncRoute(async (req, res) => {
  const result = await datasetCodex.bindColumn(withDatasetId(req), req.user.id);
  res.status(201).json(result);
}));

router.delete('/:datasetId/bindings/:bindingId', verifyUserAccess, asyncRoute(async (req, res) => {
  const result = await datasetCodex.unbindColumn(
    withDatasetId(req, { binding_id: req.params.bindingId }),
    req.user.id
  );
  res.json(result);
}));

router.delete('/:datasetId/rows/:rowId/codex-link', verifyUserAccess, asyncRoute(async (req, res) => {
  const result = await datasetCodex.detachRow(
    withDatasetId(req, { row_id: req.params.rowId }),
    req.user.id
  );
  res.json(result);
}));

router.get('/:datasetId/sync-status', verifyUserAccess, asyncRoute(async (req, res) => {
  const result = await datasetCodex.getSyncStatus(withDatasetId(req), req.user.id);
  res.json(result);
}));

router.get('/:datasetId/sync-events', verifyUserAccess, asyncRoute(async (req, res) => {
  const params = withDatasetId(req);
  if (typeof req.query.statuses === 'string') params.statuses = req.query.statuses.split(',').map((status) => status.trim()).filter(Boolean);
  const result = await datasetCodex.listSyncEvents(params, req.user.id);
  res.json(result);
}));

router.get('/:datasetId/conflicts', verifyUserAccess, asyncRoute(async (req, res) => {
  const result = await datasetCodex.listConflicts(withDatasetId(req), req.user.id);
  res.json(result);
}));

module.exports = router;
