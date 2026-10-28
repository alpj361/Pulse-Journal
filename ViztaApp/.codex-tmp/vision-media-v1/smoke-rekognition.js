const { detectFaces } = require('/app/server/services/rekognition');

detectFaces({ imagePath: '/tmp/vizta-rekognition-smoke.png' })
  .then(result => {
    console.log(JSON.stringify({
      faceCount: (result.FaceDetails || []).length,
      requestId: Boolean(result.$metadata?.requestId)
    }));
  })
  .catch(error => {
    console.error(`${error.name}: ${error.message}`);
    process.exitCode = 1;
  });
