import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

export default function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { data, error: loginError } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (loginError) throw loginError;
      if (!data?.user) throw new Error("Login failed");

      // ✅ USER ID IS HERE
      const userId = data.user.id;

      // OPTIONAL: check profile exists
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, role")
        .eq("id", userId)
        .single();

      // Admin redirect
      if (profile?.role === "admin") {
        navigate("/admin", { replace: true });
        return;
      }

      // Swahiba redirect
      navigate("/swahiba/profile", { replace: true });
    } catch (err) {
      console.error(err);
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-3xl p-8 border">
        <h1 className="text-3xl font-semibold text-center">Swahiba Login</h1>
        <p className="text-sm text-center text-slate-600 mt-2">
          Log in to your profile.
        </p>

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-xl">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="mt-6 space-y-4">
          <input
            type="email"
            className="w-full rounded-xl bg-slate-50 border px-4 py-3 text-sm"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            type="password"
            className="w-full rounded-xl bg-slate-50 border px-4 py-3 text-sm"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button
            disabled={loading}
            className="w-full bg-amber-500 text-white rounded-2xl py-3 font-semibold"
          >
            {loading ? "…" : "Login"}
          </button>
        </form>

        <p className="text-center text-sm mt-6">
          No account yet?{" "}
          <Link to="/swahiba/signup" className="text-amber-600 font-semibold">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}