const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildImageInput,
  compareFaces,
  detectFaces
} = require('./rekognition');

test('construye una imagen inline para Rekognition', () => {
  const image = buildImageInput({ bytes: Buffer.from('image') });
  assert.ok(Buffer.isBuffer(image.Bytes));
  assert.equal(image.Bytes.toString(), 'image');
});

test('construye una referencia S3 sin leer credenciales', () => {
  assert.deepEqual(buildImageInput({
    s3Bucket: 'bucket',
    s3Name: 'faces/persona.jpg',
    s3Version: 'v1'
  }), {
    S3Object: { Bucket: 'bucket', Name: 'faces/persona.jpg', Version: 'v1' }
  });
});

test('detectFaces utiliza el comando del SDK sin persistir rostros', async () => {
  const calls = [];
  const client = { send: async command => { calls.push(command); return { FaceDetails: [] }; } };
  const result = await detectFaces({ bytes: Buffer.from('image') }, { client, region: 'us-east-1' });
  assert.deepEqual(result, { FaceDetails: [] });
  assert.equal(calls[0].constructor.name, 'DetectFacesCommand');
});

test('compareFaces aplica un umbral conservador por defecto', async () => {
  const calls = [];
  const client = { send: async command => { calls.push(command); return { FaceMatches: [] }; } };
  await compareFaces(
    { bytes: Buffer.from('source') },
    { bytes: Buffer.from('target') },
    { client, region: 'us-east-1' }
  );
  assert.equal(calls[0].input.SimilarityThreshold, 90);
});
