import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { useLanguage } from "../../context/LanguageContext";

export default function Signup() {
  const navigate = useNavigate();
  const { lang } = useLanguage();

  const t =
    lang === "SW"
      ? {
          title: "Jiunge na Swahiba kama Peer",
          subtitle: "Unda akaunti yako ya Swahiba kama Peer.",
          name: "Jina kamili",
          email: "Barua pepe",
          password: "Nenosiri",
          confirm: "Thibitisha nenosiri",
          agree: "Nakubali sera ya matumizi ya data na ulinzi",
          submit: "Unda akaunti",
          haveAccount: "Tayari una akaunti?",
          login: "Ingia",
          errorPassword: "Nenosiri hazifanani.",
          errorAgree: "Tafadhali kubali sera ya matumizi ya data.",
          errorGeneric: "Imeshindikana kuunda akaunti. Tafadhali jaribu tena.",
        }
      : {
          title: "Join Swahiba as a Peer",
          subtitle: "Create your Swahiba peer account.",
          name: "Full name",
          email: "Email address",
          password: "Password",
          confirm: "Confirm password",
          agree: "I agree to the data use and safeguarding policies",
          submit: "Create account",
          haveAccount: "Already have an account?",
          login: "Login",
          errorPassword: "Passwords do not match.",
          errorAgree: "Please agree to the data use policy.",
          errorGeneric: "Failed to create account. Please try again.",
        };

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [agree, setAgree] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      setError(t.errorPassword);
      return;
    }

    if (!agree) {
      setError(t.errorAgree);
      return;
    }

    setLoading(true);

    try {
      const { error: authErr } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
            role: "peer",
          },
        },
      });

      if (authErr) throw authErr;

      // Redirect after signup
      navigate("/swahiba/login", { replace: true });
    } catch (err) {
      setError(t.errorGeneric);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 p-8 shadow-sm">
        <h1
          className="text-3xl tracking-tight text-slate-900"
          style={{ fontFamily: "ui-serif, Georgia, Cambria, serif" }}
        >
          {t.title}
        </h1>

        <p className="mt-2 text-sm text-slate-600">{t.subtitle}</p>

        {error && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t.name}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-amber-400"
          />

          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t.email}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-amber-400"
          />

          <input
            required
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t.password}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-amber-400"
          />

          <input
            required
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={t.confirm}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-amber-400"
          />

          <label className="flex items-start gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={agree}
              onChange={(e) => setAgree(e.target.checked)}
              className="mt-1"
            />
            {t.agree}
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-amber-500 px-6 py-3 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
          >
            {loading ? "…" : t.submit}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-600">
          {t.haveAccount}{" "}
          <Link to="/swahiba/login" className="font-semibold text-amber-600">
            {t.login}
          </Link>
        </div>
      </div>
    </div>
  );
}