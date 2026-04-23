import api from './apiClient';

export const getTopJobs           = (params) => api.post('/analytics/jobs/top', params);
export const getFunnel            = (params) => api.post('/analytics/funnel', params);
export const getGeo               = (params) => api.post('/analytics/geo', params);
export const getMemberDashboard   = (member_id) => api.post('/analytics/member/dashboard', { member_id, window_days: 30 });
export const getRecruiterDashboard = (recruiter_id, selected_job_id = null) =>
  api.post('/analytics/recruiter/dashboard', { recruiter_id, selected_job_id, window_days: 30 });
