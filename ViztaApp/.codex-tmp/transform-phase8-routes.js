const fs = require('fs');
const path = 'server/routes/codex.js';
let source = fs.readFileSync(path, 'utf8');
const importNeedle = "} = require('../services/codexResourceService');";
if (!source.includes(importNeedle)) throw new Error('No se encontró import de recursos Codex');
source = source.replace(importNeedle, `${importNeedle}\nconst { ejecutarSimulacion } = require('../services/simulacion');`);

const insertNeedle = '\nfunction setupCodexRoutes(app) {';
if (!source.includes(insertNeedle)) throw new Error('No se encontró setupCodexRoutes');
const routes = `

function sendSimulationResult(res, result, successStatus = 200) {
  if (result.success) return res.status(successStatus).json(result);
  const statusByCode = {
    UNAUTHENTICATED: 401,
    SIMULATION_NOT_FOUND: 404,
    INVALID_SOURCE_IDS: 409,
    INVALID_PARENT_SIMULATION: 409,
    SIMULATION_VERSION_CONFLICT: 409,
    TURN_TOKEN_MISMATCH: 409,
    SIMULATION_NOT_ACTIVE: 409,
  };
  return res.status(statusByCode[result.code] || 400).json(result);
}

// Simulación es un recurso persistente propio, no un universe item.
router.get('/simulations', verifyUserAccess, async (req, res) => {
  return sendSimulationResult(res, await ejecutarSimulacion({ operation: 'listar', ...req.query }, req.user));
});

router.post('/simulations', verifyUserAccess, async (req, res) => {
  return sendSimulationResult(res, await ejecutarSimulacion({ ...(req.body || {}), operation: 'crear' }, req.user), 201);
});

router.get('/simulations/:id', verifyUserAccess, async (req, res) => {
  return sendSimulationResult(res, await ejecutarSimulacion({ operation: 'obtener', sim_id: req.params.id }, req.user));
});

router.get('/simulations/:id/state', verifyUserAccess, async (req, res) => {
  return sendSimulationResult(res, await ejecutarSimulacion({ operation: 'estado', sim_id: req.params.id }, req.user));
});

router.get('/simulations/:id/report', verifyUserAccess, async (req, res) => {
  return sendSimulationResult(res, await ejecutarSimulacion({ operation: 'reporte', sim_id: req.params.id }, req.user));
});

router.post('/simulations/:id/actions', verifyUserAccess, async (req, res) => {
  return sendSimulationResult(res, await ejecutarSimulacion({ ...(req.body || {}), operation: 'actuar', sim_id: req.params.id }, req.user));
});

router.patch('/simulations/:id', verifyUserAccess, async (req, res) => {
  const operation = req.body?.analysis !== undefined || req.body?.analisis !== undefined
    ? 'guardar_analisis'
    : req.body?.status === 'archived' ? 'archivar'
      : req.body?.status === 'cancelled' ? 'cancelar' : null;
  if (!operation) return res.status(400).json({ success: false, code: 'INVALID_SIMULATION_PATCH', error: 'Usa analysis/analisis o status=archived|cancelled.' });
  return sendSimulationResult(res, await ejecutarSimulacion({
    operation,
    sim_id: req.params.id,
    analisis: req.body?.analisis ?? req.body?.analysis,
  }, req.user));
});
`;
source = source.replace(insertNeedle, routes + insertNeedle);
fs.writeFileSync(path, source);
