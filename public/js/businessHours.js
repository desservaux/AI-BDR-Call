import { apiPost } from './api.js';

function getEl(id) { return document.getElementById(id); }

export function bindBusinessHoursPreview() {
  const tz = getEl('sequenceTimezone');
  const start = getEl('sequenceBusinessHoursStart');
  const end = getEl('sequenceBusinessHoursEnd');
  const excl = getEl('sequenceExcludeWeekends');
  const preview = getEl('businessHoursPreview');
  const validation = getEl('businessHoursValidation');

  async function update() {
    if (!tz || !start || !end || !preview) return;
    const cfg = {
      timezone: tz.value || 'UTC',
      business_hours_start: (start.value || '09:00') + ':00',
      business_hours_end: (end.value || '17:00') + ':00',
      exclude_weekends: !!excl?.checked,
    };
    preview.textContent = `Business Hours: ${start.value || '09:00'} - ${end.value || '17:00'} ${cfg.timezone}${cfg.exclude_weekends ? ' (excluding weekends)' : ''}`;
    validation.textContent = '';
    try {
      const res = await apiPost('/api/sequences/validate-business-hours', cfg);
      if (!res.success || !res.isValid) {
        validation.textContent = (res.errors || ['Invalid business hours']).join(', ');
      }
    } catch {}
  }

  [tz, start, end, excl].forEach((el) => el && el.addEventListener('change', update));
  update();
}


