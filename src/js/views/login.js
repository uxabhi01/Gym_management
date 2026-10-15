import { API } from '../api.js';
import { bootstrapApp } from '../main.js';

export async function renderLogin(mountPoint) {
  mountPoint.innerHTML = `
    <div class="login-card">
      <div class="login-header">
        <div class="login-logo">
          <i data-lucide="dumbbell"></i>
        </div>
        <h2>APEX<span>GYM</span></h2>
        <p>Enter administrative credentials to proceed</p>
      </div>

      <form id="login-form">
        <div class="form-group">
          <label for="username">Username</label>
          <input type="text" id="username" class="form-control" placeholder="e.g. admin" required autocomplete="username">
        </div>
        
        <div class="form-group" style="margin-bottom: 1.5rem;">
          <label for="password">Password</label>
          <input type="password" id="password" class="form-control" placeholder="••••••••" required autocomplete="current-password">
        </div>

        <div id="login-error" class="hidden" style="color: var(--status-danger); font-size: 0.85rem; margin-bottom: 1.25rem; text-align: center; font-weight: 600;">
          Invalid username or password.
        </div>

        <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 0.5rem;" id="login-submit">
          <i data-lucide="log-in"></i>
          <span>Secure Sign In</span>
        </button>
      </form>
    </div>
  `;

  // Draw lucide icons on login card
  if (window.lucide) {
    window.lucide.createIcons();
  }

  const form = document.getElementById('login-form');
  const errorEl = document.getElementById('login-error');
  const submitBtn = document.getElementById('login-submit');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.classList.add('hidden');
    submitBtn.disabled = true;
    submitBtn.querySelector('span').textContent = 'Connecting...';

    const username = form.username.value.trim();
    const password = form.password.value;

    try {
      const data = await API.login(username, password);
      
      // Store verification tokens
      localStorage.setItem('apex_token', data.token);
      localStorage.setItem('apex_username', data.user.username);
      localStorage.setItem('apex_user_name', data.user.name);
      
      // Load application
      await bootstrapApp();
    } catch (err) {
      console.error('Login error:', err);
      errorEl.textContent = err.message || 'Credentials authentication rejected.';
      errorEl.classList.remove('hidden');
      
      // Restore submit button state
      submitBtn.disabled = false;
      submitBtn.querySelector('span').textContent = 'Secure Sign In';
    }
  });
}
