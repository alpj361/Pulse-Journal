const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

const STATIC_IMAGE_MODEL = (process.env.IMAGE_VISION_MODEL || 'qwen/qwen3.7-flash').trim();
const VIDEO_MODEL = (process.env.VIDEO_VISION_MODEL || 'google/gemini-3.8-flash').trim();
const AGENTIC_THRESHOLD_SECONDS = Number.parseInt(
  process.env.VIDEO_AGENTIC_THRESHOLD_SECONDS || '300',
  10
);
const VIDEO_BASE64_LIMIT_BYTES = Number.parseInt(
  process.env.VIDEO_BASE64_LIMIT_BYTES || String(100 * 1024 * 1024),
  10
);

const IMAGE_MIME_TYPES = Object.freeze({
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp'
});

const VIDEO_MIME_TYPES = Object.freeze({
  '.mp4': 'video/mp4',
  '.mpeg': 'video/mpeg',
  '.mpg': 'video/mpg',
  '.mov': 'video/mov',
  '.avi': 'video/avi',
  '.webm': 'video/webm',
  '.wmv': 'video/wmv',
  '.flv': 'video/x-flv',
  '.3gp': 'video/3gpp'
});

function assertReadableFile(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('Se requiere una ruta de archivo válida');
  }
  if (!fs.existsSync(filePath)) {
    throw new Error(`Archivo no encontrado: ${filePath}`);
  }
  const stats = fs.statSync(filePath);
  if (!stats.isFile()) {
    throw new Error(`La ruta no corresponde a un archivo: ${filePath}`);
  }
  return stats;
}

function getMimeType(filePath, kind) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeType = kind === 'image' ? IMAGE_MIME_TYPES[ext] : VIDEO_MIME_TYPES[ext];
  if (!mimeType) {
    const supported = Object.keys(kind === 'image' ? IMAGE_MIME_TYPES : VIDEO_MIME_TYPES);
    throw new Error(`Formato de ${kind === 'image' ? 'imagen' : 'video'} no soportado: ${ext}. Formatos: ${supported.join(', ')}`);
  }
  return mimeType;
}

function normalizeTextContent(content) {
  if (typeof content === 'string') return content.trim();
  if (!Array.isArray(content)) return '';
  return content
    .filter(part => part && (part.type === 'text' || typeof part.text === 'string'))
    .map(part => part.text || '')
    .join('\n')
    .trim();
}

function extractInteractionText(interaction) {
  const direct = interaction?.output_text || interaction?.outputText;
  if (typeof direct === 'string' && direct.trim()) return direct.trim();

  const texts = [];
  for (const step of interaction?.steps || []) {
    if (step?.type !== 'model_output') continue;
    for (const part of step.content || []) {
      if (typeof part?.text === 'string') texts.push(part.text);
    }
  }
  return texts.join('\n').trim();
}

function selectVideoProcessingMode(durationSeconds, requestedMode = 'auto') {
  if (requestedMode === 'agentic' || requestedMode === 'static') return requestedMode;
  if (requestedMode !== 'auto') {
    throw new Error('videoMode debe ser auto, static o agentic');
  }
  if (!Number.isFinite(durationSeconds) || durationSeconds < 0) return 'agentic';
  return durationSeconds >= AGENTIC_THRESHOLD_SECONDS ? 'agentic' : 'static';
}

async function getVideoDurationSeconds(videoPath) {
  assertReadableFile(videoPath);
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      videoPath
    ]);
    const duration = Number.parseFloat(stdout.trim());
    if (!Number.isFinite(duration)) throw new Error('ffprobe no devolvió una duración válida');
    return duration;
  } catch (error) {
    throw new Error(`No se pudo medir la duración del video: ${error.message}`);
  }
}

async function analyzeStaticImage(imagePath, options = {}) {
  const stats = assertReadableFile(imagePath);
  const mimeType = getMimeType(imagePath, 'image');
  const apiKey = options.apiKey || process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY no configurada');

  const model = (options.model || STATIC_IMAGE_MODEL).trim();
  const prompt = options.prompt ||
    'Describe detalladamente esta imagen en español. Transcribe exactamente todo texto visible y señala personas, objetos, lugares y contexto relevante. Devuelve solo el análisis.';
  const baseUrl = (process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/$/, '');
  const imageData = fs.readFileSync(imagePath).toString('base64');

  const fetchImpl = options.fetchImpl || fetch;
  const response = await fetchImpl(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'https://standatpd.com',
      'X-Title': process.env.OPENROUTER_APP_NAME || 'ExtractorW'
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: 'Eres un analista visual preciso. No inventes texto ni identidades que no sean observables.'
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageData}` } }
          ]
        }
      ],
      max_tokens: options.maxTokens || 1200,
      temperature: options.temperature ?? 0.1
    })
  });

  if (!response.ok) {
    const responseBody = (await response.text()).slice(0, 1000);
    throw new Error(`OpenRouter vision error ${response.status}: ${responseBody}`);
  }

  const payload = await response.json();
  const analysis = normalizeTextContent(payload?.choices?.[0]?.message?.content);
  if (!analysis) throw new Error('Qwen Vision devolvió una respuesta vacía');

  return {
    analysis,
    metadata: {
      provider: 'openrouter',
      model,
      processingMode: 'static-image',
      originalFile: path.basename(imagePath),
      mimeType,
      bytes: stats.size,
      charactersCount: analysis.length,
      wordsCount: analysis.split(/\s+/).filter(Boolean).length,
      timestamp: new Date().toISOString()
    }
  };
}

async function analyzeVideo(videoPath, options = {}) {
  const apiKey = options.apiKey || process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY no configurada');

  let stats = null;
  let mimeType = options.mimeType || null;
  let videoUrl = options.videoUrl || null;
  let durationSeconds = options.durationSeconds;

  if (videoPath) {
    stats = assertReadableFile(videoPath);
    mimeType = mimeType || getMimeType(videoPath, 'video');
    if (durationSeconds === undefined) {
      durationSeconds = await getVideoDurationSeconds(videoPath);
    }
    if (!videoUrl) {
      if (stats.size > VIDEO_BASE64_LIMIT_BYTES) {
        throw new Error(
          `El video local supera ${VIDEO_BASE64_LIMIT_BYTES} bytes; proporciona options.videoUrl con una URL temporal accesible`
        );
      }
      const data = fs.readFileSync(videoPath, { encoding: 'base64' });
      videoUrl = `data:${mimeType};base64,${data}`;
    }
  }

  if (!videoUrl || !/^https?:\/\//i.test(videoUrl) && !/^data:video\//i.test(videoUrl)) {
    throw new Error('Se requiere un videoPath local o options.videoUrl HTTP(S)');
  }

  mimeType = mimeType || 'video/mp4';
  const processingMode = selectVideoProcessingMode(durationSeconds, options.videoMode || 'auto');
  const model = (options.model || VIDEO_MODEL).trim();
  const prompt = options.prompt ||
    'Analiza este video en español. Resume los hechos, transcribe el diálogo relevante, identifica texto visible, cambios de escena y momentos importantes con marcas de tiempo cuando sea posible.';
  const baseUrl = (process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/$/, '');
  const fetchImpl = options.fetchImpl || fetch;
  const response = await fetchImpl(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'https://standatpd.com',
      'X-Title': process.env.OPENROUTER_APP_NAME || 'ExtractorW'
    },
    body: JSON.stringify({
      model,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          {
            type: 'video_url',
            video_url: {
              url: videoUrl,
              processing: processingMode
            }
          }
        ]
      }],
      max_tokens: options.maxTokens || 2400,
      temperature: options.temperature ?? 0.1
    })
  });

  if (!response.ok) {
    const responseBody = (await response.text()).slice(0, 1600);
    throw new Error(`OpenRouter video error ${response.status}: ${responseBody}`);
  }

  const payload = await response.json();
  const analysis = normalizeTextContent(payload?.choices?.[0]?.message?.content);
  if (!analysis) throw new Error('Gemini Video devolvió una respuesta vacía');

  return {
    analysis,
    metadata: {
      provider: 'openrouter',
      upstreamProvider: payload?.provider || null,
      model,
      processingMode,
      agenticRequested: processingMode === 'agentic',
      originalFile: videoPath ? path.basename(videoPath) : null,
      mimeType,
      bytes: stats?.size || null,
      durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : null,
      charactersCount: analysis.length,
      wordsCount: analysis.split(/\s+/).filter(Boolean).length,
      timestamp: new Date().toISOString()
    }
  };
}

module.exports = {
  STATIC_IMAGE_MODEL,
  VIDEO_MODEL,
  AGENTIC_THRESHOLD_SECONDS,
  VIDEO_BASE64_LIMIT_BYTES,
  IMAGE_MIME_TYPES,
  VIDEO_MIME_TYPES,
  analyzeStaticImage,
  analyzeVideo,
  extractInteractionText,
  getMimeType,
  getVideoDurationSeconds,
  selectVideoProcessingMode
};
