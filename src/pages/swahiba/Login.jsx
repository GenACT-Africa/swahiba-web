import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

export default function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);

  // Forgot password
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const [error, setError] = useState("");

  // When Google redirects back, Supabase will auto-detect session in URL.
  // This effect catches that session and routes user based on role.
  useEffect(() => {
    let alive = true;

    async function checkSessionAndRedirect() {
      try {
        const { data, error: sessErr } = await supabase.auth.getSession();
        if (sessErr) throw sessErr;

        const user = data?.session?.user;
        if (!user) return;

        const { data: profile, error: profErr } = await supabase
          .from("profiles")
          .select("id, role")
          .eq("id", user.id)
          .single();

        // If profile missing, default to swahiba route (or handle onboarding)
        if (profErr) {
          if (!alive) return;
          navigate("/swahiba/profile", { replace: true });
          return;
        }

        if (!alive) return;
        if (profile?.role === "admin") navigate("/admin", { replace: true });
        else navigate("/swahiba/profile", { replace: true });
      } catch (e) {
        console.error(e);
      }
    }

    checkSessionAndRedirect();
    return () => {
      alive = false;
    };
  }, [navigate]);

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { data, error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (loginError) throw loginError;
      if (!data?.user) throw new Error("Login failed");

      const userId = data.user.id;

      const { data: profile, error: profErr } = await supabase
        .from("profiles")
        .select("id, role")
        .eq("id", userId)
        .single();

      // If profile missing, default to swahiba route (or handle onboarding)
      if (profErr) {
        navigate("/swahiba/profile", { replace: true });
        return;
      }

      if (profile?.role === "admin") {
        navigate("/admin", { replace: true });
        return;
      }

      navigate("/swahiba/profile", { replace: true });
    } catch (err) {
      console.error(err);
      setError(err?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setError("");
    setOauthLoading(true);

    try {
      // Redirect back to THIS login route after Google auth
      const redirectTo = `${window.location.origin}/swahiba/login`;

      const { error: oauthErr } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });

      if (oauthErr) throw oauthErr;
    } catch (err) {
      console.error(err);
      setError(err?.message || "Google login failed");
      setOauthLoading(false);
    }
  }

  async function handleSendReset(e) {
    e.preventDefault();
    setError("");
    setResetSent(false);

    const targetEmail = (resetEmail || email || "").trim();
    if (!targetEmail) {
      setError("Please enter your email address.");
      return;
    }

    setResetLoading(true);
    try {
      // Must match a route you handle (e.g. /swahiba/reset-password)
      // That route should call supabase.auth.updateUser({ password: "..." })
      const redirectTo = `${window.location.origin}/swahiba/reset-password`;

      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(targetEmail, {
        redirectTo,
      });
      if (resetErr) throw resetErr;

      setResetSent(true);
    } catch (err) {
      console.error(err);
      setError(err?.message || "Failed to send reset email");
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-3xl p-8 border">
        <h1 className="text-3xl font-semibold text-center">Swahiba Login</h1>
        <p className="text-sm text-center text-slate-600 mt-2">.</p>

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-xl">
            {error}
          </div>
        )}

        {resetSent && (
          <div className="mt-4 bg-green-50 border border-green-200 text-green-700 text-sm p-3 rounded-xl">
            Reset link sent. Check your email.
          </div>
        )}

        {/* Email/password login */}
        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="email"
            className="w-full rounded-xl bg-slate-50 border px-4 py-3 text-sm"
            placeholder="Email address"
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
            disabled={loading || oauthLoading || resetLoading}
            className={`w-full rounded-2xl py-3 font-semibold text-white ${
              loading || oauthLoading || resetLoading
                ? "bg-amber-300 cursor-not-allowed"
                : "bg-amber-500 hover:bg-amber-600"
            }`}
          >
            {loading ? "…" : "Login"}
          </button>

{/* Forgot password */}
<div className="pt-1 flex justify-center">
  <button
    type="button"
    onClick={() => {
      setResetOpen((v) => !v);
      setResetEmail(email);
      setResetSent(false);
      setError("");
    }}
    className="text-xs font-semibold text-slate-500 hover:text-slate-800 underline underline-offset-4"
    disabled={loading || oauthLoading}
  >
    Forgot password?
  </button>
</div>

          {resetOpen && (
            <div className="mt-2 rounded-2xl border bg-slate-50 p-4 space-y-3">
              <div className="text-sm font-semibold text-slate-900">Reset your password</div>
              <p className="text-xs text-slate-600">
                Enter your email and we’ll send you a reset link.
              </p>

              <input
                type="email"
                className="w-full rounded-xl bg-white border px-4 py-3 text-sm"
                placeholder="Email address"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                autoComplete="email"
              />

              <button
                type="button"
                onClick={handleSendReset}
                disabled={resetLoading || loading || oauthLoading}
                className={`w-full rounded-2xl py-3 font-semibold text-white ${
                  resetLoading || loading || oauthLoading
                    ? "bg-slate-300 cursor-not-allowed"
                    : "bg-slate-900 hover:bg-slate-800"
                }`}
              >
                {resetLoading ? "…" : "Send reset link"}
              </button>

              <button
                type="button"
                onClick={() => setResetOpen(false)}
                className="w-full text-xs font-semibold text-slate-500 hover:text-slate-800"
              >
                Cancel
              </button>
            </div>
          )}
        </form>

        <p className="text-center text-sm mt-6">
          No account yet?{" "}
          <Link className="text-amber-600 font-semibold">
            Contact Admin
          </Link>
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303C33.732 32.657 29.266 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.651-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 16.108 19.01 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4c-7.682 0-14.354 4.337-17.694 10.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.197l-6.19-5.238C29.18 35.091 26.715 36 24 36c-5.245 0-9.696-3.317-11.276-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303a12.02 12.02 0 0 1-4.084 5.565l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.651-.389-3.917z"
      />
    </svg>
  );
}
