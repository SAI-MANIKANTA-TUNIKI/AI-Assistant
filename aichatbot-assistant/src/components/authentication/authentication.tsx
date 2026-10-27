import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaHome,
  FaRegLightbulb,
  FaLock,
  FaWifi,
  FaThermometerHalf,
} from "react-icons/fa";
import "react-toastify/dist/ReactToastify.css";
import styles from "../pagesmodulecss/authentication.module.css";

// Use the same API base URL as the rest of the app
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const API_BASE_URL = `${API_URL}/api/auth`;

type AuthMode = "login" | "register" | "forgot" | "reset";

interface AuthProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
  handleLogin: () => void;
}

const Authentication: React.FC<AuthProps> = ({ darkMode, onToggleDarkMode, handleLogin }) => {
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");

    try {
      if (authMode === "register") {
        if (!name.trim()) return setError("Name is required");
        if (password !== confirmPassword) return setError("Passwords do not match");

        const res = await axios.post(`${API_BASE_URL}/register`, { name, email, password }, { withCredentials: true });
        setMessage(res.data.message);
        toast.success(res.data.message);
        setAuthMode("login");

      } else if (authMode === "login") {
        const res = await axios.post(`${API_BASE_URL}/login`, { email, password }, { withCredentials: true });
        setMessage(res.data.message);
        toast.success(res.data.message);
        handleLogin();
        navigate("/chat"); // FIXED: Changed from /home to /chat

      } else if (authMode === "forgot") {
        // Note: You'll need to implement these endpoints in main.py if you want them to work
        const res = await axios.post(`${API_BASE_URL}/send-reset-otp`, { email }, { withCredentials: true });
        setMessage(res.data.message);
        toast.success(res.data.message);
        setAuthMode("reset");

      } else if (authMode === "reset") {
        const res = await axios.post(`${API_BASE_URL}/reset-password`, { email, password, otp }, { withCredentials: true });
        setMessage(res.data.message);
        toast.success(res.data.message);
        setAuthMode("login");
      }
    } catch (err: any) {
      // FIXED: FastAPI uses "detail" for errors, not "message"
      const errorMsg = 
        err.response?.data?.detail || 
        err.response?.data?.message || 
        "Something went wrong. Please check your connection.";
        
      setError(errorMsg);
      toast.error(errorMsg);
    }
  };

  const switchMode = (mode: AuthMode) => {
    setAuthMode(mode);
    setName("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setOtp("");
    setError("");
    setMessage("");
  };

  return (
    <div className={`${styles.container} ${darkMode ? styles.dark : ""}`}>
      {/* Animated IoT Background */}
      <div className={styles.bgEffects}>
        <motion.div className={styles.grid} animate={{ backgroundPosition: ["0% 0%", "100% 100%"] }} transition={{ duration: 10, repeat: Infinity, ease: "linear" }} />
        <motion.div className={styles.iotIcon} animate={{ y: [0, -20, 0] }} transition={{ duration: 6, repeat: Infinity }}>
          <FaLock />
        </motion.div>
        <motion.div className={styles.iotIcon} animate={{ y: [0, 15, 0] }} transition={{ duration: 8, repeat: Infinity }}>
          <FaWifi />
        </motion.div>
        <motion.div className={styles.iotIcon} animate={{ y: [0, -12, 0] }} transition={{ duration: 7, repeat: Infinity }}>
          <FaThermometerHalf />
        </motion.div>
        <motion.div className={styles.iotIcon} animate={{ y: [0, 18, 0] }} transition={{ duration: 5, repeat: Infinity }}>
          <FaRegLightbulb />
        </motion.div>
      </div>

      {/* Futuristic Header */}
      <motion.div
        className={styles.header}
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <FaHome className={styles.logo} />
        <h1 className={styles.appTitle}>Smart Home Assistant</h1>
      </motion.div>

      {/* Animated Auth Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={authMode}
          className={styles.card}
          initial={{ scale: 0.9, opacity: 0, y: 30 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.85, opacity: 0, y: -20 }}
          transition={{ duration: 0.6, type: "spring" }}
        >
          <h2 className={styles.title}>
            {authMode === "login"
              ? "Welcome Back"
              : authMode === "register"
              ? "Create Your Account"
              : authMode === "forgot"
              ? "Forgot Password?"
              : "Reset Password"}
          </h2>

          <form onSubmit={handleSubmit} className={styles.form}>
            {authMode === "register" && (
              <motion.input
                type="text"
                placeholder="Full Name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={styles.input}
                initial={{ x: -30, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
              />
            )}

            <motion.input
              type="email"
              placeholder="Email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={styles.input}
              initial={{ x: -30, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
            />

            {(authMode === "login" || authMode === "register" || authMode === "reset") && (
              <motion.input
                type="password"
                placeholder={authMode === "reset" ? "New Password" : "Password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={styles.input}
                initial={{ x: -30, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
              />
            )}

            {authMode === "register" && (
              <motion.input
                type="password"
                placeholder="Confirm Password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={styles.input}
                initial={{ x: -30, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
              />
            )}

            {authMode === "reset" && (
              <motion.input
                type="text"
                placeholder="Enter OTP"
                required
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className={styles.input}
                initial={{ x: -30, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
              />
            )}

            {error && <div className={styles.error}>{error}</div>}
            {message && <div className={styles.success}>{message}</div>}

            <motion.button
              type="submit"
              className={styles.button}
              whileHover={{ scale: 1.05, boxShadow: "0px 0px 15px #22c55e" }}
              whileTap={{ scale: 0.95 }}
            >
              {authMode === "login"
                ? "Login"
                : authMode === "register"
                ? "Register"
                : authMode === "forgot"
                ? "Send OTP"
                : "Reset Password"}
            </motion.button>
          </form>

          <div className={styles.switch}>
            {authMode !== "login" && (
              <button onClick={() => switchMode("login")}>Back to Login</button>
            )}
            {authMode === "login" && (
              <>
                <button onClick={() => switchMode("register")}>Create Account</button>
                <button onClick={() => switchMode("forgot")}>Forgot Password?</button>
              </>
            )}
            <button onClick={onToggleDarkMode}>
              <FaRegLightbulb /> Toggle {darkMode ? "Light" : "Dark"} Mode
            </button>
          </div>
        </motion.div>
      </AnimatePresence>

      <ToastContainer position="top-right" autoClose={3000} hideProgressBar theme={darkMode ? "dark" : "light"} />
    </div>
  );
};

export default Authentication;