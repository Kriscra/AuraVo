export class WaveformRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.context = canvas?.getContext ? canvas.getContext('2d') : null;
    this.width = 0;
    this.height = 0;
    this.colors = {
      background: '#0b0914',
      active: '#9c5cff',
      idle: '#2a2441'
    };

    if (this.context && typeof window !== 'undefined') {
      this.refreshColors();
      this.resize();
      window.addEventListener('resize', () => this.resize());
    }
  }

  refreshColors() {
    if (!this.canvas || typeof window === 'undefined') {
      return;
    }
    const styles = window.getComputedStyle(this.canvas);
    this.colors = {
      background: styles.getPropertyValue('--waveform-bg').trim() || '#0b0914',
      active: styles.getPropertyValue('--waveform-active').trim() || '#b793ff',
      idle: styles.getPropertyValue('--waveform-idle').trim() || '#2a2441'
    };
  }

  resize() {
    if (!this.context || !this.canvas) {
      return;
    }

    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    this.canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    this.canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    this.context.setTransform(1, 0, 0, 1, 0, 0);
    this.context.scale(dpr, dpr);

    this.width = rect.width;
    this.height = rect.height;

    this.clear();
  }

  clear() {
    if (!this.context) {
      return;
    }
    this.context.fillStyle = this.colors.background;
    this.context.fillRect(0, 0, this.width, this.height);
  }

  pushFrame(frame, isActive = true) {
    if (!this.context || !frame) {
      return;
    }

    const ctx = this.context;
    const width = this.width;
    const height = this.height;

    if (width <= 0 || height <= 0) {
      return;
    }

    try {
      const imageData = ctx.getImageData(1, 0, width - 1, height);
      ctx.putImageData(imageData, 0, 0);
    } catch (error) {
      this.clear();
    }

    ctx.fillStyle = this.colors.background;
    ctx.fillRect(width - 1, 0, 1, height);

    let min = 1;
    let max = -1;

    for (let i = 0; i < frame.length; i += 1) {
      const value = frame[i];
      if (value < min) {
        min = value;
      }
      if (value > max) {
        max = value;
      }
    }

    const y1 = ((1 - max) * height) / 2;
    const y2 = ((1 - min) * height) / 2;

    ctx.strokeStyle = isActive ? this.colors.active : this.colors.idle;
    ctx.beginPath();
    ctx.moveTo(width - 0.5, y1);
    ctx.lineTo(width - 0.5, y2);
    ctx.stroke();
  }
}
