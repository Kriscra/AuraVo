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
  setRecordButtonCountdown,
  setSaveEnabled,
  updateMeter,
  setThresholdDisplay,
  setGateHoldDisplay,
  showPreview,
  clearPreview,
  setError,
  populateDeviceOptions,
  populateFormatOptions,
  setFavoriteState,
  renderLibrary
} from './ui/presenter.js';
import { RecordingLibrary } from './state/library.js';
import { WaveformRenderer } from './ui/waveform.js';

const TIMER_INTERVAL = 200;

let devices = [];
let formats = [];
let selectedDeviceId = null;
let selectedFormat = null;
let activeStream = null;
let timerHandle = null;
let timerStart = null;
let countdownController = null;

const waveformRenderer = ui.waveformCanvas ? new WaveformRenderer(ui.waveformCanvas) : null;

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
    updateAuxiliaryControls();
  },
  onError: (error) => {
    console.error(error);
    setError('Kayıt sırasında bir hata oluştu: ' + (error?.message || error));
    setStatus('Hata', 'error');
  },
  onWaveform: (frame, isActive) => {
    waveformRenderer?.pushFrame(frame, isActive);
  }
});

const library = new RecordingLibrary({
  onChange: handleLibraryChange
});

handleLibraryChange({ items: [], selected: null });

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

function formatTimestamp(isoString) {
  if (!isoString) {
    return '';
  }
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const now = new Date();
  const pad = (value) => value.toString().padStart(2, '0');
  const isSameDay = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();
  const dayPart = isSameDay ? 'Bugün' : isYesterday ? 'Dün' : `${pad(date.getDate())}.${pad(date.getMonth() + 1)}`;
  return `${dayPart} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
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

function isCountdownActive() {
  return Boolean(countdownController);
}

function updateAuxiliaryControls() {
  const busy = recorder.isActive() || isCountdownActive();
  if (ui.countdownToggle) {
    ui.countdownToggle.disabled = busy;
  }
  if (ui.countdownSelect) {
    const disabled = !ui.countdownToggle?.checked || busy;
    ui.countdownSelect.disabled = disabled;
  }
  if (ui.autoTrimToggle) {
    ui.autoTrimToggle.disabled = recorder.isActive();
  }
}

function setRecordingControlsDisabled(disabled) {
  ui.deviceSelect.disabled = disabled || devices.length === 0;
  ui.formatSelect.disabled = disabled;
  if (ui.refreshDevicesButton) {
    ui.refreshDevicesButton.disabled = disabled;
  }
  updateAuxiliaryControls();
}

function cancelCountdown() {
  if (countdownController) {
    countdownController.abort();
    countdownController = null;
  }
  setRecordButtonCountdown(null);
  if (!recorder.isActive()) {
    setStatus('Hazır');
    setTimerHint('Kaydı başlatmak için tıklayın');
    setRecordingControlsDisabled(false);
  }
  updateAuxiliaryControls();
}

function delay(ms, signal) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      cleanup();
      resolve(true);
    }, ms);

    const cleanup = () => {
      clearTimeout(timer);
      if (signal) {
        signal.removeEventListener('abort', onAbort);
      }
    };

    const onAbort = () => {
      cleanup();
      resolve(false);
    };

    if (signal) {
      if (signal.aborted) {
        cleanup();
        resolve(false);
      } else {
        signal.addEventListener('abort', onAbort, { once: true });
      }
    }
  });
}

async function runCountdown(seconds) {
  if (seconds <= 0) {
    return true;
  }
  countdownController = new AbortController();
  for (let remaining = seconds; remaining > 0; remaining -= 1) {
    setRecordButtonCountdown(remaining);
    setStatus(`Başlamaya ${remaining} saniye`, 'saving');
    setTimerHint('Geri sayım sürüyor...');
    const completed = await delay(1000, countdownController.signal);
    if (!completed) {
      countdownController = null;
      setRecordButtonCountdown(null);
      setStatus('Hazır');
      setTimerHint('Kaydı başlatmak için tıklayın');
      return false;
    }
  }
  setRecordButtonCountdown(null);
  countdownController = null;
  return true;
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
  if (recorder.isActive() || isCountdownActive()) {
    return;
  }

  setError('');
  setRecordingControlsDisabled(true);

  const countdownSeconds = ui.countdownToggle?.checked
    ? Number(ui.countdownSelect?.value || 0)
    : 0;

  if (countdownSeconds > 0) {
    const proceed = await runCountdown(countdownSeconds);
    if (!proceed) {
      cancelCountdown();
      return;
    }
  }

  try {
    setStatus('Mikrofon hazırlanıyor...', 'saving');
    setRecordButtonState(true);
    waveformRenderer?.clear();
    const threshold = Number(ui.thresholdSlider.value);
    recorder.setThreshold(threshold);
    const holdMs = Number(ui.gateHoldSlider?.value);
    if (Number.isFinite(holdMs)) {
      recorder.setGateHold(holdMs);
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
  if (isCountdownActive()) {
    cancelCountdown();
    return;
  }

  try {
    setRecordButtonState(false);
    setStatus('Kayıt işleniyor...', 'saving');
    const result = await recorder.stop();

    if (!result?.blob) {
      setStatus('Hazır');
      return;
    }

    const trimThreshold = Number(ui.thresholdSlider.value) - 5;
    const exportResult = await prepareExport(result.blob, selectedFormat, {
      trimSilence: Boolean(ui.autoTrimToggle?.checked),
      trimThreshold: Number.isFinite(trimThreshold) ? trimThreshold : -55,
      trimPaddingMs: 40
    });

    const fileName = generateFileName(selectedFormat.extension);
    const url = URL.createObjectURL(exportResult.blob);

    library.add({
      blob: exportResult.blob,
      mimeType: exportResult.mimeType,
      extension: exportResult.extension,
      name: fileName,
      duration: exportResult.duration,
      formatLabel: selectedFormat.label,
      url,
      size: exportResult.blob.size
    });

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
    waveformRenderer?.clear();
  }
}

async function saveRecording(entry = library.getSelected()) {
  if (!entry) {
    return;
  }

  setSaveEnabled(false);
  setStatus('Kaydediliyor...', 'saving');
  setError('');

  try {
    const arrayBuffer = await entry.blob.arrayBuffer();
    if (!window.electronAPI?.saveAudio) {
      throw new Error('Electron kaydetme köprüsüne erişilemiyor.');
    }

    const result = await window.electronAPI.saveAudio({
      buffer: arrayBuffer,
      extension: entry.extension,
      suggestedName: entry.name,
      mimeType: entry.mimeType
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
    setSaveEnabled(Boolean(library.getSelected()));
  }
}

function handleLibraryChange({ items, selected }) {
  const list = items.map((item) => ({
    id: item.id,
    name: item.name,
    durationLabel: formatDuration(item.duration),
    sizeLabel: formatSize(item.size),
    formatLabel: item.formatLabel,
    timestampLabel: formatTimestamp(item.createdAt),
    favorite: item.favorite,
    active: selected?.id === item.id
  }));

  renderLibrary(list);

  const hasSelection = Boolean(selected);
  setSaveEnabled(hasSelection);
  if (ui.favoriteButton) {
    ui.favoriteButton.disabled = !hasSelection;
  }
  if (ui.renameButton) {
    ui.renameButton.disabled = !hasSelection;
  }
  if (ui.exportButton) {
    ui.exportButton.disabled = !hasSelection;
  }
  if (ui.discardButton) {
    ui.discardButton.disabled = !hasSelection;
  }
  if (ui.noteField) {
    ui.noteField.disabled = !hasSelection;
  }

  if (selected) {
    showPreview({
      url: selected.url,
      name: selected.name,
      sizeLabel: formatSize(selected.size),
      formatLabel: selected.formatLabel,
      durationLabel: formatDuration(selected.duration),
      timestampLabel: formatTimestamp(selected.createdAt),
      favorite: selected.favorite,
      note: selected.note
    });
    setFavoriteState(selected.favorite);
  } else {
    clearPreview();
    setFavoriteState(false);
  }
}

function setupEventListeners() {
  ui.recordButton.addEventListener('click', () => {
    if (isCountdownActive()) {
      cancelCountdown();
      return;
    }
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
    library.removeSelected();
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

  if (ui.gateHoldSlider) {
    ui.gateHoldSlider.addEventListener('input', (event) => {
      const value = Number(event.target.value);
      setGateHoldDisplay(value);
      recorder.setGateHold(value);
    });
  }

  if (ui.refreshDevicesButton) {
    ui.refreshDevicesButton.addEventListener('click', () => {
      refreshDevices();
    });
  }

  if (ui.countdownToggle) {
    ui.countdownToggle.addEventListener('change', () => {
      updateAuxiliaryControls();
    });
  }

  if (ui.countdownSelect) {
    ui.countdownSelect.addEventListener('change', () => {
      updateAuxiliaryControls();
    });
  }

  if (ui.autoTrimToggle) {
    ui.autoTrimToggle.addEventListener('change', () => {
      if (!recorder.isActive() && !isCountdownActive()) {
        if (ui.autoTrimToggle.checked) {
          setStatus('Sessizlik kırpma aktif', 'saving');
          setTimeout(() => {
            if (!recorder.isActive() && !isCountdownActive()) {
              setStatus('Hazır');
            }
          }, 800);
        } else {
          setStatus('Hazır');
        }
      }
    });
  }

  if (ui.libraryList) {
    ui.libraryList.addEventListener('click', (event) => {
      const item = event.target.closest('.library-item');
      if (!item) {
        return;
      }
      const { id } = item.dataset;
      library.select(id);
      if (event.detail >= 2) {
        saveRecording();
      }
    });
  }

  if (ui.clearLibraryButton) {
    ui.clearLibraryButton.addEventListener('click', () => {
      if (library.isEmpty()) {
        return;
      }
      const confirmed = window.confirm('Tüm kayıt geçmişini silmek istediğinize emin misiniz?');
      if (confirmed) {
        library.clear();
        setStatus('Hazır');
      }
    });
  }

  if (ui.favoriteButton) {
    ui.favoriteButton.addEventListener('click', () => {
      const selected = library.getSelected();
      if (!selected) {
        return;
      }
      library.toggleFavorite(selected.id);
    });
  }

  if (ui.renameButton) {
    ui.renameButton.addEventListener('click', () => {
      const selected = library.getSelected();
      if (!selected) {
        return;
      }
      const name = window.prompt('Kayıt adını düzenle', selected.name);
      if (!name) {
        return;
      }
      const trimmed = name.trim();
      if (!trimmed || trimmed === selected.name) {
        return;
      }
      library.update(selected.id, { name: trimmed });
    });
  }

  if (ui.exportButton) {
    ui.exportButton.addEventListener('click', () => {
      saveRecording();
    });
  }

  if (ui.noteField) {
    ui.noteField.addEventListener('input', (event) => {
      const selected = library.getSelected();
      if (!selected) {
        return;
      }
      library.update(selected.id, { note: event.target.value });
    });
  }

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

  window.addEventListener('keydown', (event) => {
    if (event.repeat) {
      return;
    }
    const target = event.target;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
      return;
    }

    if (event.code === 'Space') {
      event.preventDefault();
      if (recorder.isActive() || isCountdownActive()) {
        stopRecording();
      } else {
        startRecording();
      }
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      saveRecording();
    }

    if (event.key === 'Delete') {
      event.preventDefault();
      library.removeSelected();
      setStatus('Hazır');
    }
  });

  window.addEventListener('beforeunload', () => {
    if (recorder.isActive()) {
      recorder.cancel();
    }
    cancelCountdown();
    stopStream(activeStream);
    library.clear();
  });
}

async function bootstrap() {
  setStatus('Hazır');
  setTimerText('00:00:00');
  setSaveEnabled(false);
  setThresholdDisplay(Number(ui.thresholdSlider.value));
  recorder.setThreshold(Number(ui.thresholdSlider.value));
  if (ui.gateHoldSlider) {
    setGateHoldDisplay(Number(ui.gateHoldSlider.value));
    recorder.setGateHold(Number(ui.gateHoldSlider.value));
  }
  updateMeter(0, false);
  updateAuxiliaryControls();
  waveformRenderer?.clear();

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
