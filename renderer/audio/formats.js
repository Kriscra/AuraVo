const FORMAT_CATALOG = [
  {
    id: 'webm',
    label: 'WebM (Opus)',
    extension: 'webm',
    exportMimeType: 'audio/webm',
    recorderMimeTypes: ['audio/webm;codecs=opus', 'audio/webm'],
    requiresConversion: false
  },
  {
    id: 'ogg',
    label: 'Ogg (Opus)',
    extension: 'ogg',
    exportMimeType: 'audio/ogg',
    recorderMimeTypes: ['audio/ogg;codecs=opus', 'audio/ogg'],
    requiresConversion: false
  },
  {
    id: 'wav',
    label: 'WAV (PCM 16-bit)',
    extension: 'wav',
    exportMimeType: 'audio/wav',
    recorderMimeTypes: ['audio/webm;codecs=opus', 'audio/webm'],
    requiresConversion: true
  }
];

function resolveRecorderMimeType(recorderMimeTypes = []) {
  if (typeof MediaRecorder === 'undefined') {
    return undefined;
  }

  return recorderMimeTypes.find((mimeType) => {
    try {
      return MediaRecorder.isTypeSupported(mimeType);
    } catch (error) {
      console.warn('MediaRecorder desteği sorgulanamadı:', error);
      return false;
    }
  });
}

export function getSupportedFormats() {
  return FORMAT_CATALOG.map((format) => {
    const recorderMimeType = resolveRecorderMimeType(format.recorderMimeTypes);
    if (format.recorderMimeTypes?.length && !recorderMimeType) {
      return null;
    }

    return {
      ...format,
      recorderMimeType
    };
  }).filter(Boolean);
}

export function getFormatById(formats, id) {
  return formats.find((format) => format.id === id) ?? formats[0];
}
