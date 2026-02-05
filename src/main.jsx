import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.jsx";
import { LanguageProvider } from "./context/LanguageContext.jsx";
import { initPushNotifications } from "./push/initPush.js";
import "./index.css";

const missingEnv =
  !import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!missingEnv) {
  registerSW({ immediate: true });
  initPushNotifications();
}

function MissingEnvScreen() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-lg rounded-3xl border border-amber-200 bg-amber-50 p-6 text-slate-900">
        <div className="text-lg font-extrabold">Environment variables missing</div>
        <p className="mt-2 text-sm text-slate-700">
          Add <span className="font-semibold">VITE_SUPABASE_URL</span> and{" "}
          <span className="font-semibold">VITE_SUPABASE_ANON_KEY</span> to your{" "}
          <span className="font-mono">.env</span> file (local) or Netlify env settings,
          then redeploy.
        </p>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <LanguageProvider>
      {missingEnv ? <MissingEnvScreen /> : <App />}
    </LanguageProvider>
  </StrictMode>
);
