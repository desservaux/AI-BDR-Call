export function updateStatus(element, success, message) {
  element.textContent = message;
  element.className = 'status-value ' + (success ? 'status-connected' : 'status-disconnected');
}

export function formatDuration(seconds) {
  if (!seconds && seconds !== 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

