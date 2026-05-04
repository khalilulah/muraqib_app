import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "../constants";
import { router } from "expo-router";

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
});

let isLoggingOut = false;

async function logout() {
  if (isLoggingOut) return;
  isLoggingOut = true;
  const { useAuthStore } = await import("../store/auth.store");
  await useAuthStore.getState().logout();
  router.replace("/(auth)/login");
  isLoggingOut = false;
}

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem("accessToken");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;
    const originalRequest = error.config;

    if (status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken = await AsyncStorage.getItem("refreshToken");
      if (refreshToken) {
        try {
          // Use plain axios, NOT the api instance — avoids interceptor loop
          const res = await axios.post(`${API_URL}/api/auth/refresh`, {
            refreshToken,
          });
          const { accessToken } = res.data.data; // just the access token

          await AsyncStorage.setItem("accessToken", accessToken);

          const { useAuthStore } = await import("../store/auth.store");
          useAuthStore.setState({ accessToken });

          // Retry original request with new token
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        } catch {
          await logout();
          return Promise.reject(error);
        }
      }

      await logout();
    }

    return Promise.reject(error);
  },
);

export default api;
