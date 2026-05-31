import axios, { AxiosInstance, AxiosError } from 'axios';

const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

const api: AxiosInstance = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

let isRefreshing = false;
let refreshQueue: Array<{ resolve: () => void; reject: (err: any) => void }> = [];

const processQueue = (error: any = null) => {
  refreshQueue.forEach((p) => (error ? p.reject(error) : p.resolve()));
  refreshQueue = [];
};

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as any;

    if (
      error.response?.status === 401 &&
      !original._retry &&
      !original.url?.includes('/auth/refresh') &&
      !original.url?.includes('/auth/login')
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          refreshQueue.push({ resolve, reject });
        }).then(() => api(original));
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const refreshRes = await api.post('/auth/refresh');
        if (!refreshRes.data?.data?.accessToken) {
          throw new Error('Refresh response missing token');
        }
        processQueue();
        isRefreshing = false;
        return api(original);
      } catch (refreshErr) {
        processQueue(refreshErr);
        isRefreshing = false;
        window.location.href = '/login';
        return Promise.reject(refreshErr);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
