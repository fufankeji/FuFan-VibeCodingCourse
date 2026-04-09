import React, { createContext, useContext, useState } from 'react';
import type { User, UserRole } from '../types';
import { MOCK_USERS } from '../mock/data';
import { apiClient } from '../api/client';

interface AuthContextValue {
  user: User | null;
  login: (role: UserRole) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  login: () => {},
  logout: () => {},
  isAuthenticated: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  const login = (role: UserRole) => {
    const found = MOCK_USERS.find((u) => u.role === role) ?? MOCK_USERS[0];
    setUser(found);
    apiClient.setUser(found.id, found.role);
  };

  const logout = () => setUser(null);

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
