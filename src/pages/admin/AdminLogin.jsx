import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

export default function AdminLogin() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("admin@genactafrica.org");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  // ✅ If Google redirects back with an auth session, verify admin and route
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!alive) return;
        if (!user) return;

        const { data: profile, error: profileErr } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();

        if (profileErr) throw profileErr;

        if (profile?.role !== "admin") {
          await supabase.auth.signOut();
          setError("Access denied. Admins only.");
          return;
        }

        navigate("/admin", { replace: true });
      } catch (e) {
        // swallow; user might not be logged in yet
      }
    })();

    return () => {
      alive = false;
    };
  }, [navigate]);

  async function handleAdminLogin(e) {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);

    try {
      const { data, error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (loginError) throw loginError;
      if (!data?.user) throw new Error("Login failed");

      const userId = data.user.id;

      // Must be admin
      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("id, role")
        .eq("id", userId)
        .single();

      if (profileErr) throw profileErr;

      if (!profile || profile.role !== "admin") {
        await supabase.auth.signOut();
        throw new Error("Access denied. Admins only.");
      }

      navigate("/admin", { replace: true });
    } catch (err) {
      console.error(err);
      setError(err.message || "Admin login failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleAdminLogin() {
    setError("");
    setInfo("");
    setOauthLoading(true);

    try {
      const redirectTo = `${window.location.origin}/admin/login`;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          // optional: will show Google account chooser
          queryParams: { prompt: "select_account" },
        },
      });

      if (error) throw error;
      // Supabase will redirect to Google; no further code runs here.
    } catch (err) {
      console.error(err);
      setError(err.message || "Google login failed");
      setOauthLoading(false);
    }
  }

  async function handleForgotPassword() {
    setError("");
    setInfo("");

    const e = email.trim();
    if (!e) {
      setError("Enter your admin email first.");
      return;
    }

    setResetLoading(true);
    try {
      // You must have a reset page route that calls supabase.auth.updateUser({ password })
      // Example suggested route: /admin/reset-password
      const redirectTo = `${window.location.origin}/admin/reset-password`;

      const { error } = await supabase.auth.resetPasswordForEmail(e, { redirectTo });
      if (error) throw error;

      setInfo("Password reset link sent. Check your email inbox/spam.");
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to send reset link");
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-3xl p-8 border">
        <h1 className="text-3xl font-semibold text-center">Admin Login</h1>
        <p className="text-sm text-center text-slate-600 mt-2">
          Log in to access the Admin Panel.
        </p>

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-xl">
            {error}
          </div>
        )}

        {info && (
          <div className="mt-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm p-3 rounded-xl">
            {info}
          </div>
        )}

        {/* ✅ Google login */}
        <button
          type="button"
          onClick={handleGoogleAdminLogin}
          disabled={oauthLoading}
          className="mt-6 w-full rounded-2xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-60"
        >
          {oauthLoading ? "…" : "Continue with Google"}
        </button>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-200" />
          <div className="text-xs text-slate-500">or</div>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        {/* ✅ Email/password login */}
        <form onSubmit={handleAdminLogin} className="space-y-4">
          <input
            type="email"
            className="w-full rounded-xl bg-slate-50 border px-4 py-3 text-sm"
            placeholder="Admin email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />

          <input
            type="password"
            className="w-full rounded-xl bg-slate-50 border px-4 py-3 text-sm"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />

          <button
            disabled={loading}
            className="w-full bg-slate-900 text-white rounded-2xl py-3 font-semibold hover:bg-slate-800 disabled:opacity-60"
          >
            {loading ? "…" : "Login"}
          </button>

          {/* ✅ Forgot password */}
          <div className="flex items-center justify-center">
            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={resetLoading}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 underline underline-offset-4 disabled:opacity-60"
            >
              {resetLoading ? "…" : "Forgot password?"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}