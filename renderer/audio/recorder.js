import { PCMRecorder } from './pcmRecorder.js';
import { NativeRecorder } from './nativeRecorder.js';
import { encodeWav } from './encoders/wav.js';
import { findFormat } from './formats.js';

export async function listInputDevices() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((device) => device.kind === 'audioinput');
}

export class Recorder {
  constructor() {
    this.stream = null;
    this.engine = null;
    this.format = null;
  }

  async start(options) {
    const {
      formatId,
      deviceId,
      threshold,
      hold,
      bypassGate,
      onLevel,
      onGateChange
    } = options;

    this.format = findFormat(formatId);
    if (!this.format) {
      throw new Error(`Format bulunamadı: ${formatId}`);
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Tarayıcı medya cihazlarını desteklemiyor');
    }

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        echoCancellation: false,
        noiseSuppression: false
      }
    });

    const gateOptions = {
      threshold,
      hold,
      disabled: bypassGate,
      onLevel,
      onGateChange
    };

    if (this.format.type === 'pcm') {
      this.engine = new PCMRecorder(this.stream, gateOptions);
    } else {
      this.engine = new NativeRecorder(this.stream, {
        ...gateOptions,
        mimeType: this.format.mimeType
      });
    }

    try {
      await this.engine.start();
    } catch (error) {
      if (this.stream) {
        for (const track of this.stream.getTracks()) {
          track.stop();
        }
      }
      this.stream = null;
      this.engine = null;
      throw error;
    }
  }

  updateGate(options) {
    if (!this.engine) {
      return;
    }

    this.engine.updateOptions({
      threshold: options.threshold,
      hold: options.hold,
      disabled: options.bypassGate
    });
  }

  async stop() {
    if (!this.engine) {
      return null;
    }

    const result = await this.engine.stop();

    if (this.stream) {
      for (const track of this.stream.getTracks()) {
        track.stop();
      }
      this.stream = null;
    }

    const finalized = await this._finalizeRecording(result);
    this.engine = null;
    this.format = null;
    return finalized;
  }

  async _finalizeRecording(result) {
    if (!result) {
      return null;
    }

    if (result.type === 'pcm') {
      const buffer = encodeWav({
        sampleRate: result.sampleRate,
        channels: result.channels
      });
      const blob = new Blob([buffer], { type: 'audio/wav' });
      return {
        blob,
        duration: result.duration,
        extension: this.format.extension || 'wav',
        mimeType: 'audio/wav'
      };
    }

    return {
      blob: result.blob,
      duration: result.duration,
      extension: this.format.extension,
      mimeType: result.mimeType || this.format.mimeType
    };
  }
}
