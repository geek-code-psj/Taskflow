import axios, { AxiosInstance, AxiosError } from 'axios';

// Helper to safely get environment variables without type issues
function getApiUrl(): string {
  try {
    // @ts-ignore - Bypass type checking for import.meta.env
    const envUrl = import.meta.env?.VITE_API_URL;
    if (envUrl) {
      return `${envUrl}/api`;
    }
  } catch {
    // Silently fail if import.meta not available
  }
  return '/api';
}

const API_BASE = getApiUrl();

const api: AxiosInstance = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

let isRefreshing = false;
type QueueItem = {
  resolve: (value?: any) => void;
  reject: (reason?: any) => void;
};
let refreshQueue: QueueItem[] = [];

const processQueue = (error: any = null) => {
  refreshQueue.forEach((p: QueueItem) => {
    if (error) {
      p.reject(error);
    } else {
      p.resolve(undefined);
    }
  });
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
        return new Promise<any>((resolve: (value?: any) => void, reject: (reason?: any) => void) => {
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
