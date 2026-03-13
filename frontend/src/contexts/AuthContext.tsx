import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import api from '../api/client';

interface AuthContextType {
  token: string | null;
  isAuthEnabled: boolean;
  isAuthenticated: boolean;
  login: (token: string) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  token: null,
  isAuthEnabled: false,
  isAuthenticated: true,
  login: () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(
    localStorage.getItem('paperless_token')
  );
  const [isAuthEnabled, setIsAuthEnabled] = useState(false);

  useEffect(() => {
    api.get('/auth/status').then((res) => {
      setIsAuthEnabled(res.data.auth_enabled);
    }).catch(() => {
      // If status endpoint fails, default to no auth required
    });
  }, []);

  const login = (newToken: string) => {
    localStorage.setItem('paperless_token', newToken);
    setToken(newToken);
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // ignore
    }
    // Re-fetch auth status so isAuthenticated is computed with the current value
    try {
      const res = await api.get('/auth/status');
      setIsAuthEnabled(res.data.auth_enabled);
    } catch {
      // ignore
    }
    localStorage.removeItem('paperless_token');
    setToken(null);
  };

  const isAuthenticated = !isAuthEnabled || token !== null;

  return (
    <AuthContext.Provider value={{ token, isAuthEnabled, isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
