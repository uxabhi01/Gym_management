import { API } from '../api.js';

export async function renderAttendance(mountPoint) {
  const today = new Date();
  const todayStr = formatDateStr(today);
  let currentMonth = today.getMonth();
  let currentYear = today.getFullYear();
  let selectedDate = todayStr;
  let attendancePanelOpen = false;

  mountPoint.innerHTML = `
    <div class="view-container">
      <div class="view-header">
        <div class="view-title">
          <h2>Attendance Manager</h2>
          <p>View past attendance on the calendar or mark today's attendance</p>
        </div>
        <button class="btn btn-primary" id="btn-take-attendance">
          <i data-lucide="clipboard-check"></i>
          <span>Take Today's Attendance</span>
        </button>
      </div>

      <!-- Calendar + Date Details Grid -->
      <div class="attendance-layout">
        <!-- Calendar Card -->
        <div class="glass-card calendar-card">
          <div class="calendar-nav">
            <button class="btn btn-secondary btn-sm" id="cal-prev">
              <i data-lucide="chevron-left"></i>
            </button>
            <h3 id="cal-month-label"></h3>
            <button class="btn btn-secondary btn-sm" id="cal-next">
              <i data-lucide="chevron-right"></i>
            </button>
          </div>
          <div class="calendar-grid">
            <div class="cal-day-header">Sun</div>
            <div class="cal-day-header">Mon</div>
            <div class="cal-day-header">Tue</div>
            <div class="cal-day-header">Wed</div>
            <div class="cal-day-header">Thu</div>
            <div class="cal-day-header">Fri</div>
            <div class="cal-day-header">Sat</div>
            <div id="cal-days-container"></div>
          </div>
          <div class="calendar-legend">
            <span class="legend-item"><span class="legend-dot has-attendance"></span> Has Attendance</span>
            <span class="legend-item"><span class="legend-dot today-dot"></span> Today</span>
          </div>
        </div>

        <!-- Date Detail Card -->
        <div class="glass-card date-detail-card">
          <div class="date-detail-header">
            <h3 id="date-detail-title">Today's Attendance</h3>
            <span id="date-detail-count" class="badge badge-active">0 Present</span>
          </div>
          <div id="date-detail-content" class="date-detail-content">
            <div class="empty-state">
              <i data-lucide="calendar-x"></i>
              <p>Select a date from the calendar to view attendance</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Take Attendance Panel (Hidden by default) -->
      <div id="attendance-panel" class="attendance-panel hidden">
        <div class="glass-card" style="padding: 0; overflow: hidden;">
          <div class="attendance-panel-header">
            <div>
              <h3>Mark Today's Attendance</h3>
              <p id="attendance-date-label"></p>
            </div>
            <div class="attendance-panel-actions">
              <button class="btn btn-secondary btn-sm" id="btn-select-all">Select All</button>
              <button class="btn btn-secondary btn-sm" id="btn-deselect-all">Deselect All</button>
              <button class="btn btn-primary" id="btn-save-attendance">
                <i data-lucide="save"></i> Save Attendance
              </button>
              <button class="btn btn-secondary" id="btn-close-panel">
                <i data-lucide="x"></i>
              </button>
            </div>
          </div>

          <!-- Search bar inside panel -->
          <div class="attendance-search-bar">
            <div class="scan-input-wrapper">
              <i data-lucide="search"></i>
              <input type="text" id="attendance-search" class="form-control" placeholder="Search members by name or phone..." autocomplete="off">
            </div>
            <div class="attendance-summary" id="attendance-summary">
              <span class="summary-pill present-pill"><span id="present-count">0</span> Present</span>
              <span class="summary-pill absent-pill"><span id="absent-count">0</span> Absent</span>
            </div>
          </div>

          <!-- Members List -->
          <div class="attendance-members-list" id="attendance-members-list">
            <div class="empty-state" style="padding: 2rem;">
              <div class="loader-spinner"></div>
              <p>Loading active members...</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Initialize Lucide icons
  if (window.lucide) window.lucide.createIcons();

  // ========== CALENDAR LOGIC ==========
  const calDaysContainer = document.getElementById('cal-days-container');
  const calMonthLabel = document.getElementById('cal-month-label');
  let monthAttendanceMap = {}; // { 'YYYY-MM-DD': count }

  async function renderCalendar() {
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    calMonthLabel.textContent = `${monthNames[currentMonth]} ${currentYear}`;

    // Fetch month attendance data
    try {
      const days = await API.getMonthAttendance(currentYear, currentMonth + 1);
      monthAttendanceMap = {};
      days.forEach(d => { monthAttendanceMap[d.day] = d.count; });
    } catch (err) {
      console.error('Failed to load month attendance:', err);
      monthAttendanceMap = {};
    }

    // Build calendar days
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    calDaysContainer.innerHTML = '';

    // Empty slots before first day
    for (let i = 0; i < firstDay; i++) {
      const empty = document.createElement('div');
      empty.className = 'cal-day empty';
      calDaysContainer.appendChild(empty);
    }

    // Actual days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayEl = document.createElement('div');
      dayEl.className = 'cal-day';
      dayEl.dataset.date = dateStr;

      // Is today?
      if (dateStr === todayStr) {
        dayEl.classList.add('is-today');
      }
      // Is selected?
      if (dateStr === selectedDate) {
        dayEl.classList.add('is-selected');
      }
      // Has attendance?
      if (monthAttendanceMap[dateStr]) {
        dayEl.classList.add('has-data');
      }
      // Is future?
      if (new Date(dateStr) > today) {
        dayEl.classList.add('is-future');
      }

      dayEl.innerHTML = `
        <span class="cal-day-num">${d}</span>
        ${monthAttendanceMap[dateStr] ? `<span class="cal-day-dot">${monthAttendanceMap[dateStr]}</span>` : ''}
      `;

      dayEl.addEventListener('click', () => {
        if (dayEl.classList.contains('is-future')) return;
        selectedDate = dateStr;
        // Update selected highlight
        calDaysContainer.querySelectorAll('.cal-day').forEach(el => el.classList.remove('is-selected'));
        dayEl.classList.add('is-selected');
        loadDateAttendance(dateStr);
      });

      calDaysContainer.appendChild(dayEl);
    }
  }

  // Calendar navigation
  document.getElementById('cal-prev').addEventListener('click', () => {
    currentMonth--;
    if (currentMonth < 0) { currentMonth = 11; currentYear--; }
    renderCalendar();
  });

  document.getElementById('cal-next').addEventListener('click', () => {
    currentMonth++;
    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    renderCalendar();
  });

  // ========== DATE DETAIL VIEW ==========
  async function loadDateAttendance(dateStr) {
    const titleEl = document.getElementById('date-detail-title');
    const countEl = document.getElementById('date-detail-count');
    const contentEl = document.getElementById('date-detail-content');

    // Format the display date
    const dateObj = new Date(dateStr + 'T00:00:00');
    const displayDate = dateObj.toLocaleDateString('en-IN', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });

    const isToday = dateStr === todayStr;
    titleEl.textContent = isToday ? "Today's Attendance" : displayDate;

    contentEl.innerHTML = `
      <div class="empty-state" style="padding: 2rem;">
        <div class="loader-spinner"></div>
      </div>
    `;

    try {
      const logs = await API.getAttendanceByDate(dateStr);
      countEl.textContent = `${logs.length} Present`;

      if (logs.length === 0) {
        contentEl.innerHTML = `
          <div class="empty-state">
            <i data-lucide="calendar-x"></i>
            <p>No attendance recorded on this date</p>
          </div>
        `;
        if (window.lucide) window.lucide.createIcons();
        return;
      }

      contentEl.innerHTML = '';
      logs.forEach(log => {
        const checkInDate = new Date(log.check_in_time);
        const checkInStr = checkInDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        let checkOutStr = '—';
        if (log.check_out_time) {
          checkOutStr = new Date(log.check_out_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        }

        // Membership expiry info
        const endDate = new Date(log.end_date);
        const daysLeft = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
        let statusTag = '';
        if (log.due_amount > 0) {
          statusTag += `<span class="badge badge-due" style="font-size: 0.65rem;">₹${log.due_amount} Due</span>`;
        }
        if (daysLeft <= 7 && daysLeft >= 0) {
          statusTag += `<span class="badge badge-expiring" style="font-size: 0.65rem;">${daysLeft}d left</span>`;
        }

        const card = document.createElement('div');
        card.className = 'date-attendance-item';
        card.innerHTML = `
          <div class="dai-info">
            <div class="dai-avatar">${log.name.charAt(0).toUpperCase()}</div>
            <div>
              <div class="dai-name">${log.name}</div>
              <div class="dai-sub">${log.phone} · ${log.membership_type}</div>
            </div>
          </div>
          <div class="dai-meta">
            <div class="dai-tags">${statusTag}</div>
            <div class="dai-time">
              <span style="color: var(--status-active);">In: ${checkInStr}</span>
              <span style="color: var(--text-muted);">Out: ${checkOutStr}</span>
            </div>
          </div>
        `;
        contentEl.appendChild(card);
      });

      if (window.lucide) window.lucide.createIcons();
    } catch (err) {
      console.error(err);
      contentEl.innerHTML = `
        <div class="empty-state" style="color: var(--status-danger);">
          <p>Failed to load attendance data.</p>
        </div>
      `;
    }
  }

  // ========== TAKE ATTENDANCE PANEL ==========
  const panel = document.getElementById('attendance-panel');
  const btnTake = document.getElementById('btn-take-attendance');
  const btnClose = document.getElementById('btn-close-panel');
  const btnSelectAll = document.getElementById('btn-select-all');
  const btnDeselectAll = document.getElementById('btn-deselect-all');
  const btnSave = document.getElementById('btn-save-attendance');
  const searchInput = document.getElementById('attendance-search');
  const membersList = document.getElementById('attendance-members-list');
  let allMembers = [];

  // Date label
  document.getElementById('attendance-date-label').textContent =
    today.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  btnTake.addEventListener('click', async () => {
    attendancePanelOpen = true;
    panel.classList.remove('hidden');
    panel.scrollIntoView({ behavior: 'smooth' });
    await loadActiveMembers();
  });

  btnClose.addEventListener('click', () => {
    attendancePanelOpen = false;
    panel.classList.add('hidden');
  });

  async function loadActiveMembers() {
    membersList.innerHTML = `
      <div class="empty-state" style="padding: 2rem;">
        <div class="loader-spinner"></div>
        <p>Loading active members...</p>
      </div>
    `;

    try {
      allMembers = await API.getActiveMembers();
      renderMembersList(allMembers);
    } catch (err) {
      console.error(err);
      membersList.innerHTML = `
        <div class="empty-state" style="padding: 2rem; color: var(--status-danger);">
          <p>Failed to load members.</p>
        </div>
      `;
    }
  }

  function renderMembersList(members) {
    membersList.innerHTML = '';

    if (members.length === 0) {
      membersList.innerHTML = `
        <div class="empty-state" style="padding: 2rem;">
          <i data-lucide="users"></i>
          <p>No active members found</p>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    members.forEach(m => {
      const endDate = new Date(m.end_date);
      const daysLeft = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
      const isPresent = m.attended_today > 0;

      let statusTags = '';
      if (m.due_amount > 0) {
        statusTags += `<span class="badge badge-due" style="font-size: 0.65rem; margin-right: 4px;">₹${m.due_amount} Due</span>`;
      }
      if (daysLeft <= 7 && daysLeft >= 0) {
        statusTags += `<span class="badge badge-expiring" style="font-size: 0.65rem;">${daysLeft} days left</span>`;
      } else if (daysLeft > 7) {
        statusTags += `<span class="badge badge-active" style="font-size: 0.65rem;">${daysLeft} days left</span>`;
      }

      const row = document.createElement('div');
      row.className = `attendance-member-row ${isPresent ? 'is-present' : ''}`;
      row.dataset.memberId = m.id;
      row.dataset.name = m.name.toLowerCase();
      row.dataset.phone = m.phone;

      row.innerHTML = `
        <div class="amr-check">
          <label class="toggle-switch">
            <input type="checkbox" class="attendance-toggle" data-id="${m.id}" ${isPresent ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>
        <div class="amr-info">
          <div class="amr-avatar">${m.name.charAt(0).toUpperCase()}</div>
          <div>
            <div class="amr-name">${m.name}</div>
            <div class="amr-sub">${m.phone} · ${m.membership_type}</div>
          </div>
        </div>
        <div class="amr-status">
          ${statusTags}
        </div>
        <div class="amr-label ${isPresent ? 'present' : 'absent'}">
          ${isPresent ? 'PRESENT' : 'ABSENT'}
        </div>
      `;

      // Toggle click handler
      const toggle = row.querySelector('.attendance-toggle');
      toggle.addEventListener('change', () => {
        const label = row.querySelector('.amr-label');
        if (toggle.checked) {
          row.classList.add('is-present');
          label.textContent = 'PRESENT';
          label.className = 'amr-label present';
        } else {
          row.classList.remove('is-present');
          label.textContent = 'ABSENT';
          label.className = 'amr-label absent';
        }
        updateCounts();
      });

      // Allow tapping anywhere on the row to toggle on mobile
      row.addEventListener('click', (e) => {
        if (e.target.closest('.toggle-switch')) return;
        toggle.checked = !toggle.checked;
        toggle.dispatchEvent(new Event('change'));
      });

      membersList.appendChild(row);
    });

    updateCounts();
    if (window.lucide) window.lucide.createIcons();
  }

  // Search filter
  searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim().toLowerCase();
    const rows = membersList.querySelectorAll('.attendance-member-row');
    rows.forEach(row => {
      const name = row.dataset.name;
      const phone = row.dataset.phone;
      if (name.includes(q) || phone.includes(q)) {
        row.style.display = '';
      } else {
        row.style.display = 'none';
      }
    });
  });

  // Select All / Deselect All
  btnSelectAll.addEventListener('click', () => {
    membersList.querySelectorAll('.attendance-toggle').forEach(cb => {
      cb.checked = true;
      const row = cb.closest('.attendance-member-row');
      row.classList.add('is-present');
      row.querySelector('.amr-label').textContent = 'PRESENT';
      row.querySelector('.amr-label').className = 'amr-label present';
    });
    updateCounts();
  });

  btnDeselectAll.addEventListener('click', () => {
    membersList.querySelectorAll('.attendance-toggle').forEach(cb => {
      cb.checked = false;
      const row = cb.closest('.attendance-member-row');
      row.classList.remove('is-present');
      row.querySelector('.amr-label').textContent = 'ABSENT';
      row.querySelector('.amr-label').className = 'amr-label absent';
    });
    updateCounts();
  });

  function updateCounts() {
    const all = membersList.querySelectorAll('.attendance-toggle');
    const present = membersList.querySelectorAll('.attendance-toggle:checked');
    const pCount = document.getElementById('present-count');
    const aCount = document.getElementById('absent-count');
    if (pCount) pCount.textContent = present.length;
    if (aCount) aCount.textContent = all.length - present.length;
  }

  // Save Attendance (Single Atomic Network Call)
  btnSave.addEventListener('click', async () => {
    const checkedIds = [];

    membersList.querySelectorAll('.attendance-toggle:checked').forEach(cb => {
      checkedIds.push(parseInt(cb.dataset.id));
    });

    btnSave.disabled = true;
    btnSave.innerHTML = '<div class="loader-spinner" style="width:20px;height:20px;border-width:2px;"></div> Saving...';

    try {
      // Single fast atomic transaction call
      await API.syncAttendance(checkedIds);

      // Show success feedback
      btnSave.innerHTML = '<i data-lucide="check-circle"></i> Saved!';
      btnSave.style.background = 'var(--status-active)';
      if (window.lucide) window.lucide.createIcons();

      // Refresh calendar and date view
      await renderCalendar();
      await loadDateAttendance(selectedDate);

      setTimeout(() => {
        btnSave.disabled = false;
        btnSave.innerHTML = '<i data-lucide="save"></i> Save Attendance';
        btnSave.style.background = '';
        if (window.lucide) window.lucide.createIcons();
      }, 2000);

    } catch (err) {
      console.error(err);
      alert('Error saving attendance: ' + err.message);
      btnSave.disabled = false;
      btnSave.innerHTML = '<i data-lucide="save"></i> Save Attendance';
      if (window.lucide) window.lucide.createIcons();
    }
  });

  // ========== INITIAL LOAD ==========
  await renderCalendar();
  await loadDateAttendance(todayStr);
}

function formatDateStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
