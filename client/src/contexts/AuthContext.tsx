'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiService } from '@/lib/api';
import { socketService } from '@/lib/socket';
import { User, LoginFormData, RegisterFormData, UserRole } from '@/types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (data: LoginFormData) => Promise<void>;
  register: (data: RegisterFormData) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // 检查本地存储的token并验证用户
  useEffect(() => {
    const initAuth = async () => {
      try {
        const token = apiService.getToken();
        if (token) {
          const response = await apiService.getCurrentUser();
          setUser(response.user);
          // 连接Socket.IO
          socketService.connect(token);
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        // 清除无效token
        apiService.clearToken();
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (data: LoginFormData) => {
    try {
      setLoading(true);
      const response = await apiService.login(data);

      if (response.token && response.user) {
        apiService.setToken(response.token);
        setUser(response.user);

        // 连接Socket.IO
        socketService.connect(response.token);
      } else {
        throw new Error('登录响应格式错误');
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const register = async (data: RegisterFormData) => {
    try {
      setLoading(true);

      // 验证密码确认
      if (data.password !== data.confirmPassword) {
        throw new Error('密码确认不匹配');
      }

      // 移除confirmPassword字段，因为API不需要它
      const { confirmPassword, ...registerData } = data;

      const response = await apiService.register(registerData);

      if (response.token && response.user) {
        apiService.setToken(response.token);
        setUser(response.user);

        // 连接Socket.IO
        socketService.connect(response.token);
      } else {
        throw new Error('注册响应格式错误');
      }
    } catch (error) {
      console.error('Register error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    apiService.clearToken();
    socketService.disconnect();
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const response = await apiService.getCurrentUser();
      setUser(response.user);
    } catch (error) {
      console.error('Refresh user error:', error);
      // 如果刷新失败，可能token已过期
      logout();
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    login,
    register,
    logout,
    refreshUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
