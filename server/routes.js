import express from 'express';
import { dbRun, dbGet, dbAll, hashPassword } from './db.js';

const router = express.Router();

// Helper: Calculate status and due for member update
function getMemberStatus(endDate) {
  const today = new Date();
  today.setHours(0,0,0,0);
  const end = new Date(endDate);
  end.setHours(0,0,0,0);
  return end >= today ? 'Active' : 'Expired';
}

// Route: Auth Login
router.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const hashed = hashPassword(password);
    const user = await dbGet('SELECT * FROM users WHERE username = ? AND password = ?', [username, hashed]);

    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Return mock token and admin info
    res.json({
      token: `mock-token-${user.id}-${Date.now()}`,
      user: {
        id: user.id,
        username: user.username,
        name: user.name
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Route: Dashboard Statistics
router.get('/dashboard/stats', async (req, res) => {
  try {
    // 1. Active Members
    const activeRes = await dbGet("SELECT COUNT(*) as count FROM members WHERE status = 'Active'");
    
    // 2. Expiring Soon (Active and ends within 7 days from local time)
    const expiringRes = await dbGet(`
      SELECT COUNT(*) as count FROM members 
      WHERE status = 'Active' 
        AND date(end_date) >= date('now', 'localtime') 
        AND date(end_date) <= date('now', 'localtime', '+7 days')
    `);
    
    // 3. Payment Due (due_amount > 0)
    const dueRes = await dbGet('SELECT COUNT(*) as count FROM members WHERE due_amount > 0');
    
    // 4. Today's Attendance Check-ins
    const attendanceRes = await dbGet(`
      SELECT COUNT(DISTINCT member_id) as count FROM attendance 
      WHERE date(check_in_time) = date('now', 'localtime')
    `);

    // 5. Chart Data: Membership Status breakdown
    const statusBreakdown = await dbAll('SELECT status, COUNT(*) as count FROM members GROUP BY status');

    // 6. Chart Data: Monthly Payments total (last 6 months)
    const paymentTrend = await dbAll(`
      SELECT strftime('%Y-%m', payment_date) as month, SUM(amount) as total 
      FROM payments 
      GROUP BY month 
      ORDER BY month DESC 
      LIMIT 6
    `);

    // 7. Chart Data: Daily Attendance counts (last 7 days)
    const attendanceTrend = await dbAll(`
      SELECT date(check_in_time) as day, COUNT(DISTINCT member_id) as count 
      FROM attendance 
      WHERE date(check_in_time) >= date('now', 'localtime', '-7 days') 
      GROUP BY day 
      ORDER BY day ASC
    `);

    res.json({
      activeMembers: activeRes.count,
      expiringSoon: expiringRes.count,
      paymentsDue: dueRes.count,
      todayAttendance: attendanceRes.count,
      charts: {
        statusBreakdown,
        paymentTrend: paymentTrend.reverse(), // display chronologically
        attendanceTrend
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Route: Get Notifications
router.get('/notifications', async (req, res) => {
  try {
    const alerts = [];

    // Query 1: Expiring plans in next 7 days
    const expiringMembers = await dbAll(`
      SELECT id, name, phone, end_date FROM members 
      WHERE status = 'Active' 
        AND date(end_date) >= date('now', 'localtime') 
        AND date(end_date) <= date('now', 'localtime', '+7 days')
    `);
    
    for (const m of expiringMembers) {
      alerts.push({
        id: `exp-${m.id}`,
        type: 'expiring',
        title: 'Membership Expiring',
        message: `${m.name}'s plan expires on ${m.end_date}.`,
        phone: m.phone,
        memberId: m.id,
        severity: 'warning'
      });
    }

    // Query 2: Payments due
    const unpaidMembers = await dbAll('SELECT id, name, phone, due_amount FROM members WHERE due_amount > 0');
    for (const m of unpaidMembers) {
      alerts.push({
        id: `due-${m.id}`,
        type: 'due',
        title: 'Payment Overdue',
        message: `${m.name} has an outstanding balance of ₹${m.due_amount}.`,
        phone: m.phone,
        memberId: m.id,
        severity: 'danger'
      });
    }

    // Sort by type / severity
    res.json(alerts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Route: Get Members List
router.get('/members', async (req, res) => {
  try {
    const { q, status } = req.query;
    let sql = 'SELECT * FROM members';
    const params = [];
    const conditions = [];

    if (q) {
      conditions.push('(name LIKE ? OR phone LIKE ? OR email LIKE ?)');
      const wild = `%${q}%`;
      params.push(wild, wild, wild);
    }

    if (status && status !== 'All') {
      if (status === 'Expiring') {
        conditions.push(`
          status = 'Active' 
          AND date(end_date) >= date('now', 'localtime') 
          AND date(end_date) <= date('now', 'localtime', '+7 days')
        `);
      } else if (status === 'Unpaid') {
        conditions.push('due_amount > 0');
      } else {
        conditions.push('status = ?');
        params.push(status);
      }
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    
    sql += ' ORDER BY name ASC';
    const members = await dbAll(sql, params);
    res.json(members);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Route: Get Member Profile Details
router.get('/members/:id', async (req, res) => {
  try {
    const member = await dbGet('SELECT * FROM members WHERE id = ?', [req.params.id]);
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Get attendance logs
    const attendance = await dbAll(
      'SELECT * FROM attendance WHERE member_id = ? ORDER BY check_in_time DESC LIMIT 30',
      [req.params.id]
    );

    // Get payments ledger
    const payments = await dbAll(
      'SELECT * FROM payments WHERE member_id = ? ORDER BY payment_date DESC',
      [req.params.id]
    );

    res.json({
      member,
      attendance,
      payments
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Route: Create Member
router.post('/members', async (req, res) => {
  try {
    const { name, phone, email, membership_type, start_date, end_date, total_fee, paid_amount } = req.body;
    
    if (!name || !phone || !membership_type || !start_date || !end_date || total_fee === undefined) {
      return res.status(400).json({ error: 'Required fields: name, phone, membership_type, start_date, end_date, total_fee' });
    }

    const paid = parseFloat(paid_amount) || 0;
    const total = parseFloat(total_fee);
    const due = total - paid;
    const status = getMemberStatus(end_date);

    const result = await dbRun(`
      INSERT INTO members (name, phone, email, membership_type, start_date, end_date, total_fee, paid_amount, due_amount, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [name, phone, email || null, membership_type, start_date, end_date, total, paid, due, status]);

    const memberId = result.lastID;

    // Log the initial payment in ledger if any amount is paid
    if (paid > 0) {
      await dbRun(`
        INSERT INTO payments (member_id, amount, payment_method, payment_date, reference)
        VALUES (?, ?, ?, ?, ?)
      `, [memberId, paid, 'Cash', start_date, 'Initial Pay']);
    }

    res.status(201).json({ id: memberId, message: 'Member created successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Route: Update Member Profile
router.put('/members/:id', async (req, res) => {
  try {
    const { name, phone, email, membership_type, start_date, end_date, total_fee } = req.body;
    
    const member = await dbGet('SELECT * FROM members WHERE id = ?', [req.params.id]);
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const total = parseFloat(total_fee) !== undefined ? parseFloat(total_fee) : member.total_fee;
    const due = total - member.paid_amount;
    const status = getMemberStatus(end_date);

    await dbRun(`
      UPDATE members 
      SET name = ?, phone = ?, email = ?, membership_type = ?, start_date = ?, end_date = ?, total_fee = ?, due_amount = ?, status = ?
      WHERE id = ?
    `, [
      name || member.name, 
      phone || member.phone, 
      email !== undefined ? email : member.email, 
      membership_type || member.membership_type, 
      start_date || member.start_date, 
      end_date || member.end_date, 
      total, 
      due, 
      status, 
      req.params.id
    ]);

    res.json({ message: 'Member updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Route: Delete Member
router.delete('/members/:id', async (req, res) => {
  try {
    const result = await dbRun('DELETE FROM members WHERE id = ?', [req.params.id]);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Member not found' });
    }
    res.json({ message: 'Member deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Route: Get Payments Ledger (with optional search filter by member name/phone)
router.get('/payments', async (req, res) => {
  try {
    const { q } = req.query;
    let sql = `
      SELECT p.*, m.name as member_name, m.phone as member_phone, m.membership_type
      FROM payments p
      JOIN members m ON p.member_id = m.id
    `;
    const params = [];
    if (q) {
      sql += ' WHERE (m.name LIKE ? OR m.phone LIKE ?)';
      const wild = `%${q}%`;
      params.push(wild, wild);
    }
    sql += ' ORDER BY p.payment_date DESC, p.id DESC';
    const payments = await dbAll(sql, params);
    res.json(payments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Route: Record a Payment
router.post('/payments', async (req, res) => {
  try {
    const { member_id, amount, payment_method, payment_date, reference } = req.body;
    
    if (!member_id || !amount || !payment_method || !payment_date) {
      return res.status(400).json({ error: 'Required fields: member_id, amount, payment_method, payment_date' });
    }

    const member = await dbGet('SELECT * FROM members WHERE id = ?', [member_id]);
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const payVal = parseFloat(amount);
    const newPaid = member.paid_amount + payVal;
    const newDue = member.total_fee - newPaid;

    // Begin SQLite Transaction
    await dbRun('BEGIN TRANSACTION');
    
    try {
      // 1. Save payment record
      await dbRun(`
        INSERT INTO payments (member_id, amount, payment_method, payment_date, reference)
        VALUES (?, ?, ?, ?, ?)
      `, [member_id, payVal, payment_method, payment_date, reference || null]);

      // 2. Update member outstanding balance
      await dbRun(`
        UPDATE members 
        SET paid_amount = ?, due_amount = ?
        WHERE id = ?
      `, [newPaid, newDue, member_id]);

      await dbRun('COMMIT');
      res.status(201).json({ message: 'Payment recorded successfully' });
    } catch (txErr) {
      await dbRun('ROLLBACK');
      throw txErr;
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Route: Get Daily Attendance Log & Member Details
router.get('/attendance/today', async (req, res) => {
  try {
    const logs = await dbAll(`
      SELECT a.*, m.name, m.phone, m.membership_type 
      FROM attendance a
      JOIN members m ON a.member_id = m.id
      WHERE date(a.check_in_time) = date('now', 'localtime')
      ORDER BY a.check_in_time DESC
    `);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Route: Check-In Member
router.post('/attendance/checkin', async (req, res) => {
  try {
    const { member_id } = req.body;
    if (!member_id) {
      return res.status(400).json({ error: 'Member ID is required' });
    }

    const member = await dbGet('SELECT * FROM members WHERE id = ?', [member_id]);
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    if (member.status !== 'Active') {
      return res.status(400).json({ error: `Cannot check-in. Member is currently ${member.status}.` });
    }

    // Check if already checked in today and not checked out
    const activeCheckIn = await dbGet(`
      SELECT * FROM attendance 
      WHERE member_id = ? 
        AND date(check_in_time) = date('now', 'localtime') 
        AND check_out_time IS NULL
    `, [member_id]);

    if (activeCheckIn) {
      return res.status(400).json({ error: 'Member is already checked in for today.' });
    }

    const checkInStr = new Date().toISOString();
    await dbRun(`
      INSERT INTO attendance (member_id, check_in_time, check_out_time)
      VALUES (?, ?, NULL)
    `, [member_id]);

    res.status(201).json({ message: `${member.name} checked in successfully.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Route: Check-Out Member
router.post('/attendance/checkout', async (req, res) => {
  try {
    const { member_id } = req.body;
    if (!member_id) {
      return res.status(400).json({ error: 'Member ID is required' });
    }

    const activeCheckIn = await dbGet(`
      SELECT * FROM attendance 
      WHERE member_id = ? 
        AND date(check_in_time) = date('now', 'localtime') 
        AND check_out_time IS NULL
      ORDER BY check_in_time DESC 
      LIMIT 1
    `, [member_id]);

    if (!activeCheckIn) {
      return res.status(400).json({ error: 'No active check-in found for today to check-out.' });
    }

    const checkOutStr = new Date().toISOString();
    await dbRun(`
      UPDATE attendance 
      SET check_out_time = ? 
      WHERE id = ?
    `, [checkOutStr, activeCheckIn.id]);

    res.json({ message: 'Checked out successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Route: Get attendance for a specific date (calendar view)
router.get('/attendance/date/:date', async (req, res) => {
  try {
    const { date } = req.params; // YYYY-MM-DD
    const logs = await dbAll(`
      SELECT a.*, m.name, m.phone, m.membership_type, m.status as member_status,
             m.end_date, m.due_amount
      FROM attendance a
      JOIN members m ON a.member_id = m.id
      WHERE date(a.check_in_time) = ?
      ORDER BY a.check_in_time DESC
    `, [date]);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Route: Get all active members for attendance marking
router.get('/attendance/active-members', async (req, res) => {
  try {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    // Get all active members with their today's attendance status
    const members = await dbAll(`
      SELECT m.id, m.name, m.phone, m.membership_type, m.status, 
             m.end_date, m.due_amount, m.start_date,
             (SELECT COUNT(*) FROM attendance a 
              WHERE a.member_id = m.id AND date(a.check_in_time) = ?) as attended_today
      FROM members m 
      WHERE m.status = 'Active'
      ORDER BY m.name ASC
    `, [todayStr]);
    
    res.json(members);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Route: Bulk mark attendance (present/absent for multiple members)
router.post('/attendance/mark', async (req, res) => {
  try {
    const { member_ids } = req.body; // array of member IDs to mark present
    if (!member_ids || !Array.isArray(member_ids)) {
      return res.status(400).json({ error: 'member_ids array is required' });
    }
    
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    let marked = 0;
    let skipped = 0;
    
    for (const memberId of member_ids) {
      // Check if already marked today
      const existing = await dbGet(`
        SELECT id FROM attendance 
        WHERE member_id = ? AND date(check_in_time) = ?
      `, [memberId, todayStr]);
      
      if (existing) {
        skipped++;
        continue;
      }
      
      // Check member is active
      const member = await dbGet('SELECT * FROM members WHERE id = ? AND status = ?', [memberId, 'Active']);
      if (!member) {
        skipped++;
        continue;
      }
      
      await dbRun(`
        INSERT INTO attendance (member_id, check_in_time, check_out_time)
        VALUES (?, ?, NULL)
      `, [memberId, now.toISOString()]);
      marked++;
    }
    
    res.status(201).json({ 
      message: `Attendance marked: ${marked} present, ${skipped} skipped (already marked or inactive).`,
      marked,
      skipped
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Route: Sync today's attendance in a single atomic request (fast for mobile)
router.post('/attendance/sync', async (req, res) => {
  try {
    const { present_ids } = req.body;
    if (!Array.isArray(present_ids)) {
      return res.status(400).json({ error: 'present_ids array is required' });
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const nowIso = new Date().toISOString();

    await dbRun('BEGIN TRANSACTION');
    try {
      // 1. Delete attendance for today for any member who is NOT in present_ids
      if (present_ids.length > 0) {
        const placeholders = present_ids.map(() => '?').join(',');
        await dbRun(`
          DELETE FROM attendance 
          WHERE date(check_in_time) = ? 
            AND member_id NOT IN (${placeholders})
        `, [todayStr, ...present_ids]);
      } else {
        // If present_ids is empty, clear today's attendance
        await dbRun('DELETE FROM attendance WHERE date(check_in_time) = ?', [todayStr]);
      }

      // 2. Insert any member in present_ids who isn't already marked today
      for (const memberId of present_ids) {
        const existing = await dbGet(`
          SELECT id FROM attendance 
          WHERE member_id = ? AND date(check_in_time) = ?
        `, [memberId, todayStr]);

        if (!existing) {
          await dbRun(`
            INSERT INTO attendance (member_id, check_in_time, check_out_time)
            VALUES (?, ?, NULL)
          `, [memberId, nowIso]);
        }
      }

      await dbRun('COMMIT');
      res.json({ message: 'Attendance synced successfully.' });
    } catch (txErr) {
      await dbRun('ROLLBACK');
      throw txErr;
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Route: Get dates with attendance records for a given month (for calendar dots)
router.get('/attendance/month/:year/:month', async (req, res) => {
  try {
    const { year, month } = req.params;
    const paddedMonth = month.padStart(2, '0');
    const prefix = `${year}-${paddedMonth}`;
    
    const days = await dbAll(`
      SELECT DISTINCT date(check_in_time) as day, COUNT(DISTINCT member_id) as count
      FROM attendance
      WHERE strftime('%Y-%m', check_in_time) = ?
      GROUP BY day
      ORDER BY day ASC
    `, [prefix]);
    
    res.json(days);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
