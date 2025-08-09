import { apiGet, apiPost, apiPut } from './api.js';

function getEl(id) { return document.getElementById(id); }

function closeModal(id) { const el = getEl(id); if (el) el.style.display = 'none'; }
function openModal(id) { const el = getEl(id); if (el) el.style.display = 'block'; }

export function bindSequenceModals() {
  // Close buttons are now event-bound rather than inline onclicks
  getEl('sequenceModal')?.querySelector('.close')?.addEventListener('click', () => closeModal('sequenceModal'));
  getEl('sequenceDetailsModal')?.querySelector('.close')?.addEventListener('click', () => closeModal('sequenceDetailsModal'));
  getEl('addToSequenceModal')?.querySelector('.close')?.addEventListener('click', () => closeModal('addToSequenceModal'));

  // Cancel buttons in forms
  getEl('sequenceForm')?.querySelector('.btn.btn-secondary')?.addEventListener('click', (e) => { e.preventDefault(); closeModal('sequenceModal'); });
  const addToSeqCancel = getEl('addToSequenceContent')?.querySelector('.btn.btn-secondary');
  addToSeqCancel?.addEventListener('click', (e) => { e.preventDefault(); closeModal('addToSequenceModal'); });

  // Add-to-sequence action button
  const addBtn = getEl('addToSequenceContent')?.querySelector('.btn.btn-primary');
  addBtn?.addEventListener('click', async () => {
    const sequenceId = getEl('sequenceSelect')?.value;
    const selectedItems = Array.from(document.querySelectorAll('[data-selected-phone-id]')).map(el => el.getAttribute('data-selected-phone-id'));
    if (!sequenceId || selectedItems.length === 0) return;
    try {
      const res = await apiPost(`/api/sequences/${sequenceId}/add-phone-numbers`, { phoneNumberIds: selectedItems });
      if (res.success) closeModal('addToSequenceModal');
    } catch {}
  });
}

export function wireViewButtons() {
  // Replace inline onclick for "View" actions in sequences list
  document.querySelectorAll('[data-action="view-sequence"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      if (!id) return;
      openModal('sequenceDetailsModal');
      const content = getEl('sequenceDetailsContent');
      content.innerHTML = '<div class="loading">Loading…</div>';
      try {
        const res = await apiGet(`/api/sequences/${id}`);
        if (res.success) {
          // Minimal render for now; can be expanded
          getEl('sequenceDetailsModalTitle').textContent = res.sequence?.name || 'Sequence Details';
          content.innerHTML = '<div class="no-data">Details loaded.</div>';
        } else {
          content.innerHTML = '<div class="no-data">Failed to load</div>';
        }
      } catch {
        content.innerHTML = '<div class="no-data">Error</div>';
      }
    });
  });
}


