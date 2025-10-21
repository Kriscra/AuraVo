import { ui } from './dom.js';

const STATUS_STATES = ['recording', 'saving', 'error', 'gated'];

export function setStatus(text, state = 'idle') {
  ui.statusPill.textContent = text;
  ui.statusPill.classList.remove(...STATUS_STATES);
  if (state !== 'idle') {
    ui.statusPill.classList.add(state);
  }
}

export function setTimerText(value) {
  ui.timer.textContent = value;
}

export function setTimerHint(value) {
  ui.timerHint.textContent = value;
}

export function setRecordButtonState(isRecording) {
  ui.recordButton.classList.toggle('recording', isRecording);
  ui.recordButton.querySelector('.button-label').textContent = isRecording
    ? 'Kaydı Durdur'
    : 'Kaydı Başlat';
}

export function setSaveEnabled(enabled) {
  ui.saveButton.disabled = !enabled;
}

export function updateMeter(normalizedLevel, gated) {
  ui.meterFill.style.transform = `scaleX(${normalizedLevel})`;
  ui.meter.classList.toggle('gated', gated);
}

export function setThresholdDisplay(value) {
  ui.thresholdValue.textContent = `${Math.round(value)} dB`;
}

export function showPreview({ url, name, sizeLabel, formatLabel, durationLabel }) {
  ui.preview.classList.remove('hidden');
  ui.emptyState.classList.add('hidden');
  ui.audioPlayer.src = url;
  ui.recordingName.textContent = name;
  ui.recordingSize.textContent = sizeLabel;
  ui.recordingFormat.textContent = formatLabel;
  ui.recordingDuration.textContent = durationLabel;
}

export function clearPreview() {
  ui.preview.classList.add('hidden');
  ui.emptyState.classList.remove('hidden');
  ui.audioPlayer.pause();
  ui.audioPlayer.src = '';
  ui.recordingName.textContent = 'AuraVo-kayit.wav';
  ui.recordingSize.textContent = '0 KB';
  ui.recordingFormat.textContent = '';
  ui.recordingDuration.textContent = '00:00';
}

export function setError(message = '') {
  ui.errorMessage.textContent = message;
}

export function populateDeviceOptions(devices, selectedId) {
  ui.deviceSelect.innerHTML = '';
  devices.forEach((device) => {
    const option = document.createElement('option');
    option.value = device.deviceId;
    option.textContent = device.label;
    option.selected = device.deviceId === selectedId;
    ui.deviceSelect.appendChild(option);
  });
  ui.deviceSelect.disabled = devices.length === 0;
}

export function populateFormatOptions(formats, selectedId) {
  ui.formatSelect.innerHTML = '';
  formats.forEach((format) => {
    const option = document.createElement('option');
    option.value = format.id;
    option.textContent = format.label;
    option.selected = format.id === selectedId;
    ui.formatSelect.appendChild(option);
  });
}
