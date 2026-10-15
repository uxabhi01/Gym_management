import sqlite3 from 'sqlite3';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '../gym.db');

// Connect to SQLite
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Database connection error:', err.message);
  } else {
    console.log('Connected to SQLite database at:', dbPath);
  }
});

// Helper: Wrap db runs/queries in Promises
export const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

export const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

export const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

// Hash password helper
export function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Format date helper (YYYY-MM-DD)
function formatDate(date) {
  return date.toISOString().split('T')[0];
}

// Initialize database schema and seed data
export async function initDb() {
  // 1. Enable foreign keys
  await dbRun('PRAGMA foreign_keys = ON');

  // 2. Create users table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL
    )
  `);

  // 3. Create members table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      membership_type TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      total_fee REAL NOT NULL,
      paid_amount REAL DEFAULT 0,
      due_amount REAL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'Active'
    )
  `);

  // 4. Create attendance table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER NOT NULL,
      check_in_time TEXT NOT NULL,
      check_out_time TEXT,
      FOREIGN KEY(member_id) REFERENCES members(id) ON DELETE CASCADE
    )
  `);

  // 5. Create payments table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      payment_method TEXT NOT NULL,
      payment_date TEXT NOT NULL,
      reference TEXT,
      FOREIGN KEY(member_id) REFERENCES members(id) ON DELETE CASCADE
    )
  `);

  // Seed default admin if table is empty
  const adminExists = await dbGet('SELECT * FROM users WHERE username = ?', ['admin']);
  if (!adminExists) {
    const hashed = hashPassword('admin123');
    await dbRun(
      'INSERT INTO users (username, password, name) VALUES (?, ?, ?)',
      ['admin', hashed, 'Owner Admin']
    );
    console.log('Seeded default admin user: admin / admin123');
  }

  // Seed initial member data if empty
  const membersCount = await dbGet('SELECT COUNT(*) as count FROM members');
  if (membersCount.count === 0) {
    console.log('Database is empty. Seeding mock gym data...');

    const today = new Date();
    
    // Create Date Offsets for seeding
    const getOffsetDate = (days) => {
      const d = new Date(today);
      d.setDate(today.getDate() + days);
      return formatDate(d);
    };

    const seedMembers = [
      { name: 'John Doe', phone: '9876543210', email: 'john@example.com', type: 'Monthly', start: -15, end: 15, fee: 1000, paid: 1000 },
      { name: 'Jane Smith', phone: '9876543211', email: 'jane@example.com', type: 'Annual', start: -180, end: 185, fee: 8000, paid: 6000 },
      { name: 'Alex Johnson', phone: '9876543212', email: 'alex@example.com', type: 'Monthly', start: -28, end: 2, fee: 1000, paid: 1000 }, // Expiring soon (2 days)
      { name: 'Sarah Connor', phone: '9876543213', email: 'sarah@example.com', type: 'Quarterly', start: -5, end: 85, fee: 2700, paid: 1000 }, // Payment due
      { name: 'Michael Scott', phone: '9876543214', email: 'michael@dunder.com', type: 'Monthly', start: -35, end: -5, fee: 1000, paid: 500 }, // Expired & Payment due
      { name: 'Dwight Schrute', phone: '9876543215', email: 'dwight@dunder.com', type: 'Annual', start: -10, end: 355, fee: 8000, paid: 8000 },
      { name: 'Jim Halpert', phone: '9876543216', email: 'jim@example.com', type: 'Quarterly', start: -80, end: 10, fee: 2700, paid: 2700 }, // Expiring soon
      { name: 'Pam Beesly', phone: '9876543217', email: 'pam@example.com', type: 'Monthly', start: -12, end: 18, fee: 1000, paid: 0 }, // Payment due (fully unpaid)
      { name: 'Ryan Howard', phone: '9876543218', email: 'ryan@example.com', type: 'Monthly', start: -45, end: -15, fee: 1000, paid: 1000 }, // Expired
      { name: 'Kelly Kapoor', phone: '9876543219', email: 'kelly@example.com', type: 'Quarterly', start: -4, end: 86, fee: 2700, paid: 2700 }
    ];

    for (const m of seedMembers) {
      const startStr = getOffsetDate(m.start);
      const endStr = getOffsetDate(m.end);
      const due = m.fee - m.paid;
      
      // Determine status based on dates
      let status = 'Active';
      if (new Date(endStr) < today) {
        status = 'Expired';
      }

      const res = await dbRun(
        `INSERT INTO members (name, phone, email, membership_type, start_date, end_date, total_fee, paid_amount, due_amount, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [m.name, m.phone, m.email, m.type, startStr, endStr, m.fee, m.paid, due, status]
      );

      const memberId = res.lastID;

      // Seed payments for this member
      if (m.paid > 0) {
        await dbRun(
          `INSERT INTO payments (member_id, amount, payment_method, payment_date, reference)
           VALUES (?, ?, ?, ?, ?)`,
          [memberId, m.paid, 'UPI', getOffsetDate(m.start), 'TXN' + Math.floor(100000 + Math.random() * 90000) ]
        );
      }

      // Seed attendance (e.g. check in today or in past days)
      if (m.start < 0 && status === 'Active') {
        // Attendance history
        for (let dayOffset = m.start; dayOffset <= 0; dayOffset++) {
          // 70% chance of attendance on any day
          if (Math.random() > 0.3) {
            const checkInDate = new Date(today);
            checkInDate.setDate(today.getDate() + dayOffset);
            
            // Random hour between 6 AM and 10 AM
            checkInDate.setHours(6 + Math.floor(Math.random() * 4), Math.floor(Math.random() * 60), 0);
            const checkInStr = checkInDate.toISOString();

            // Check out ~1.5 hours later
            const checkOutDate = new Date(checkInDate);
            checkOutDate.setMinutes(checkOutDate.getMinutes() + 60 + Math.floor(Math.random() * 60));
            const checkOutStr = checkOutDate.toISOString();

            // If it's today, we might check in but not yet check out (active scanner check-in)
            const isToday = dayOffset === 0;
            const skipCheckOut = isToday && Math.random() > 0.5;

            await dbRun(
              `INSERT INTO attendance (member_id, check_in_time, check_out_time)
               VALUES (?, ?, ?)`,
              [memberId, checkInStr, skipCheckOut ? null : checkOutStr]
            );
          }
        }
      }
    }
    console.log('Successfully seeded database tables with mock data!');
  }
}

export default db;
