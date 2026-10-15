import { renderDashboard } from './views/dashboard.js';
import { renderMembers } from './views/members.js';
import { renderProfile } from './views/profile.js';
import { renderAttendance } from './views/attendance.js';
import { renderPayments } from './views/payments.js';

const MOUNT_POINT_ID = 'view-mount-point';

export const Router = {
  currentView: null,
  currentParams: null,

  init() {
    // Register navigation link click handlers
    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetView = link.getAttribute('data-view');
        this.navigate(targetView);
      });
    });
  },

  async navigate(viewName, params = null) {
    const mountPoint = document.getElementById(MOUNT_POINT_ID);
    if (!mountPoint) return;

    this.currentView = viewName;
    this.currentParams = params;

    // Highlight the active link in the navigation header
    document.querySelectorAll('.nav-link').forEach(link => {
      const viewAttr = link.getAttribute('data-view');
      // If we are viewing profile, highlight the members navigation link
      const isMemberRelated = viewName === 'profile' && viewAttr === 'members';
      
      if (viewAttr === viewName || isMemberRelated) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    // Reset view mount point with a loading spinner
    mountPoint.innerHTML = `
      <div style="display: flex; justify-content: center; align-items: center; min-height: 300px;">
        <div class="loader-spinner"></div>
      </div>
    `;

    try {
      switch (viewName) {
        case 'dashboard':
          await renderDashboard(mountPoint);
          break;
        case 'members':
          await renderMembers(mountPoint);
          break;
        case 'profile':
          await renderProfile(mountPoint, params);
          break;
        case 'attendance':
          await renderAttendance(mountPoint);
          break;
        case 'payments':
          await renderPayments(mountPoint);
          break;
        default:
          mountPoint.innerHTML = `
            <div class="empty-state">
              <i data-lucide="alert-triangle"></i>
              <p>Requested view "${viewName}" does not exist.</p>
            </div>
          `;
      }

      // Automatically render Lucide icon templates
      if (window.lucide) {
        window.lucide.createIcons();
      }
    } catch (err) {
      console.error(`Error mounting view [${viewName}]:`, err);
      mountPoint.innerHTML = `
        <div class="glass-card" style="border-color: var(--status-danger); text-align: center; padding: 3rem 1.5rem; max-width: 500px; margin: 3rem auto;">
          <i data-lucide="alert-octagon" style="width: 48px; height: 48px; color: var(--status-danger); margin-bottom: 1rem;"></i>
          <h3 style="color: var(--status-danger); margin-bottom: 0.5rem; font-size: 1.25rem;">Failed to load view</h3>
          <p style="color: var(--text-secondary); font-size: 0.95rem; margin-bottom: 1.5rem;">${err.message}</p>
          <button class="btn btn-primary" id="btn-view-retry">Retry Load</button>
        </div>
      `;
      
      const retryBtn = document.getElementById('btn-view-retry');
      if (retryBtn) {
        retryBtn.addEventListener('click', () => this.navigate(viewName, params));
      }

      if (window.lucide) {
        window.lucide.createIcons();
      }
    }
  }
};
