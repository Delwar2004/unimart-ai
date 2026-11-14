import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('unimart_token') || null);
  const [loading, setLoading] = useState(true);

  // Initialize auth state: if token exists, fetch current user info
  useEffect(() => {
    const initAuth = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const response = await authService.getMe();
        if (response?.success && response?.data) {
          setUser(response.data);
        } else {
          logout();
        }
      } catch (err) {
        console.warn('Session expired or invalid token:', err.message);
        logout();
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, [token]);

  // Handle successful login
  const login = (authToken, userData) => {
    localStorage.setItem('unimart_token', authToken);
    setToken(authToken);
    setUser(userData);
  };

  // Handle logout: remove token from client storage
  const logout = () => {
    localStorage.removeItem('unimart_token');
    setToken(null);
    setUser(null);
  };

  // Update authenticated user state in context
  const updateUser = (updatedUserData) => {
    setUser((prev) => ({ ...prev, ...updatedUserData }));
  };

  const value = {
    user,
    token,
    isAuthenticated: !!user,
    isLoading: loading,
    login,
    logout,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
