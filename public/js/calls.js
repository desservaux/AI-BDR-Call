import { apiGet, apiPost } from './api.js';
import { formatDuration } from './utils.js';

let currentPage = 1;
let itemsPerPage = 20;
let allCalls = [];
let filteredCalls = [];
let searchTerm = '';

function renderCalls(calls) {
  const container = document.getElementById('calls-table-content');
  if (!container) return;
  const tableHTML = `
    <div class="call-row" style="grid-template-columns: 1fr 1fr 1fr 1fr 1fr auto; font-weight: 600; background: #f8f9fa;">
      <div>Phone Number</div>
      <div>Date</div>
      <div>Status</div>
      <div>Duration</div>
      <div>Analysis</div>
      <div>Actions</div>
    </div>
    ${calls
      .map((call) => {
        const minutes = call.duration_seconds ? Math.floor(call.duration_seconds / 60) : 0;
        const seconds = call.duration_seconds ? call.duration_seconds % 60 : 0;
        const durationText = call.duration_seconds ? `${minutes}m ${seconds}s` : 'N/A';
        return `
          <div class="call-row">
            <div class="call-phone">${call.phone_number && call.phone_number !== 'unknown' ? call.phone_number : 'N/A'}</div>
            <div class="call-date">${call.start_time ? new Date(call.start_time).toLocaleString() : new Date(call.created_at).toLocaleString()}</div>
            <div class="call-status-badge status-${call.enhanced_status || 'unknown'}">${call.enhanced_status || 'Unknown'}</div>
            <div class="call-duration">${durationText}</div>
            <div class="call-analysis">
              ${call.meeting_booked ? '✅' : '❌'} Meeting
              ${call.person_interested ? '✅' : '❌'} Interested
            </div>
            <div class="call-actions">
              <button class="btn btn-small btn-secondary" data-action="view" data-id="${call.id}">View</button>
            </div>
          </div>
        `;
      })
      .join('')}
  `;
  container.innerHTML = tableHTML;
  container.querySelectorAll('button[data-action="view"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const { viewCallDetails } = await import('./callDetails.js');
      viewCallDetails(btn.dataset.id);
    });
  });
}

function hidePagination() {
  const paginationControls = document.getElementById('pagination-controls');
  if (paginationControls) paginationControls.style.display = 'none';
}

function updatePagination(totalPages = null, totalCalls = null) {
  if (totalPages === null) {
    totalPages = Math.ceil(filteredCalls.length / itemsPerPage);
    totalCalls = filteredCalls.length;
  }
  const paginationControls = document.getElementById('pagination-controls');
  const pageNumbers = document.getElementById('page-numbers');
  const prevBtn = document.getElementById('prev-page-btn');
  const nextBtn = document.getElementById('next-page-btn');
  const paginationInfo = document.getElementById('pagination-info');
  if (totalPages <= 1) {
    hidePagination();
    return;
  }
  paginationControls.style.display = 'flex';
  prevBtn.disabled = currentPage <= 1;
  nextBtn.disabled = currentPage >= totalPages;
  if (paginationInfo && totalCalls !== null) {
    const startIndex = (currentPage - 1) * itemsPerPage + 1;
    const endIndex = Math.min(currentPage * itemsPerPage, totalCalls);
    paginationInfo.textContent = `Showing ${startIndex}-${endIndex} of ${totalCalls}`;
  }
  let pageNumbersHTML = '';
  const maxVisiblePages = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
  let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
  if (endPage - startPage + 1 < maxVisiblePages) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }
  for (let i = startPage; i <= endPage; i++) {
    const isActive = i === currentPage;
    pageNumbersHTML += `<button class="page-number ${isActive ? 'active' : ''}" data-page="${i}">${i}</button>`;
  }
  pageNumbers.innerHTML = pageNumbersHTML;
  pageNumbers.querySelectorAll('button[data-page]').forEach((btn) => {
    btn.addEventListener('click', () => {
      currentPage = parseInt(btn.dataset.page, 10);
      loadCalls(currentPage);
    });
  });
}

export async function loadCalls(page = 1) {
  currentPage = page;
  const status = document.getElementById('filter-call-result')?.value || '';
  const phone = document.getElementById('filter-phone')?.value || '';
  const dateStart = document.getElementById('filter-date-start')?.value || '';
  const dateEnd = document.getElementById('filter-date-end')?.value || '';
  const meetingBooked = document.getElementById('filter-meeting')?.value || '';
  const personInterested = document.getElementById('filter-interested')?.value || '';
  const personUpset = document.getElementById('filter-upset')?.value || '';
  const duration = document.getElementById('filter-duration')?.value || '';
  const limit = itemsPerPage;
  const query = new URLSearchParams({
    status,
    callResult: status,
    phone,
    dateStart,
    dateEnd,
    meetingBooked,
    personInterested,
    personUpset,
    duration,
    page: String(page),
    limit: String(limit),
  }).toString();
  const data = await apiGet(`/api/calls?${query}`);
  if (data.success) {
    allCalls = data.calls;
    filteredCalls = data.calls; // base set; apply client search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filteredCalls = allCalls.filter((call) => {
        const haystack = [
          call.phone_number,
          call.enhanced_status,
          call.meeting_booked ? 'meeting booked' : '',
          call.person_interested ? 'interested' : '',
          call.person_very_upset ? 'upset' : '',
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(term);
      });
    }
    renderCalls(filteredCalls);
    updatePagination(Math.ceil(data.total / limit), data.total);
  }
}

export function bindCallSearch() {
  const searchInput = document.getElementById('search-input');
  searchInput?.addEventListener('input', () => {
    searchTerm = searchInput.value.trim();
    currentPage = 1;
    // Re-render using current filtered data
    if (!allCalls.length) return;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filteredCalls = allCalls.filter((call) => {
        const haystack = [
          call.phone_number,
          call.enhanced_status,
          call.meeting_booked ? 'meeting booked' : '',
          call.person_interested ? 'interested' : '',
          call.person_very_upset ? 'upset' : '',
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(term);
      });
    } else {
      filteredCalls = allCalls;
    }
    if (filteredCalls.length > 0) {
      renderCalls(filteredCalls);
      updatePagination();
    } else {
      const container = document.getElementById('calls-table-content');
      if (container) container.innerHTML = '<div class=\"no-data\">No calls found matching your search</div>';
      hidePagination();
    }
  });
}

export function bindCallsTab() {
  const refreshCallsBtn = document.getElementById('refresh-calls-btn');
  const syncCallsBtn = document.getElementById('sync-calls-btn');
  refreshCallsBtn?.addEventListener('click', () => loadCalls(1));
  syncCallsBtn?.addEventListener('click', async () => {
    await apiPost('/api/sync-calls');
    await loadCalls(1);
  });

  // Filters
  const applyFiltersBtn = document.getElementById('apply-filters-btn');
  const clearFiltersBtn = document.getElementById('clear-filters-btn');
  applyFiltersBtn?.addEventListener('click', () => loadCalls(1));
  clearFiltersBtn?.addEventListener('click', () => {
    document.getElementById('filter-call-result').value = '';
    document.getElementById('filter-phone').value = '';
    document.getElementById('filter-date-start').value = '';
    document.getElementById('filter-date-end').value = '';
    document.getElementById('filter-meeting').value = '';
    document.getElementById('filter-interested').value = '';
    document.getElementById('filter-upset').value = '';
    document.getElementById('filter-duration').value = '';
    searchTerm = '';
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.value = '';
    loadCalls(1);
  });
}

