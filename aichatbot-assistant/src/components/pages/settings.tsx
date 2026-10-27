import React, { useState, useContext, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { AuthContext } from '../../context/authContext';
import styles from '../pagesmodulecss/settings.module.css';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const SettingsPage: React.FC = () => {
  const { darkMode, toggleDarkMode, logout } = useContext(AuthContext)!;
  
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  
  // Device State
  const [devices, setDevices] = useState<any[]>([]);
  const [newDeviceName, setNewDeviceName] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [bluetoothDevice, setBluetoothDevice] = useState<any>(null);

  // Fetch paired devices on load
  const fetchDevices = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/device/list`, { withCredentials: true });
      setDevices(res.data.devices);
    } catch (err) {
      console.error("Failed to load devices");
    }
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  const handleAddDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeviceName.trim()) return;
    
    setIsGenerating(true);
    try {
      const res = await axios.post(
        `${API_URL}/api/device/generate`, 
        { device_name: newDeviceName }, 
        { withCredentials: true }
      );
      toast.success(`Token generated! Copy it to config.h`);
      setNewDeviceName('');
      fetchDevices();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to generate token");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeleteDevice = async (id: number) => {
    try {
      await axios.delete(`${API_URL}/api/device/${id}`, { withCredentials: true });
      toast.success("Device removed");
      fetchDevices();
    } catch (err) {
      toast.error("Failed to remove device");
    }
  };

  const connectToDevice = async () => {
    try {
      const device = await (navigator as any).bluetooth.requestDevice({
        filters: [{ namePrefix: 'ESP32' }],
        optionalServices: ['battery_service'],
      });
      const server = await device.gatt?.connect();
      setBluetoothDevice(device);
      device.addEventListener('gattserverdisconnected', () => setBluetoothDevice(null));
    } catch (error) {
      console.error('Bluetooth Connection Error:', error);
    }
  };

  return (
    <div className={styles.settingsContainer}>
      <h1 className={styles.heading}>Settings</h1>
      
      <div className={styles.section}>
        <h2 className={styles.subheading}>Preferences</h2>
        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <span className={styles.settingName}>Notifications</span>
            <span className={styles.settingDesc}>Receive alerts for new features.</span>
          </div>
          <label className={styles.switch}>
            <input type="checkbox" checked={notificationsEnabled} onChange={() => setNotificationsEnabled(!notificationsEnabled)} />
            <span className={styles.slider}></span>
          </label>
        </div>
        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <span className={styles.settingName}>Dark Mode</span>
            <span className={styles.settingDesc}>Toggle between light and dark themes.</span>
          </div>
          <button className={`${styles.toggleButton} ${darkMode ? styles.activeToggle : ''}`} onClick={toggleDarkMode}>
            {darkMode ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.subheading}>VoiceAI Robot Devices</h2>
        
        <div className={styles.deviceFormSection}>
          <span className={styles.settingName}>Pair a New ESP32 Device</span>
          <p className={styles.settingDesc} style={{marginBottom: '10px'}}>
            Generate a token below, then paste it into the <code>DEVICE_TOKEN</code> line in your ESP32 <code>config.h</code> file.
          </p>
          <form onSubmit={handleAddDevice} className={styles.deviceForm}>
            <input
              type="text"
              value={newDeviceName}
              onChange={(e) => setNewDeviceName(e.target.value)}
              placeholder="e.g. Living Room Robot"
              className={styles.deviceInput}
            />
            <button type="submit" className={styles.addButton} disabled={isGenerating}>
              {isGenerating ? 'Generating...' : 'Generate Token'}
            </button>
          </form>
          
          {devices.length > 0 && (
            <ul className={styles.deviceList}>
              {devices.map((device) => (
                <li key={device.id} className={styles.deviceItem}>
                  <div>
                    <strong>{device.device_name}</strong>
                    <div style={{fontSize: '0.75rem', color: '#888', marginTop: '4px', wordBreak: 'break-all'}}>
                      Token: <code>{device.device_token}</code>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleDeleteDevice(device.id)}
                    style={{background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 'bold'}}
                  >
                    Revoke
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.subheading}>ESP32 Bluetooth (Direct)</h2>
        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <span className={styles.settingName}>Bluetooth Connection</span>
            <span className={styles.settingDesc}>Connect directly via Web Bluetooth.</span>
          </div>
          <button onClick={connectToDevice} className={`${styles.actionBtn} ${bluetoothDevice ? styles.connectedBtn : ''}`} disabled={bluetoothDevice !== null}>
            {bluetoothDevice ? 'Connected' : 'Connect via BT'}
          </button>
        </div>
      </div>

      <div className={styles.dangerZone}>
        <h2 className={styles.subheading}>Account</h2>
        <button onClick={logout} className={styles.signOutButton}>Sign Out</button>
      </div>
    </div>
  );
};

export default SettingsPage;