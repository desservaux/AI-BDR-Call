import { apiGet, apiPost } from './api.js';
import { updateStatus } from './utils.js';
import { loadAnalytics } from './analytics.js';
import { bindCallsTab, loadCalls, bindCallSearch } from './calls.js';
import { bindContactsTab, loadContacts } from './contacts.js';
import { bindSequencesTab, loadSequences } from './sequences.js';
import { bindPhoneNumbersTab, loadPhoneNumbers } from './phoneNumbers.js';
import './callDetails.js';

function initTabs() {
  const tabLinks = document.querySelectorAll('.tabbar-link');
  const dashboardContents = document.querySelectorAll('.dashboard-content');
  tabLinks.forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = link.getAttribute('data-target');
      dashboardContents.forEach((el) => el.classList.add('d-none'));
      document.getElementById(target)?.classList.remove('d-none');
      tabLinks.forEach((l) => l.classList.remove('active'));
      link.classList.add('active');
    });
  });
}

async function initStatus() {
  const serverStatus = document.getElementById('server-status');
  const elevenlabsStatus = document.getElementById('elevenlabs-status');
  const agentStatus = document.getElementById('agent-status');
  try {
    const health = await apiGet('/health');
    updateStatus(serverStatus, true, 'Connected');
  } catch {
    updateStatus(serverStatus, false, 'Disconnected');
  }
  try {
    const el = await apiGet('/test-elevenlabs');
    updateStatus(elevenlabsStatus, true, 'Connected');
  } catch {
    updateStatus(elevenlabsStatus, false, 'Disconnected');
  }
  try {
    const agents = await apiGet('/elevenlabs/agents');
    updateStatus(agentStatus, true, 'Available');
  } catch {
    updateStatus(agentStatus, false, 'Unavailable');
  }
}

window.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initStatus();
  bindCallsTab();
  bindContactsTab();
  bindSequencesTab();
  bindPhoneNumbersTab();
  bindCallSearch();
  const refreshAnalyticsBtn = document.getElementById('refresh-analytics-btn');
  if (refreshAnalyticsBtn) {
    refreshAnalyticsBtn.addEventListener('click', loadAnalytics);
  }
  // Initial analytics load
  loadAnalytics();
  // Initial calls load
  loadCalls(1);
  // Initial contacts load
  loadContacts();
  loadSequences();
  loadPhoneNumbers();
});

