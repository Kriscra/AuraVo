const byId = (id) => document.getElementById(id);

export const ui = {
  recordButton: byId('recordButton'),
  timer: byId('timer'),
  timerHint: byId('timerHint'),
  statusPill: byId('statusPill'),
  saveButton: byId('saveButton'),
  preview: byId('preview'),
  emptyState: byId('emptyState'),
  audioPlayer: byId('audioPlayer'),
  recordingName: byId('recordingName'),
  recordingSize: byId('recordingSize'),
  recordingFormat: byId('recordingFormat'),
  recordingDuration: byId('recordingDuration'),
  errorMessage: byId('errorMessage'),
  discardButton: byId('discardButton'),
  meter: byId('levelMeter'),
  meterFill: byId('meterFill'),
  deviceSelect: byId('deviceSelect'),
  formatSelect: byId('formatSelect'),
  thresholdSlider: byId('thresholdSlider'),
  thresholdValue: byId('thresholdValue')
};
