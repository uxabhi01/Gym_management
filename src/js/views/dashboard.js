import { API } from '../api.js';
import { Router } from '../router.js';

let statusChartInstance = null;
let revenueChartInstance = null;

export async function renderDashboard(mountPoint) {
  const stats = await API.getDashboardStats();

  mountPoint.innerHTML = `
    <div class="view-container">
      <div class="view-header">
        <div class="view-title">
          <h2>Welcome Back, Admin</h2>
          <p>Here is a summary of the fitness center metrics today</p>
        </div>
      </div>

      <!-- Quick Metrics Grid -->
      <div class="dashboard-grid">
        <div class="glass-card metric-card" id="card-metric-active" style="cursor: pointer;">
          <div class="metric-icon emerald">
            <i data-lucide="users"></i>
          </div>
          <div class="metric-details">
            <p>Active Members</p>
            <div class="metric-number">${stats.activeMembers}</div>
          </div>
        </div>

        <div class="glass-card metric-card" id="card-metric-expiring" style="cursor: pointer;">
          <div class="metric-icon amber">
            <i data-lucide="calendar-clock"></i>
          </div>
          <div class="metric-details">
            <p>Expiring Soon</p>
            <div class="metric-number">${stats.expiringSoon}</div>
          </div>
        </div>

        <div class="glass-card metric-card" id="card-metric-due" style="cursor: pointer;">
          <div class="metric-icon danger">
            <i data-lucide="credit-card"></i>
          </div>
          <div class="metric-details">
            <p>Payments Due</p>
            <div class="metric-number">${stats.paymentsDue}</div>
          </div>
        </div>

        <div class="glass-card metric-card" id="card-metric-attendance" style="cursor: pointer;">
          <div class="metric-icon indigo">
            <i data-lucide="calendar-check"></i>
          </div>
          <div class="metric-details">
            <p>Today's Check-ins</p>
            <div class="metric-number">${stats.todayAttendance}</div>
          </div>
        </div>
      </div>

      <!-- Visual Chart Analytics -->
      <div class="charts-grid">
        <div class="glass-card chart-card">
          <h3>Revenue Analytics (Last 6 Months)</h3>
          <div class="chart-container">
            <canvas id="revenue-chart-canvas"></canvas>
          </div>
        </div>
        <div class="glass-card chart-card">
          <h3>Plan Status Distribution</h3>
          <div class="chart-container">
            <canvas id="status-chart-canvas"></canvas>
          </div>
        </div>
      </div>

      <!-- Quick Shortcuts Section -->
      <div class="glass-card">
        <h3 style="font-size: 1rem; color: var(--text-secondary); margin-bottom: 1.25rem; font-weight: 600;">
          Quick Administrative Shortcuts
        </h3>
        <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
          <button class="btn btn-primary" id="btn-qa-add">
            <i data-lucide="user-plus"></i> Register Member
          </button>
          <button class="btn btn-secondary" id="btn-qa-scan">
            <i data-lucide="calendar-check"></i> Attendance Check-In
          </button>
          <button class="btn btn-secondary" id="btn-qa-pay">
            <i data-lucide="banknote"></i> Log Payment
          </button>
        </div>
      </div>
    </div>
  `;

  // Bind navigation on clicking metric cards
  document.getElementById('card-metric-active').addEventListener('click', () => {
    Router.navigate('members', { filter: 'Active' });
  });

  document.getElementById('card-metric-expiring').addEventListener('click', () => {
    Router.navigate('members', { filter: 'Expiring' });
  });

  document.getElementById('card-metric-due').addEventListener('click', () => {
    Router.navigate('members', { filter: 'Unpaid' });
  });

  document.getElementById('card-metric-attendance').addEventListener('click', () => {
    Router.navigate('attendance');
  });

  // Bind Quick Actions shortcuts
  document.getElementById('btn-qa-add').addEventListener('click', () => {
    Router.navigate('members', { openAddModal: true });
  });

  document.getElementById('btn-qa-scan').addEventListener('click', () => {
    Router.navigate('attendance');
  });

  document.getElementById('btn-qa-pay').addEventListener('click', () => {
    Router.navigate('payments', { openRecordModal: true });
  });

  // Render Charts using Chart.js
  initCharts(stats.charts);
}

function initCharts(chartsData) {
  // Clear any existing chart instances to avoid overlap
  if (statusChartInstance) statusChartInstance.destroy();
  if (revenueChartInstance) revenueChartInstance.destroy();

  const statusCanvas = document.getElementById('status-chart-canvas');
  const revenueCanvas = document.getElementById('revenue-chart-canvas');

  if (!statusCanvas || !revenueCanvas) return;

  // Chart Global Default Settings for Dark Mode
  Chart.defaults.color = '#9ca3af';
  Chart.defaults.font.family = 'Outfit, sans-serif';

  // 1. Members Status Doughnut Chart
  const statusLabels = chartsData.statusBreakdown.map(s => s.status);
  const statusCounts = chartsData.statusBreakdown.map(s => s.count);
  const statusColors = statusLabels.map(label => {
    if (label === 'Active') return '#10b981'; // Emerald
    if (label === 'Expired') return '#ef4444'; // Red
    return '#6b7280'; // Muted Grey
  });

  statusChartInstance = new Chart(statusCanvas, {
    type: 'doughnut',
    data: {
      labels: statusLabels,
      datasets: [{
        data: statusCounts,
        backgroundColor: statusColors,
        borderWidth: 2,
        borderColor: '#0f1422' // matches --bg-secondary
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { padding: 15, boxWidth: 12, usePointStyle: true }
        }
      },
      cutout: '65%'
    }
  });

  // 2. Revenue Inflow Monthly Bar Chart
  const revenueLabels = chartsData.paymentTrend.map(t => {
    // Format "2026-08" to "Aug 2026"
    const [year, month] = t.month.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  });
  const revenueTotals = chartsData.paymentTrend.map(t => t.total);

  revenueChartInstance = new Chart(revenueCanvas, {
    type: 'bar',
    data: {
      labels: revenueLabels,
      datasets: [{
        label: 'Revenue (₹)',
        data: revenueTotals,
        backgroundColor: 'rgba(99, 102, 241, 0.45)', // transparent indigo
        borderColor: '#6366f1',
        borderWidth: 2,
        borderRadius: 6,
        hoverBackgroundColor: '#6366f1'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          grid: { display: false }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: {
            callback: (value) => '₹' + value
          }
        }
      }
    }
  });
}
