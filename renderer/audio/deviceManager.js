export async function ensureAudioPermission() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  stream.getTracks().forEach((track) => track.stop());
}

export async function getAudioInputDevices() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((device) => device.kind === 'audioinput');
}

export async function createAudioStream(deviceId) {
  const constraints = {
    audio: {
      deviceId: deviceId ? { exact: deviceId } : undefined,
      noiseSuppression: false,
      echoCancellation: false,
      autoGainControl: false
    }
  };

  return navigator.mediaDevices.getUserMedia(constraints);
}

export function stopStream(stream) {
  if (!stream) return;
  stream.getTracks().forEach((track) => track.stop());
}

export function formatDeviceLabel(device, index) {
  if (device.label) {
    return device.label;
  }

  if (device.deviceId === 'default') {
    return 'Varsayılan Mikrofon';
  }

  return `Mikrofon ${index + 1}`;
}
