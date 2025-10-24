const FORMAT_DEFINITIONS = [
  {
    id: 'wav-pcm',
    label: 'WAV (PCM 16-bit)',
    type: 'pcm',
    extension: 'wav',
    description: 'Tüm platformlarda desteklenen 16-bit PCM çıktı'
  },
  {
    id: 'webm-opus',
    label: 'WebM (Opus)',
    type: 'native',
    mimeType: 'audio/webm;codecs=opus',
    extension: 'webm',
    description: 'Chromium tabanlı ortamlarda yüksek verimli kayıt'
  },
  {
    id: 'ogg-opus',
    label: 'Ogg (Opus)',
    type: 'native',
    mimeType: 'audio/ogg;codecs=opus',
    extension: 'ogg',
    description: 'Mozilla tabanlı ortamlarda yaygın destek'
  },
  {
    id: 'mp3-native',
    label: 'MP3 (Deneysel)',
    type: 'native',
    mimeType: 'audio/mpeg',
    extension: 'mp3',
    description: 'Platform destekliyorsa yerel MediaRecorder ile MP3'
  }
];

export function getAllFormats() {
  return [...FORMAT_DEFINITIONS];
}

export function resolveSupportedFormats() {
  if (typeof MediaRecorder === 'undefined') {
    return FORMAT_DEFINITIONS.filter((format) => format.type === 'pcm');
  }

  return FORMAT_DEFINITIONS.filter((format) => {
    if (format.type === 'pcm') {
      return true;
    }

    if (!format.mimeType) {
      return false;
    }

    try {
      return MediaRecorder.isTypeSupported(format.mimeType);
    } catch (error) {
      console.warn('MediaRecorder desteği doğrulanamadı:', error);
      return false;
    }
  });
}

export function findFormat(id) {
  return FORMAT_DEFINITIONS.find((format) => format.id === id);
}
