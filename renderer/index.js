import {
  ensureAudioPermission,
  getAudioInputDevices,
  createAudioStream,
  stopStream,
  formatDeviceLabel
} from './audio/deviceManager.js';
import { AudioRecorder } from './audio/recorder.js';
import { getSupportedFormats, getFormatById } from './audio/formats.js';
import { prepareExport } from './audio/exporter.js';
import { normalizeDecibels } from './audio/levels.js';
import { ui } from './ui/dom.js';
import {
  setStatus,
  setTimerText,
  setTimerHint,
  setRecordButtonState,
  setSaveEnabled,
  updateMeter,
  setThresholdDisplay,
  showPreview,
  clearPreview,
  setError,
  populateDeviceOptions,
  populateFormatOptions
} from './ui/presenter.js';

const TIMER_INTERVAL = 200;

let devices = [];
let formats = [];
let selectedDeviceId = null;
let selectedFormat = null;
let activeStream = null;
let lastRecording = null;
let lastPreviewUrl = null;
let timerHandle = null;
let timerStart = null;

const recorder = new AudioRecorder({
  onLevel: (decibels, gated) => {
    const normalized = normalizeDecibels(decibels);
    updateMeter(normalized, gated);
  },
  onStateChange: (state) => {
    switch (state) {
      case 'recording':
        setStatus('Kayıt Yapılıyor', 'recording');
        break;
      case 'gated':
        setStatus('Gürültü Eşiği Aktif', 'gated');
        break;
      case 'inactive':
        setStatus('Hazır');
        break;
      default:
        break;
    }
  },
  onError: (error) => {
    console.error(error);
    setError('Kayıt sırasında bir hata oluştu: ' + (error?.message || error));
    setStatus('Hata', 'error');
  }
});

function formatTimerValue(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600)
    .toString()
    .padStart(2, '0');
  const minutes = Math.floor((totalSeconds % 3600) / 60)
    .toString()
    .padStart(2, '0');
  const seconds = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) {
    return '00:00';
  }
  const totalSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const secs = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, '0');
  return `${minutes}:${secs}`;
}

function formatSize(bytes) {
  if (!bytes) {
    return '0 KB';
  }
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function generateFileName(extension) {
  const now = new Date();
  const pad = (value) => value.toString().padStart(2, '0');
  const datePart = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const timePart = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `AuraVo-${datePart}-${timePart}.${extension}`;
}

function startTimer() {
  timerStart = Date.now();
  setTimerText('00:00:00');
  setTimerHint('Kaydı durdurmak için tekrar tıklayın');
  timerHandle = setInterval(() => {
    setTimerText(formatTimerValue(Date.now() - timerStart));
  }, TIMER_INTERVAL);
}

function stopTimer() {
  if (timerHandle) {
    clearInterval(timerHandle);
    timerHandle = null;
  }
  setTimerHint('Yeni kayıt için tıklayın');
}

function resetPreview() {
  if (lastPreviewUrl) {
    URL.revokeObjectURL(lastPreviewUrl);
    lastPreviewUrl = null;
  }
  lastRecording = null;
  clearPreview();
  setSaveEnabled(false);
}

function setRecordingControlsDisabled(disabled) {
  ui.deviceSelect.disabled = disabled || devices.length === 0;
  ui.formatSelect.disabled = disabled;
}

async function refreshDevices() {
  try {
    const discovered = await getAudioInputDevices();
    devices = discovered.map((device, index) => ({
      ...device,
      label: formatDeviceLabel(device, index)
    }));

    if (!devices.length) {
      setError('Kullanılabilir mikrofon bulunamadı.');
      ui.deviceSelect.innerHTML = '';
      ui.deviceSelect.disabled = true;
      ui.recordButton.disabled = true;
      resetPreview();
      return;
    }

    ui.recordButton.disabled = false;
    setError('');

    if (!selectedDeviceId || !devices.find((device) => device.deviceId === selectedDeviceId)) {
      selectedDeviceId = devices[0].deviceId;
    }

    populateDeviceOptions(devices, selectedDeviceId);
  } catch (error) {
    console.error(error);
    setError('Mikrofon listesi alınamadı: ' + (error?.message || error));
  }
}

async function initializeFormats() {
  formats = getSupportedFormats();
  if (!formats.length) {
    throw new Error('Desteklenen kayıt formatı bulunamadı.');
  }
  selectedFormat = formats[0];
  recorder.setFormat(selectedFormat);
  populateFormatOptions(formats, selectedFormat.id);
}

function updateSelectedFormat(formatId) {
  selectedFormat = getFormatById(formats, formatId);
  recorder.setFormat(selectedFormat);
}

async function startRecording() {
  setError('');
  resetPreview();
  try {
    setStatus('Mikrofon hazırlanıyor...', 'saving');
    setRecordButtonState(true);
    setRecordingControlsDisabled(true);
    recorder.setThreshold(Number(ui.thresholdSlider.value));

    if (!selectedFormat) {
      throw new Error('Geçerli bir kayıt formatı seçilemedi.');
    }

    activeStream = await createAudioStream(selectedDeviceId);
    await recorder.start(activeStream);
    startTimer();
  } catch (error) {
    console.error(error);
    setRecordButtonState(false);
    setRecordingControlsDisabled(false);
    setStatus('Hata', 'error');
    setError('Kayıt başlatılamadı: ' + (error?.message || error));
    recorder.cancel();
    if (activeStream) {
      stopStream(activeStream);
      activeStream = null;
    }
  }
}

async function stopRecording() {
  try {
    setRecordButtonState(false);
    setStatus('Kayıt işleniyor...', 'saving');
    const result = await recorder.stop();

    if (!result?.blob) {
      setStatus('Hazır');
      return;
    }

    const exportResult = await prepareExport(result.blob, selectedFormat);
    const fileName = generateFileName(selectedFormat.extension);

    if (lastPreviewUrl) {
      URL.revokeObjectURL(lastPreviewUrl);
    }
    const url = URL.createObjectURL(exportResult.blob);
    lastPreviewUrl = url;
    lastRecording = {
      blob: exportResult.blob,
      mimeType: exportResult.mimeType,
      extension: exportResult.extension,
      name: fileName,
      duration: exportResult.duration,
      formatLabel: selectedFormat.label
    };

    showPreview({
      url,
      name: fileName,
      sizeLabel: formatSize(exportResult.blob.size),
      formatLabel: selectedFormat.label,
      durationLabel: formatDuration(exportResult.duration)
    });
    setSaveEnabled(true);
    setStatus('Hazır');
  } catch (error) {
    console.error(error);
    setError('Kayıt durdurulamadı: ' + (error?.message || error));
    setStatus('Hata', 'error');
  } finally {
    stopTimer();
    stopStream(activeStream);
    activeStream = null;
    setRecordingControlsDisabled(false);
    updateMeter(0, false);
  }
}

async function saveRecording() {
  if (!lastRecording) {
    return;
  }

  setSaveEnabled(false);
  setStatus('Kaydediliyor...', 'saving');
  setError('');

  try {
    const arrayBuffer = await lastRecording.blob.arrayBuffer();
    if (!window.electronAPI?.saveAudio) {
      throw new Error('Electron kaydetme köprüsüne erişilemiyor.');
    }

    const result = await window.electronAPI.saveAudio({
      buffer: arrayBuffer,
      extension: lastRecording.extension,
      suggestedName: lastRecording.name,
      mimeType: lastRecording.mimeType
    });

    if (result?.success) {
      setStatus('Kaydedildi');
    } else if (result?.error) {
      throw new Error(result.error);
    } else {
      setStatus('Hazır');
    }
  } catch (error) {
    console.error(error);
    setError('Dosya kaydedilemedi: ' + (error?.message || error));
    setStatus('Hata', 'error');
  } finally {
    setSaveEnabled(Boolean(lastRecording));
  }
}

function setupEventListeners() {
  ui.recordButton.addEventListener('click', () => {
    if (recorder.isActive()) {
      stopRecording();
    } else {
      startRecording();
    }
  });

  ui.saveButton.addEventListener('click', () => {
    saveRecording();
  });

  ui.discardButton.addEventListener('click', () => {
    resetPreview();
    setStatus('Hazır');
  });

  ui.deviceSelect.addEventListener('change', (event) => {
    selectedDeviceId = event.target.value;
  });

  ui.formatSelect.addEventListener('change', (event) => {
    updateSelectedFormat(event.target.value);
  });

  ui.thresholdSlider.addEventListener('input', (event) => {
    const value = Number(event.target.value);
    setThresholdDisplay(value);
    recorder.setThreshold(value);
  });

  if (navigator.mediaDevices?.addEventListener) {
    navigator.mediaDevices.addEventListener('devicechange', () => {
      refreshDevices();
    });
  }

  if (ui.minimizeButton) {
    ui.minimizeButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      window.electronAPI?.minimizeWindow?.();
    });
  }

  if (ui.closeButton) {
    ui.closeButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      window.electronAPI?.closeWindow?.();
    });
  }

  window.addEventListener('beforeunload', () => {
    if (recorder.isActive()) {
      recorder.cancel();
    }
    stopStream(activeStream);
    if (lastPreviewUrl) {
      URL.revokeObjectURL(lastPreviewUrl);
    }
  });
}

async function bootstrap() {
  setStatus('Hazır');
  setTimerText('00:00:00');
  setSaveEnabled(false);
  setThresholdDisplay(Number(ui.thresholdSlider.value));
  recorder.setThreshold(Number(ui.thresholdSlider.value));
  updateMeter(0, false);

  try {
    await ensureAudioPermission();
  } catch (error) {
    console.error(error);
    setError('Mikrofona erişim izni verilmedi.');
    setStatus('Hata', 'error');
    setRecordButtonState(false);
    ui.recordButton.disabled = true;
    return;
  }

  await refreshDevices();
  try {
    await initializeFormats();
  } catch (error) {
    console.error(error);
    setError(error.message);
    setStatus('Hata', 'error');
  }

  setupEventListeners();
}

bootstrap();
