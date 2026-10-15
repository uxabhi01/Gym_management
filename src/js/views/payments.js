import { API } from '../api.js';
import { Router } from '../router.js';
import { updateNotificationBadge } from './notifications.js';

export async function renderPayments(mountPoint, routeParams = null) {
  mountPoint.innerHTML = `
    <div class="view-container">
      <div class="view-header">
        <div class="view-title">
          <h2>Financial Ledger</h2>
          <p>Record transactions, collect dues, and view payment histories</p>
        </div>
        <button class="btn btn-primary" id="btn-add-payment">
          <i data-lucide="circle-plus"></i> Record Payment
        </button>
      </div>

      <!-- Search ledger row -->
      <div class="glass-card action-row">
        <div class="search-wrapper">
          <i data-lucide="search"></i>
          <input type="text" id="payment-search" class="form-control" placeholder="Filter ledger by member name or phone...">
        </div>
      </div>

      <!-- Ledger Table -->
      <div class="glass-card" style="padding: 0; overflow: hidden;">
        <div class="table-responsive">
          <table class="apex-table">
            <thead>
              <tr>
                <th style="padding-left: 1.5rem;">Transaction Date</th>
                <th>Member Name</th>
                <th>Amount Paid</th>
                <th class="hide-mobile">Method</th>
                <th class="hide-mobile">Reference ID / Comments</th>
              </tr>
            </thead>
            <tbody id="ledger-list-tbody">
              <!-- Rendered via JS -->
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  const searchInput = document.getElementById('payment-search');
  const addBtn = document.getElementById('btn-add-payment');

  const fetchAndRenderLedger = async () => {
    const q = searchInput.value.trim();
    await renderLedgerList(q);
  };

  searchInput.addEventListener('input', fetchAndRenderLedger);
  addBtn.addEventListener('click', () => {
    openLogTransactionModal(fetchAndRenderLedger);
  });

  // Pull initial list
  await fetchAndRenderLedger();

  // Handle direct navigation to open payment collection modal
  if (routeParams && routeParams.openRecordModal) {
    openLogTransactionModal(fetchAndRenderLedger);
  }
}

async function renderLedgerList(query) {
  const tbody = document.getElementById('ledger-list-tbody');
  if (!tbody) return;

  tbody.innerHTML = `
    <tr>
      <td colspan="5" style="text-align: center; padding: 3rem;">
        <div class="loader-spinner" style="margin: 0 auto;"></div>
      </td>
    </tr>
  `;

  try {
    const payments = await API.getPayments(query);

    if (payments.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; padding: 4rem; color: var(--text-muted);">
            <i data-lucide="receipt" style="width: 40px; height: 40px; opacity: 0.3; margin-bottom: 0.75rem;"></i>
            <p>No transaction records found.</p>
          </td>
        </tr>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    tbody.innerHTML = '';
    const options = { month: 'short', day: 'numeric', year: 'numeric' };

    payments.forEach(p => {
      const tr = document.createElement('tr');
      const payDate = new Date(p.payment_date).toLocaleDateString('en-US', options);

      tr.innerHTML = `
        <td style="padding-left: 1.5rem; font-weight: 500;">${payDate}</td>
        <td>
          <div style="font-weight: 600;">
            <a class="member-name-link action-view-member" data-id="${p.member_id}">${p.member_name}</a>
          </div>
          <span style="font-size: 0.75rem; color: var(--text-secondary);">${p.member_phone} | Plan: ${p.membership_type}</span>
        </td>
        <td style="color: var(--status-active); font-weight: 700; font-size: 0.95rem;">₹${p.amount}</td>
        <td class="hide-mobile"><span class="badge" style="background: var(--bg-tertiary);">${p.payment_method}</span></td>
        <td class="hide-mobile" style="color: var(--text-secondary); font-size: 0.85rem;">${p.reference || '—'}</td>
      `;

      tbody.appendChild(tr);
    });

    // Bind link navigations to profile pages
    tbody.querySelectorAll('.action-view-member').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const id = link.getAttribute('data-id');
        Router.navigate('profile', id);
      });
    });

    if (window.lucide) {
      window.lucide.createIcons();
    }
  } catch (err) {
    console.error('Error rendering transaction ledger:', err);
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 3rem; color: var(--status-danger);">
          <i data-lucide="alert-circle" style="margin-bottom: 0.5rem;"></i>
          <p>Failed to retrieve financial logs.</p>
        </td>
      </tr>
    `;
    if (window.lucide) window.lucide.createIcons();
  }
}

function openLogTransactionModal(onSaveSuccess) {
  const modalContainer = document.getElementById('modal-container');
  if (!modalContainer) return;

  const todayStr = new Date().toISOString().split('T')[0];

  modalContainer.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>Record Transaction</h3>
        <button class="close-btn" id="modal-close"><i data-lucide="x"></i></button>
      </div>
      <form id="global-payment-form">
        <input type="hidden" id="gp-member-id" required>
        
        <div class="modal-body" style="max-height: 70vh; overflow-y: auto;">
          
          <!-- Member Selector Autocomplete Search -->
          <div class="form-group" style="position: relative;">
            <label for="gp-member-search">Find Gym Member</label>
            <input type="text" id="gp-member-search" class="form-control" placeholder="Type member name or phone..." required autocomplete="off">
            <div id="gp-member-results" class="search-results-list hidden" style="position: absolute; width: 100%; z-index: 10;">
              <!-- Matches rendered via JS -->
            </div>
          </div>

          <!-- Target Member Selected Details Widget -->
          <div id="gp-member-details-box" class="hidden" style="background: rgba(255, 255, 255, 0.02); border: 1px dashed var(--glass-border); border-radius: 8px; padding: 0.75rem 1rem; margin-bottom: 1.25rem;">
            <div style="font-size: 0.85rem; font-weight: 600;" id="gp-box-name">Member Name</div>
            <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem;">
              Plan: <span id="gp-box-plan">Plan</span> | Phone: <span id="gp-box-phone">Phone</span>
            </div>
            <div style="font-size: 0.85rem; margin-top: 0.5rem; font-weight: 700; color: #f97316;">
              Outstanding balance: ₹<span id="gp-box-dues">0.00</span>
            </div>
          </div>

          <div class="form-group">
            <label for="gp-amount">Amount (₹)</label>
            <input type="number" id="gp-amount" class="form-control" min="1" required disabled>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="gp-method">Payment Method</label>
              <select id="gp-method" class="form-control" required>
                <option value="UPI">UPI / Net Banking</option>
                <option value="Cash">Cash</option>
                <option value="Card">Credit/Debit Card</option>
              </select>
            </div>
            <div class="form-group">
              <label for="gp-date">Payment Date</label>
              <input type="date" id="gp-date" class="form-control" value="${todayStr}" required>
            </div>
          </div>

          <div class="form-group">
            <label for="gp-ref">Reference ID / Notes</label>
            <input type="text" id="gp-ref" class="form-control" placeholder="e.g. Txn reference or details">
          </div>

          <div id="gp-modal-error" class="hidden" style="color: var(--status-danger); font-size: 0.85rem; font-weight: 600; text-align: center; margin-top: 0.5rem;">
            Error message.
          </div>
        </div>
        
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" id="modal-cancel">Cancel</button>
          <button type="submit" class="btn btn-primary" id="btn-gp-submit" disabled>Record Payment</button>
        </div>
      </form>
    </div>
  `;

  modalContainer.classList.remove('hidden');
  if (window.lucide) window.lucide.createIcons();

  const form = document.getElementById('global-payment-form');
  const memberSearch = document.getElementById('gp-member-search');
  const memberResults = document.getElementById('gp-member-results');
  const detailsBox = document.getElementById('gp-member-details-box');
  const memberIdInput = document.getElementById('gp-member-id');
  const amountInput = document.getElementById('gp-amount');
  const submitBtn = document.getElementById('btn-gp-submit');
  const errorEl = document.getElementById('gp-modal-error');

  const closeModal = () => {
    modalContainer.classList.add('hidden');
    modalContainer.innerHTML = '';
  };

  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);

  // Autocomplete member matching input listener
  memberSearch.addEventListener('input', async () => {
    const q = memberSearch.value.trim();
    if (q.length < 2) {
      memberResults.innerHTML = '';
      memberResults.classList.add('hidden');
      return;
    }

    try {
      // Find members (even unpaid or active, but only those who have dues)
      const allMembers = await API.getMembers(q, 'All');
      const dueMembers = allMembers.filter(m => m.due_amount > 0);

      if (dueMembers.length === 0) {
        memberResults.innerHTML = `
          <div style="padding: 1rem; text-align: center; color: var(--text-muted); font-size: 0.85rem;">
            No members with outstanding balance found.
          </div>
        `;
        memberResults.classList.remove('hidden');
        return;
      }

      memberResults.innerHTML = '';
      memberResults.classList.remove('hidden');

      dueMembers.forEach(m => {
        const item = document.createElement('div');
        item.className = 'search-result-item';
        item.innerHTML = `
          <div>
            <div class="search-result-name">${m.name}</div>
            <div class="search-result-details">${m.phone} | Dues: ₹${m.due_amount}</div>
          </div>
          <button type="button" class="btn btn-secondary select-member-action" data-id="${m.id}" data-name="${m.name}" data-phone="${m.phone}" data-plan="${m.membership_type}" data-dues="${m.due_amount}" style="padding: 0.25rem 0.65rem; font-size: 0.75rem;">
            Select
          </button>
        `;

        memberResults.appendChild(item);
      });

      // Bind clicks to select member
      memberResults.querySelectorAll('.select-member-action').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const id = btn.getAttribute('data-id');
          const name = btn.getAttribute('data-name');
          const phone = btn.getAttribute('data-phone');
          const plan = btn.getAttribute('data-plan');
          const dues = parseFloat(btn.getAttribute('data-dues'));

          // Inject details to form
          memberIdInput.value = id;
          memberSearch.value = name;
          
          document.getElementById('gp-box-name').textContent = name;
          document.getElementById('gp-box-phone').textContent = phone;
          document.getElementById('gp-box-plan').textContent = plan;
          document.getElementById('gp-box-dues').textContent = dues.toFixed(2);
          
          // Clear autocomplete list
          memberResults.innerHTML = '';
          memberResults.classList.add('hidden');

          // Display selected box widget
          detailsBox.classList.remove('hidden');

          // Enable amount field and fill it
          amountInput.value = dues;
          amountInput.max = dues;
          amountInput.disabled = false;
          submitBtn.disabled = false;
        });
      });

    } catch (err) {
      console.error(err);
    }
  });

  // Close results on outer click
  document.addEventListener('click', (e) => {
    if (memberResults && !memberResults.contains(e.target) && e.target !== memberSearch) {
      memberResults.classList.add('hidden');
    }
  });

  // Submit Handler
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.classList.add('hidden');

    const maxDues = parseFloat(document.getElementById('gp-box-dues').textContent);
    const amountVal = parseFloat(amountInput.value);

    if (amountVal > maxDues) {
      errorEl.textContent = `Amount cannot exceed outstanding dues of ₹${maxDues}.`;
      errorEl.classList.remove('hidden');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Processing...';

    const payData = {
      member_id: parseInt(memberIdInput.value),
      amount: amountVal,
      payment_method: document.getElementById('gp-method').value,
      payment_date: document.getElementById('gp-date').value,
      reference: document.getElementById('gp-ref').value.trim() || null
    };

    try {
      await API.recordPayment(payData);
      closeModal();
      await onSaveSuccess();
      await updateNotificationBadge();
    } catch (err) {
      console.error(err);
      errorEl.textContent = err.message || 'Failed to register receipt transaction.';
      errorEl.classList.remove('hidden');
      
      submitBtn.disabled = false;
      submitBtn.textContent = 'Record Payment';
    }
  });
}
