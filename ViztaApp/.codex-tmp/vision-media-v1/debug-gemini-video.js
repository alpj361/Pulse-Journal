const fs = require('fs');

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY no configurada');

  const modelResponse = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash',
    { headers: { 'x-goog-api-key': apiKey } }
  );
  console.log(JSON.stringify({
    check: 'model',
    status: modelResponse.status,
    body: (await modelResponse.text()).slice(0, 1600)
  }));

  const videoData = fs.readFileSync('/tmp/vizta-video-smoke.mp4', { encoding: 'base64' });
  const interactionResponse = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/interactions',
    {
      method: 'POST',
      headers: {
        'x-goog-api-key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gemini-3.8-flash',
        input: [
          { type: 'text', text: 'Describe brevemente este video sintético.' },
          { type: 'video', data: videoData, mime_type: 'video/mp4' }
        ]
      })
    }
  );
  console.log(JSON.stringify({
    check: 'interaction',
    status: interactionResponse.status,
    body: (await interactionResponse.text()).slice(0, 3000)
  }));
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
