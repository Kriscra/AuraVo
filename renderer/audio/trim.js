function createTrimmedBuffer(sourceBuffer, startSample, endSample) {
  const length = Math.max(0, endSample - startSample);
  const trimmedBuffer = new AudioBuffer({
    length,
    numberOfChannels: sourceBuffer.numberOfChannels,
    sampleRate: sourceBuffer.sampleRate
  });

  for (let channel = 0; channel < sourceBuffer.numberOfChannels; channel += 1) {
    const channelData = sourceBuffer.getChannelData(channel).subarray(startSample, endSample);
    trimmedBuffer.copyToChannel(channelData, channel, 0);
  }

  return trimmedBuffer;
}

function amplitudeFromDecibels(decibels) {
  return Math.pow(10, decibels / 20);
}

export function trimAudioBuffer(audioBuffer, { thresholdDb = -55, paddingMs = 30 } = {}) {
  if (!audioBuffer) {
    return null;
  }

  if (thresholdDb <= -90) {
    return {
      audioBuffer,
      duration: audioBuffer.duration,
      startSample: 0,
      endSample: audioBuffer.length
    };
  }

  const amplitudeThreshold = amplitudeFromDecibels(thresholdDb);
  const channelCount = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const length = audioBuffer.length;
  const paddingSamples = Math.floor((paddingMs / 1000) * sampleRate);

  let startSample = 0;
  let endSample = length - 1;

  const channelData = [];
  for (let i = 0; i < channelCount; i += 1) {
    channelData.push(audioBuffer.getChannelData(i));
  }

  const getPeakAtSample = (sampleIndex) => {
    let peak = 0;
    for (let channel = 0; channel < channelCount; channel += 1) {
      const value = Math.abs(channelData[channel][sampleIndex]);
      if (value > peak) {
        peak = value;
      }
    }
    return peak;
  };

  while (startSample < length) {
    if (getPeakAtSample(startSample) > amplitudeThreshold) {
      break;
    }
    startSample += 1;
  }

  while (endSample > startSample) {
    if (getPeakAtSample(endSample) > amplitudeThreshold) {
      break;
    }
    endSample -= 1;
  }

  if (startSample <= 0 && endSample >= length - 1) {
    return {
      audioBuffer,
      duration: audioBuffer.duration,
      startSample: 0,
      endSample: audioBuffer.length
    };
  }

  const paddedStart = Math.max(0, startSample - paddingSamples);
  const paddedEnd = Math.min(length, endSample + paddingSamples);

  const trimmedBuffer = createTrimmedBuffer(audioBuffer, paddedStart, paddedEnd);
  return {
    audioBuffer: trimmedBuffer,
    duration: trimmedBuffer.duration,
    startSample: paddedStart,
    endSample: paddedEnd
  };
}
