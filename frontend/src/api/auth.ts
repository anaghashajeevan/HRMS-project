import api from './axios';
import type { LoginPayload, LoginResponse, UserProfile } from '../types/auth';

export const authApi = {
  login: async (payload: LoginPayload): Promise<LoginResponse> => {
    const { data } = await api.post<LoginResponse>('/auth/token/', payload);
    return data;
  },

  logout: async (refresh: string): Promise<void> => {
    await api.post('/auth/logout/', { refresh });
  },

  me: async (): Promise<UserProfile> => {
    const { data } = await api.get<UserProfile>('/auth/me/');
    return data;
  },

  changePassword: async (payload: {
    old_password: string;
    new_password: string;
    confirm_password: string;
  }): Promise<void> => {
    await api.post('/auth/password/change/', payload);
  },
};