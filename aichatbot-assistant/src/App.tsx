import React, { useState, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, AuthContext } from './context/authContext';

import Sidebar from './components/navigation/sidebar';
import Navbar from './components/navigation/navbar';
import ChatDashboard from './components/pages/Chatdashdoard';
import Profile from './components/pages/profile';
import SettingsPage from './components/pages/settings';
import Authentication from './components/authentication/authentication';

const ProtectedLayout = () => {
  const { isAuthenticated, darkMode } = useContext(AuthContext)!;
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: darkMode ? '#0a0a0a' : '#f5f5f5', color: darkMode ? '#fff' : '#000', overflow: 'hidden' }}>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Navbar onMenuClick={() => setSidebarOpen(true)} title="VoiceAI Dashboard" />
        <div style={{ flex: 1, overflow: 'auto' }}>
          <Outlet />
        </div>
      </div>
    </div>
  );
};

const AuthRoute = () => {
  const { isAuthenticated, darkMode, toggleDarkMode, login } = useContext(AuthContext)!;
  if (isAuthenticated) return <Navigate to="/chat" replace />;
  return <Authentication darkMode={darkMode} onToggleDarkMode={toggleDarkMode} handleLogin={login} />;
};

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<AuthRoute />} />
          <Route element={<ProtectedLayout />}>
            <Route path="/" element={<Navigate to="/chat" replace />} />
            <Route path="/chat" element={<ChatDashboard />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}