function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i += 1) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function interleave(buffer) {
  const channels = [];
  for (let i = 0; i < buffer.numberOfChannels; i += 1) {
    channels.push(buffer.getChannelData(i));
  }

  if (channels.length === 1) {
    return channels[0];
  }

  const length = buffer.length * channels.length;
  const result = new Float32Array(length);
  let index = 0;

  for (let i = 0; i < buffer.length; i += 1) {
    for (let channel = 0; channel < channels.length; channel += 1) {
      result[index] = channels[channel][i];
      index += 1;
    }
  }

  return result;
}

function floatTo16BitPCM(view, offset, input) {
  for (let i = 0; i < input.length; i += 1, offset += 2) {
    let sample = input[i];
    sample = Math.max(-1, Math.min(1, sample));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }
}

export function audioBufferToWav(buffer) {
  const numberOfChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bytesPerSample = 2;
  const blockAlign = numberOfChannels * bytesPerSample;
  const interleaved = interleave(buffer);
  const bufferLength = interleaved.length * bytesPerSample;
  const wavBuffer = new ArrayBuffer(44 + bufferLength);
  const view = new DataView(wavBuffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + bufferLength, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // chunk size
  view.setUint16(20, 1, true); // audio format PCM
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bytesPerSample * 8, true);
  writeString(view, 36, 'data');
  view.setUint32(40, bufferLength, true);

  floatTo16BitPCM(view, 44, interleaved);

  return wavBuffer;
}
