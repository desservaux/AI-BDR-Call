import { apiGet } from './api.js';

let charts = {};

function updateAnalyticsDisplay(analytics) {
  document.getElementById('total-calls').textContent = analytics.totalCalls || 0;
  document.getElementById('success-rate').textContent = `${analytics.successRate || 0}%`;
  document.getElementById('avg-duration').textContent = `${analytics.avgDuration || 0}m`;
  document.getElementById('meetings-booked').textContent = analytics.meetingsBooked || 0;
}

function createCharts(analytics) {
  Object.values(charts).forEach((chart) => chart?.destroy());
  charts = {};
  // Chart.js rendering will be migrated incrementally
}

export async function loadAnalytics() {
  try {
    const data = await apiGet('/api/analytics');
    if (data.success) {
      updateAnalyticsDisplay(data.analytics);
      createCharts(data.analytics);
    }
  } catch (e) {
    console.error('Error loading analytics:', e);
  }
}

