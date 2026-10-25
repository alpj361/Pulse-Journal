const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  analyzeVideo,
  extractInteractionText,
  getMimeType,
  selectVideoProcessingMode
} = require('./mediaVision');

test('selecciona video estático por debajo de cinco minutos', () => {
  assert.equal(selectVideoProcessingMode(179, 'auto'), 'static');
});

test('selecciona video agentic desde cinco minutos', () => {
  assert.equal(selectVideoProcessingMode(300, 'auto'), 'agentic');
});

test('respeta un modo solicitado explícitamente', () => {
  assert.equal(selectVideoProcessingMode(30, 'agentic'), 'agentic');
  assert.equal(selectVideoProcessingMode(900, 'static'), 'static');
});

test('mapea formatos multimedia documentados', () => {
  assert.equal(getMimeType('/tmp/foto.jpeg', 'image'), 'image/jpeg');
  assert.equal(getMimeType('/tmp/video.mp4', 'video'), 'video/mp4');
});

test('extrae texto de la respuesta directa o de steps', () => {
  assert.equal(extractInteractionText({ output_text: ' resumen ' }), 'resumen');
  assert.equal(extractInteractionText({
    steps: [{ type: 'model_output', content: [{ type: 'text', text: 'detalle' }] }]
  }), 'detalle');
});

test('prepara Agentic Video para OpenRouter', async t => {
  const videoPath = path.join(os.tmpdir(), `media-vision-${process.pid}.mp4`);
  fs.writeFileSync(videoPath, Buffer.from('video'));
  t.after(() => fs.rmSync(videoPath, { force: true }));

  const calls = [];
  const fetchImpl = async (url, request) => {
    calls.push({ url, request });
    return {
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'análisis' } }] })
    };
  };

  const result = await analyzeVideo(videoPath, {
    apiKey: 'test-key',
    fetchImpl,
    durationSeconds: 600
  });

  const payload = JSON.parse(calls[0].request.body);
  assert.equal(payload.model, 'google/gemini-3.8-flash');
  assert.equal(payload.messages[0].content[1].video_url.processing, 'agentic');
  assert.equal(result.metadata.processingMode, 'agentic');
  assert.equal(result.metadata.agenticRequested, true);
});

test('envía videos cortos inline con procesamiento estático', async t => {
  const videoPath = path.join(os.tmpdir(), `media-vision-short-${process.pid}.mp4`);
  fs.writeFileSync(videoPath, Buffer.from('video'));
  t.after(() => fs.rmSync(videoPath, { force: true }));

  let requestBody;
  const fetchImpl = async (_url, request) => {
    requestBody = JSON.parse(request.body);
    return {
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'análisis corto' } }] })
    };
  };

  const result = await analyzeVideo(videoPath, {
    apiKey: 'test-key',
    fetchImpl,
    durationSeconds: 120
  });

  assert.equal(requestBody.messages[0].content[1].video_url.processing, 'static');
  assert.equal(result.metadata.processingMode, 'static');
});
