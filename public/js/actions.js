import { apiGet, apiPost, apiPut, apiDelete } from './api.js';
import { loadCalls } from './calls.js';
import { loadContacts } from './contacts.js';
import { loadPhoneNumbers } from './phoneNumbers.js';
import { loadSequences } from './sequences.js';
import { bindBusinessHoursPreview } from './businessHours.js';

function getEl(id) { return document.getElementById(id); }
function openModal(id) { const el = getEl(id); if (el) el.style.display = 'block'; }
function closeModal(id) { const el = getEl(id); if (el) el.style.display = 'none'; }

function setCallsFilterAndLoad(phone) {
  const input = getEl('filter-phone');
  if (input) { input.value = phone || ''; }
  loadCalls(1);
}

async function toggleSequenceStatus(sequenceId, isActive) {
  try {
    await apiPut(`/api/sequences/${sequenceId}/status`, { isActive });
    await loadSequences();
  } catch (e) { /* noop */ }
}

function showContactForm(contact = null) {
  const modal = getEl('callDetailsModal');
  const content = getEl('callDetailsContent');
  const isEdit = !!contact;
  content.innerHTML = `
    <div class="call-detail-section">
      <h4>${isEdit ? 'Edit Contact' : 'Add Contact'}</h4>
      <form id="contact-form">
        <div class="form-group"><label>First Name</label><input id="contact-first-name" type="text" value="${contact?.first_name || ''}"></div>
        <div class="form-group"><label>Last Name</label><input id="contact-last-name" type="text" value="${contact?.last_name || ''}"></div>
        <div class="form-group"><label>Email</label><input id="contact-email" type="email" value="${contact?.email || ''}"></div>
        <div class="form-group"><label>Company</label><input id="contact-company" type="text" value="${contact?.company_name || ''}"></div>
        <div class="form-group"><label>Position</label><input id="contact-position" type="text" value="${contact?.position || ''}"></div>
        <div class="form-group"><label>Notes</label><textarea id="contact-notes" rows="3">${contact?.notes || ''}</textarea></div>
        <div class="form-group"><label><input id="contact-dnc" type="checkbox" ${contact?.do_not_call ? 'checked' : ''}> Do Not Call</label></div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">${isEdit ? 'Update' : 'Create'}</button>
          <button type="button" class="btn btn-secondary" id="contact-cancel-btn">Cancel</button>
        </div>
      </form>
    </div>`;
  openModal('callDetailsModal');
  getEl('contact-cancel-btn')?.addEventListener('click', () => closeModal('callDetailsModal'));
  getEl('contact-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {
      first_name: getEl('contact-first-name').value.trim(),
      last_name: getEl('contact-last-name').value.trim(),
      email: getEl('contact-email').value.trim(),
      company_name: getEl('contact-company').value.trim(),
      position: getEl('contact-position').value.trim(),
      notes: getEl('contact-notes').value.trim(),
      do_not_call: getEl('contact-dnc').checked,
    };
    try {
      if (isEdit) {
        await apiPut(`/api/contacts/${contact.id}`, body);
      } else {
        await apiPost('/api/contacts', body);
      }
      closeModal('callDetailsModal');
      await loadContacts();
    } catch {}
  });
}

function showPhoneForm(phone = null) {
  const modal = getEl('callDetailsModal');
  const content = getEl('callDetailsContent');
  const isEdit = !!phone;
  content.innerHTML = `
    <div class="call-detail-section">
      <h4>${isEdit ? 'Edit Phone Number' : 'Add Phone Number'}</h4>
      <form id="phone-form">
        <div class="form-group"><label>Phone Number</label><input id="phone-input" type="tel" value="${phone?.phone_number || ''}" required></div>
        <div class="form-group"><label>Type</label>
          <select id="phone-type">
            <option value="mobile" ${phone?.phone_type === 'mobile' ? 'selected' : ''}>Mobile</option>
            <option value="home" ${phone?.phone_type === 'home' ? 'selected' : ''}>Home</option>
            <option value="work" ${phone?.phone_type === 'work' ? 'selected' : ''}>Work</option>
            <option value="other" ${phone?.phone_type === 'other' ? 'selected' : ''}>Other</option>
          </select>
        </div>
        <div class="form-group"><label><input id="phone-primary" type="checkbox" ${phone?.is_primary ? 'checked' : ''}> Primary</label></div>
        <div class="form-group"><label><input id="phone-dnc" type="checkbox" ${phone?.do_not_call ? 'checked' : ''}> Do Not Call</label></div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">${isEdit ? 'Update' : 'Create'}</button>
          <button type="button" class="btn btn-secondary" id="phone-cancel-btn">Cancel</button>
        </div>
      </form>
    </div>`;
  openModal('callDetailsModal');
  getEl('phone-cancel-btn')?.addEventListener('click', () => closeModal('callDetailsModal'));
  getEl('phone-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {
      phone_number: getEl('phone-input').value.trim(),
      phone_type: getEl('phone-type').value,
      is_primary: getEl('phone-primary').checked,
      do_not_call: getEl('phone-dnc').checked,
    };
    try {
      if (isEdit) {
        await apiPut(`/api/phone-numbers/${phone.id}`, body);
      } else {
        // No dedicated create in UI; keep for completeness if needed later
      }
      closeModal('callDetailsModal');
      await loadPhoneNumbers();
    } catch {}
  });
}

export function bindGlobalActions() {
  // Batch buttons
  document.getElementById('start-batch-calling-btn')?.addEventListener('click', async () => {
    try {
      const res = await apiGet('/api/sequences/batch-queue?limit=10');
      alert(res.success && res.queue?.length ? `Starting batch with ${res.queue.length} entries` : 'No entries ready');
    } catch { alert('Error'); }
  });
  document.getElementById('view-batch-queue-btn')?.addEventListener('click', async () => {
    try {
      const res = await apiGet('/api/sequences/batch-queue?limit=10');
      const modal = getEl('callDetailsModal');
      const content = getEl('callDetailsContent');
      const html = (res.queue || []).map((q) => `<div class="queue-item">${q.phone_numbers?.phone_number || 'N/A'}</div>`).join('') || '<div class="no-data">Empty</div>';
      content.innerHTML = `<div class="call-detail-section"><h4>Queue</h4>${html}</div>`; openModal('callDetailsModal');
    } catch { /* noop */ }
  });

  // Delegated clicks
  document.body.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-action], .phone-number');
    if (!t) return;

    // Phone number clicks (contacts and phone numbers lists)
    if (t.classList.contains('phone-number')) {
      const phone = t.getAttribute('data-primary-phone') || t.getAttribute('data-phone-number');
      if (phone) setCallsFilterAndLoad(phone);
      return;
    }

    const action = t.getAttribute('data-action');
    const id = t.getAttribute('data-id');
    switch (action) {
      case 'delete-contact':
        if (confirm('Delete this contact?')) { await apiDelete(`/api/contacts/${id}`); await loadContacts(); }
        break;
      case 'delete-phone':
        if (confirm('Delete this phone number?')) { await apiDelete(`/api/phone-numbers/${id}`); await loadPhoneNumbers(); }
        break;
      case 'edit-contact':
        try { const res = await apiGet(`/api/contacts/${id}`); if (res.success) showContactForm(res.contact); } catch {}
        break;
      case 'edit-phone':
        try { const res = await apiGet(`/api/phone-numbers/${id}`); if (res.success) showPhoneForm(res.phoneNumber); } catch {}
        break;
      case 'toggle-sequence':
        await toggleSequenceStatus(id, t.getAttribute('data-active') === 'true');
        break;
      case 'open-sequence-details':
      case 'view-sequence':
        // Sequence details are handled in sequenceModals.js (wireViewButtons). No-op here.
        break;
      default:
        break;
    }
  });
}


