import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../lib/api';
import { User } from '@taskflow/types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api.get('/auth/me')
      .then((res) => {
        if (res.data?.data?.user) {
          setUser(res.data.data.user);
        } else {
          console.warn('Invalid auth response structure');
          setUser(null);
        }
      })
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.post('/auth/login', { email, password });
    if (res.data?.data?.user) {
      setUser(res.data.data.user);
    } else {
      throw new Error('Invalid login response');
    }
  };

  const signup = async (username: string, email: string, password: string) => {
    const res = await api.post('/auth/signup', { username, email, password });
    if (res.data?.data?.user) {
      setUser(res.data.data.user);
    } else {
      throw new Error('Invalid signup response');
    }
  };

  const logout = async () => {
    await api.post('/auth/logout').catch(() => {});
    setUser(null);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
