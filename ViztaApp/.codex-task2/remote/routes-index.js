const trendsRoutes = require('./trends');
const newsAnalysisRoutes = require('./newsAnalysis');
const narrativaDiariaRoutes = require('./narrativaDiaria');
const adminRoutes = require('./admin');
const sondeosRoutes = require('./sondeos');
const projectSuggestionsRoutes = require('./project-suggestions');
const transcriptionRoutes = require('./transcription');
const documentAnalysisRoutes = require('./documentAnalysis');
const mcpRoutes = require('./mcp');
const mcpProtocolRoutes = require('./mcpProtocol'); // servidor MCP real (protocolo estándar) para clientes externos
const { setupMcpOAuth } = require('./mcpOAuth'); // OAuth 2.1 AS para clientes MCP (Claude/ChatGPT sign-in)
const viztaChatRoutes = require('./viztaChat'); // Using optimized version with parallel execution & streaming (includes debug mode for ViztaExplorer)
const viztaFeedbackRoutes = require('./viztaFeedback');
const hybridCoveragesRoutes = require('./hybridCoverages');
const nitterContextRoutes = require('./nitterContext');
const nitterProfileRoutes = require('./nitterProfile');
const pendingAnalysisRoutes = require('./pendingAnalysis');
const nitterCommentProxyRoutes = require('./nitterComment');
const tweetCommentsRoutes = require('./tweetComments');
const aiRoutes = require('./ai');
const mapsRoutes = require('./maps');
const webAgentRoutes = require('./webAgent');
const agentsRoutes = require('./agents');
const path = require('path');
const capturadosRoutes = require('./capturados');
const coveragesRoutes = require('./coverages');
const express = require('express');
const { verifyUserAccess } = require('../middlewares/auth');
const codexRoutes = require('./codex');
const wikiCodexRoutes = require('./wikiCodex');
const instagramRoutes = require('./instagram');
const xRoutes = require('./x');
const socialEntitiesRoutes = require('./socialEntities');
const extractionErrorsRoutes = require('./extractionErrors');
const jobsRoutes = require('./jobs');
const guestPostsRoutes = require('./guestPosts');
const postAnalysisRoutes = require('./postAnalysis');
const { router: realtimeTranscriptionRoutes } = require('./realtime-transcription');
const elevenLabsTokenRoutes = require('./elevenlabs-token');
const feedsRoutes = require('./feeds');
const workshopPromptsRoutes = require('./workshopPrompts');
const workersRoutes = require('./workers');
const datasetsRoutes = require('./datasets');

/**
 * Configura todas las rutas de la aplicación
 * @param {Express} app - La aplicación Express
 */
function setupRoutes(app) {
  // Ruta de verificación básica
  app.get('/api/status', (req, res) => {
    res.json({
      status: 'online',
      timestamp: new Date().toISOString()
    });
  });

  // Ruta para el panel de administración
  app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '../../admin.html'));
  });

  // Ruta de redirección desde /admin/ a /admin
  app.get('/admin/', (req, res) => {
    res.redirect('/admin');
  });

  // Configurar rutas de tendencias
  trendsRoutes(app);

  // Rutas de análisis de noticias (news cards + insights + cron endpoint)
  app.use('/api/trends', newsAnalysisRoutes);
  app.use('/api', newsAnalysisRoutes); // exposes /api/cron/news-cards

  // Rutas de feed data analítico por categoría (cron endpoint)
  app.use('/', feedsRoutes); // exposes /api/cron/feed-data

  // Rutas de narrativa diaria (narrativa sintética del día + cron endpoint)
  app.use('/api/trends', narrativaDiariaRoutes);
  app.use('/api', narrativaDiariaRoutes); // exposes /api/cron/narrativa

  // Configurar rutas de administración
  adminRoutes(app);

  // Configurar rutas de sondeos
  app.use('/api', sondeosRoutes);

  // Configurar rutas de sugerencias de proyectos
  app.use('/api/project-suggestions', projectSuggestionsRoutes);

  // Configurar rutas de transcripción
  app.use('/api/transcription', transcriptionRoutes);

  // Configurar rutas de análisis de documentos
  app.use('/api/document-analysis', documentAnalysisRoutes);

  // Configurar rutas de capturados (hallazgos extraídos)
  app.use('/api/capturados', capturadosRoutes);

  // Configurar rutas de coberturas geográficas (sistema tradicional)
  app.use('/api/coverages', coveragesRoutes);

  // Configurar rutas híbridas de coberturas geográficas con IA
  app.use('/api/hybrid-coverages', hybridCoveragesRoutes);

  // Configurar rutas del agente Maps (experto en geografía guatemalteca)
  app.use('/api/maps', mapsRoutes);

  // Configurar rutas del MCP Server
  app.use('/api/mcp', mcpRoutes);
  app.use('/mcp', mcpProtocolRoutes); // protocolo MCP estándar (clientes externos: Claude Desktop, ChatGPT)
  setupMcpOAuth(app); // discovery (.well-known), /oauth/{register,authorize,consent,token}

  // Configurar rutas de Vizta Chat
  app.use('/api/vizta-chat', viztaChatRoutes);

  // Configurar rutas de Vizta Feedback
  app.use('/api/vizta', viztaFeedbackRoutes);

  // Configurar rutas de Nitter Context (herramienta de análisis de tweets)
  app.use('/api', nitterContextRoutes);

  // Configurar rutas de Nitter Profile (herramienta de análisis de perfiles de usuarios)
  app.use('/api', nitterProfileRoutes);

  // Configurar rutas de Nitter Comment (proxy hacia ExtractorT)
  app.use('/api', nitterCommentProxyRoutes);

  // Rutas de gestión de comentarios (obtener/eliminar)
  app.use('/api/tweet-comments', tweetCommentsRoutes);

  // Configurar rutas de Knowledge (PublicKnowledge)
  app.use('/api/knowledge', require('./knowledge'));

  // Configurar rutas de análisis de enlaces pendientes
  app.use('/api/pending-analysis', pendingAnalysisRoutes);

  // Configurar rutas de IA (Gemini)
  app.use('/api/ai', aiRoutes);

  // Configurar rutas de WebAgent Proxy
  app.use('/api/webagent', webAgentRoutes);

  // Configurar rutas de Agentes IA
  app.use('/api/agents', agentsRoutes);

  // Nueva ruta para agrupación de Codex
  require('./codexGroups')(app);

  // Rutas de Codex (guardar enlaces, grabaciones, listados)
  codexRoutes(app);

  // Rutas de Wiki dentro del Codex (personas, organizaciones, lugares, eventos, conceptos)
  app.use('/api/wiki', wikiCodexRoutes);

  // Configurar rutas de Instagram (comentarios y análisis)
  app.use('/api/instagram', instagramRoutes);

  // Configurar rutas de X/Twitter (comentarios y media)
  app.use('/api/x', xRoutes);

  // Configurar rutas de jobs (async jobs management)
  app.use('/api/jobs', jobsRoutes);

  // Configurar rutas de guest posts (simplified post persistence)
  app.use('/api/guest-posts', guestPostsRoutes);

  // Configurar rutas de análisis de posts (saved posts processing)
  app.use('/api/analyze-post', postAnalysisRoutes);

  // Configurar rutas de entidades sociales (extracción universal)
  app.use('/api/social', socialEntitiesRoutes);

  // Configurar rutas de reportes de errores de extracción
  app.use('/api/extraction-errors', extractionErrorsRoutes);

  // Configurar rutas de transcripción en tiempo real con ElevenLabs
  app.use('/api/realtime-transcription', realtimeTranscriptionRoutes);

  // Configurar rutas de tokens de ElevenLabs
  app.use('/api/elevenlabs', elevenLabsTokenRoutes);

  // Configurar rutas de Workshop Prompts (prompts personalizados de identidad/rol para Vizta)
  app.use('/api/workshop-prompts', workshopPromptsRoutes);

  // Configurar rutas de Workers (Clasificador — cuestionamientos, temas, conocimiento)
  app.use('/api/workers', workersRoutes);

  // Contrato canónico Dataset ↔ Codex (vista previa, vínculos y sincronización)
  app.use('/api/datasets', datasetsRoutes);

  // Healthcheck routes (both /health and /api/health for compatibility)
  const healthResponse = (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'ExtractorW Backend'
    });
  };

  app.get('/health', healthResponse);
  app.get('/api/health', healthResponse);

  // Default fallback
  app.get('/api', (req, res) => {
    res.json({
      message: 'ExtractorW API v2.0',
      timestamp: new Date().toISOString(),
      endpoints: [
        '/api/health',
        '/api/vizta-chat',
        '/api/admin',
        '/api/transcription',
        '/api/document-analysis',
        '/api/nitter-context',
        '/api/nitter-profile',
        '/api/trends',
        '/api/coverages',
        '/api/hybrid-coverages',
        '/api/ai',
        '/api/mcp',
        '/api/datasets',
        '/api/pending-analysis',
        '/api/capturados',
        '/api/sondeos',
        '/api/project-suggestions',
        '/api/codex-groups',
        '/api/codex',
        '/api/wiki',
        '/api/webagent',
        '/api/agents',
        '/api/instagram',
        '/api/x',
        '/api/guest-posts',
        '/api/analyze-post'
      ]
    });
  });
}

module.exports = {
  setupRoutes
}; 
