function floatTo16BitPCM(float32Array) {
  const out = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, float32Array[i]));
    out[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return out;
}

function interleaveChannels(channels) {
  const converted = channels.map((buffer) => floatTo16BitPCM(buffer));

  if (converted.length === 1) {
    return converted[0];
  }

  const length = converted[0].length;
  const channelCount = converted.length;
  const interleaved = new Int16Array(length * channelCount);
  for (let i = 0; i < length; i += 1) {
    for (let channel = 0; channel < channelCount; channel += 1) {
      interleaved[i * channelCount + channel] = converted[channel][i];
    }
  }
  return interleaved;
}

export function encodeWav({ sampleRate, channels }) {
  const channelCount = channels.length;
  const interleaved = interleaveChannels(channels);
  const blockAlign = channelCount * 2;
  const byteRate = sampleRate * blockAlign;
  const buffer = new ArrayBuffer(44 + interleaved.length * 2);
  const view = new DataView(buffer);

  // RIFF identifier
  writeString(view, 0, 'RIFF');
  // RIFF chunk length
  view.setUint32(4, 36 + interleaved.length * 2, true);
  // RIFF type
  writeString(view, 8, 'WAVE');
  // format chunk identifier
  writeString(view, 12, 'fmt ');
  // format chunk length
  view.setUint32(16, 16, true);
  // sample format (raw)
  view.setUint16(20, 1, true);
  // channel count
  view.setUint16(22, channelCount, true);
  // sample rate
  view.setUint32(24, sampleRate, true);
  // byte rate (sample rate * block align)
  view.setUint32(28, byteRate, true);
  // block align (channel count * bytes per sample)
  view.setUint16(32, blockAlign, true);
  // bits per sample
  view.setUint16(34, 16, true);
  // data chunk identifier
  writeString(view, 36, 'data');
  // data chunk length
  view.setUint32(40, interleaved.length * 2, true);

  const pcmData = new Int16Array(buffer, 44);
  pcmData.set(interleaved);

  return buffer;
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i += 1) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
