import { Recorder, listInputDevices } from './audio/recorder.js';
import { resolveSupportedFormats, findFormat } from './audio/formats.js';

const elements = {
  fileName: document.getElementById('file-name'),
  format: document.getElementById('format'),
  device: document.getElementById('device'),
  refreshDevices: document.getElementById('refresh-devices'),
  threshold: document.getElementById('threshold'),
  thresholdValue: document.getElementById('threshold-value'),
  hold: document.getElementById('hold'),
  holdValue: document.getElementById('hold-value'),
  captureSilence: document.getElementById('capture-silence'),
  start: document.getElementById('start'),
  stop: document.getElementById('stop'),
  gateIndicator: document.getElementById('gate-indicator'),
  levelBar: document.getElementById('level-bar'),
  levelValue: document.getElementById('level-value'),
  duration: document.getElementById('duration'),
  list: document.getElementById('recording-list'),
  template: document.getElementById('recording-template'),
  importButton: document.getElementById('import-audio')
};

const recorder = new Recorder();

function getMimeForExtension(extension) {
  const map = {
    wav: 'audio/wav',
    mp3: 'audio/mpeg',
    ogg: 'audio/ogg',
    webm: 'audio/webm',
    m4a: 'audio/mp4',
    aac: 'audio/aac',
    flac: 'audio/flac'
  };

  return map[extension] || `audio/${extension}`;
}

const sessionState = {
  threshold: Number(elements.threshold.value),
  hold: Number(elements.hold.value),
  bypassGate: false,
  gateOpen: false,
  gateOpenedAt: null,
  activeDuration: 0,
  durationTimer: null,
  recordings: [],
  activeFormatId: null,
  baseName: 'kayıt',
  availableFormats: []
};

function formatDuration(ms) {
  const totalSeconds = Math.max(ms / 1000, 0);
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, '0');
  const tenths = Math.floor((totalSeconds * 10) % 10);
  return `${minutes}:${seconds}.${tenths}`;
}

function updateThresholdDisplay() {
  elements.thresholdValue.textContent = `${sessionState.threshold} dB`;
}

function updateHoldDisplay() {
  elements.holdValue.textContent = `${sessionState.hold} ms`;
}

function updateLevel(db) {
  const clamped = Math.max(-90, Math.min(db, 0));
  const percentage = ((clamped + 90) / 90) * 100;
  elements.levelBar.style.width = `${percentage}%`;
  elements.levelValue.textContent = Number.isFinite(db) ? `${db.toFixed(1)} dB` : '-∞ dB';
}

function updateGateIndicator(isOpen) {
  sessionState.gateOpen = isOpen;
  if (isOpen) {
    if (!sessionState.gateOpenedAt) {
      sessionState.gateOpenedAt = performance.now();
    }
    elements.gateIndicator.classList.add('open');
    elements.gateIndicator.textContent = 'Kapı Açık';
  } else {
    if (sessionState.gateOpenedAt) {
      sessionState.activeDuration += performance.now() - sessionState.gateOpenedAt;
      sessionState.gateOpenedAt = null;
    }
    elements.gateIndicator.classList.remove('open');
    elements.gateIndicator.textContent = 'Kapı Kapalı';
  }
}

function startDurationTimer() {
  stopDurationTimer();
  sessionState.durationTimer = setInterval(() => {
    let total = sessionState.activeDuration;
    if (sessionState.gateOpen && sessionState.gateOpenedAt) {
      total += performance.now() - sessionState.gateOpenedAt;
    }
    elements.duration.textContent = formatDuration(total);
  }, 100);
}

function stopDurationTimer() {
  if (sessionState.durationTimer) {
    clearInterval(sessionState.durationTimer);
    sessionState.durationTimer = null;
  }
}

function resetDurationDisplay() {
  sessionState.activeDuration = 0;
  sessionState.gateOpenedAt = null;
  sessionState.gateOpen = false;
  elements.duration.textContent = formatDuration(0);
}

function setRecordingUI(active) {
  elements.start.disabled = active;
  elements.stop.disabled = !active;
  elements.format.disabled = active;
  elements.device.disabled = active;
  elements.refreshDevices.disabled = active;
}

async function populateFormats() {
  const supported = resolveSupportedFormats();
  sessionState.availableFormats = supported;
  elements.format.innerHTML = '';
  for (const format of supported) {
    const option = document.createElement('option');
    option.value = format.id;
    option.textContent = `${format.label}`;
    if (format.type !== 'pcm' && !format.mimeType) {
      option.disabled = true;
    }
    elements.format.appendChild(option);
  }
  if (supported.length > 0) {
    elements.format.value = supported[0].id;
  }
}

async function ensureDeviceAccess() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
  } catch (error) {
    console.error('Mikrofon erişimi alınamadı', error);
    throw error;
  }
}

async function populateDevices() {
  const devices = await listInputDevices();
  elements.device.innerHTML = '';

  if (devices.length === 0) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'Cihaz bulunamadı';
    elements.device.appendChild(option);
    elements.device.disabled = true;
    return;
  }

  for (const device of devices) {
    const option = document.createElement('option');
    option.value = device.deviceId;
    option.textContent = device.label || `Mikrofon ${elements.device.length + 1}`;
    elements.device.appendChild(option);
  }

  elements.device.disabled = false;
}

function buildRecordingItem(recording) {
  const clone = elements.template.content.firstElementChild.cloneNode(true);
  clone.dataset.id = recording.id;
  clone.querySelector('.name').textContent = recording.name;
  clone.querySelector('.format').textContent = recording.formatLabel;
  clone.querySelector('.duration').textContent = formatDuration((recording.duration || 0) * 1000);
  const sizeKb = recording.size / 1024;
  clone.querySelector('.size').textContent = sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(2)} MB` : `${sizeKb.toFixed(1)} KB`;
  const audio = clone.querySelector('audio');
  audio.src = recording.url;
  audio.type = recording.mimeType;

  clone.querySelector('.save').addEventListener('click', () => exportRecording(recording));
  clone.querySelector('.rename').addEventListener('click', () => renameRecording(recording));
  clone.querySelector('.remove').addEventListener('click', () => removeRecording(recording));
  const notes = clone.querySelector('.notes');
  notes.value = recording.notes || '';
  notes.addEventListener('input', (event) => {
    recording.notes = event.target.value;
  });

  return clone;
}

function renderRecordings() {
  elements.list.innerHTML = '';
  for (const recording of sessionState.recordings) {
    elements.list.appendChild(buildRecordingItem(recording));
  }
}

function createRecordingEntry({ blob, duration, extension, mimeType }) {
  const timestamp = new Date();
  const format = findFormat(sessionState.activeFormatId);
  const resolvedExtension = extension || format?.extension || 'audio';
  const resolvedMime = mimeType || getMimeForExtension(resolvedExtension);
  const baseName = sessionState.baseName && sessionState.baseName.length > 0 ? sessionState.baseName : 'kayıt';
  const safeName = `${baseName}-${timestamp.toISOString().replace(/[:.]/g, '-')}`;

  const recording = {
    id: crypto.randomUUID(),
    name: safeName,
    extension: resolvedExtension,
    formatLabel: format ? format.label : resolvedExtension.toUpperCase(),
    blob,
    url: URL.createObjectURL(blob),
    mimeType: resolvedMime,
    duration,
    createdAt: timestamp,
    notes: '',
    size: blob.size,
    formatId: sessionState.activeFormatId
  };

  sessionState.recordings.unshift(recording);
  renderRecordings();
}

async function exportRecording(recording) {
  try {
    if (!window.bridge) {
      alert('Dosya kaydetme köprü modülü etkin değil.');
      return;
    }

    const defaultPath = `${recording.name}.${recording.extension}`;
    const filters = [
      { name: 'Audio', extensions: [recording.extension] },
      { name: 'Tüm Dosyalar', extensions: ['*'] }
    ];
    const filePath = await window.bridge.chooseSaveLocation(defaultPath, filters);
    if (!filePath) {
      return;
    }

    const buffer = await recording.blob.arrayBuffer();
    await window.bridge.writeFile(filePath, new Uint8Array(buffer));
  } catch (error) {
    console.error('Dışa aktarma hatası', error);
    alert('Dosya kaydedilemedi. Lütfen yeniden deneyin.');
  }
}

function renameRecording(recording) {
  const nextName = prompt('Yeni kayıt adı', recording.name);
  if (!nextName) {
    return;
  }
  recording.name = nextName.trim();
  renderRecordings();
}

function removeRecording(recording) {
  sessionState.recordings = sessionState.recordings.filter((item) => item.id !== recording.id);
  URL.revokeObjectURL(recording.url);
  renderRecordings();
}

async function importRecording() {
  try {
    if (!window.bridge) {
      alert('Dosya içe aktarma köprü modülü etkin değil.');
      return;
    }

    const file = await window.bridge.pickAudioFile();
    if (!file) {
      return;
    }

    const extension = file.name.split('.').pop()?.toLowerCase() || 'audio';
    const type = getMimeForExtension(extension);
    const blob = new Blob([file.data], { type });
    const audioUrl = URL.createObjectURL(blob);

    const recording = {
      id: crypto.randomUUID(),
      name: file.name.replace(/\.[^.]+$/, ''),
      extension,
      formatLabel: extension.toUpperCase(),
      blob,
      url: audioUrl,
      mimeType: type,
      duration: 0,
      createdAt: new Date(),
      notes: '',
      size: blob.size
    };

    sessionState.recordings.unshift(recording);
    renderRecordings();
  } catch (error) {
    console.error('Dosya içe aktarılamadı', error);
  }
}

async function startRecording() {
  try {
    setRecordingUI(true);
    resetDurationDisplay();
    startDurationTimer();

    sessionState.activeFormatId = elements.format.value;
    const rawName = (elements.fileName.value || '').trim();
    sessionState.baseName = rawName.length > 0 ? rawName : 'kayıt';
    updateGateIndicator(sessionState.bypassGate);

    await recorder.start({
      formatId: sessionState.activeFormatId,
      deviceId: elements.device.value || undefined,
      threshold: sessionState.threshold,
      hold: sessionState.hold,
      bypassGate: sessionState.bypassGate,
      onLevel: updateLevel,
      onGateChange: updateGateIndicator
    });
  } catch (error) {
    console.error('Kayıt başlatılamadı', error);
    alert('Kayıt başlatılamadı. Mikrofon izinlerini ve format desteğini kontrol edin.');
    setRecordingUI(false);
    stopDurationTimer();
    updateGateIndicator(false);
  }
}

async function stopRecording() {
  try {
    setRecordingUI(false);
    stopDurationTimer();
    if (sessionState.gateOpenedAt) {
      sessionState.activeDuration += performance.now() - sessionState.gateOpenedAt;
      sessionState.gateOpenedAt = null;
    }

    const result = await recorder.stop();
    if (!result) {
      return;
    }

    if (!result.duration || Number.isNaN(result.duration)) {
      result.duration = sessionState.activeDuration / 1000;
    }

    createRecordingEntry(result);
    updateGateIndicator(false);
    updateLevel(-Infinity);
    resetDurationDisplay();
    sessionState.activeFormatId = null;
  } catch (error) {
    console.error('Kayıt durdurulamadı', error);
    alert('Kayıt durdurulamadı. Lütfen yeniden deneyin.');
  }
}

function initializeEvents() {
  elements.threshold.addEventListener('input', (event) => {
    sessionState.threshold = Number(event.target.value);
    updateThresholdDisplay();
    recorder.updateGate({
      threshold: sessionState.threshold,
      hold: sessionState.hold,
      bypassGate: sessionState.bypassGate
    });
  });

  elements.hold.addEventListener('input', (event) => {
    sessionState.hold = Number(event.target.value);
    updateHoldDisplay();
    recorder.updateGate({
      threshold: sessionState.threshold,
      hold: sessionState.hold,
      bypassGate: sessionState.bypassGate
    });
  });

  elements.captureSilence.addEventListener('change', (event) => {
    sessionState.bypassGate = event.target.checked;
    recorder.updateGate({
      threshold: sessionState.threshold,
      hold: sessionState.hold,
      bypassGate: sessionState.bypassGate
    });
    updateGateIndicator(sessionState.bypassGate);
  });

  elements.start.addEventListener('click', startRecording);
  elements.stop.addEventListener('click', stopRecording);
  elements.refreshDevices.addEventListener('click', async () => {
    await populateDevices();
  });
  elements.importButton.addEventListener('click', importRecording);
}

async function init() {
  updateThresholdDisplay();
  updateHoldDisplay();
  updateLevel(-Infinity);
  updateGateIndicator(false);
  setRecordingUI(false);

  await populateFormats();

  try {
    await ensureDeviceAccess();
    await populateDevices();
  } catch (error) {
    alert('Mikrofon erişimine izin verilmedi. Uygulama sınırlı çalışacaktır.');
  }

  initializeEvents();
}

init();
