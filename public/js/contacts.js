import { apiGet } from './api.js';

function renderContacts(contacts) {
  const container = document.getElementById('contacts-table-content');
  if (!container) return;
  if (!contacts.length) {
    container.innerHTML = '<div class="no-data">No contacts found</div>';
    return;
  }
  const rows = contacts
    .map((c) => {
      const phones = (c.phone_numbers || [])
        .map((p) => `<span class=\"phone-badge\">${p.phone_number}</span>`) 
        .join(' ');
      const status = c.do_not_call ? 'Do Not Call' : 'Active';
      return `
        <div class=\"contacts-row\">
          <div class=\"contacts-cell\">${c.first_name || ''} ${c.last_name || ''}</div>
          <div class=\"contacts-cell\">${c.email || ''}</div>
          <div class=\"contacts-cell\">${c.company_name || ''}</div>
          <div class=\"contacts-cell\">${c.position || ''}</div>
          <div class=\"contacts-cell\">${phones}</div>
          <div class=\"contacts-cell\">${status}</div>
          <div class=\"contacts-cell\">
            <button class=\"btn btn-small\" data-action=\"view\" data-id=\"${c.id}\">View</button>
          </div>
        </div>
      `;
    })
    .join('');
  container.innerHTML = rows;
}

export async function loadContacts() {
  const name = document.getElementById('contact-name-filter')?.value || '';
  const email = document.getElementById('contact-email-filter')?.value || '';
  const company = document.getElementById('contact-company-filter')?.value || '';
  const doNotCall = document.getElementById('contact-status-filter')?.value || '';
  const params = new URLSearchParams();
  if (name) params.append('name', name);
  if (email) params.append('email', email);
  if (company) params.append('company', company);
  if (doNotCall) params.append('doNotCall', doNotCall);

  const container = document.getElementById('contacts-table-content');
  container.innerHTML = '<div class="loading">Loading contacts...</div>';
  const data = await apiGet(`/api/contacts?${params.toString()}`);
  if (!data.success) {
    container.innerHTML = '<div class="no-data">No contacts found</div>';
    return;
  }
  const contacts = data.contacts || [];
  const withPhones = await Promise.all(
    contacts.map(async (contact) => {
      try {
        const phoneData = await apiGet(`/api/phone-numbers?contactId=${contact.id}`);
        return { ...contact, phone_numbers: phoneData.success ? phoneData.phoneNumbers : [] };
      } catch {
        return { ...contact, phone_numbers: [] };
      }
    })
  );
  renderContacts(withPhones);
}

export function bindContactsTab() {
  const refreshBtn = document.getElementById('refresh-contacts-btn');
  refreshBtn?.addEventListener('click', () => loadContacts());

  const nameInput = document.getElementById('contact-name-filter');
  const emailInput = document.getElementById('contact-email-filter');
  const companyInput = document.getElementById('contact-company-filter');
  const statusSelect = document.getElementById('contact-status-filter');
  [nameInput, emailInput, companyInput, statusSelect].forEach((el) => {
    el?.addEventListener('input', () => loadContacts());
    el?.addEventListener('change', () => loadContacts());
  });
}

