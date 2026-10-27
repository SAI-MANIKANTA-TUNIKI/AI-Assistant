import React, { createContext, useState, useEffect, type ReactNode } from "react";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

interface AuthContextType {
  isAuthenticated: boolean;
  user: { name: string; email: string } | null;
  login: () => void;
  logout: () => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
  updateUser: (userData: { name: string; email: string }) => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [darkMode, setDarkMode] = useState(true);

  const checkAuth = async () => {
    try {
      const res = await axios.post(`${API_URL}/api/auth/is-auth`, {}, { withCredentials: true });
      if (res.data.success) {
        const userRes = await axios.get(`${API_URL}/api/user/data`, { withCredentials: true });
        setUser(userRes.data.userData);
        setIsAuthenticated(true);
      }
    } catch (error) {
      setIsAuthenticated(false);
      setUser(null);
    }
  };

  useEffect(() => { checkAuth(); }, []);

  const login = () => { setIsAuthenticated(true); checkAuth(); };

  const logout = async () => {
    try {
      await axios.post(`${API_URL}/api/auth/logout`, {}, { withCredentials: true });
      setIsAuthenticated(false);
      setUser(null);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const toggleDarkMode = () => setDarkMode(!darkMode);
  const updateUser = (userData: { name: string; email: string }) => setUser(userData);

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout, darkMode, toggleDarkMode, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};