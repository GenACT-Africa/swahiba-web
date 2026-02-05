import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { supabase } from "../lib/supabaseClient";

const TOKEN_STORAGE_KEY = "push_last_token";
const PERMISSION_KEY = "push_permission_requested";

export async function sendTokenToBackend(token, userId) {
  const endpoint = import.meta.env.VITE_PUSH_TOKEN_ENDPOINT;
  if (!endpoint || !token) return;

  try {
    await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, userId: userId || null }),
    });
  } catch (err) {
    console.warn("Push token sync failed", err);
  }
}

export async function initPushNotifications() {
  if (!Capacitor.isNativePlatform()) return null;

  const alreadyRequested = localStorage.getItem(PERMISSION_KEY) === "1";

  try {
    if (!alreadyRequested) {
      const perm = await PushNotifications.requestPermissions();
      localStorage.setItem(PERMISSION_KEY, "1");
      if (perm.receive !== "granted") return null;
    }

    await PushNotifications.register();

    PushNotifications.addListener("registration", async (token) => {
      if (!token?.value) return;
      localStorage.setItem(TOKEN_STORAGE_KEY, token.value);
      const { data } = await supabase.auth.getUser();
      await sendTokenToBackend(token.value, data?.user?.id);
    });

    PushNotifications.addListener("registrationError", (err) => {
      console.warn("Push registration error", err);
    });

    PushNotifications.addListener("pushNotificationReceived", (notification) => {
      console.log("Push received", notification);
    });

    PushNotifications.addListener("pushNotificationActionPerformed", (notification) => {
      console.log("Push action performed", notification);
    });
  } catch (err) {
    console.warn("Push init failed", err);
  }

  return localStorage.getItem(TOKEN_STORAGE_KEY);
}
