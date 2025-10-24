import { GateController } from './gate.js';

export class PCMRecorder {
  constructor(stream, options = {}) {
    this.stream = stream;
    this.options = options;
    this.audioContext = null;
    this.source = null;
    this.processor = null;
    this.sink = null;
    this.gate = new GateController({
      threshold: options.threshold,
      hold: options.hold,
      disabled: options.disabled,
      onLevel: options.onLevel,
      onStateChange: options.onGateChange
    });
    this.channelBuffers = [];
    this.channelCount = 0;
    this.totalSamples = 0;
    this._startedAt = 0;
  }

  async start() {
    if (this.audioContext) {
      await this.audioContext.close();
    }

    this.audioContext = new AudioContext();
    await this.audioContext.resume();

    this.source = this.audioContext.createMediaStreamSource(this.stream);
    this.channelCount = this.source.channelCount || 1;
    this.channelBuffers = Array.from({ length: this.channelCount }, () => []);
    this.totalSamples = 0;

    this.processor = this.audioContext.createScriptProcessor(4096, this.channelCount, this.channelCount);
    this.processor.onaudioprocess = (event) => {
      const input = event.inputBuffer;
      const channelZero = input.getChannelData(0);
      const shouldCapture = this.gate.evaluate(channelZero);

      if (!shouldCapture) {
        return;
      }

      for (let channel = 0; channel < this.channelCount; channel += 1) {
        const channelData = input.getChannelData(channel);
        this.channelBuffers[channel].push(new Float32Array(channelData));
      }

      this.totalSamples += input.length;
    };

    this.sink = this.audioContext.createGain();
    this.sink.gain.value = 0;

    this.source.connect(this.processor);
    this.processor.connect(this.sink);
    this.sink.connect(this.audioContext.destination);
    this._startedAt = performance.now();
  }

  updateOptions({ threshold, hold, disabled }) {
    this.gate.configure({ threshold, hold, disabled });
  }

  async stop() {
    if (!this.audioContext) {
      return null;
    }

    this.processor.disconnect();
    this.source.disconnect();
    if (this.sink) {
      this.sink.disconnect();
      this.sink = null;
    }

    const sampleRate = this.audioContext.sampleRate;
    await this.audioContext.close();
    this.audioContext = null;

    const channels = this.channelBuffers.map((chunks) => {
      const data = new Float32Array(this.totalSamples);
      let offset = 0;
      for (const chunk of chunks) {
        data.set(chunk, offset);
        offset += chunk.length;
      }
      return data;
    });

    const totalSamples = this.totalSamples;
    const duration = totalSamples / sampleRate;

    this.channelBuffers = [];
    this.totalSamples = 0;

    return {
      type: 'pcm',
      sampleRate,
      channels,
      channelCount: this.channelCount,
      totalSamples,
      duration
    };
  }
}
