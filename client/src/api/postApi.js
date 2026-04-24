import api from './apiClient';

export const getFeedPosts = (limit = 30) => api.get('/posts', { params: { limit } });
export const createPost = (content, type = 'general') => api.post('/posts', { content, type });
export const likePost = (postId) => api.post(`/posts/${postId}/like`);
export const unlikePost = (postId) => api.delete(`/posts/${postId}/like`);
export const addPostComment = (postId, content) => api.post(`/posts/${postId}/comments`, { content });
export const deletePostComment = (postId, commentId) => api.delete(`/posts/${postId}/comments/${commentId}`);
export const savePost = (postId) => api.post(`/posts/${postId}/save`);
export const unsavePost = (postId) => api.delete(`/posts/${postId}/save`);
export const getSavedPosts = (limit = 50) => api.get('/posts/saved', { params: { limit } });
