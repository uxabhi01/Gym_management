# 🏋️ Apex Gym Management System

A sleek, lightweight, full-stack web application designed for gym owners and administrators to effortlessly manage members, track active plans, record attendance, collect dues, and dispatch renewal reminders.

---

## 🎯 Project Agenda & Purpose

Managing a gym with spreadsheets or paper logs is time-consuming and prone to errors. **Apex Gym** provides a centralized administrative hub to:

- 📋 **Manage Members**: Register new gym members, assign plans (Monthly, Quarterly, Annual), and update records.
- ⏱️ **Track Expirations**: Automatically identify active, expiring-soon, and expired memberships.
- 💳 **Payment & Due Tracking**: Keep a real-time ledger of collected fees, partial payments, and outstanding balances.
- 📲 **1-Click WhatsApp Reminders**: Direct links with pre-filled reminder messages for dues and expiring memberships.
- 🕒 **Daily Attendance Log**: Fast check-in and check-out terminal for gym members with timestamp tracking.
- 📊 **Visual Analytics**: Interactive charts showing membership distribution, attendance patterns, and revenue trends.

---

## 🛠️ Tech Stack

| Layer | Technologies Used |
| :--- | :--- |
| **Frontend** | Vanilla JavaScript (ES Modules SPA), HTML5, Custom Glassmorphic CSS |
| **Bundler & Tooling** | [Vite](https://vitejs.dev/) |
| **Backend** | [Node.js](https://nodejs.org/) & [Express.js](https://expressjs.com/) |
| **Database** | [SQLite3](https://www.sqlite.org/) (Zero-setup file database with auto-seeding) |
| **UI Components** | [Chart.js](https://www.chartjs.org/) (Analytics), [Lucide Icons](https://lucide.dev/) |

---

## 🚀 Quick Setup & Installation

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) (version 18 or higher) installed on your machine.

### 1. Clone the repository
```bash
git clone https://github.com/YOUR_USERNAME/gym-management.git
cd gym-management
```

### 2. Install dependencies
```bash
npm install
```

### 3. Run the application
Run both the Express API server and Vite client concurrently:
```bash
npm run dev
```

* **Frontend UI:** Open [http://localhost:3000](http://localhost:3000) in your browser.
* **Backend API:** Running at [http://localhost:5000](http://localhost:5000).

---

## 🔐 Default Admin Credentials

When the server starts for the first time, it automatically creates the SQLite database (`gym.db`) and seeds a default admin account alongside sample data:

| Field | Default Value |
| :--- | :--- |
| **Username** | `admin` |
| **Password** | `admin123` |

---

## 📁 Project Structure

```text
gym-management/
├── server/
│   ├── db.js          # SQLite connection, tables, & initial seed data
│   ├── routes.js      # REST API endpoints (Auth, Members, Payments, Attendance)
│   └── index.js       # Express server entry point
├── src/
│   ├── css/
│   │   └── style.css  # Dark glassmorphic theme & responsive styles
│   ├── js/
│   │   ├── api.js     # Frontend fetch wrapper for API communication
│   │   ├── main.js    # App bootstrapper & session handler
│   │   ├── router.js  # Client-side SPA navigation router
│   │   └── views/     # Dashboard, Members, Attendance, Payments, Login
│   └── index.html     # SPA entry page
├── package.json       # Project scripts and dependencies
└── vite.config.js     # Vite configuration with API proxy
```

---

## 📜 Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts both the Express backend and Vite frontend concurrently |
| `npm run server` | Starts only the backend API server with nodemon |
| `npm run client` | Starts only the Vite development frontend |
| `npm run build` | Builds the client application for production in `/dist` |
| `npm run preview` | Previews the production build locally |

---

## 📄 License
This project is open-source and available under the [MIT License](LICENSE).
