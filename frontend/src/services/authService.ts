import { api, setAccessToken } from './axiosInstance'

export interface LoginCredentials {
  email: string
  password: string
}

export interface AuthUser {
  id: string
  name: string
  email: string
  role: 'ADMIN' | 'CASHIER' | 'INVENTORY_MANAGER'
  phone?: string
  isActive?: boolean
  createdAt?: string
}

export interface LoginResponse {
  success: boolean
  message: string
  data: {
    token: string
    user: AuthUser
  }
}

export const authService = {
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    const response = await api.post<LoginResponse>('/auth/login', credentials)
    setAccessToken(response.data.data.token) // Save token in memory
    return response.data
  },

  async logout(): Promise<void> {
    await api.post('/auth/logout')
    setAccessToken(null) // Clear memory token
  },

  async getMe(): Promise<AuthUser> {
    const response = await api.get<{ success: boolean; data: AuthUser }>('/auth/me')
    return response.data.data
  },

  async listUsers(): Promise<AuthUser[]> {
    const response = await api.get<{ success: boolean; data: AuthUser[] }>('/auth/users')
    return response.data.data
  },

  async createUser(userData: any): Promise<AuthUser> {
    const response = await api.post<{ success: boolean; data: AuthUser }>('/auth/users', userData)
    return response.data.data
  },

  async toggleUserStatus(id: string): Promise<AuthUser> {
    const response = await api.patch<{ success: boolean; data: AuthUser }>(`/auth/users/${id}/toggle`)
    return response.data.data
  },

  async updateUser(id: string, userData: any): Promise<AuthUser> {
    const response = await api.put<{ success: boolean; data: AuthUser }>(`/auth/users/${id}`, userData)
    return response.data.data
  },

  async resetPassword(id: string): Promise<{ newPassword: string; emailSent: boolean }> {
    const response = await api.post<{ success: boolean; message: string; data: { newPassword: string; emailSent: boolean } }>(`/auth/users/${id}/reset-password`)
    return response.data.data
  },

  async updateProfile(profileData: { name: string; email: string; phone?: string }): Promise<AuthUser> {
    const response = await api.put<{ success: boolean; data: AuthUser }>('/auth/profile', profileData)
    return response.data.data
  },

  async updatePassword(passwordData: { currentPassword: string; newPassword: string }): Promise<{ success: boolean; message: string }> {
    const response = await api.put<{ success: boolean; message: string }>('/auth/profile/password', passwordData)
    return response.data
  },

  async checkEmail(email: string): Promise<boolean> {
    const response = await api.get<{ success: boolean; available: boolean }>(`/auth/users/check-email?email=${encodeURIComponent(email)}`)
    return response.data.available
  }
}

