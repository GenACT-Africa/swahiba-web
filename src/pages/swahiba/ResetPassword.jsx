import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

export default function ResetPassword() {
  const navigate = useNavigate();

  const [checking, setChecking] = useState(true);
  const [authedForRecovery, setAuthedForRecovery] = useState(false);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        // If the link is valid, Supabase will create a session from the URL
        const { data } = await supabase.auth.getSession();
        if (!alive) return;

        if (data?.session) {
          setAuthedForRecovery(true);
        } else {
          setAuthedForRecovery(false);
        }
      } finally {
        if (alive) setChecking(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  async function handleUpdatePassword(e) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      setDone(true);

      // Optional: sign out after change, then send to login
      await supabase.auth.signOut();
      navigate("/swahiba/login", { replace: true });
    } catch (err) {
      console.error(err);
      setError(err?.message || "Failed to update password");
    } finally {
      setSaving(false);
    }
  }

  if (checking) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-3xl p-8 border">
        <h1 className="text-2xl font-semibold text-center">Set a new password</h1>
        <p className="text-sm text-center text-slate-600 mt-2">
          Choose a new password to continue.
        </p>

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-xl">
            {error}
          </div>
        )}

        {!authedForRecovery ? (
          <div className="mt-6 rounded-2xl border bg-slate-50 p-4 text-sm text-slate-700">
            This reset link is invalid or expired. Please request a new password reset from the login page.
          </div>
        ) : (
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
              disabled={saving}
              className={`w-full rounded-2xl py-3 font-semibold text-white ${
                saving ? "bg-slate-300 cursor-not-allowed" : "bg-slate-900 hover:bg-slate-800"
              }`}
            >
              {saving ? "…" : "Update password"}
            </button>

            {done && (
              <div className="text-sm text-green-700 bg-green-50 border border-green-200 p-3 rounded-xl">
                Password updated successfully.
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
