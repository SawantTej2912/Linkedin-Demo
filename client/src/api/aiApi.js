import api from './apiClient';

export const startHiringAssistant  = (data)     => api.post('/agents/hiring-assistant/start', data);
export const getHiringStatus       = (trace_id) => api.post('/agents/hiring-assistant/status', { trace_id });
export const approveHiring         = (data)     => api.post('/agents/hiring-assistant/approve', data);
export const careerCoach           = (data)     => api.post('/agents/career-coach', data);
export const parseResume           = (data)     => api.post('/skills/parse-resume', data);

// WebSocket URL for real-time updates
export const hiringWsUrl = (trace_id) =>
  `ws://${window.location.hostname}:8000/agents/hiring-assistant/ws/${trace_id}`;
