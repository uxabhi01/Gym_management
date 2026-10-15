import { API } from '../api.js';
import { Router } from '../router.js';
import { updateNotificationBadge } from './notifications.js';

export async function renderProfile(mountPoint, memberId) {
  if (!memberId) {
    mountPoint.innerHTML = `
      <div class="view-container">
        <div class="glass-card" style="text-align: center; padding: 3rem;">
          <i data-lucide="alert-triangle" style="width: 48px; height: 48px; color: var(--status-warning); margin-bottom: 1rem;"></i>
          <h3>No Member Selected</h3>
          <p>Please return to the members directory and choose a member.</p>
          <button class="btn btn-primary" style="margin-top: 1.5rem;" id="btn-profile-back">Go to Directory</button>
        </div>
      </div>
    `;
    document.getElementById('btn-profile-back').addEventListener('click', () => Router.navigate('members'));
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  const profileData = await API.getMemberProfile(memberId);
  const m = profileData.member;
  const attendance = profileData.attendance;
  const payments = profileData.payments;

  // Format initials
  const initials = m.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

  // Format dates
  const options = { month: 'short', day: 'numeric', year: 'numeric' };
  const startF = new Date(m.start_date).toLocaleDateString('en-US', options);
  const endF = new Date(m.end_date).toLocaleDateString('en-US', options);

  // Status Badge
  let badgeClass = 'badge-active';
  let badgeLabel = m.status;
  
  const today = new Date();
  today.setHours(0,0,0,0);
  const end = new Date(m.end_date);
  end.setHours(0,0,0,0);
  const diffTime = end - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (m.status === 'Active' && diffDays >= 0 && diffDays <= 7) {
    badgeClass = 'badge-expiring';
    badgeLabel = 'Expiring Soon';
  } else if (m.status === 'Expired') {
    badgeClass = 'badge-expired';
  }

  mountPoint.innerHTML = `
    <div class="view-container">
      <!-- Header Navigation Link -->
      <div class="view-header" style="margin-bottom: 1.5rem;">
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <button class="icon-btn" id="btn-back-dir" style="width: 36px; height: 36px;">
            <i data-lucide="arrow-left" style="width: 18px; height: 18px;"></i>
          </button>
          <div class="view-title">
            <h2>Member Details</h2>
            <p>Profile overview for ${m.name}</p>
          </div>
        </div>
        <div style="display: flex; gap: 0.75rem;">
          <button class="btn btn-secondary" id="btn-edit-member">
            <i data-lucide="edit-3"></i> Edit Profile
          </button>
          <button class="btn btn-danger" id="btn-delete-member" style="padding: 0.5rem 1rem;">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      </div>

      <!-- Main Layout -->
      <div class="profile-grid">
        <!-- Sidebar Column -->
        <div class="profile-sidebar">
          <div class="glass-card profile-card">
            <div class="profile-avatar">${initials}</div>
            <h3>${m.name}</h3>
            <div class="profile-phone">${m.phone}</div>
            <span class="badge ${badgeClass}" style="margin-bottom: 1.5rem;">${badgeLabel}</span>

            <div class="profile-details-list">
              <div class="detail-item">
                <span class="detail-label">Membership Type</span>
                <span class="detail-value">${m.membership_type}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Start Date</span>
                <span class="detail-value">${startF}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">End Date</span>
                <span class="detail-value">${endF}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Email Address</span>
                <span class="detail-value" style="font-size: 0.8rem; word-break: break-all;">${m.email || '—'}</span>
              </div>
            </div>
          </div>

          <!-- Quick Reminders Drawer Actions -->
          <div class="glass-card" id="profile-reminders-panel">
            <!-- Rendered by JS below -->
          </div>
        </div>

        <!-- Main Column tabs -->
        <div class="profile-main">
          <!-- Navigation Tab Selectors -->
          <div class="profile-tabs-nav">
            <button class="profile-tab-btn active" id="tab-btn-fin">Payments & Ledger</button>
            <button class="profile-tab-btn" id="tab-btn-att">Attendance Logs</button>
          </div>

          <!-- Payments & Finance Panel -->
          <div id="panel-fin" class="profile-panel">
            <div class="glass-card finance-overview" style="margin-bottom: 1.5rem;">
              <div class="finance-box">
                <div class="finance-label">Total Cost</div>
                <div class="finance-val total">₹${m.total_fee}</div>
              </div>
              <div class="finance-box">
                <div class="finance-label">Paid</div>
                <div class="finance-val paid">₹${m.paid_amount}</div>
              </div>
              <div class="finance-box">
                <div class="finance-label">Outstanding Due</div>
                <div class="finance-val due">₹${m.due_amount}</div>
              </div>
            </div>

            <div class="glass-card" style="padding: 0; overflow: hidden;">
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--glass-border);">
                <h3 style="font-size: 1rem; font-weight: 700;">Transactions Ledger</h3>
                ${m.due_amount > 0 ? `
                  <button class="btn btn-primary" id="btn-collect-due" style="padding: 0.5rem 1rem; font-size: 0.85rem;">
                    <i data-lucide="hand-coins"></i> Collect Payment
                  </button>
                ` : ''}
              </div>
              
              <div class="table-responsive">
                <table class="apex-table">
                  <thead>
                    <tr>
                      <th style="padding-left: 1.5rem;">Date</th>
                      <th>Amount</th>
                      <th>Method</th>
                      <th class="hide-mobile">Reference ID / Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${payments.length === 0 ? `
                      <tr>
                        <td colspan="4" style="text-align: center; padding: 3rem; color: var(--text-muted);">
                          No payment receipts found.
                        </td>
                      </tr>
                    ` : payments.map(p => {
                      const payDate = new Date(p.payment_date).toLocaleDateString('en-US', options);
                      return `
                        <tr>
                          <td style="padding-left: 1.5rem; font-weight: 500;">${payDate}</td>
                          <td style="color: var(--status-active); font-weight: 600;">₹${p.amount}</td>
                          <td><span class="badge" style="background: var(--bg-tertiary);">${p.payment_method}</span></td>
                          <td class="hide-mobile" style="color: var(--text-secondary); font-size: 0.85rem;">${p.reference || '—'}</td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- Attendance Logs Panel -->
          <div id="panel-att" class="profile-panel hidden">
            <div class="glass-card" style="padding: 0; overflow: hidden;">
              <div style="padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--glass-border);">
                <h3 style="font-size: 1rem; font-weight: 700;">Access Logs (Last 30 days)</h3>
              </div>
              <div class="table-responsive">
                <table class="apex-table">
                  <thead>
                    <tr>
                      <th style="padding-left: 1.5rem;">Date</th>
                      <th>Check In</th>
                      <th>Check Out</th>
                      <th class="hide-mobile">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${attendance.length === 0 ? `
                      <tr>
                        <td colspan="4" style="text-align: center; padding: 3rem; color: var(--text-muted);">
                          No attendance logs recorded.
                        </td>
                      </tr>
                    ` : attendance.map(a => {
                      const cIn = new Date(a.check_in_time);
                      const dateStr = cIn.toLocaleDateString('en-US', options);
                      const checkInTime = cIn.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                      
                      let checkOutTime = '—';
                      let duration = 'Active Session';
                      
                      if (a.check_out_time) {
                        const cOut = new Date(a.check_out_time);
                        checkOutTime = cOut.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                        
                        const diffMins = Math.round((cOut - cIn) / (1000 * 60));
                        const hrs = Math.floor(diffMins / 60);
                        const mins = diffMins % 60;
                        duration = hrs > 0 ? `${hrs}h ${mins}m` : `${mins} mins`;
                      }

                      return `
                        <tr>
                          <td style="padding-left: 1.5rem; font-weight: 500;">${dateStr}</td>
                          <td style="color: var(--status-active);">${checkInTime}</td>
                          <td>${checkOutTime}</td>
                          <td class="hide-mobile" style="color: var(--text-secondary); font-size: 0.85rem;">${duration}</td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  `;

  // Render Reminders Panel based on status
  renderProfileReminders(m);

  // Tab switching triggers
  const tabFin = document.getElementById('tab-btn-fin');
  const tabAtt = document.getElementById('tab-btn-att');
  const panelFin = document.getElementById('panel-fin');
  const panelAtt = document.getElementById('panel-att');

  tabFin.addEventListener('click', () => {
    tabFin.classList.add('active');
    tabAtt.classList.remove('active');
    panelFin.classList.remove('hidden');
    panelAtt.classList.add('hidden');
  });

  tabAtt.addEventListener('click', () => {
    tabAtt.classList.add('active');
    tabFin.classList.remove('active');
    panelAtt.classList.remove('hidden');
    panelFin.classList.add('hidden');
  });

  // Action Click Events
  document.getElementById('btn-back-dir').addEventListener('click', () => Router.navigate('members'));
  
  document.getElementById('btn-edit-member').addEventListener('click', () => {
    openEditMemberModal(m, () => renderProfile(mountPoint, memberId));
  });

  document.getElementById('btn-delete-member').addEventListener('click', async () => {
    if (confirm(`Are you sure you want to permanently delete member ${m.name}? This will remove all their payment and attendance histories.`)) {
      try {
        await API.deleteMember(m.id);
        await updateNotificationBadge();
        Router.navigate('members');
      } catch (err) {
        alert('Error deleting member: ' + err.message);
      }
    }
  });

  // Collect Payment Trigger (Inside Ledger header)
  const collectBtn = document.getElementById('btn-collect-due');
  if (collectBtn) {
    collectBtn.addEventListener('click', () => {
      openRecordPaymentModal(m, () => renderProfile(mountPoint, memberId));
    });
  }

  if (window.lucide) window.lucide.createIcons();
}

function renderProfileReminders(member) {
  const panel = document.getElementById('profile-reminders-panel');
  if (!panel) return;

  const today = new Date();
  today.setHours(0,0,0,0);
  const end = new Date(member.end_date);
  end.setHours(0,0,0,0);
  const diffTime = end - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  const isExpiring = member.status === 'Active' && diffDays >= 0 && diffDays <= 7;
  const isExpired = member.status === 'Expired';
  const hasDue = member.due_amount > 0;

  if (!isExpiring && !isExpired && !hasDue) {
    panel.innerHTML = `
      <div class="empty-state" style="padding: 1.5rem 1rem;">
        <i data-lucide="shield-check" style="color: var(--status-active); opacity: 0.8; width: 36px; height: 36px; margin-bottom: 0.5rem;"></i>
        <p style="font-size: 0.85rem; font-weight: 500;">Account is in good standing. No alerts.</p>
      </div>
    `;
    return;
  }

  let htmlContent = `<h3 style="font-size: 0.95rem; color: var(--text-secondary); margin-bottom: 1rem; font-weight: 700;">Account Alerts</h3>`;

  const phoneClean = member.phone.replace(/[^0-9]/g, '');
  const phoneWithCode = phoneClean.length === 10 ? `91${phoneClean}` : phoneClean;

  // 1. Expiration Alert
  if (isExpiring || isExpired) {
    const severity = isExpired ? 'danger' : 'warning';
    const message = isExpired 
      ? `Membership expired on ${member.end_date}. Access has been suspended.`
      : `Membership is expiring in ${diffDays} days (${member.end_date}).`;
    
    const waText = `Hello, this is a friendly reminder from Apex Gym. Your membership plan has ${isExpired ? 'expired' : 'is expiring soon'} (Date: ${member.end_date}). Please visit the front desk to renew your plan and continue training! Thank you.`;
    const waUrl = `https://wa.me/${phoneWithCode}?text=${encodeURIComponent(waText)}`;

    htmlContent += `
      <div class="glass-card reminder-card ${severity}" style="padding: 1rem; margin-bottom: 1rem;">
        <div class="reminder-header ${severity}">
          <i data-lucide="calendar-clock"></i>
          <span>${isExpired ? 'Membership Expired' : 'Expiring Soon'}</span>
        </div>
        <p style="font-size: 0.8rem; color: var(--text-secondary);">${message}</p>
        <div class="reminder-actions">
          <a href="${waUrl}" target="_blank" class="btn btn-warning" style="padding: 0.4rem 0.8rem; font-size: 0.75rem; width: 100%; border: 1px solid rgba(245, 158, 11, 0.3);">
            <i data-lucide="message-square"></i> WhatsApp Reminder
          </a>
        </div>
      </div>
    `;
  }

  // 2. Outstanding Balance Alert
  if (hasDue) {
    const waText = `Hello, this is a friendly reminder from Apex Gym. You have an outstanding membership balance of ₹${member.due_amount}. Kindly clear the pending payment at your earliest convenience. Thank you!`;
    const waUrl = `https://wa.me/${phoneWithCode}?text=${encodeURIComponent(waText)}`;

    htmlContent += `
      <div class="glass-card reminder-card danger" style="padding: 1rem;">
        <div class="reminder-header danger">
          <i data-lucide="wallet"></i>
          <span>Outstanding Balance</span>
        </div>
        <p style="font-size: 0.8rem; color: var(--text-secondary);">This account has a pending balance of ₹${member.due_amount}.</p>
        <div class="reminder-actions">
          <a href="${waUrl}" target="_blank" class="btn btn-danger" style="padding: 0.4rem 0.8rem; font-size: 0.75rem; width: 100%; border: 1px solid rgba(239, 68, 68, 0.3);">
            <i data-lucide="message-square"></i> WhatsApp Dues Alert
          </a>
        </div>
      </div>
    `;
  }

  panel.innerHTML = htmlContent;
}

// Payment Recording Modal
function openRecordPaymentModal(member, onPaymentSuccess) {
  const modalContainer = document.getElementById('modal-container');
  if (!modalContainer) return;

  const todayStr = new Date().toISOString().split('T')[0];

  modalContainer.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>Collect Payment</h3>
        <button class="close-btn" id="modal-close"><i data-lucide="x"></i></button>
      </div>
      <form id="record-payment-form">
        <input type="hidden" id="p-member-id" value="${member.id}">
        <div class="modal-body">
          <p style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 1.25rem;">
            Recording transaction for <strong style="color: var(--text-primary);">${member.name}</strong>. Outstanding dues: ₹${member.due_amount}.
          </p>

          <div class="form-group">
            <label for="p-amount">Amount (₹)</label>
            <input type="number" id="p-amount" class="form-control" value="${member.due_amount}" max="${member.due_amount}" min="1" required>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="p-method">Payment Method</label>
              <select id="p-method" class="form-control" required>
                <option value="UPI">UPI / Net Banking</option>
                <option value="Cash">Cash</option>
                <option value="Card">Credit/Debit Card</option>
              </select>
            </div>
            <div class="form-group">
              <label for="p-date">Payment Date</label>
              <input type="date" id="p-date" class="form-control" value="${todayStr}" required>
            </div>
          </div>

          <div class="form-group">
            <label for="p-ref">Reference ID / Comments</label>
            <input type="text" id="p-ref" class="form-control" placeholder="e.g. UPI transaction hash or notes">
          </div>

          <div id="pay-modal-error" class="hidden" style="color: var(--status-danger); font-size: 0.85rem; font-weight: 600; text-align: center; margin-top: 0.5rem;">
            Error message.
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" id="modal-cancel">Cancel</button>
          <button type="submit" class="btn btn-primary" id="btn-save-payment">Log Transaction</button>
        </div>
      </form>
    </div>
  `;

  modalContainer.classList.remove('hidden');
  if (window.lucide) window.lucide.createIcons();

  const form = document.getElementById('record-payment-form');
  const errorEl = document.getElementById('pay-modal-error');
  const amountInput = document.getElementById('p-amount');

  const closeModal = () => {
    modalContainer.classList.add('hidden');
    modalContainer.innerHTML = '';
  };

  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.classList.add('hidden');

    const amount = parseFloat(amountInput.value);
    if (amount > member.due_amount) {
      errorEl.textContent = `Amount cannot exceed outstanding dues of ₹${member.due_amount}.`;
      errorEl.classList.remove('hidden');
      return;
    }

    const saveBtn = document.getElementById('btn-save-payment');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Processing...';

    const payData = {
      member_id: member.id,
      amount,
      payment_method: document.getElementById('p-method').value,
      payment_date: document.getElementById('p-date').value,
      reference: document.getElementById('p-ref').value.trim() || null
    };

    try {
      await API.recordPayment(payData);
      closeModal();
      
      // Update UI and badges
      await onPaymentSuccess();
      await updateNotificationBadge();
    } catch (err) {
      console.error(err);
      errorEl.textContent = err.message || 'Failed to record transaction.';
      errorEl.classList.remove('hidden');
      
      saveBtn.disabled = false;
      saveBtn.textContent = 'Log Transaction';
    }
  });
}

// Edit Member Profile Modal
function openEditMemberModal(member, onEditSuccess) {
  const modalContainer = document.getElementById('modal-container');
  if (!modalContainer) return;

  modalContainer.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>Edit Member Profile</h3>
        <button class="close-btn" id="modal-close"><i data-lucide="x"></i></button>
      </div>
      <form id="edit-member-form">
        <div class="modal-body" style="max-height: 70vh; overflow-y: auto;">
          <div class="form-group">
            <label for="e-name">Full Name</label>
            <input type="text" id="e-name" class="form-control" value="${member.name}" required>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label for="e-phone">Phone Number</label>
              <input type="tel" id="e-phone" class="form-control" value="${member.phone}" required pattern="[0-9]{10}">
            </div>
            <div class="form-group">
              <label for="e-email">Email Address</label>
              <input type="email" id="e-email" class="form-control" value="${member.email || ''}">
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="e-type">Membership Plan</label>
              <select id="e-type" class="form-control" required>
                <option value="Monthly" ${member.membership_type === 'Monthly' ? 'selected' : ''} data-months="1">Monthly Plan</option>
                <option value="Quarterly" ${member.membership_type === 'Quarterly' ? 'selected' : ''} data-months="3">Quarterly Plan</option>
                <option value="Annual" ${member.membership_type === 'Annual' ? 'selected' : ''} data-months="12">Annual Plan</option>
              </select>
            </div>
            <div class="form-group">
              <label for="e-start">Start Date</label>
              <input type="date" id="e-start" class="form-control" value="${member.start_date}" required>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="e-end">End Date</label>
              <input type="date" id="e-end" class="form-control" value="${member.end_date}" readonly>
            </div>
            <div class="form-group">
              <label for="e-fee">Total Fee (₹)</label>
              <input type="number" id="e-fee" class="form-control" value="${member.total_fee}" required min="0">
            </div>
          </div>

          <div id="edit-modal-error" class="hidden" style="color: var(--status-danger); font-size: 0.85rem; font-weight: 600; text-align: center; margin-top: 0.5rem;">
            Error message.
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" id="modal-cancel">Cancel</button>
          <button type="submit" class="btn btn-primary" id="btn-update-member">Save Changes</button>
        </div>
      </form>
    </div>
  `;

  modalContainer.classList.remove('hidden');
  if (window.lucide) window.lucide.createIcons();

  const form = document.getElementById('edit-member-form');
  const typeSelect = document.getElementById('e-type');
  const startInput = document.getElementById('e-start');
  const endInput = document.getElementById('e-end');
  const feeInput = document.getElementById('e-fee');
  const errorEl = document.getElementById('edit-modal-error');

  const recalculateEnd = () => {
    const selectedOption = typeSelect.options[typeSelect.selectedIndex];
    const months = parseInt(selectedOption.getAttribute('data-months'));
    const startDateVal = startInput.value;
    if (startDateVal) {
      const start = new Date(startDateVal);
      start.setMonth(start.getMonth() + months);
      endInput.value = start.toISOString().split('T')[0];
    }
  };

  typeSelect.addEventListener('change', recalculateEnd);
  startInput.addEventListener('change', recalculateEnd);

  const closeModal = () => {
    modalContainer.classList.add('hidden');
    modalContainer.innerHTML = '';
  };

  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.classList.add('hidden');

    const updateBtn = document.getElementById('btn-update-member');
    updateBtn.disabled = true;
    updateBtn.textContent = 'Updating...';

    const updateData = {
      name: document.getElementById('e-name').value.trim(),
      phone: document.getElementById('e-phone').value.trim(),
      email: document.getElementById('e-email').value.trim() || null,
      membership_type: typeSelect.value,
      start_date: startInput.value,
      end_date: endInput.value,
      total_fee: parseFloat(feeInput.value)
    };

    try {
      await API.updateMember(member.id, updateData);
      closeModal();
      await onEditSuccess();
      await updateNotificationBadge();
    } catch (err) {
      console.error(err);
      errorEl.textContent = err.message || 'Failed to update member profile.';
      errorEl.classList.remove('hidden');
      
      updateBtn.disabled = false;
      updateBtn.textContent = 'Save Changes';
    }
  });
}
