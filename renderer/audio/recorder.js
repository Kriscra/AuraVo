import { computeDecibels } from './levels.js';

export class AudioRecorder {
  constructor({ onLevel, onStateChange, onError, onWaveform } = {}) {
    this.onLevel = onLevel;
    this.onStateChange = onStateChange;
    this.onError = onError;
    this.onWaveform = onWaveform;

    this.thresholdDb = -50;
    this.gateHoldMs = 280;

    this.mediaRecorder = null;
    this.stream = null;
    this.chunks = [];
    this.audioContext = null;
    this.analyser = null;
    this.levelBuffer = null;
    this.sourceNode = null;
    this.animationFrame = null;
    this.isGateClosed = false;
    this.belowThresholdDuration = 0;
    this.lastGateTimestamp = null;
    this.lastDecibel = -100;
    this.startedAt = null;
    this.currentFormat = null;
  }

  setFormat(format) {
    this.currentFormat = format;
  }

  setThreshold(decibels) {
    this.thresholdDb = decibels;
    this.applyGate(this.lastDecibel, performance.now());
  }

  setGateHold(milliseconds) {
    if (Number.isFinite(milliseconds) && milliseconds >= 0) {
      this.gateHoldMs = milliseconds;
    }
  }

  isActive() {
    return Boolean(this.mediaRecorder && this.mediaRecorder.state !== 'inactive');
  }

  async start(stream) {
    if (this.isActive()) {
      throw new Error('Kayıt zaten devam ediyor.');
    }

    this.stream = stream;
    this.startedAt = performance.now();
    this.chunks = [];
    this.isGateClosed = false;
    this.belowThresholdDuration = 0;
    this.lastGateTimestamp = null;

    await this.setupAudioAnalysis(stream);

    const options = this.currentFormat?.recorderMimeType
      ? { mimeType: this.currentFormat.recorderMimeType }
      : undefined;

    try {
      this.mediaRecorder = new MediaRecorder(stream, options);
    } catch (error) {
      this.handleError(error);
      throw error;
    }

    this.mediaRecorder.addEventListener('dataavailable', (event) => {
      if (event.data?.size) {
        this.chunks.push(event.data);
      }
    });

    this.mediaRecorder.addEventListener('pause', () => {
      this.onStateChange?.('gated');
    });

    this.mediaRecorder.addEventListener('resume', () => {
      this.onStateChange?.('recording');
    });

    this.mediaRecorder.addEventListener('error', (event) => {
      const error = event?.error ?? event;
      this.handleError(error);
    });

    this.mediaRecorder.start(250);
    this.onStateChange?.('recording');
    this.startLevelLoop();
  }

  async stop() {
    if (!this.mediaRecorder) {
      return null;
    }

    const recorder = this.mediaRecorder;

    const resultPromise = new Promise((resolve) => {
      recorder.addEventListener(
        'stop',
        async () => {
          try {
            await this.teardownAudioAnalysis();
          } finally {
            const mimeType =
              recorder.mimeType || this.currentFormat?.recorderMimeType || 'audio/webm';
            const blob = new Blob(this.chunks, { type: mimeType });
            this.cleanup();
            resolve({
              blob,
              mimeType
            });
          }
        },
        { once: true }
      );
    });

    recorder.stop();
    this.onStateChange?.('inactive');
    return resultPromise;
  }

  cancel() {
    if (!this.mediaRecorder) {
      return;
    }
    try {
      this.mediaRecorder.stop();
    } catch (error) {
      console.warn('Kayıt durdurulurken hata oluştu:', error);
    }
    this.cleanup();
  }

  async setupAudioAnalysis(stream) {
    this.audioContext = new AudioContext();
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 2048;
    this.levelBuffer = new Float32Array(this.analyser.fftSize);

    this.sourceNode = this.audioContext.createMediaStreamSource(stream);
    this.sourceNode.connect(this.analyser);
  }

  async teardownAudioAnalysis() {
    this.stopLevelLoop();
    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch (error) {
        console.warn('Kaynak bağlantısı kesilirken hata oluştu:', error);
      }
    }
    this.sourceNode = null;

    if (this.audioContext) {
      try {
        await this.audioContext.close();
      } catch (error) {
        console.warn('AudioContext kapatılırken hata oluştu:', error);
      }
    }
    this.audioContext = null;
    this.analyser = null;
    this.levelBuffer = null;
  }

  startLevelLoop() {
    const loop = (timestamp) => {
      if (!this.analyser || !this.levelBuffer) {
        return;
      }

      this.analyser.getFloatTimeDomainData(this.levelBuffer);
      const decibels = computeDecibels(this.levelBuffer);
      this.lastDecibel = decibels;

      this.applyGate(decibels, timestamp);
      this.onLevel?.(decibels, this.isGateClosed);
      if (this.onWaveform) {
        const copy = Float32Array.from(this.levelBuffer);
        const isActive = !this.isGateClosed && this.mediaRecorder?.state === 'recording';
        this.onWaveform(copy, isActive);
      }

      this.animationFrame = requestAnimationFrame(loop);
    };

    this.animationFrame = requestAnimationFrame(loop);
  }

  stopLevelLoop() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  applyGate(decibels, timestamp = performance.now()) {
    if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
      this.belowThresholdDuration = 0;
      this.isGateClosed = false;
      this.lastGateTimestamp = timestamp;
      return;
    }

    if (this.thresholdDb <= -90) {
      if (this.isGateClosed && this.mediaRecorder.state === 'paused') {
        try {
          this.mediaRecorder.resume();
        } catch (error) {
          console.warn('Kayıt devam ettirilemedi:', error);
        }
      }
      this.isGateClosed = false;
      this.belowThresholdDuration = 0;
      this.lastGateTimestamp = timestamp;
      return;
    }

    if (!this.lastGateTimestamp) {
      this.lastGateTimestamp = timestamp;
    }

    const delta = timestamp - this.lastGateTimestamp;
    this.lastGateTimestamp = timestamp;

    if (decibels < this.thresholdDb) {
      this.belowThresholdDuration += delta;
      if (!this.isGateClosed && this.belowThresholdDuration >= this.gateHoldMs) {
        if (this.mediaRecorder.state === 'recording') {
          try {
            this.mediaRecorder.pause();
            this.isGateClosed = true;
            this.onStateChange?.('gated');
          } catch (error) {
            this.handleError(error);
          }
        }
      }
    } else {
      this.belowThresholdDuration = 0;
      if (this.isGateClosed && this.mediaRecorder.state === 'paused') {
        try {
          this.mediaRecorder.resume();
        } catch (error) {
          this.handleError(error);
        }
      }
      this.isGateClosed = false;
    }
  }

  handleError(error) {
    console.error('Kayıt hatası:', error);
    this.onError?.(error);
  }

  cleanup() {
    this.stopLevelLoop();

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
    }

    this.stream = null;
    this.mediaRecorder = null;
    this.chunks = [];
    this.startedAt = null;
    this.isGateClosed = false;
    this.belowThresholdDuration = 0;
    this.lastGateTimestamp = null;
  }
}
