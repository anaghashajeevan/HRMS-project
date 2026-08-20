// src/api/auth.ts
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

export const forgotPasswordApi = {
  requestOTP: async (email: string): Promise<{ message: string }> => {
    const { data } = await api.post('/auth/forgot-password/request/', { email });
    return data;
  },

  verifyOTP: async (
    email: string,
    otp: string
  ): Promise<{ reset_token: string; expires_in_minutes: number }> => {
    const { data } = await api.post('/auth/forgot-password/verify-otp/', {
      email,
      otp,
    });
    return data;
  },

  resetPassword: async (
    resetToken: string,
    newPassword: string,
    confirmPassword: string
  ): Promise<{ message: string }> => {
    const { data } = await api.post('/auth/forgot-password/reset/', {
      reset_token: resetToken,
      new_password: newPassword,
      confirm_password: confirmPassword,
    });
    return data;
  },
};