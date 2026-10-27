{/*
// Client-side: src/services/api.ts
import axios from "axios";

// Use environment variable for API base URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token && config.url && !config.url.includes("/room/sensor/report") && !config.url.includes("/room/device/status")) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const register = (data: { name: string; email: string; password: string }) =>
  api.post("/auth/register", data);

export const login = (data: { email: string; password: string }) => api.post("/auth/login", data);

export const logout = () => api.post("/auth/logout");

export const sendResetOtp = (data: { email: string }) => api.post("/auth/send-reset-otp", data);

export const resetPassword = (data: { email: string; otp: string; password: string }) =>
  api.post("/auth/reset-password", data);

//export const getUserData = () => api.get("/user/data");

export const addRoom = (data: { name: string; esp32_ip: string; device_id: string}) =>
  api.post("/room/add", data);

export const getRooms = () => api.get("/room/list");

export const updateRoom = (roomId: string, data: { name: string; device_id: string}) => {
  return api.put(`/room/update/${roomId}`, data);
};
export const deleteRoom = (roomId: string) => api.delete(`/room/delete/${roomId}`);

export const addDevice = (data: {
  room_id: string;
  type: string;
  relay_no: number;
  is_on?: boolean;
}) => api.post("/room/device/add", data);

export const updateDevice = (
  relay_no: string,
  data: { type?: string; image_url?: string; is_on?: boolean }
) => api.put(`/room/device/update/${relay_no}`, data);



export const deleteDevice = (relay_no: string) => api.delete(`/room/device/delete/${relay_no}`);

export const addSchedule = (data: {
  esp32_ip: string;
  relay_no: number;
  on_time: string | null;
  off_time: string | null;
}) => api.post("/room/schedule/add", data);

export const updateSchedule = (
  relay_no: string,
  data: { esp32_ip: string; relay_no: number; on_time: string | null; off_time: string | null }
) => api.put(`/room/schedule/update/${relay_no}`, data);

export const deleteSchedule = (relay_no: string, params: { esp32_ip: string }) =>
  api.delete(`/room/schedule/delete/${relay_no}`, { params });

export const getSchedules = () => api.get("/room/schedule/list");

export const reportSensorData = async (data: { device_id: string; temperature: number; humidity: number }) => {
  try {
    const response = await api.post("/room/sensor/report", data);
    return response;
  } catch (error: any) {
    console.error("Error reporting sensor data:", error.response?.data || error.message);
    throw error;
  }
};

export const reportDeviceStatus = async (data: { esp32_ip: string; relay_no: number; is_on: boolean }) => {
  try {
    const response = await api.post("/room/device/status", data);
    return response;
  } catch (error: any) {
    console.error("Error reporting device status:", error.response?.data || error.message);
    throw error;
  }
};

export const getLatestSensorData = async (device_id: string) => {
  try {
    const response = await api.get(`/sensor/latest?device_id=${device_id}`);
    return response;
  } catch (error: any) {
    console.error(`Error fetching latest sensor data for device_id: ${device_id}:`, error.response?.data || error.message);
    throw error;
  }
};


export const getRoomWithSensorData = async (device_id: string) => {
  return api.get(`/room/list-with-sensor-data?device_id=${device_id}`);
};

//src/services/api.ts/Notification
export const getNotifications = (params: { dashboard?: string; eventType?: string; limit?: number }) =>
  api.get("/notifications", { params });
export const getUserPreferences = () => api.get("/preferences");
export const updateUserPreferences = (disabledEventTypes: string[]) =>
  api.put("/preferences", { disabledEventTypes });
export const getUserSettings = () => api.get("/settings");
export const updateUserSettings = (disabledEventTypes: string[]) =>
  api.put("/settings", { disabledEventTypes });
// src/services/api.ts
export interface UserData {
  [x: string]: any;
  id: string; // Or userId: string, depending on your API
  // Add other fields as needed
}

export const getUserData = (): Promise<{ data: UserData }> => api.get("/user/data");

// Camera-specific API calls
export const getCameras = () => api.get("/camera");

export const addCamera = (data: { name: string; ip: string }) => api.post("/camera", data);

// PowerSupply API calls
export const getPowerEntries = (timeRange: string) => api.get(`/power/entries?timeRange=${timeRange}`);
export const getRoomPowers = () => api.get("/power/room-powers");
export const getDeviceStatuses = () => api.get("/power/device-statuses");


// Same as previous, no new server APIs needed for music since it's direct to Jamendo
export const getLedSettings = async (microcontroller: string) => {
  const response = await axios.get(`${API_BASE_URL}/${microcontroller}`);
  return response.data;
};

export const updateLedSettings = async (microcontroller: string, settings: any) => {
  await axios.post(`${API_BASE_URL}/${microcontroller}`, settings);
};

//profile
export interface UserData {
  id: string;
  name: string;
  email: string;
  profileImage: string;
  phoneNumber: string;
  bio: string;
  address: string;
  websiteLinks: string[];
  isAccountVerified: boolean;
}

// Update getUserData to return the extended UserData
//export const getUserData = (): Promise<{ data: { userData: UserData } }> => api.get("/user/data");

// Add updateProfile
export const updateProfile = (formData: FormData) =>
  api.put("/user/profile", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  
export default api;
*/}


// Chatbot/src/services/api.ts
// Change BASE_URL to your deployed backend URL in production

const API_BASE_URL =
  (typeof import.meta !== "undefined" &&
    (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL) ||
  "http://localhost:8000";

// TYPES

export interface Conversation {
  id: number;
  title: string;
  created_at: string;
}

export interface Message {
  role: "user" | "assistant";
  content: string;
  created_at?: string;
}

export interface ChatResponse {
  reply: string;
  conversation_id: number;
}

// SPEECH TO TEXT

export async function transcribeAudio(blob: Blob): Promise<string> {
  const form = new FormData();
  form.append("audio", blob, "recording.webm");

  const res = await fetch(`${API_BASE_URL}/transcribe`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    throw new Error(`Transcription failed (${res.status})`);
  }

  const data: { text: string } = await res.json();
  return data.text.trim();
}

// CHAT

export async function sendChat(
  message: string,
  conversationId: number | null = null
): Promise<ChatResponse> {
  const res = await fetch(`${API_BASE_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      conversation_id: conversationId,
    }),
  });

  if (!res.ok) {
    throw new Error(`Chat request failed (${res.status})`);
  }

  return res.json() as Promise<ChatResponse>;
}

// TEXT TO SPEECH

export async function textToSpeech(
  text: string,
  lang = "en"
): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/speak`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, lang }),
  });

  if (!res.ok) {
    throw new Error(`TTS failed (${res.status})`);
  }

  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

// CONVERSATIONS

export async function getConversations(): Promise<Conversation[]> {
  const res = await fetch(`${API_BASE_URL}/conversations`);

  if (!res.ok) {
    throw new Error("Failed to load conversations");
  }

  return res.json() as Promise<Conversation[]>;
}

export async function getConversationMessages(
  convId: number
): Promise<Message[]> {
  const res = await fetch(
    `${API_BASE_URL}/conversations/${convId}/messages`
  );

  if (!res.ok) {
    throw new Error("Failed to load messages");
  }

  return res.json() as Promise<Message[]>;
}

export async function deleteConversation(
  convId: number
): Promise<void> {
  const res = await fetch(
    `${API_BASE_URL}/conversations/${convId}`,
    { method: "DELETE" }
  );

  if (!res.ok) {
    throw new Error("Failed to delete conversation");
  }
}

export async function renameConversation(
  convId: number,
  title: string
): Promise<void> {
  const res = await fetch(
    `${API_BASE_URL}/conversations/${convId}/title`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    }
  );

  if (!res.ok) {
    throw new Error("Failed to rename conversation");
  }
}
