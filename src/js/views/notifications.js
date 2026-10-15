import { API } from '../api.js';
import { Router } from '../router.js';

let drawerInstance = null;

export async function initNotifications() {
  const toggleBtn = document.getElementById('notification-toggle');
  const drawer = document.getElementById('notifications-drawer');
  const closeBtn = document.getElementById('drawer-close');
  const overlay = document.getElementById('drawer-overlay');

  if (!toggleBtn || !drawer) return;

  drawerInstance = drawer;

  const openDrawer = () => {
    drawer.classList.add('active');
    loadNotifications();
  };

  const closeDrawer = () => {
    drawer.classList.remove('active');
  };

  // Bind event listeners
  toggleBtn.addEventListener('click', (e) => {
    e.preventDefault();
    openDrawer();
  });

  closeBtn.addEventListener('click', closeDrawer);
  overlay.addEventListener('click', closeDrawer);

  // Initial fetch to load stats count badge on page start
  await updateNotificationBadge();
}

export async function updateNotificationBadge() {
  try {
    const alerts = await API.getNotifications();
    const badge = document.getElementById('notification-count');
    
    if (badge) {
      if (alerts.length > 0) {
        badge.textContent = alerts.length;
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    }
  } catch (err) {
    console.error('Error fetching notification badge count:', err);
  }
}

export async function loadNotifications() {
  const listContainer = document.getElementById('notifications-list');
  if (!listContainer) return;

  listContainer.innerHTML = `
    <div style="display: flex; justify-content: center; padding: 2rem;">
      <div class="loader-spinner"></div>
    </div>
  `;

  try {
    const alerts = await API.getNotifications();
    
    // Update badge numbers concurrently
    const badge = document.getElementById('notification-count');
    if (badge) {
      if (alerts.length > 0) {
        badge.textContent = alerts.length;
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    }

    if (alerts.length === 0) {
      listContainer.innerHTML = `
        <div class="empty-state">
          <i data-lucide="bell-off"></i>
          <p>You're all caught up! No reminders.</p>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    listContainer.innerHTML = '';
    
    alerts.forEach(alert => {
      const alertCard = document.createElement('div');
      alertCard.className = `notification-alert ${alert.severity}`;
      
      const phoneClean = alert.phone ? alert.phone.replace(/[^0-9]/g, '') : '';
      
      // Select appropriate icon
      let alertIcon = 'alert-triangle';
      let waMessage = '';
      
      if (alert.type === 'expiring') {
        alertIcon = 'calendar-clock';
        waMessage = `Hello, this is a friendly reminder from Apex Gym. Your membership plan is expiring soon (Date: ${alert.message.split('expires on ')[1] || 'shortly'}). Please visit the front desk to renew your membership and continue your fitness journey! Thank you.`;
      } else if (alert.type === 'due') {
        alertIcon = 'dollar-sign';
        waMessage = `Hello, this is a friendly reminder from Apex Gym. You have an outstanding membership balance of ₹${alert.phone ? alert.message.split('outstanding balance of ₹')[1] || '' : ''}. Kindly complete the pending payment at your earliest convenience. Thank you!`;
      }

      // Prefix phone number with country code for India (+91) if it's 10 digits
      const phoneWithCode = phoneClean.length === 10 ? `91${phoneClean}` : phoneClean;
      const whatsappUrl = `https://wa.me/${phoneWithCode}?text=${encodeURIComponent(waMessage)}`;

      alertCard.innerHTML = `
        <div class="alert-title">
          <i data-lucide="${alertIcon}"></i>
          <span>${alert.title}</span>
        </div>
        <p class="alert-message">${alert.message}</p>
        <div class="alert-actions">
          <button class="alert-link action-view-profile" data-id="${alert.memberId}">
            <i data-lucide="user"></i> View Profile
          </button>
          ${alert.phone ? `
            <a href="${whatsappUrl}" target="_blank" class="alert-link" style="color: var(--status-active);">
              <i data-lucide="message-square"></i> Send WhatsApp
            </a>
          ` : ''}
        </div>
      `;
      
      listContainer.appendChild(alertCard);
    });

    // Bind event clicks to navigations inside drawer
    listContainer.querySelectorAll('.action-view-profile').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const memberId = btn.getAttribute('data-id');
        if (drawerInstance) {
          drawerInstance.classList.remove('active'); // Close drawer panel
        }
        Router.navigate('profile', memberId);
      });
    });

    if (window.lucide) {
      window.lucide.createIcons();
    }
  } catch (err) {
    console.error('Error loading notification content:', err);
    listContainer.innerHTML = `
      <div class="empty-state" style="color: var(--status-danger);">
        <i data-lucide="alert-octagon"></i>
        <p>Error retrieving notifications. Try again.</p>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
  }
}
