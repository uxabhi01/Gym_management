import { API } from '../api.js';
import { Router } from '../router.js';
import { updateNotificationBadge } from './notifications.js';

export async function renderMembers(mountPoint, routeParams = null) {
  // If navigated from dashboard, default filters might be passed
  let initialFilter = 'All';
  if (routeParams) {
    if (routeParams.filter) initialFilter = routeParams.filter;
  }

  mountPoint.innerHTML = `
    <div class="view-container">
      <div class="view-header">
        <div class="view-title">
          <h2>Members Directory</h2>
          <p>Search, filter, and register gym members</p>
        </div>
        <button class="btn btn-primary" id="btn-add-member">
          <i data-lucide="user-plus"></i> Add New Member
        </button>
      </div>

      <!-- Action search/filter row -->
      <div class="glass-card action-row">
        <div class="search-wrapper">
          <i data-lucide="search"></i>
          <input type="text" id="member-search" class="form-control" placeholder="Search by name, phone or email...">
        </div>
        <div class="filter-wrapper">
          <select id="member-status-filter" class="form-control">
            <option value="All" ${initialFilter === 'All' ? 'selected' : ''}>All Members</option>
            <option value="Active" ${initialFilter === 'Active' ? 'selected' : ''}>Active</option>
            <option value="Expiring" ${initialFilter === 'Expiring' ? 'selected' : ''}>Expiring Soon (≤ 7 days)</option>
            <option value="Unpaid" ${initialFilter === 'Unpaid' ? 'selected' : ''}>Payment Due</option>
            <option value="Expired" ${initialFilter === 'Expired' ? 'selected' : ''}>Expired</option>
          </select>
        </div>
      </div>

      <!-- Members Table -->
      <div class="glass-card" style="padding: 0; overflow: hidden;">
        <div class="table-responsive">
          <table class="apex-table">
            <thead>
              <tr>
                <th>Member Details</th>
                <th class="hide-mobile">Plan Type</th>
                <th>Validity</th>
                <th>Status</th>
                <th class="hide-mobile">Financials</th>
                <th style="text-align: right; padding-right: 1.5rem;" class="hide-mobile">Actions</th>
              </tr>
            </thead>
            <tbody id="members-list-tbody">
              <!-- Rendered via JS -->
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  // Bind main event listeners
  const searchInput = document.getElementById('member-search');
  const statusFilter = document.getElementById('member-status-filter');
  const addBtn = document.getElementById('btn-add-member');

  const fetchAndRenderList = async () => {
    const q = searchInput.value.trim();
    const status = statusFilter.value;
    await renderMembersList(q, status);
  };

  searchInput.addEventListener('input', fetchAndRenderList);
  statusFilter.addEventListener('change', fetchAndRenderList);
  
  addBtn.addEventListener('click', () => {
    openAddMemberModal(fetchAndRenderList);
  });

  // Pull initial list
  await fetchAndRenderList();

  // If redirected from shortcuts to automatically open the Add Member popup
  if (routeParams && routeParams.openAddModal) {
    openAddMemberModal(fetchAndRenderList);
  }
}

async function renderMembersList(query, filter) {
  const tbody = document.getElementById('members-list-tbody');
  if (!tbody) return;

  tbody.innerHTML = `
    <tr>
      <td colspan="6" style="text-align: center; padding: 3rem;">
        <div class="loader-spinner" style="margin: 0 auto;"></div>
      </td>
    </tr>
  `;

  try {
    const members = await API.getMembers(query, filter);

    if (members.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 4rem; color: var(--text-muted);">
            <i data-lucide="users" style="width: 40px; height: 40px; opacity: 0.3; margin-bottom: 0.75rem;"></i>
            <p>No members found matching the criteria.</p>
          </td>
        </tr>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    tbody.innerHTML = '';

    members.forEach(member => {
      const tr = document.createElement('tr');
      
      // Avatar text (initials)
      const initials = member.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
      
      // Format dates
      const options = { month: 'short', day: 'numeric', year: 'numeric' };
      const startF = new Date(member.start_date).toLocaleDateString('en-US', options);
      const endF = new Date(member.end_date).toLocaleDateString('en-US', options);
      
      // Determine badge class
      let badgeClass = 'badge-active';
      let badgeLabel = member.status;
      
      // Client-side calculations to check for expiring soon within 7 days
      const today = new Date();
      today.setHours(0,0,0,0);
      const end = new Date(member.end_date);
      end.setHours(0,0,0,0);
      const diffTime = end - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (member.status === 'Active' && diffDays >= 0 && diffDays <= 7) {
        badgeClass = 'badge-expiring';
        badgeLabel = 'Expiring Soon';
      } else if (member.status === 'Expired') {
        badgeClass = 'badge-expired';
      }

      // Calculate dues indicator
      let financeText = `₹${member.paid_amount} / ₹${member.total_fee}`;
      let financeClass = '';
      if (member.due_amount > 0) {
        financeClass = 'style="color: #f97316; font-weight: 600;"';
        financeText += ` (Due: ₹${member.due_amount})`;
      }

      tr.innerHTML = `
        <td>
          <div class="member-cell">
            <div class="member-avatar-text">${initials}</div>
            <div class="member-info">
              <a class="member-name-link action-view" data-id="${member.id}">${member.name}</a>
              <span class="member-phone">${member.phone}</span>
            </div>
          </div>
        </td>
        <td class="hide-mobile">
          <div style="font-weight: 500;">${member.membership_type}</div>
          <span style="font-size: 0.75rem; color: var(--text-secondary);">Plan</span>
        </td>
        <td>
          <div style="font-size: 0.85rem; font-weight: 500;">${endF}</div>
          <span style="font-size: 0.75rem; color: var(--text-muted);">Ends (Started: ${startF})</span>
        </td>
        <td>
          <span class="badge ${badgeClass}">${badgeLabel}</span>
        </td>
        <td class="hide-mobile">
          <div ${financeClass} style="font-size: 0.85rem;">${financeText}</div>
        </td>
        <td style="text-align: right; padding-right: 1.5rem;" class="hide-mobile">
          <button class="btn btn-secondary action-view" data-id="${member.id}" style="padding: 0.4rem 0.8rem; font-size: 0.8rem;">
            Profile
          </button>
        </td>
      `;

      tbody.appendChild(tr);
    });

    // Bind profile clicks
    tbody.querySelectorAll('.action-view').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const id = btn.getAttribute('data-id');
        Router.navigate('profile', id);
      });
    });

    if (window.lucide) {
      window.lucide.createIcons();
    }
  } catch (err) {
    console.error('Error loading members table:', err);
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 3rem; color: var(--status-danger);">
          <i data-lucide="alert-circle" style="margin-bottom: 0.5rem;"></i>
          <p>Failed to retrieve members list. Please refresh.</p>
        </td>
      </tr>
    `;
    if (window.lucide) window.lucide.createIcons();
  }
}

function openAddMemberModal(onSaveSuccess) {
  const modalContainer = document.getElementById('modal-container');
  if (!modalContainer) return;

  const todayStr = new Date().toISOString().split('T')[0];

  modalContainer.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>Register New Member</h3>
        <button class="close-btn" id="modal-close"><i data-lucide="x"></i></button>
      </div>
      <form id="add-member-form">
        <div class="modal-body" style="max-height: 70vh; overflow-y: auto;">
          <div class="form-group">
            <label for="m-name">Full Name</label>
            <input type="text" id="m-name" class="form-control" placeholder="e.g. Liam Neeson" required>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label for="m-phone">Phone Number</label>
              <input type="tel" id="m-phone" class="form-control" placeholder="10-digit number" required pattern="[0-9]{10}">
            </div>
            <div class="form-group">
              <label for="m-email">Email Address</label>
              <input type="email" id="m-email" class="form-control" placeholder="liam@example.com">
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="m-type">Membership Plan</label>
              <select id="m-type" class="form-control" required>
                <option value="Monthly" data-fee="1000" data-months="1">Monthly Plan (₹1,000)</option>
                <option value="Quarterly" data-fee="2700" data-months="3">Quarterly Plan (₹2,700)</option>
                <option value="Annual" data-fee="8000" data-months="12">Annual Plan (₹8,000)</option>
              </select>
            </div>
            <div class="form-group">
              <label for="m-start">Start Date</label>
              <input type="date" id="m-start" class="form-control" value="${todayStr}" required>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="m-end">End Date</label>
              <input type="date" id="m-end" class="form-control" readonly>
            </div>
            <div class="form-group">
              <label for="m-fee">Total Fee (₹)</label>
              <input type="number" id="m-fee" class="form-control" value="1000" required min="0">
            </div>
          </div>

          <div class="form-group">
            <label for="m-paid">Paid Amount (₹)</label>
            <input type="number" id="m-paid" class="form-control" value="1000" required min="0">
          </div>
          
          <div id="modal-error" class="hidden" style="color: var(--status-danger); font-size: 0.85rem; margin-top: 0.5rem; font-weight: 600; text-align: center;">
            Error message.
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" id="modal-cancel">Cancel</button>
          <button type="submit" class="btn btn-primary" id="btn-save-member">Save Member</button>
        </div>
      </form>
    </div>
  `;

  modalContainer.classList.remove('hidden');
  if (window.lucide) window.lucide.createIcons();

  const form = document.getElementById('add-member-form');
  const typeSelect = document.getElementById('m-type');
  const startInput = document.getElementById('m-start');
  const endInput = document.getElementById('m-end');
  const feeInput = document.getElementById('m-fee');
  const paidInput = document.getElementById('m-paid');
  const errorEl = document.getElementById('modal-error');

  // Automatic calculation handler
  const recalculatePlan = () => {
    const selectedOption = typeSelect.options[typeSelect.selectedIndex];
    const months = parseInt(selectedOption.getAttribute('data-months'));
    const defaultFee = parseFloat(selectedOption.getAttribute('data-fee'));

    feeInput.value = defaultFee;
    paidInput.value = defaultFee;

    const startDateVal = startInput.value;
    if (startDateVal) {
      const start = new Date(startDateVal);
      start.setMonth(start.getMonth() + months);
      endInput.value = start.toISOString().split('T')[0];
    }
  };

  // Run calculation immediately on load
  recalculatePlan();

  // Listeners to trigger calculation when plan type or start date changes
  typeSelect.addEventListener('change', recalculatePlan);
  startInput.addEventListener('change', recalculatePlan);

  // Sync paid input defaults to total fee modifications
  feeInput.addEventListener('input', () => {
    paidInput.value = feeInput.value;
  });

  // Modal Closing handlers
  const closeModal = () => {
    modalContainer.classList.add('hidden');
    modalContainer.innerHTML = '';
  };

  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);

  // Form submission handler
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.classList.add('hidden');
    
    const saveBtn = document.getElementById('btn-save-member');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    const memberData = {
      name: document.getElementById('m-name').value.trim(),
      phone: document.getElementById('m-phone').value.trim(),
      email: document.getElementById('m-email').value.trim() || null,
      membership_type: typeSelect.value,
      start_date: startInput.value,
      end_date: endInput.value,
      total_fee: parseFloat(feeInput.value),
      paid_amount: parseFloat(paidInput.value)
    };

    try {
      await API.createMember(memberData);
      closeModal();
      
      // Trigger table reload and header badge updates
      await onSaveSuccess();
      await updateNotificationBadge();
    } catch (err) {
      console.error(err);
      errorEl.textContent = err.message || 'Could not save member details.';
      errorEl.classList.remove('hidden');
      
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Member';
    }
  });
}
