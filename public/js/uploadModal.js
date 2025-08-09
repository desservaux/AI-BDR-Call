import { apiGet } from './api.js';

function getEl(id) { return document.getElementById(id); }
function openModal(id) { const el = getEl(id); if (el) el.style.display = 'block'; }
function closeModal(id) { const el = getEl(id); if (el) el.style.display = 'none'; }

function downloadSampleCSV() {
  const sample = [
    'first_name,last_name,email,company_name,position,phone_number,phone_type,is_primary,do_not_call,notes',
    'Ada,Lovelace,ada@example.com,Analytical Engines,Engineer,+15551234567,mobile,true,false,VIP prospect',
    'Grace,Hopper,grace@example.com,Navy,Rear Admiral,+15557654321,work,true,false,Interested in demo'
  ].join('\n');
  const blob = new Blob([sample], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'sample-contacts.csv';
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

async function populateSequenceSelect() {
  const select = getEl('sequence-select');
  if (!select) return;
  select.innerHTML = '<option value="">Select a sequence...</option>';
  try {
    const res = await apiGet('/api/sequences');
    if (res.success && Array.isArray(res.sequences)) {
      res.sequences.forEach(seq => {
        const opt = document.createElement('option');
        opt.value = seq.id; opt.textContent = seq.name || 'Untitled';
        select.appendChild(opt);
      });
    }
  } catch {}
}

function handleSequenceCheckboxChange() {
  const cb = getEl('add-to-sequence-checkbox');
  const sel = getEl('sequence-select');
  if (!cb || !sel) return;
  sel.style.display = cb.checked ? 'block' : 'none';
  if (cb.checked) populateSequenceSelect();
}

async function handleCSVUpload(ev) {
  ev.preventDefault();
  const fileInput = getEl('csv-file');
  if (!fileInput || !fileInput.files || !fileInput.files[0]) return;
  const formData = new FormData();
  formData.append('csvFile', fileInput.files[0]);
  const addToSequence = getEl('add-to-sequence-checkbox')?.checked;
  const sequenceId = getEl('sequence-select')?.value;
  const endpoint = addToSequence && sequenceId
    ? `/api/contacts/upload-to-sequence?sequenceId=${encodeURIComponent(sequenceId)}`
    : '/api/contacts/upload';
  const res = await fetch(endpoint, { method: 'POST', body: formData });
  const json = await res.json();
  const info = getEl('file-info');
  if (json.success) {
    info.textContent = '✅ Upload complete';
    closeModal('uploadModal');
  } else {
    info.textContent = `❌ Upload failed: ${json.message || 'Unknown error'}`;
  }
}

function handleFileSelect() {
  const file = getEl('csv-file')?.files?.[0];
  const info = getEl('file-info');
  if (file && info) info.textContent = `${file.name} (${Math.round(file.size / 1024)} KB)`;
}

export function bindUploadModal() {
  // Openers
  const uploadBtn = document.getElementById('upload-contacts-btn');
  uploadBtn?.addEventListener('click', () => openModal('uploadModal'));

  // Closers
  const closeX = document.querySelector('#uploadModal .close');
  closeX?.addEventListener('click', () => closeModal('uploadModal'));

  // Download sample
  const downloadBtn = document.querySelector('#uploadModal .btn.btn-secondary');
  downloadBtn?.addEventListener('click', downloadSampleCSV);

  // Form submit and file change
  const form = getEl('upload-form');
  form?.addEventListener('submit', handleCSVUpload);
  const fileInput = getEl('csv-file');
  fileInput?.addEventListener('change', handleFileSelect);

  const seqCheckbox = getEl('add-to-sequence-checkbox');
  seqCheckbox?.addEventListener('change', handleSequenceCheckboxChange);
}


