import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { AuthContext } from '../../context/authContext';
import styles from '../pagesmodulecss/profile.module.css';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function Profile() {
  const { user, updateUser } = useContext(AuthContext)!;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
    }
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await axios.put(`${API_URL}/api/user/update`, { name, email }, { withCredentials: true });
      if (res.data.success) {
        toast.success("Profile updated successfully!");
        updateUser({ name, email });
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to update profile");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.profileContainer}>
      <div className={styles.header}>
        <h1 className={styles.title}>Profile</h1>
        <p className={styles.subtitle}>Manage your personal information.</p>
      </div>
      <div className={styles.card}>
        <div className={styles.avatarSection}>
          <img src={`https://ui-avatars.com/api/?name=${name || 'User'}&background=c96442&color=fff&size=128`} alt="Profile" className={styles.avatar} />
        </div>
        <form onSubmit={handleSave} className={styles.form}>
          <div className={styles.inputGroup}>
            <label>Full Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={styles.input} required />
          </div>
          <div className={styles.inputGroup}>
            <label>Email Address</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={styles.input} required />
          </div>
          <button type="submit" className={styles.saveBtn} disabled={isLoading}>
            {isLoading ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  );
}