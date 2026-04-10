// src/hooks/useQfRedirect.ts
import { useCallback } from "react";
import axios from "axios";
import { useAuthStore } from "../store/auth.store";

interface QfResponse {
  user: {
    id: string;
    email: string;
    username: string;
    gender: "male" | "female";
    qfConnected: boolean;
  };
  accessToken: string;
  refreshToken: string;
}

/**
 * Returns a function that handles the QF OAuth redirect.
 */
export const useQfRedirect = () => {
  const { setAuth } = useAuthStore();

  const handleQfRedirect = useCallback(
    async (code: string, state: string) => {
      console.log("[useQfRedirect] Sending code to backend:", code, state);

      try {
        const res = await axios.get<QfResponse>(
          `https://muraqib-server.onrender.com/api/auth/qf/callback`,
          {
            params: { code, state },
          },
        );

        const data = res.data;
        console.log("[useQfRedirect] Backend response:", data);

        // update Zustand store
        setAuth(data.user, data.accessToken, data.refreshToken);

        return data;
      } catch (err) {
        console.error("[useQfRedirect] ERROR CAUGHT:", err);
        throw err;
      }
    },
    [setAuth],
  );

  return handleQfRedirect;
};
