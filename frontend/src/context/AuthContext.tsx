import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { api } from '../services/api';
import { useToast } from './ToastContext';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  loginWithGoogle: (credential: string) => Promise<void>;
  loginWithDemo: (customUser?: Partial<User>) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('reachinbox_auth_token'));
  const [loading, setLoading] = useState<boolean>(true);
  const { showToast } = useToast();

  useEffect(() => {
    const fetchUser = async () => {
      const storedToken = localStorage.getItem('reachinbox_auth_token');
      if (storedToken) {
        try {
          const res = await api.getMe();
          if (res.success && res.user) {
            setUser(res.user);
          } else {
            logout();
          }
        } catch {
          // Token expired or invalid
          logout();
        }
      }
      setLoading(false);
    };

    fetchUser();
  }, []);

  const loginWithGoogle = async (credential: string) => {
    try {
      setLoading(true);
      const res = await api.googleLogin(credential);
      if (res.success) {
        localStorage.setItem('reachinbox_auth_token', res.token);
        setToken(res.token);
        setUser(res.user);
        showToast('success', `Welcome back, ${res.user.name || res.user.email}!`, 'Signed in successfully');
      }
    } catch (err: any) {
      showToast('error', err.response?.data?.message || 'Google Login failed', 'Authentication Error');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const loginWithDemo = async (customUser?: Partial<User>) => {
    try {
      setLoading(true);
      const res = await api.demoLogin(customUser);
      if (res.success) {
        localStorage.setItem('reachinbox_auth_token', res.token);
        setToken(res.token);
        setUser(res.user);
        showToast('success', `Logged in as ${res.user.name}`, 'Demo Access Activated');
      }
    } catch (err: any) {
      showToast('error', 'Could not authenticate demo session', 'Error');
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('reachinbox_auth_token');
    setToken(null);
    setUser(null);
    showToast('info', 'You have been logged out safely.', 'Session Closed');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        loading,
        loginWithGoogle,
        loginWithDemo,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
