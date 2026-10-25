const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const supabase = require('../utils/supabase');
const { analyzeStaticImage } = require('./mediaVision');

const execAsync = promisify(exec);

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_TRANSCRIBE_MODEL = 'whisper-1';

const TEMP_DIR = '/tmp/audio_transcriptions';
const SUPPORTED_AUDIO_FORMATS = ['.mp3', '.wav', '.aac', '.ogg', '.flac', '.m4a'];
const SUPPORTED_VIDEO_FORMATS = ['.mp4', '.avi', '.mov', '.mkv', '.webm', '.m4v'];
const SUPPORTED_IMAGE_FORMATS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

// Crear directorio temporal si no existe
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

function detectFileType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (SUPPORTED_AUDIO_FORMATS.includes(ext)) { return 'audio'; }
  if (SUPPORTED_VIDEO_FORMATS.includes(ext)) { return 'video'; }
  if (SUPPORTED_IMAGE_FORMATS.includes(ext)) { return 'image'; }
  return 'unsupported';
}

function normalizeLanguageCode(lang) {
  if (!lang || typeof lang !== 'string') return undefined;
  const trimmed = lang.trim().toLowerCase();
  if (!trimmed || trimmed === 'auto') return undefined;
  const isoPattern = /^[a-z]{2,8}(-[a-z0-9]{2,8})?$/;
  if (!isoPattern.test(trimmed)) return undefined;
  return trimmed;
}

async function checkVideoHasAudio(videoPath) {
  try {
    console.log(`🔍 Verificando si el video tiene audio: ${videoPath}`);
    // Remove a:0 to check for ANY audio stream
    const { stdout } = await execAsync(`ffprobe -v error -select_streams a -show_entries stream=codec_type -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`);
    console.log(`🔍 ffprobe output: '${stdout}'`);

    // Check if output contains 'audio' anywhere
    const hasAudio = stdout.toLowerCase().includes('audio');
    console.log(`${hasAudio ? '✅' : '❌'} Video ${hasAudio ? 'tiene' : 'NO tiene'} stream de audio`);
    return hasAudio;
  } catch (error) {
    console.warn('⚠️ Error verificando audio, asumiendo que no tiene:', error.message);
    return false;
  }
}

async function extractAudioFromVideo(videoPath) {
  const videoName = path.basename(videoPath, path.extname(videoPath));
  const audioPath = path.join(TEMP_DIR, `${videoName}_${Date.now()}.wav`);
  console.log(`🎵 Extrayendo audio de video: ${videoPath}`);
  const ffmpegCommand = `ffmpeg -i "${videoPath}" -vn -ac 1 -ar 16000 -y "${audioPath}"`;
  try { await execAsync(ffmpegCommand); console.log(`✅ Audio extraído: ${audioPath}`); return audioPath; }
  catch (error) { console.error('❌ Error extrayendo audio:', error); throw new Error(`Error al extraer audio del video: ${error.message}`); }
}

async function prepareAudioFile(inputPath) {
  const fileType = detectFileType(inputPath);
  if (fileType === 'unsupported') {
    throw new Error(`Formato de archivo no soportado. Formatos soportados: ${[...SUPPORTED_AUDIO_FORMATS, ...SUPPORTED_VIDEO_FORMATS].join(', ')}`);
  }
  if (fileType === 'video') {
    // ✅ Verificar si el video tiene audio ANTES de intentar extraerlo
    const hasAudio = await checkVideoHasAudio(inputPath);
    if (!hasAudio) {
      throw new Error('VIDEO_NO_AUDIO: El video no contiene stream de audio');
    }
    const audioPath = await extractAudioFromVideo(inputPath);
    return { audioPath, isTemporary: true };
  } else {
    return { audioPath: inputPath, isTemporary: false };
  }
}

// Transcripción de audio usando OpenAI
async function transcribeWithOpenAI(audioPath, options = {}) {
  try {
    if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY no configurada');
    if (!fs.existsSync(audioPath)) throw new Error(`Archivo de audio no encontrado: ${audioPath}`);

    // Leer el archivo como buffer
    const fileBuffer = fs.readFileSync(audioPath);

    const form = new (require('form-data'))();
    form.append('model', OPENAI_TRANSCRIBE_MODEL);
    form.append('file', fileBuffer, {
      filename: path.basename(audioPath),
      contentType: 'audio/wav'
    });
    const normalizedLanguage = normalizeLanguageCode(options.language);
    if (normalizedLanguage) {
      form.append('language', normalizedLanguage);
    }
    if (options.prompt) form.append('prompt', options.prompt);

    const axios = require('axios');
    const resp = await axios.post('https://api.openai.com/v1/audio/transcriptions', form, {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        ...form.getHeaders()
      }
    });
    const data = resp.data;
    const transcription = data.text || '';

    return {
      transcription,
      metadata: {
        originalFile: path.basename(audioPath),
        model: OPENAI_TRANSCRIBE_MODEL,
        timestamp: new Date().toISOString(),
        charactersCount: transcription.length,
        wordsCount: transcription.split(' ').length
      }
    };
  } catch (error) {
    console.error('❌ Error en transcripción OpenAI:', error);
    throw new Error(`Error al transcribir con OpenAI: ${error.message}`);
  }
}

async function saveTranscriptionToCodex(
  transcriptionResult,
  originalFilePath,
  userId,
  metadata = {},
  supabaseClient = supabase,
  updateItemId = null
) {
  try {
    console.log(`💾 Guardando transcripción en Codex para usuario: ${userId}`);
    const originalFileName = path.basename(originalFilePath);
    const originalFileType = detectFileType(originalFilePath);
    const codexItemData = {
      user_id: userId,
      tipo: originalFileType,
      titulo: metadata.titulo || `Transcripción: ${originalFileName}`,
      descripcion: metadata.descripcion || `Transcripción automática de ${originalFileType === 'video' ? 'video' : 'audio'} generada con OpenAI (${OPENAI_TRANSCRIBE_MODEL}). ${transcriptionResult.metadata.wordsCount} palabras, ${transcriptionResult.metadata.charactersCount} caracteres.`,
      etiquetas: metadata.noAutoTags ? (metadata.etiquetas || []) : [
        'transcripcion', 'audio', originalFileType, 'openai-gpt', ...(metadata.etiquetas || [])
      ],
      proyecto: metadata.proyecto || 'Transcripciones Automáticas',
      project_id: metadata.project_id || null,
      storage_path: null,
      url: null,
      nombre_archivo: `${originalFileName}.transcripcion.txt`,
      tamano: transcriptionResult.transcription.length,
      fecha: new Date().toISOString().split('T')[0],
      audio_transcription: transcriptionResult.transcription
    };
    let codexData, codexError;
    if (updateItemId) {
      console.log(`📝 Actualizando item existente ${updateItemId} con transcripción...`);
      const updateData = { audio_transcription: codexItemData.audio_transcription, descripcion: codexItemData.descripcion, nombre_archivo: codexItemData.nombre_archivo };
      if (!metadata.noAutoTags) { updateData.etiquetas = codexItemData.etiquetas; }
      ({ data: codexData, error: codexError } = await supabaseClient
        .from('codex_items')
        .update(updateData)
        .eq('id', updateItemId)
        .select()
        .single());
    } else {
      console.log(`📝 Creando registro con transcripción de ${transcriptionResult.transcription.length} caracteres...`);
      ({ data: codexData, error: codexError } = await supabaseClient
        .from('codex_items')
        .insert([codexItemData])
        .select()
        .single());
    }
    if (codexError) { console.error('❌ Error insertando en codex_items:', codexError); throw codexError; }
    console.log(`✅ Transcripción guardada en codex_items id: ${codexData.id}`);
    return { codexItem: codexData, transcriptionResult: transcriptionResult, storagePath: null };
  } catch (error) {
    console.error('❌ Error guardando transcripción en Codex:', error);
    throw new Error(`Error al guardar transcripción: ${error.message}`);
  }
}

function cleanupTempFiles(tempFiles) {
  tempFiles.forEach(filePath => { try { if (fs.existsSync(filePath)) { fs.unlinkSync(filePath); console.log(`🗑️ Archivo temporal eliminado: ${filePath}`); } } catch (e) { console.warn(`⚠️ No se pudo eliminar archivo temporal ${filePath}:`, e.message); } });
}

async function transcribeFile(filePath, userId, options = {}) {
  const spClient = options.supabaseClient || supabase;
  const updateItemId = options.updateItemId || null;
  const skipSave = options.skipSave || false;
  const tempFiles = [];
  try {
    console.log(`🎬 Iniciando proceso de transcripción: ${filePath}`);

    let transcriptionResult;

    // ✅ Detectar si es imagen y usar Vision AI directamente
    const ext = path.extname(filePath).toLowerCase();
    if (SUPPORTED_IMAGE_FORMATS.includes(ext)) {
      console.log('🖼️ Archivo es imagen, usando Vision AI...');
      transcriptionResult = await transcribeImageWithGemini(filePath, options);
    } else {
      // Es audio o video
      try {
        const { audioPath, isTemporary } = await prepareAudioFile(filePath);
        if (isTemporary) { tempFiles.push(audioPath); }
        transcriptionResult = await transcribeWithOpenAI(audioPath, options);
      } catch (error) {
        // ✅ Si el video no tiene audio, usar Vision AI en frames
        if (error.message.includes('VIDEO_NO_AUDIO')) {
          console.log('🎥 Video sin audio detectado, usando Vision AI en frames...');
          transcriptionResult = await transcribeVideoFramesWithVision(filePath, options);
        } else {
          throw error;
        }
      }
    }

    // Solo guardar en Supabase si no se solicita saltar el guardado
    let saveResult = null;
    if (skipSave) {
      console.log('⏭️ Guardado en Supabase omitido (skipSave=true)');
    } else {
      console.log('💾 Guardando transcripción en Codex para usuario:', userId);
      saveResult = await saveTranscriptionToCodex(transcriptionResult, filePath, userId, options, spClient, updateItemId);
    }

    return {
      success: true,
      transcription: transcriptionResult.transcription,
      metadata: transcriptionResult.metadata,
      codexItem: saveResult?.codexItem || null,
      message: `Transcripción completada. ${transcriptionResult.metadata.wordsCount} palabras.`
    };
  } catch (error) {
    console.error('❌ Error en proceso de transcripción:', error);
    return { success: false, error: error.message, message: 'Error durante el proceso de transcripción' };
  } finally { if (tempFiles.length > 0) { cleanupTempFiles(tempFiles); } }
}

// ✅ Nueva función para transcribir videos sin audio usando Vision AI
async function transcribeVideoFramesWithVision(videoPath, options = {}) {
  try {
    console.log(`🎥 Extrayendo frames del video para análisis con Vision AI...`);

    // Extraer un frame del video (frame del medio)
    const videoName = path.basename(videoPath, path.extname(videoPath));
    const framePath = path.join(TEMP_DIR, `${videoName}_frame_${Date.now()}.jpg`);

    // Extraer frame del segundo 1 del video
    const ffmpegCommand = `ffmpeg -i "${videoPath}" -ss 00:00:01 -vframes 1 -y "${framePath}"`;
    await execAsync(ffmpegCommand);
    console.log(`✅ Frame extraído: ${framePath}`);

    // Usar Vision AI para analizar el frame
    const result = await transcribeImageWithGemini(framePath, {
      ...options,
      prompt: options.prompt || 'Describe detalladamente el contenido de este video frame en español. Si hay texto visible, transcríbelo exactamente.'
    });

    // Limpiar frame temporal
    try {
      fs.unlinkSync(framePath);
    } catch (e) {
      console.warn('⚠️ No se pudo eliminar frame temporal:', e.message);
    }

    return result;
  } catch (error) {
    console.error('❌ Error transcribiendo video con Vision AI:', error);
    throw new Error(`Error al transcribir video con Vision AI: ${error.message}`);
  }
}

// Alias conservado para no romper consumidores existentes. La implementación
// usa el proveedor y modelo configurados en mediaVision.
async function transcribeImageWithGemini(imagePath, options = {}) {
  try {
    const result = await analyzeStaticImage(imagePath, options);
    return { transcription: result.analysis, metadata: result.metadata };
  } catch (error) {
    console.error('❌ Error en transcripción de imagen con Vision AI:', error);
    throw new Error(`Error al transcribir imagen con Vision AI: ${error.message}`);
  }
}

module.exports = {
  transcribeFile,
  detectFileType,
  SUPPORTED_AUDIO_FORMATS,
  SUPPORTED_VIDEO_FORMATS,
  SUPPORTED_IMAGE_FORMATS,
  transcribeImageWithGemini
};
