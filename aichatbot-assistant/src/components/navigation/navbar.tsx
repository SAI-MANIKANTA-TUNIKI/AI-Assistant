import { useState, useEffect } from "react";
import { Menu, Search, Bell } from 'lucide-react';
import styles from '../pagesmodulecss/navbar.module.css';

interface NavbarProps {
  onMenuClick: () => void;
  title?: string;
}

export default function Navbar({ onMenuClick, title = 'Dashboard' }: NavbarProps) {
  return (
    <header className={styles.navbar}>
      <div className={styles.leftSection}>
        <button className={styles.menuBtn} onClick={onMenuClick} aria-label="Toggle menu">
          <Menu size={20} />
        </button>
        <h1 className={styles.pageTitle}>{title}</h1>
      </div>

      <div className={styles.rightSection}>
        <div className={styles.searchBar}>
          <Search size={16} className={styles.searchIcon} />
          <input type="text" placeholder="Search..." className={styles.searchInput} />
        </div>
        
        <button className={styles.iconBtn} aria-label="Notifications">
          <Bell size={20} />
          <span className={styles.notificationDot} />
        </button>
        
        <div className={styles.userAvatar}>
          <img src="https://ui-avatars.com/api/?name=User&background=c96442&color=fff" alt="User" />
        </div>
      </div>
    </header>
  );
}