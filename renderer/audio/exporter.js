import { audioBufferToWav } from '../utils/wav.js';
import { trimAudioBuffer } from './trim.js';

async function decodeRecording(arrayBuffer) {
  const audioContext = new AudioContext();
  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    return { audioBuffer, duration: audioBuffer.duration };
  } finally {
    await audioContext.close();
  }
}

async function encodeWithMediaRecorder(audioBuffer, format) {
  if (typeof AudioContext === 'undefined' || typeof MediaRecorder === 'undefined') {
    throw new Error('MediaRecorder desteklenmiyor.');
  }

  const context = new AudioContext({ sampleRate: audioBuffer.sampleRate });
  const destination = context.createMediaStreamDestination();
  const source = context.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(destination);

  const mimeType = format.exportMimeType || format.recorderMimeType || 'audio/webm';
  const recorderOptions = mimeType ? { mimeType } : undefined;
  let recorder;

  try {
    recorder = new MediaRecorder(destination.stream, recorderOptions);
  } catch (error) {
    await context.close();
    throw error;
  }

  const chunks = [];

  return new Promise(async (resolve, reject) => {
    const cleanUp = async () => {
      try {
        source.disconnect();
      } catch (error) {
        console.warn('Kaynak bağlantısı kesilirken hata:', error);
      }
      try {
        destination.disconnect?.();
      } catch (error) {
        console.warn('Hedef bağlantısı kesilirken hata:', error);
      }
      try {
        await context.close();
      } catch (error) {
        console.warn('AudioContext kapatılamadı:', error);
      }
    };

    recorder.addEventListener('dataavailable', (event) => {
      if (event.data?.size) {
        chunks.push(event.data);
      }
    });

    recorder.addEventListener(
      'stop',
      async () => {
        await cleanUp();
        const type = recorder.mimeType || mimeType;
        resolve(new Blob(chunks, { type }));
      },
      { once: true }
    );

    recorder.addEventListener(
      'error',
      async (event) => {
        await cleanUp();
        reject(event.error || event);
      },
      { once: true }
    );

    source.addEventListener(
      'ended',
      () => {
        if (recorder.state !== 'inactive') {
          recorder.stop();
        }
      },
      { once: true }
    );

    try {
      await context.resume();
    } catch (error) {
      console.warn('AudioContext devam ettirilemedi:', error);
    }

    const stopTime = context.currentTime + audioBuffer.duration;
    recorder.start();
    source.start();
    source.stop(stopTime);
  });
}

export async function prepareExport(blob, format, options = {}) {
  if (!format) {
    return {
      blob,
      mimeType: blob.type,
      extension: 'webm',
      duration: null
    };
  }

  const arrayBuffer = await blob.arrayBuffer();
  const { audioBuffer } = await decodeRecording(arrayBuffer);

  let workingBuffer = audioBuffer;
  let workingDuration = audioBuffer.duration;

  if (options.trimSilence) {
    try {
      const trimmed = trimAudioBuffer(audioBuffer, {
        thresholdDb: options.trimThreshold ?? -55,
        paddingMs: options.trimPaddingMs ?? 30
      });
      if (trimmed?.audioBuffer) {
        workingBuffer = trimmed.audioBuffer;
        workingDuration = trimmed.duration;
      }
    } catch (error) {
      console.warn('Sessizlik kırpılırken hata oluştu:', error);
    }
  }

  if (!format.requiresConversion) {
    if (options.trimSilence && workingBuffer !== audioBuffer) {
      try {
        const encodedBlob = await encodeWithMediaRecorder(workingBuffer, format);
        return {
          blob: encodedBlob,
          mimeType: encodedBlob.type || format.exportMimeType || blob.type,
          extension: format.extension,
          duration: workingDuration
        };
      } catch (error) {
        console.warn('Trimlenmiş kayıt kodlanamadı, orijinal kayıt kullanılacak:', error);
      }
    }

    const mimeType = format.exportMimeType || blob.type;
    return {
      blob,
      mimeType,
      extension: format.extension,
      duration: workingDuration
    };
  }

  switch (format.id) {
    case 'wav': {
      const wavBuffer = audioBufferToWav(workingBuffer);
      return {
        blob: new Blob([wavBuffer], { type: format.exportMimeType }),
        mimeType: format.exportMimeType,
        extension: format.extension,
        duration: workingDuration
      };
    }
    default: {
      return {
        blob,
        mimeType: blob.type,
        extension: format.extension,
        duration: workingDuration
      };
    }
  }
}
