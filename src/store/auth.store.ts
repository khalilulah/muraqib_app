import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface User {
  id: string;
  email: string;
  username: string;
  gender: "male" | "female";
  qfConnected: boolean;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;

  // Actions
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  logout: () => void;
  loadFromStorage: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,

  // Called after login/register — saves to memory and phone storage
  setAuth: async (user, accessToken, refreshToken) => {
    set({ user, accessToken, refreshToken });
    await AsyncStorage.setItem("accessToken", accessToken);
    await AsyncStorage.setItem("refreshToken", refreshToken);
    await AsyncStorage.setItem("user", JSON.stringify(user));
  },

  // Called on app start — loads saved tokens from phone storage
  loadFromStorage: async () => {
    const accessToken = await AsyncStorage.getItem("accessToken");
    const refreshToken = await AsyncStorage.getItem("refreshToken");
    const userStr = await AsyncStorage.getItem("user");
    const user = userStr ? JSON.parse(userStr) : null;

    if (accessToken && user) {
      set({ accessToken, refreshToken, user });
    }
  },

  // Called on logout — clears everything
  logout: async () => {
    set({ user: null, accessToken: null, refreshToken: null });
    await AsyncStorage.multiRemove(["accessToken", "refreshToken", "user"]);
  },
}));
