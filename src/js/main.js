import { Router } from './router.js';
import { renderLogin } from './views/login.js';
import { initNotifications } from './views/notifications.js';

document.addEventListener('DOMContentLoaded', () => {
  bootstrapApp();
});

export async function bootstrapApp() {
  const loader = document.getElementById('global-loader');
  const appShell = document.getElementById('app-shell');
  const authScreen = document.getElementById('auth-screen');

  // Display initial loading sequence
  if (loader) loader.classList.remove('hidden');

  const token = localStorage.getItem('apex_token');
  const adminName = localStorage.getItem('apex_user_name');

  if (!token) {
    // Unauthorized: Hide workspace, display login box
    if (appShell) appShell.classList.add('hidden');
    if (authScreen) authScreen.classList.remove('hidden');
    
    await renderLogin(authScreen);
    if (loader) loader.classList.add('hidden');
  } else {
    // Authorized: Display application layout, hide login
    if (authScreen) authScreen.classList.add('hidden');
    if (appShell) appShell.classList.remove('hidden');

    // Update admin username displays
    const nameEl = document.getElementById('user-display-name');
    if (nameEl && adminName) nameEl.textContent = adminName;

    // Initialize SPA navigation links
    Router.init();

    // Activate the sliding alerts panel drawer
    await initNotifications();

    // Direct user to the default screen (Dashboard)
    await Router.navigate('dashboard');

    // Hide loader after dashboard mount finishes
    if (loader) loader.classList.add('hidden');
  }
}

// Global Log-out Handler
const logoutBtn = document.getElementById('action-logout');
if (logoutBtn) {
  logoutBtn.addEventListener('click', (e) => {
    e.preventDefault();
    localStorage.removeItem('apex_token');
    localStorage.removeItem('apex_username');
    localStorage.removeItem('apex_user_name');
    
    // Force reboot application layout back to authentication state
    bootstrapApp();
  });
}
