const {
  analyzeStaticImage,
  analyzeVideo
} = require('/app/server/services/mediaVision');

async function main() {
  const mode = process.argv[2];
  console.log(JSON.stringify({
    openrouterConfigured: Boolean(process.env.OPENROUTER_API_KEY),
    awsConfigured: Boolean(process.env.AWS_ACCESS_KEY_ID),
    imageModel: process.env.IMAGE_VISION_MODEL || 'qwen/qwen3.7-flash',
    videoModel: process.env.VIDEO_VISION_MODEL || 'google/gemini-3.8-flash'
  }));

  if (mode === 'image') {
    const result = await analyzeStaticImage('/tmp/vizta-vision-smoke.png', {
      prompt: 'Describe el color dominante de esta imagen en una frase.'
    });
    console.log(JSON.stringify({
      model: result.metadata.model,
      provider: result.metadata.provider,
      analysis: result.analysis
    }));
    return;
  }

  if (mode === 'video' || mode === 'video-agentic') {
    const result = await analyzeVideo('/tmp/vizta-video-smoke.mp4', {
      prompt: 'Describe brevemente los patrones visuales de este video sintético.',
      videoMode: mode === 'video-agentic' ? 'agentic' : 'static'
    });
    console.log(JSON.stringify({
      model: result.metadata.model,
      provider: result.metadata.provider,
      processingMode: result.metadata.processingMode,
      durationSeconds: result.metadata.durationSeconds,
      analysis: result.analysis
    }));
    return;
  }

  throw new Error('Usa image o video');
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
