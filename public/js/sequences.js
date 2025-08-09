import { apiGet } from './api.js';

function renderSequences(sequences) {
  const container = document.getElementById('sequences-table-content');
  if (!container) return;
  if (!sequences.length) {
    container.innerHTML = '<div class="no-data">No sequences found</div>';
    return;
  }
  const html = sequences
    .map((sequence) => {
      const statusClass = sequence.is_active ? 'status-active' : 'status-inactive';
      const statusText = sequence.is_active ? 'Active' : 'Inactive';
      return `
        <div class=\"sequence-row\">
          <div class=\"sequence-name\">${sequence.name}</div>
          <div class=\"sequence-description\">${sequence.description || 'N/A'}</div>
          <div>${sequence.max_attempts || 3}</div>
          <div>${sequence.retry_delay_hours || 24}h</div>
          <div class=\"sequence-status ${statusClass}\">${statusText}</div>
          <div class=\"sequence-entries\">
            <button class=\"btn btn-small\" data-action=\"view\" data-id=\"${sequence.id}\">View</button>
          </div>
          <div class=\"sequence-actions\">
            <button class=\"btn btn-small\" data-action=\"edit\" data-id=\"${sequence.id}\">Edit</button>
          </div>
        </div>`;
    })
    .join('');
  container.innerHTML = html;
  // mark buttons for JS binding instead of inline onclicks
  container.querySelectorAll('button[data-action="view"]').forEach((btn)=>{
    btn.setAttribute('data-action','view-sequence');
  });
}

export async function loadSequences() {
  const name = document.getElementById('sequence-name-filter')?.value || '';
  const isActive = document.getElementById('sequence-status-filter')?.value || '';
  const params = new URLSearchParams();
  if (name) params.append('name', name);
  if (isActive) params.append('isActive', isActive);
  const container = document.getElementById('sequences-table-content');
  container.innerHTML = '<div class="loading">Loading sequences...</div>';
  const data = await apiGet(`/api/sequences?${params.toString()}`);
  if (!data.success) {
    container.innerHTML = '<div class="no-data">No sequences found</div>';
    return;
  }
  renderSequences(data.sequences || []);
}

export function bindSequencesTab() {
  const refreshBtn = document.getElementById('refresh-sequences-btn');
  refreshBtn?.addEventListener('click', () => loadSequences());
  const nameInput = document.getElementById('sequence-name-filter');
  const statusSelect = document.getElementById('sequence-status-filter');
  nameInput?.addEventListener('input', () => loadSequences());
  statusSelect?.addEventListener('change', () => loadSequences());
}

