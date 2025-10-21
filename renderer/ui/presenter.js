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
  ui.recordButton.classList.remove('countdown');
  ui.recordButton.classList.toggle('recording', isRecording);
  ui.recordButton.querySelector('.button-label').textContent = isRecording
    ? 'Kaydı Durdur'
    : 'Kaydı Başlat';
}

export function setRecordButtonCountdown(remainingSeconds) {
  if (!Number.isFinite(remainingSeconds) || remainingSeconds <= 0) {
    ui.recordButton.classList.remove('countdown');
    if (!ui.recordButton.classList.contains('recording')) {
      ui.recordButton.querySelector('.button-label').textContent = 'Kaydı Başlat';
    }
    return;
  }

  ui.recordButton.classList.add('countdown');
  ui.recordButton.querySelector('.button-label').textContent = `Başlama ${remainingSeconds} sn`;
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

export function setGateHoldDisplay(milliseconds) {
  if (!ui.gateHoldValue) {
    return;
  }
  const seconds = milliseconds / 1000;
  const formatted = seconds >= 1 ? seconds.toFixed(1) : seconds.toFixed(2);
  ui.gateHoldValue.textContent = `${formatted} sn`;
}

export function showPreview({
  url,
  name,
  sizeLabel,
  formatLabel,
  durationLabel,
  timestampLabel,
  favorite,
  note
}) {
  ui.preview.classList.remove('hidden');
  ui.emptyState.classList.add('hidden');
  ui.audioPlayer.src = url;
  ui.recordingName.textContent = name;
  ui.recordingSize.textContent = sizeLabel;
  ui.recordingFormat.textContent = formatLabel;
  ui.recordingDuration.textContent = durationLabel;
  if (ui.recordingTimestamp) {
    ui.recordingTimestamp.textContent = timestampLabel || '';
  }
  if (ui.favoriteBadge) {
    const visible = Boolean(favorite);
    ui.favoriteBadge.classList.toggle('visible', visible);
    ui.favoriteBadge.setAttribute('aria-hidden', visible ? 'false' : 'true');
  }
  if (ui.noteContainer) {
    ui.noteContainer.classList.remove('hidden');
  }
  if (ui.noteField) {
    const normalized = note || '';
    if (ui.noteField.value !== normalized) {
      ui.noteField.value = normalized;
    }
  }
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
  if (ui.recordingTimestamp) {
    ui.recordingTimestamp.textContent = '';
  }
  if (ui.favoriteBadge) {
    ui.favoriteBadge.classList.remove('visible');
    ui.favoriteBadge.setAttribute('aria-hidden', 'true');
  }
  if (ui.noteContainer) {
    ui.noteContainer.classList.add('hidden');
  }
  if (ui.noteField) {
    ui.noteField.value = '';
  }
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

export function setFavoriteState(isFavorite) {
  if (!ui.favoriteButton) {
    return;
  }
  ui.favoriteButton.classList.toggle('active', Boolean(isFavorite));
  ui.favoriteButton.textContent = isFavorite ? 'Favoriyi Kaldır' : 'Favoriye Ekle';
  if (ui.favoriteBadge) {
    const visible = Boolean(isFavorite);
    ui.favoriteBadge.classList.toggle('visible', visible);
    ui.favoriteBadge.setAttribute('aria-hidden', visible ? 'false' : 'true');
  }
}

export function renderLibrary(items = []) {
  if (!ui.libraryList || !ui.libraryEmpty) {
    return;
  }

  ui.libraryList.innerHTML = '';

  if (!items.length) {
    ui.libraryEmpty.classList.remove('hidden');
    return;
  }

  ui.libraryEmpty.classList.add('hidden');

  items.forEach((item) => {
    const li = document.createElement('li');
    li.className = 'library-item';
    li.dataset.id = item.id;
    if (item.active) {
      li.classList.add('active');
    }
    if (item.favorite) {
      li.classList.add('favorite');
    }

    const main = document.createElement('div');
    main.className = 'library-item-main';
    main.innerHTML = `
      <span class="library-name">${item.name}</span>
      <span class="library-duration">${item.durationLabel}</span>
    `;

    const meta = document.createElement('div');
    meta.className = 'library-item-meta';
    meta.innerHTML = `
      <span>${item.formatLabel}</span>
      <span>${item.sizeLabel}</span>
      <span>${item.timestampLabel}</span>
    `;

    li.appendChild(main);
    li.appendChild(meta);
    ui.libraryList.appendChild(li);
  });
}
