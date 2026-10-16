const API_BASE = '/api';

function getHeaders() {
  const token = localStorage.getItem('apex_token');
  const headers = {
    'Content-Type': 'application/json'
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function request(url, options = {}) {
  let response;
  try {
    // Add a 15 second timeout for mobile/WiFi connections
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    response = await fetch(`${API_BASE}${url}`, {
      ...options,
      signal: controller.signal,
      headers: {
        ...getHeaders(),
        ...options.headers
      }
    });

    clearTimeout(timeoutId);
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Request timed out. Check your network connection.');
    }
    throw new Error('Network error. Please check if the server is running and you are connected to the same WiFi.');
  }

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `Request failed with status ${response.status}`);
  }

  // Handle No Content response
  if (response.status === 204) return null;
  return response.json();
}

export const API = {
  // Authentication
  login: (username, password) => 
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    }),

  // Dashboard Aggregates
  getDashboardStats: () => request('/dashboard/stats'),

  // Alerts & Notifications
  getNotifications: () => request('/notifications'),

  // Members Management
  getMembers: (q = '', status = 'All') => {
    const params = new URLSearchParams();
    if (q) params.append('q', q);
    if (status) params.append('status', status);
    return request(`/members?${params.toString()}`);
  },
  
  getMemberProfile: (id) => request(`/members/${id}`),
  
  createMember: (memberData) => 
    request('/members', {
      method: 'POST',
      body: JSON.stringify(memberData)
    }),
    
  updateMember: (id, memberData) => 
    request(`/members/${id}`, {
      method: 'PUT',
      body: JSON.stringify(memberData)
    }),
    
  deleteMember: (id) => 
    request(`/members/${id}`, {
      method: 'DELETE'
    }),

  // Finance & Payments
  getPayments: (q = '') => {
    const params = new URLSearchParams();
    if (q) params.append('q', q);
    return request(`/payments?${params.toString()}`);
  },

  recordPayment: (paymentData) => 
    request('/payments', {
      method: 'POST',
      body: JSON.stringify(paymentData)
    }),

  // Attendance Checkins
  getTodayAttendance: () => request('/attendance/today'),
  
  checkIn: (memberId) => 
    request('/attendance/checkin', {
      method: 'POST',
      body: JSON.stringify({ member_id: memberId })
    }),
    
  checkOut: (memberId) => 
    request('/attendance/checkout', {
      method: 'POST',
      body: JSON.stringify({ member_id: memberId })
    }),

  // Calendar & Attendance Management
  getAttendanceByDate: (date) => request(`/attendance/date/${date}`),
  
  getActiveMembers: () => request('/attendance/active-members'),
  
  markAttendance: (memberIds) =>
    request('/attendance/mark', {
      method: 'POST',
      body: JSON.stringify({ member_ids: memberIds })
    }),
  
  syncAttendance: (presentIds) =>
    request('/attendance/sync', {
      method: 'POST',
      body: JSON.stringify({ present_ids: presentIds })
    }),

  getMonthAttendance: (year, month) => request(`/attendance/month/${year}/${month}`)
};
