import api from './apiClient';

export const sendRequest      = (data)    => api.post('/connections/request', data);
export const acceptRequest    = (request_id) => api.post('/connections/accept', { request_id });
export const rejectRequest    = (request_id) => api.post('/connections/reject', { request_id });
export const listConnections  = (user_id) => api.post('/connections/list', { user_id });
export const mutualConnections  = (data)   => api.post('/connections/mutual', data);
export const pendingRequests   = (user_id) => api.post('/connections/pending', { user_id });
export const sentRequests      = (user_id) => api.post('/connections/sent',    { user_id });
