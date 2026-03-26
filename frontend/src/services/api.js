import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('resamatic_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res.data,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('resamatic_token');
      window.location.href = '/login';
    }
    return Promise.reject(err.response?.data || err);
  }
);

export const authApi = {
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
  register: (data) => api.post('/auth/register', data),
  changePassword: (data) => api.post('/auth/change-password', data),
};

export const sitesApi = {
  getAll: () => api.get('/sites'),
  getOne: (id) => api.get(`/sites/${id}`),
  create: (data) => api.post('/sites', data),
  update: (id, data) => api.put(`/sites/${id}`, data),
  delete: (id) => api.delete(`/sites/${id}`),
  duplicate: (id) => api.post(`/sites/${id}/duplicate`),
  fetchGoogleReviews: (id) => api.post(`/sites/${id}/fetch-reviews`),
};

export const pagesApi = {
  getBySite: (siteId) => api.get(`/pages/site/${siteId}`),
  getOne: (id) => api.get(`/pages/${id}`),
  create: (siteId, data) => api.post(`/pages/site/${siteId}`, data),
  update: (id, data) => api.put(`/pages/${id}`, data),
  delete: (id) => api.delete(`/pages/${id}`),
  updateSection: (pageId, idx, data) => api.patch(`/pages/${pageId}/sections/${idx}`, data),
  updateSections: (pageId, sections) => api.patch(`/pages/${pageId}/sections`, { sections }),
};

export const mediaApi = {
  getBySite: (siteId, folder) => api.get(`/media/site/${siteId}`, { params: { folder } }),
  getOne: (id) => api.get(`/media/${id}`),
  upload: (siteId, formData) => api.post(`/media/site/${siteId}/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  update: (id, data) => api.patch(`/media/${id}`, data),
  delete: (id) => api.delete(`/media/${id}`),
};

export const buildApi = {
  trigger: (siteId) => api.post(`/build/${siteId}`),
  status: (siteId) => api.get(`/build/${siteId}/status`),
  previewUrl: (siteId, page) => `/api/build/${siteId}/preview/${page}`,
};

export const deployApi = {
  publish: (siteId) => api.post(`/deploy/${siteId}/publish`),
  unpublish: (siteId) => api.post(`/deploy/${siteId}/unpublish`),
  status: (siteId) => api.get(`/deploy/${siteId}/status`),
};

export const aiApi = {
  generatePage: (data) => api.post('/ai/generate-page', data),
  generateContact: (data) => api.post('/ai/generate-contact', data),
  generateSeo: (data) => api.post('/ai/generate-seo', data),
  optimizeSeo: (siteId) => api.post('/ai/optimize-seo', { siteId }),
  rewrite: (data) => api.post('/ai/rewrite', data),
  generateAlt: (data) => api.post('/ai/generate-alt', data),
};

export const usersApi = {
  getAll: () => api.get('/users'),
  getOne: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
  resetPassword: (id, data) => api.post(`/users/${id}/reset-password`, data),
};

export default api;
