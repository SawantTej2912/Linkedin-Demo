import api from './apiClient';

export const submitApplication = (data) => api.post('/applications/submit', data);
export const getApplication = (application_id) => api.post('/applications/get', { application_id });
export const applicationsByMember = (member_id, page = 1, limit = 20) =>
  api.post('/applications/byMember', { member_id, page, limit });
export const applicationsByJob = (jobOrParams, recruiter_id = null, page = 1, limit = 20) => {
  if (typeof jobOrParams === 'object' && jobOrParams !== null) {
    return api.post('/applications/byJob', jobOrParams);
  }
  return api.post('/applications/byJob', { job_id: jobOrParams, recruiter_id, page, limit });
};
export const updateStatus = (data) => api.post('/applications/updateStatus', data);
