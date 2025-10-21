import { audioBufferToWav } from '../utils/wav.js';

async function decodeRecording(arrayBuffer) {
  const audioContext = new AudioContext();
  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    return { audioBuffer, duration: audioBuffer.duration };
  } finally {
    await audioContext.close();
  }
}

export async function prepareExport(blob, format) {
  if (!format) {
    return {
      blob,
      mimeType: blob.type,
      extension: 'webm',
      duration: null
    };
  }

  const arrayBuffer = await blob.arrayBuffer();
  const { audioBuffer, duration } = await decodeRecording(arrayBuffer);

  if (!format.requiresConversion) {
    const mimeType = format.exportMimeType || blob.type;
    return {
      blob,
      mimeType,
      extension: format.extension,
      duration
    };
  }

  switch (format.id) {
    case 'wav': {
      const wavBuffer = audioBufferToWav(audioBuffer);
      return {
        blob: new Blob([wavBuffer], { type: format.exportMimeType }),
        mimeType: format.exportMimeType,
        extension: format.extension,
        duration
      };
    }
    default: {
      return {
        blob,
        mimeType: blob.type,
        extension: format.extension,
        duration
      };
    }
  }
}
