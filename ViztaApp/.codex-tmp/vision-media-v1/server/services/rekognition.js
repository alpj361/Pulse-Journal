const fs = require('fs');

const MAX_INLINE_IMAGE_BYTES = 5 * 1024 * 1024;

function loadSdk() {
  return require('@aws-sdk/client-rekognition');
}

function getRegion(options = {}) {
  const region = options.region || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;
  if (!region) throw new Error('AWS_REGION no configurada');
  return region;
}

function getClient(options = {}) {
  if (options.client) return options.client;
  const { RekognitionClient } = loadSdk();
  return new RekognitionClient({ region: getRegion(options) });
}

function buildImageInput(input = {}) {
  if (input.bytes) {
    const bytes = Buffer.isBuffer(input.bytes) ? input.bytes : Buffer.from(input.bytes);
    if (bytes.length > MAX_INLINE_IMAGE_BYTES) {
      throw new Error('La imagen inline supera 5 MB; usa una referencia S3');
    }
    return { Bytes: bytes };
  }

  if (input.imagePath) {
    if (!fs.existsSync(input.imagePath)) throw new Error(`Imagen no encontrada: ${input.imagePath}`);
    const bytes = fs.readFileSync(input.imagePath);
    if (bytes.length > MAX_INLINE_IMAGE_BYTES) {
      throw new Error('La imagen inline supera 5 MB; usa una referencia S3');
    }
    return { Bytes: bytes };
  }

  if (input.s3Bucket && input.s3Name) {
    return {
      S3Object: {
        Bucket: input.s3Bucket,
        Name: input.s3Name,
        ...(input.s3Version ? { Version: input.s3Version } : {})
      }
    };
  }

  throw new Error('Se requiere bytes, imagePath o s3Bucket + s3Name');
}

async function detectFaces(input, options = {}) {
  const { DetectFacesCommand } = loadSdk();
  const client = getClient(options);
  return client.send(new DetectFacesCommand({
    Image: buildImageInput(input),
    Attributes: options.attributes || ['DEFAULT']
  }));
}

async function compareFaces(source, target, options = {}) {
  const { CompareFacesCommand } = loadSdk();
  const client = getClient(options);
  return client.send(new CompareFacesCommand({
    SourceImage: buildImageInput(source),
    TargetImage: buildImageInput(target),
    SimilarityThreshold: options.similarityThreshold ?? 90,
    QualityFilter: options.qualityFilter || 'AUTO'
  }));
}

async function searchFacesByImage(input, options = {}) {
  const collectionId = options.collectionId || process.env.AWS_REKOGNITION_COLLECTION_ID;
  if (!collectionId) throw new Error('AWS_REKOGNITION_COLLECTION_ID no configurada');
  const { SearchFacesByImageCommand } = loadSdk();
  const client = getClient(options);
  return client.send(new SearchFacesByImageCommand({
    CollectionId: collectionId,
    Image: buildImageInput(input),
    FaceMatchThreshold: options.faceMatchThreshold ?? 90,
    MaxFaces: options.maxFaces || 10,
    QualityFilter: options.qualityFilter || 'AUTO'
  }));
}

async function indexFaces(input, options = {}) {
  const collectionId = options.collectionId || process.env.AWS_REKOGNITION_COLLECTION_ID;
  if (!collectionId) throw new Error('AWS_REKOGNITION_COLLECTION_ID no configurada');
  if (!options.externalImageId) throw new Error('externalImageId es obligatorio para indexar un rostro');
  const { IndexFacesCommand } = loadSdk();
  const client = getClient(options);
  return client.send(new IndexFacesCommand({
    CollectionId: collectionId,
    Image: buildImageInput(input),
    ExternalImageId: options.externalImageId,
    MaxFaces: options.maxFaces || 1,
    QualityFilter: options.qualityFilter || 'AUTO',
    DetectionAttributes: options.detectionAttributes || ['DEFAULT']
  }));
}

module.exports = {
  MAX_INLINE_IMAGE_BYTES,
  buildImageInput,
  compareFaces,
  detectFaces,
  indexFaces,
  searchFacesByImage
};
