export class GateController {
  constructor({ threshold = -45, hold = 300, disabled = false, onLevel, onStateChange } = {}) {
    this.threshold = threshold;
    this.hold = hold;
    this.disabled = disabled;
    this.onLevel = onLevel;
    this.onStateChange = onStateChange;
    this.isOpen = false;
    this._lastAboveThreshold = 0;
  }

  configure({ threshold, hold, disabled }) {
    if (typeof threshold === 'number') {
      this.threshold = threshold;
    }
    if (typeof hold === 'number') {
      this.hold = hold;
    }
    if (typeof disabled === 'boolean') {
      this.disabled = disabled;
      if (this.disabled && !this.isOpen) {
        this._updateState(true);
      }
    }
  }

  evaluate(channelSamples) {
    if (!channelSamples || channelSamples.length === 0) {
      return this.isOpen;
    }

    let sumSquares = 0;
    for (let i = 0; i < channelSamples.length; i += 1) {
      const value = channelSamples[i];
      sumSquares += value * value;
    }
    const rms = Math.sqrt(sumSquares / channelSamples.length);
    const levelDb = rms > 0 ? 20 * Math.log10(rms) : -Infinity;

    if (this.onLevel) {
      this.onLevel(levelDb);
    }

    if (this.disabled) {
      this._updateState(true);
      return true;
    }

    const now = performance.now();
    let shouldOpen = this.isOpen;

    if (levelDb >= this.threshold) {
      this._lastAboveThreshold = now;
      shouldOpen = true;
    } else if (this.isOpen) {
      if (now - this._lastAboveThreshold > this.hold) {
        shouldOpen = false;
      } else {
        shouldOpen = true;
      }
    } else {
      shouldOpen = false;
    }

    this._updateState(shouldOpen);
    return this.isOpen;
  }

  _updateState(nextState) {
    if (nextState !== this.isOpen) {
      this.isOpen = nextState;
      if (this.onStateChange) {
        this.onStateChange(this.isOpen);
      }
    }
  }
}
