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
  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      ...getHeaders(),
      ...options.headers
    }
  });

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
    })
};
