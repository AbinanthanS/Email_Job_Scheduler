import axios from 'axios';
import { EmailJob, Pagination, QueueStats, SchedulePayload, SenderProfile, User } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for injecting auth token
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('reachinbox_auth_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const api = {
  // Auth
  googleLogin: async (credential: string): Promise<{ success: boolean; token: string; user: User }> => {
    const res = await apiClient.post('/auth/google', { credential });
    return res.data;
  },

  demoLogin: async (user?: Partial<User>): Promise<{ success: boolean; token: string; user: User }> => {
    const res = await apiClient.post('/auth/demo', user || {});
    return res.data;
  },

  getMe: async (): Promise<{ success: boolean; user: User }> => {
    const res = await apiClient.get('/auth/me');
    return res.data;
  },

  // Emails
  scheduleEmails: async (payload: SchedulePayload): Promise<{ success: boolean; message: string; data: any }> => {
    const res = await apiClient.post('/emails/schedule', payload);
    return res.data;
  },

  getScheduledEmails: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
  }): Promise<{ success: boolean; data: EmailJob[]; pagination: Pagination }> => {
    const res = await apiClient.get('/emails/scheduled', { params });
    return res.data;
  },

  getSentEmails: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
  }): Promise<{ success: boolean; data: EmailJob[]; pagination: Pagination }> => {
    const res = await apiClient.get('/emails/sent', { params });
    return res.data;
  },

  cancelEmail: async (id: string): Promise<{ success: boolean; message: string }> => {
    const res = await apiClient.delete(`/emails/${id}`);
    return res.data;
  },

  getStats: async (): Promise<{ success: boolean; stats: QueueStats }> => {
    const res = await apiClient.get('/emails/stats');
    return res.data;
  },

  getSenders: async (): Promise<{ success: boolean; defaultSenderEmail: string; senders: SenderProfile[] }> => {
    const res = await apiClient.get('/emails/senders');
    return res.data;
  },
};
