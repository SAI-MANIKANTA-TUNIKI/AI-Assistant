import React from 'react';
import { NavLink } from 'react-router-dom'; // Assuming you use react-router
import { MessageSquare, User, Settings, LogOut, Bot } from 'lucide-react';
import styles from '../pagesmodulecss/sidebar.module.css';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  return (
    <aside className={`${styles.sidebar} ${isOpen ? styles.sidebarOpen : ''}`}>
      <div className={styles.brand}>
        <Bot size={24} className={styles.brandIcon} />
        <span className={styles.brandText}>VoiceAI</span>
      </div>

      <nav className={styles.navMenu}>
        <NavLink 
          to="/chat" 
          className={({ isActive }) => isActive ? `${styles.navLink} ${styles.active}` : styles.navLink}
          onClick={onClose}
        >
          <MessageSquare size={18} />
          <span>Chat</span>
        </NavLink>
        
        <NavLink 
          to="/profile" 
          className={({ isActive }) => isActive ? `${styles.navLink} ${styles.active}` : styles.navLink}
          onClick={onClose}
        >
          <User size={18} />
          <span>Profile</span>
        </NavLink>

        <NavLink 
          to="/settings" 
          className={({ isActive }) => isActive ? `${styles.navLink} ${styles.active}` : styles.navLink}
          onClick={onClose}
        >
          <Settings size={18} />
          <span>Settings</span>
        </NavLink>
      </nav>

      <div className={styles.footer}>
        <button className={styles.logoutBtn} onClick={() => console.log('Sign out')}>
          <LogOut size={18} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}