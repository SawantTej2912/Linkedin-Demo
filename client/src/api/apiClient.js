import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  const memberId = localStorage.getItem('member_id');
  if (memberId) config.headers['x-member-id'] = memberId;
  return config;
});

export default api;
