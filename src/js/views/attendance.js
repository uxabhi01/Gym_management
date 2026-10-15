import { API } from '../api.js';

export async function renderAttendance(mountPoint) {
  mountPoint.innerHTML = `
    <div class="view-container">
      <div class="view-header">
        <div class="view-title">
          <h2>Attendance Terminal</h2>
          <p>Verify memberships, check-in members, and track daily visits</p>
        </div>
      </div>

      <div class="attendance-grid">
        <!-- Access Terminal (Manual Entry) -->
        <div class="glass-card scan-card">
          <h3 style="font-size: 1.05rem; font-weight: 700; border-bottom: 1px solid var(--glass-border); padding-bottom: 0.75rem;">
            Member Check-In Terminal
          </h3>
          
          <p style="font-size: 0.85rem; color: var(--text-secondary);">
            Search name or phone number below to check-in an active member.
          </p>

          <div class="scan-input-wrapper" style="margin-top: 1rem; margin-bottom: 0.5rem;">
            <i data-lucide="search"></i>
            <input type="text" id="scan-member-search" class="form-control" placeholder="Type member name or phone..." autocomplete="off">
          </div>

          <!-- Live Search Results -->
          <div id="scan-search-results" class="search-results-list hidden">
            <!-- Populated dynamically -->
          </div>

          <div id="scan-feedback" class="hidden" style="padding: 1rem; border-radius: 8px; font-size: 0.85rem; font-weight: 600; text-align: center; margin-top: 1rem;">
            Feedback text.
          </div>
        </div>

        <!-- Today's Checked-in Feed -->
        <div class="glass-card" style="padding: 0; overflow: hidden; display: flex; flex-direction: column;">
          <div style="padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--glass-border); display: flex; justify-content: space-between; align-items: center;">
            <h3 style="font-size: 1.05rem; font-weight: 700;">Live Check-in Feed</h3>
            <span id="live-checkin-count" class="badge badge-active" style="border-radius: 6px; font-size: 0.7rem; padding: 2px 8px;">0 Present</span>
          </div>

          <div class="table-responsive" style="flex: 1; max-height: 500px; overflow-y: auto;">
            <table class="apex-table">
              <thead>
                <tr>
                  <th style="padding-left: 1.5rem;">Member Name</th>
                  <th>Check In</th>
                  <th>Check Out</th>
                  <th style="text-align: right; padding-right: 1.5rem;">Action</th>
                </tr>
              </thead>
              <tbody id="today-attendance-tbody">
                <!-- Populated via JS -->
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `;

  // Bind Events
  const searchInput = document.getElementById('scan-member-search');
  const resultsDiv = document.getElementById('scan-search-results');
  const feedbackDiv = document.getElementById('scan-feedback');

  // Load feed immediately
  await loadTodayFeed();

  // Search input change handler
  searchInput.addEventListener('input', async () => {
    const q = searchInput.value.trim();
    if (q.length < 2) {
      resultsDiv.innerHTML = '';
      resultsDiv.classList.add('hidden');
      return;
    }

    try {
      // Look up matching active members
      const activeMembers = await API.getMembers(q, 'Active');
      
      if (activeMembers.length === 0) {
        resultsDiv.innerHTML = `
          <div style="padding: 1rem; text-align: center; color: var(--text-muted); font-size: 0.85rem;">
            No active members found.
          </div>
        `;
        resultsDiv.classList.remove('hidden');
        return;
      }

      resultsDiv.innerHTML = '';
      resultsDiv.classList.remove('hidden');

      activeMembers.forEach(m => {
        const item = document.createElement('div');
        item.className = 'search-result-item';
        item.innerHTML = `
          <div>
            <div class="search-result-name">${m.name}</div>
            <div class="search-result-details">${m.phone} | ${m.membership_type}</div>
          </div>
          <button class="btn btn-primary btn-checkin-action" data-id="${m.id}" style="padding: 0.3rem 0.75rem; font-size: 0.75rem;">
            Check-In
          </button>
        `;

        resultsDiv.appendChild(item);
      });

      // Bind button click for specific member checkin
      resultsDiv.querySelectorAll('.btn-checkin-action').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.preventDefault();
          const memberId = btn.getAttribute('data-id');
          await triggerCheckIn(memberId);
        });
      });
    } catch (err) {
      console.error(err);
    }
  });

  // Hide search list if clicked outside
  document.addEventListener('click', (e) => {
    if (resultsDiv && !resultsDiv.contains(e.target) && e.target !== searchInput) {
      resultsDiv.classList.add('hidden');
    }
  });



  // Help functions
  async function triggerCheckIn(memberId) {
    try {
      const res = await API.checkIn(memberId);
      showFeedback(res.message, 'var(--status-active)', 'var(--status-active-glow)');
      
      // Clean inputs and reset dropdowns
      searchInput.value = '';
      resultsDiv.innerHTML = '';
      resultsDiv.classList.add('hidden');
      
      // Refresh listing
      await loadTodayFeed();
    } catch (err) {
      showFeedback(err.message, 'var(--status-danger)', 'var(--status-danger-glow)');
    }
  }

  function showFeedback(text, borderClr, bgClr) {
    feedbackDiv.textContent = text;
    feedbackDiv.style.border = `1px solid ${borderClr}`;
    feedbackDiv.style.backgroundColor = bgClr;
    feedbackDiv.style.color = borderClr;
    feedbackDiv.classList.remove('hidden');
  }

  if (window.lucide) window.lucide.createIcons();
}

async function loadTodayFeed() {
  const tbody = document.getElementById('today-attendance-tbody');
  const countBadge = document.getElementById('live-checkin-count');

  if (!tbody) return;

  tbody.innerHTML = `
    <tr>
      <td colspan="4" style="text-align: center; padding: 2rem;">
        <div class="loader-spinner" style="margin: 0 auto;"></div>
      </td>
    </tr>
  `;

  try {
    const logs = await API.getTodayAttendance();
    
    // Count active checked-in members (checkout timestamp is null)
    const activePresent = logs.filter(l => !l.check_out_time).length;
    if (countBadge) {
      countBadge.textContent = `${activePresent} Present`;
    }

    if (logs.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align: center; padding: 3rem; color: var(--text-muted);">
            No attendance activity recorded today.
          </td>
        </tr>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    tbody.innerHTML = '';

    logs.forEach(log => {
      const tr = document.createElement('tr');
      
      // Format timestamps
      const checkInDate = new Date(log.check_in_time);
      const checkInStr = checkInDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      
      let checkOutStr = '—';
      let actionHtml = '';

      if (log.check_out_time) {
        const checkOutDate = new Date(log.check_out_time);
        checkOutStr = checkOutDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        actionHtml = `<span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 500;">Checked Out</span>`;
      } else {
        // Still present, show Checkout Action button
        actionHtml = `
          <button class="btn btn-danger action-checkout" data-id="${log.member_id}" style="padding: 0.3rem 0.6rem; font-size: 0.75rem;">
            Check Out
          </button>
        `;
      }

      tr.innerHTML = `
        <td style="padding-left: 1.5rem; font-weight: 600;">
          <div>${log.name}</div>
          <span style="font-size: 0.7rem; color: var(--text-secondary); font-weight: 400;">${log.phone} | ${log.membership_type}</span>
        </td>
        <td style="color: var(--status-active); font-weight: 500;">${checkInStr}</td>
        <td>${checkOutStr}</td>
        <td style="text-align: right; padding-right: 1.5rem;">${actionHtml}</td>
      `;

      tbody.appendChild(tr);
    });

    // Bind check out buttons
    tbody.querySelectorAll('.action-checkout').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const memberId = btn.getAttribute('data-id');
        btn.disabled = true;
        btn.textContent = 'Closing...';
        
        try {
          await API.checkOut(memberId);
          await loadTodayFeed(); // reload grid
        } catch (err) {
          alert('Error checking out member: ' + err.message);
          btn.disabled = false;
          btn.textContent = 'Check Out';
        }
      });
    });

    if (window.lucide) {
      window.lucide.createIcons();
    }
  } catch (err) {
    console.error('Error loading live check-in logs:', err);
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align: center; padding: 2rem; color: var(--status-danger);">
          Failed to fetch attendance logs.
        </td>
      </tr>
    `;
    if (window.lucide) window.lucide.createIcons();
  }
}
