import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

export default function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setMsg("");

    if (!supabase) {
      setMsg("Authentication service is not configured.");
      return;
    }

    setLoading(true);

    try {
      // 1️⃣ Sign in
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      const userId = data.user.id;

      // 2️⃣ Fetch role from profiles table
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();

      if (profileError || !profile?.role) {
        throw new Error("User role not found. Please contact support.");
      }

      // 3️⃣ Role-based redirect
      if (profile.role === "admin") {
        navigate("/admin", { replace: true });
      } else {
        navigate("/swahiba/cases", { replace: true });
      }
    } catch (err) {
      setMsg(err.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white px-4 py-14 flex items-center justify-center">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 p-8 shadow-sm">
        <h1
          className="text-3xl tracking-tight text-slate-900"
          style={{ fontFamily: "ui-serif, Georgia, Cambria, serif" }}
        >
          Swahiba Login
        </h1>

        <p className="mt-2 text-sm text-slate-600">
          Log in to your dashboard.
        </p>

        {msg && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {msg}
          </div>
        )}

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-700">
              Email address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-amber-400"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700">
              Password
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-amber-400"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-amber-500 px-5 py-3 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
          >
            {loading ? "Logging in…" : "Login"}
          </button>
        </form>

        <div className="mt-5 text-sm text-slate-600 text-center">
          No account yet?{" "}
          <Link
            to="/swahiba/signup"
            className="font-semibold text-amber-600 hover:underline"
          >
            Create one
          </Link>
        </div>
      </div>
    </div>
  );
}