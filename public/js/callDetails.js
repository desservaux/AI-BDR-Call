import { apiGet } from './api.js';

function renderCallDetails(callDetails) {
  const content = document.getElementById('callDetailsContent');
  const call = callDetails.call;
  const transcriptions = callDetails.transcriptions || [];
  const html = `
    <div class="call-detail-section">
      <h4>📞 Call Information</h4>
      <div class="call-detail-grid">
        <div class="call-detail-item"><div class="call-detail-label">Phone Number</div><div class="call-detail-value">${call.phone_number || 'N/A'}</div></div>
        <div class="call-detail-item"><div class="call-detail-label">Status</div><div class="call-detail-value"><span class="call-status-badge status-${call.enhanced_status || call.status || 'unknown'}">${call.enhanced_status || call.status || 'Unknown'}</span></div></div>
        <div class="call-detail-item"><div class="call-detail-label">Duration</div><div class="call-detail-value">${call.duration_seconds ? Math.round(call.duration_seconds / 60) + 'm ' + (call.duration_seconds % 60) + 's' : 'N/A'}</div></div>
        <div class="call-detail-item"><div class="call-detail-label">Messages</div><div class="call-detail-value">${call.message_count || 0}</div></div>
        <div class="call-detail-item"><div class="call-detail-label">Start Time</div><div class="call-detail-value">${call.start_time ? new Date(call.start_time).toLocaleString() : 'N/A'}</div></div>
        <div class="call-detail-item"><div class="call-detail-label">Created</div><div class="call-detail-value">${new Date(call.created_at).toLocaleString()}</div></div>
        <div class="call-detail-item"><div class="call-detail-label">External Call</div><div class="call-detail-value">${call.is_external_call ? '✅ Yes' : '❌ No'}</div></div>
      </div>
    </div>
    <div class="call-detail-section">
      <h4>💬 Transcript</h4>
      <div class="transcript-section">
        ${transcriptions
          .map(
            (t) => `
          <div class="transcript-item">
            <div class="transcript-speaker">${t.speaker || 'Unknown'}</div>
            <div class="transcript-text">${t.message || t.text || 'No text available'}</div>
          </div>`
          )
          .join('') || '<div class="transcript-item"><div class="transcript-speaker">System</div><div class="transcript-text">No transcript available for this call.</div></div>'}
      </div>
    </div>`;
  content.innerHTML = html;
}

export async function viewCallDetails(callId) {
  const modal = document.getElementById('callDetailsModal');
  const content = document.getElementById('callDetailsContent');
  content.innerHTML = '<div class="loading">Loading call details...</div>';
  modal.style.display = 'block';
  const data = await apiGet(`/api/calls/${callId}`);
  if (data.success) renderCallDetails(data.callDetails);
  else content.innerHTML = '<div class="no-data">Error loading call details</div>';
}

export function bindCallDetailsModal() {
  const modal = document.getElementById('callDetailsModal');
  const x = modal?.querySelector('.close');
  x?.addEventListener('click', () => {
    modal.style.display = 'none';
  });
  const c1 = document.getElementById('close-call-details-btn-1');
  const c2 = document.getElementById('close-call-details-btn-2');
  c1?.addEventListener('click', () => { modal.style.display = 'none'; });
  c2?.addEventListener('click', () => { modal.style.display = 'none'; });
  // Also close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal?.style.display === 'block') {
      modal.style.display = 'none';
    }
  });
}

// Shim no longer required; all bindings done via modules

