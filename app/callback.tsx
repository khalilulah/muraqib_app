import { useEffect, useState } from "react";
import { View, ActivityIndicator, StyleSheet, Text } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuthStore } from "../src/store/auth.store";
import axios from "axios";

export default function CallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { setAuth } = useAuthStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        const res = await axios.get(
          "https://muraqib-server.onrender.com/api/users/me",
          {
            withCredentials: true,
          },
        );
        const user = res.data;
        setAuth(user, "", "");
      } catch (err) {
        console.error("Error fetching user after OAuth:", err);
      } finally {
        setLoading(false);
        router.replace("/"); // go home
      }
    };

    if (params.success === "true") {
      init();
    }
  }, [params]);

  return (
    <View style={styles.container}>
      {loading ? (
        <>
          <ActivityIndicator size="large" color="#1e40af" />
          <Text style={styles.text}>Connecting to Quran Foundation...</Text>
        </>
      ) : (
        <Text style={styles.text}>Redirecting...</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    padding: 20,
  },
  text: { marginTop: 20, fontSize: 16, color: "#1e40af", textAlign: "center" },
});
