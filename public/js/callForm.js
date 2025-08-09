import { apiPost } from './api.js';

function getEl(id) { return document.getElementById(id); }
function show(el) { el.style.display = 'block'; }
function hide(el) { el.style.display = 'none'; }

let lastSubmissionTime = 0;
let isSubmitting = false;

export function bindCallForm() {
  const form = getEl('call-form');
  const statusBox = getEl('call-status');
  const statusMsg = getEl('call-message');
  if (!form || !statusBox || !statusMsg) return;

  function showStatus(type, msg) {
    statusBox.className = `call-status ${type}`; statusMsg.textContent = msg; show(statusBox);
  }

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const now = Date.now();
    if (isSubmitting || now - lastSubmissionTime < 2000) {
      showStatus('info', 'Please wait a moment before trying again.');
      return;
    }
    const phoneInput = getEl('phone-number');
    const messageInput = getEl('call-message-input');
    const phoneNumber = phoneInput?.value?.trim();
    const message = messageInput?.value?.trim();
    if (!phoneNumber) { showStatus('error', 'Phone number is required'); return; }
    try {
      isSubmitting = true; lastSubmissionTime = now; showStatus('info', 'Placing call…');
      const res = await apiPost('/make-call', { phoneNumber, message });
      if (res && res.success) showStatus('success', 'Call initiated successfully');
      else showStatus('error', res?.message || 'Failed to initiate call');
    } catch (e) {
      showStatus('error', e.message || 'Request failed');
    } finally {
      isSubmitting = false;
    }
  });
}


