const recordButton = document.getElementById('recordButton');
const timerDisplay = document.getElementById('timer');
const timerHint = document.getElementById('timerHint');
const statusPill = document.getElementById('statusPill');
const saveButton = document.getElementById('saveButton');
const preview = document.getElementById('preview');
const emptyState = document.getElementById('emptyState');
const audioPlayer = document.getElementById('audioPlayer');
const recordingName = document.getElementById('recordingName');
const recordingSize = document.getElementById('recordingSize');
const errorMessage = document.getElementById('errorMessage');
const discardButton = document.getElementById('discardButton');
const meterFill = document.getElementById('meterFill');

let mediaRecorder;
let mediaStream;
let audioChunks = [];
let recordingStart = null;
let timerInterval = null;
let analyser;
let animationFrame;
let lastBlob;

const formatTime = (ms) => {
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
};

const updateTimer = () => {
  const elapsed = Date.now() - recordingStart;
  timerDisplay.textContent = formatTime(elapsed);
};

const resetTimer = () => {
  clearInterval(timerInterval);
  timerDisplay.textContent = '00:00:00';
  timerHint.textContent = 'Kaydı başlatmak için tıklayın';
};

const updateStatus = (text, state = 'idle') => {
  statusPill.textContent = text;
  statusPill.classList.remove('recording', 'saving', 'error');
  statusPill.classList.add(state);
};

const stopStream = () => {
  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop());
    mediaStream = null;
  }
};

const setupLevelMeter = (stream) => {
  const audioContext = new AudioContext();
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 256;

  const source = audioContext.createMediaStreamSource(stream);
  source.connect(analyser);

  const dataArray = new Uint8Array(analyser.frequencyBinCount);

  const draw = () => {
    analyser.getByteFrequencyData(dataArray);
    const avg = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
    const normalized = Math.min(avg / 128, 1);
    meterFill.style.transform = `scaleX(${normalized})`;
    animationFrame = requestAnimationFrame(draw);
  };

  draw();
};

const destroyLevelMeter = () => {
  if (animationFrame) {
    cancelAnimationFrame(animationFrame);
    animationFrame = null;
  }
  meterFill.style.transform = 'scaleX(0)';
};

const handleDataAvailable = (event) => {
  if (event.data.size > 0) {
    audioChunks.push(event.data);
  }
};

const showPreview = async (blob) => {
  lastBlob = blob;
  const url = URL.createObjectURL(blob);
  audioPlayer.src = url;
  preview.classList.remove('hidden');
  emptyState.classList.add('hidden');
  recordingName.textContent = 'AuraVo-kayit.wav';
  recordingSize.textContent = `${(blob.size / 1024).toFixed(1)} KB`;
  saveButton.disabled = false;
};

const startRecording = async () => {
  errorMessage.textContent = '';
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    setupLevelMeter(mediaStream);

    mediaRecorder = new MediaRecorder(mediaStream);
    audioChunks = [];

    mediaRecorder.addEventListener('dataavailable', handleDataAvailable);
    mediaRecorder.addEventListener('stop', async () => {
      const blob = new Blob(audioChunks, { type: 'audio/webm;codecs=opus' });
      await showPreview(blob);
    });

    mediaRecorder.start();
    recordingStart = Date.now();
    timerHint.textContent = 'Kaydı durdurmak için tekrar tıklayın';
    recordButton.classList.add('recording');
    recordButton.querySelector('.button-label').textContent = 'Kaydı Durdur';
    updateStatus('Kayıt Yapılıyor', 'recording');
    timerInterval = setInterval(updateTimer, 200);
    updateTimer();
  } catch (error) {
    errorMessage.textContent = 'Mikrofona erişim reddedildi veya bir hata oluştu.';
    updateStatus('Hata', 'error');
    console.error(error);
  }
};

const stopRecording = () => {
  if (!mediaRecorder || mediaRecorder.state === 'inactive') {
    return;
  }

  mediaRecorder.stop();
  stopStream();
  destroyLevelMeter();
  clearInterval(timerInterval);
  recordButton.classList.remove('recording');
  recordButton.querySelector('.button-label').textContent = 'Kaydı Başlat';
  updateStatus('Kayıt Tamamlandı');
  timerHint.textContent = 'Yeni kayıt için tıklayın';
};

recordButton.addEventListener('click', () => {
  if (!mediaRecorder || mediaRecorder.state === 'inactive') {
    startRecording();
  } else {
    stopRecording();
  }
});

saveButton.addEventListener('click', async () => {
  if (!lastBlob) return;
  saveButton.disabled = true;
  updateStatus('Kaydediliyor...', 'saving');

  try {
    const arrayBuffer = await lastBlob.arrayBuffer();
    const result = await (window.electronAPI?.saveAudio(arrayBuffer) ?? {});
    if (result.success) {
      updateStatus('Kaydedildi');
    } else if (result.error) {
      throw new Error(result.error);
    } else {
      updateStatus('Hazır');
    }
  } catch (error) {
    errorMessage.textContent = 'Dosya kaydedilemedi: ' + error.message;
    updateStatus('Hata', 'error');
  } finally {
    saveButton.disabled = false;
  }
});

discardButton.addEventListener('click', () => {
  lastBlob = null;
  audioPlayer.src = '';
  preview.classList.add('hidden');
  emptyState.classList.remove('hidden');
  saveButton.disabled = true;
  updateStatus('Hazır');
});

window.addEventListener('beforeunload', () => {
  stopStream();
  destroyLevelMeter();
});
