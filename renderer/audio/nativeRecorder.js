import { GateController } from './gate.js';

export class NativeRecorder {
  constructor(stream, options = {}) {
    this.stream = stream;
    this.mimeType = options.mimeType;
    this.options = options;
    this.mediaRecorder = null;
    this.chunks = [];
    this.audioContext = null;
    this.source = null;
    this.processor = null;
    this._stopResolver = null;
    this._stopPromise = null;
    this._gateOpenedAt = null;
    this._activeDuration = 0;

    const { onGateChange } = options;

    this.gate = new GateController({
      threshold: options.threshold,
      hold: options.hold,
      disabled: options.disabled,
      onLevel: options.onLevel,
      onStateChange: (isOpen) => {
        this._handleGateState(isOpen);
        if (onGateChange) {
          onGateChange(isOpen);
        }
      }
    });
  }

  async start() {
    this._gateOpenedAt = null;
    this._activeDuration = 0;
    this._stopPromise = null;
    this._stopResolver = null;

    this.audioContext = new AudioContext();
    await this.audioContext.resume();

    this.source = this.audioContext.createMediaStreamSource(this.stream);
    this.processor = this.audioContext.createScriptProcessor(2048, this.source.channelCount, this.source.channelCount);

    const silentGain = this.audioContext.createGain();
    silentGain.gain.value = 0;

    this.processor.onaudioprocess = (event) => {
      const samples = event.inputBuffer.getChannelData(0);
      const open = this.gate.evaluate(samples);

      if (!this.mediaRecorder) {
        return;
      }

      if (open && this.mediaRecorder.state === 'paused') {
        try {
          this.mediaRecorder.resume();
        } catch (error) {
          console.warn('Failed to resume MediaRecorder', error);
        }
      }

      if (!open && this.mediaRecorder.state === 'recording') {
        try {
          this.mediaRecorder.requestData();
          this.mediaRecorder.pause();
        } catch (error) {
          console.warn('Failed to pause MediaRecorder', error);
        }
      }
    };

    this.source.connect(this.processor);
    this.processor.connect(silentGain);
    silentGain.connect(this.audioContext.destination);

    this.mediaRecorder = new MediaRecorder(this.stream, this.mimeType ? { mimeType: this.mimeType } : undefined);
    this.chunks = [];

    this._stopPromise = new Promise((resolve) => {
      this._stopResolver = resolve;
    });

    this.mediaRecorder.addEventListener('dataavailable', (event) => {
      if (event.data && event.data.size > 0) {
        this.chunks.push(event.data);
      }
    });

    this.mediaRecorder.addEventListener('stop', () => {
      this._finalizeGate();
      if (this._stopResolver) {
        this._stopResolver();
        this._stopResolver = null;
      }
    });

    this.mediaRecorder.start(1000);
  }

  updateOptions({ threshold, hold, disabled }) {
    this.gate.configure({ threshold, hold, disabled });
  }

  async stop() {
    if (!this.mediaRecorder) {
      return null;
    }

    if (this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.requestData();
      this.mediaRecorder.stop();
    } else if (this.mediaRecorder.state === 'paused') {
      this.mediaRecorder.stop();
    }

    if (this._stopPromise) {
      await this._stopPromise;
    }

    this.processor.disconnect();
    this.source.disconnect();
    await this.audioContext.close();

    const blob = new Blob(this.chunks, { type: this.mediaRecorder.mimeType || this.mimeType });
    const duration = this._activeDuration / 1000;

    this.mediaRecorder = null;
    this.audioContext = null;
    this.processor = null;
    this.source = null;
    this.chunks = [];
    this._activeDuration = 0;
    this._stopPromise = null;
    this._stopResolver = null;

    return {
      type: 'native',
      blob,
      duration,
      mimeType: blob.type
    };
  }

  _handleGateState(isOpen) {
    const now = performance.now();
    if (isOpen) {
      if (!this._gateOpenedAt) {
        this._gateOpenedAt = now;
      }
    } else if (this._gateOpenedAt) {
      this._activeDuration += now - this._gateOpenedAt;
      this._gateOpenedAt = null;
    }
  }

  _finalizeGate() {
    if (this._gateOpenedAt) {
      this._activeDuration += performance.now() - this._gateOpenedAt;
      this._gateOpenedAt = null;
    }
  }
}
