import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

export default function AdminResetPassword() {
  const navigate = useNavigate();

  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        // Supabase v2: after clicking recovery link, session should exist here
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (!alive) return;
        setHasSession(!!data?.session);
      } catch (e) {
        if (!alive) return;
        setHasSession(false);
      } finally {
        if (!alive) return;
        setChecking(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  async function handleUpdatePassword(e) {
    e.preventDefault();
    setError("");
    setInfo("");

    if (!password || password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      setInfo("Password updated successfully. Redirecting to login…");

      // Optional: sign out so they re-login cleanly
      await supabase.auth.signOut();

      setTimeout(() => {
        navigate("/admin/login", { replace: true });
      }, 1200);
    } catch (e) {
      console.error(e);
      setError(e.message || "Failed to update password.");
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-white rounded-3xl p-8 border text-center text-sm text-slate-600">
          Checking reset session…
        </div>
      </div>
    );
  }

  if (!hasSession) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-white rounded-3xl p-8 border">
          <h1 className="text-2xl font-semibold text-center">Reset link expired</h1>
          <p className="text-sm text-center text-slate-600 mt-2">
            Please request a new password reset link.
          </p>

          <button
            type="button"
            onClick={() => navigate("/admin/login", { replace: true })}
            className="mt-6 w-full bg-slate-900 text-white rounded-2xl py-3 font-semibold hover:bg-slate-800"
          >
            Back to Admin Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-3xl p-8 border">
        <h1 className="text-3xl font-semibold text-center">Set new password</h1>
        <p className="text-sm text-center text-slate-600 mt-2">
          Create a new password for your admin account.
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

        <form onSubmit={handleUpdatePassword} className="mt-6 space-y-4">
          <input
            type="password"
            className="w-full rounded-xl bg-slate-50 border px-4 py-3 text-sm"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />

          <input
            type="password"
            className="w-full rounded-xl bg-slate-50 border px-4 py-3 text-sm"
            placeholder="Confirm new password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
          />

          <button
            disabled={loading}
            className="w-full bg-slate-900 text-white rounded-2xl py-3 font-semibold hover:bg-slate-800 disabled:opacity-60"
          >
            {loading ? "…" : "Update password"}
          </button>
        </form>
      </div>
    </div>
  );
}