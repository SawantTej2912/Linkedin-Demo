import api from './apiClient';

export const searchJobs   = (params) => api.post('/jobs/search', params);
export const getJob       = (job_id) => api.post('/jobs/get', { job_id });
export const createJob    = (data)   => api.post('/jobs/create', data);
export const updateJob    = (data)   => api.post('/jobs/update', data);
export const closeJob     = (data)   => api.post('/jobs/close', data);
export const jobsByRecruiter = (recruiter_id) => api.post('/jobs/byRecruiter', { recruiter_id });
