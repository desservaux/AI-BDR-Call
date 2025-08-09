import { apiGet } from './api.js';

function renderPhoneNumbers(items) {
  const container = document.getElementById('phone-numbers-table-content');
  if (!container) return;
  if (!items.length) {
    container.innerHTML = '<div class="no-data">No phone numbers found</div>';
    return;
  }
  const html = items
    .map((pn) => {
      const status = pn.do_not_call ? 'Do Not Call' : 'Active';
      const contactName = pn.contacts ? `${pn.contacts.first_name || ''} ${pn.contacts.last_name || ''}` : '';
      const company = pn.contacts?.company_name || '';
      return `
        <div class=\"phone-row\">
          <div>${pn.phone_number}</div>
          <div>${pn.phone_type || ''}</div>
          <div>${contactName}</div>
          <div>${company}</div>
          <div>${status}</div>
          <div>
            <button class=\"btn btn-small\" data-action=\"view-calls\" data-id=\"${pn.id}\">Calls</button>
          </div>
          <div>
            <button class=\"btn btn-small\" data-action=\"edit\" data-id=\"${pn.id}\">Edit</button>
          </div>
        </div>`;
    })
    .join('');
  container.innerHTML = html;
}

export async function loadPhoneNumbers() {
  const phoneNumber = document.getElementById('phone-number-filter')?.value || '';
  const phoneType = document.getElementById('phone-type-filter')?.value || '';
  const doNotCall = document.getElementById('phone-status-filter')?.value || '';
  const params = new URLSearchParams();
  if (phoneNumber) params.append('phoneNumber', phoneNumber);
  if (phoneType) params.append('phoneType', phoneType);
  if (doNotCall) params.append('doNotCall', doNotCall);
  const container = document.getElementById('phone-numbers-table-content');
  container.innerHTML = '<div class="loading">Loading phone numbers...</div>';
  const data = await apiGet(`/api/phone-numbers?${params.toString()}`);
  if (!data.success) {
    container.innerHTML = '<div class="no-data">No phone numbers found</div>';
    return;
  }
  renderPhoneNumbers(data.phoneNumbers || []);
}

export function bindPhoneNumbersTab() {
  const refreshBtn = document.getElementById('refresh-phone-numbers-btn');
  refreshBtn?.addEventListener('click', () => loadPhoneNumbers());
  const phoneInput = document.getElementById('phone-number-filter');
  const typeSelect = document.getElementById('phone-type-filter');
  const statusSelect = document.getElementById('phone-status-filter');
  phoneInput?.addEventListener('input', () => loadPhoneNumbers());
  typeSelect?.addEventListener('change', () => loadPhoneNumbers());
  statusSelect?.addEventListener('change', () => loadPhoneNumbers());
}

