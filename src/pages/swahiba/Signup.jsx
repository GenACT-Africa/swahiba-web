import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { useLanguage } from "../../context/LanguageContext";

export default function Signup() {
  const navigate = useNavigate();
  const { lang } = useLanguage();

  const t = useMemo(
    () =>
      lang === "SW"
        ? {
            title: "Jiunge na Swahiba kama Peer",
            subtitle: "Unda wasifu wako wa Swahiba kama Peer.",
            name: "Jina kamili",
            email: "Barua pepe",
            password: "Nenosiri",
            confirm: "Thibitisha nenosiri",
            region: "Mkoa",
            district: "Wilaya",
            bio: "Kuhusu mimi",
            agree: "Nakubali sera ya matumizi ya data na ulinzi",
            submit: "Unda akaunti",
            haveAccount: "Tayari una akaunti?",
            login: "Ingia",
            or: "AU",
            google: "Endelea na Google",
            needAgree: "Lazima ukubali sera ya matumizi ya data na ulinzi",
            passNoMatch: "Nenosiri halilingani",
          }
        : {
            title: "Join Swahiba as a Peer",
            subtitle: "Create your Swahiba peer profile.",
            name: "Full name",
            email: "Email address",
            password: "Password",
            confirm: "Confirm password",
            region: "Region",
            district: "District",
            bio: "About me",
            agree: "I agree to the data use and safeguarding policies",
            submit: "Create account",
            haveAccount: "Already have an account?",
            login: "Login",
            or: "OR",
            google: "Continue with Google",
            needAgree: "You must agree to the data use and safeguarding policies",
            passNoMatch: "Passwords do not match",
          },
    [lang]
  );

  const inputClass =
    "w-full rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm outline-none focus:border-amber-400";

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    confirm: "",
    region: "",
    district: "",
    bio: "",
  });

  const [expertise, setExpertise] = useState({
    expertise_contraceptives: false,
    expertise_hiv_stis: false,
    expertise_gbv: false,
    expertise_mental_health: false,
    expertise_physical_health: false,
    expertise_nutrition: false,
  });

  const [agree, setAgree] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [error, setError] = useState("");

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleExpertise(key) {
    setExpertise((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  // If user comes back from Google OAuth and session exists, route them
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const { data, error: sessErr } = await supabase.auth.getSession();
        if (sessErr) throw sessErr;

        const user = data?.session?.user;
        if (!user) return;

        const updates = {
          full_name: form.full_name || null,
          region: form.region || null,
          district: form.district || null,
          bio: form.bio || null,
          ...expertise,
        };

        const hasAny =
          !!form.full_name ||
          !!form.region ||
          !!form.district ||
          !!form.bio ||
          Object.values(expertise).some(Boolean);

        if (hasAny) {
          await supabase.from("profiles").update(updates).eq("id", user.id);
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("id, role")
          .eq("id", user.id)
          .single();

        if (!alive) return;

        if (profile?.role === "admin") navigate("/admin", { replace: true });
        else navigate("/swahiba/profile", { replace: true });
      } catch (e) {
        console.error(e);
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirm) {
      setError(t.passNoMatch);
      return;
    }

    if (!agree) {
      setError(t.needAgree);
      return;
    }

    setLoading(true);

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            full_name: form.full_name,
            role: "swahiba",
          },
        },
      });

      if (signUpError) throw signUpError;
      if (!data.user) throw new Error("Signup failed");

      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: form.full_name,
          region: form.region,
          district: form.district,
          bio: form.bio,
          ...expertise,
        })
        .eq("id", data.user.id);

      if (profileError) throw profileError;

      navigate("/swahiba/login", { replace: true });
    } catch (err) {
      console.error(err);
      setError(err?.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignup() {
    setError("");

    // keep your rule: must agree before OAuth
    if (!agree) {
      setError(t.needAgree);
      return;
    }

    setOauthLoading(true);

    try {
      const redirectTo = `${window.location.origin}/swahiba/signup`;

      const { error: oauthErr } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });

      if (oauthErr) throw oauthErr;
    } catch (err) {
      console.error(err);
      setError(err?.message || "Google signup failed");
      setOauthLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-3xl p-8 border">
        <h1 className="text-3xl font-semibold text-center">{t.title}</h1>
        <p className="text-sm text-center text-slate-600 mt-2">{t.subtitle}</p>

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-xl">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <input
            className={inputClass}
            placeholder={t.name}
            value={form.full_name}
            onChange={(e) => updateField("full_name", e.target.value)}
            autoComplete="name"
          />

          <input
            className={inputClass}
            type="email"
            placeholder={t.email}
            value={form.email}
            onChange={(e) => updateField("email", e.target.value)}
            autoComplete="email"
          />

          <div className="grid grid-cols-2 gap-3">
            <input
              className={inputClass}
              type="password"
              placeholder={t.password}
              value={form.password}
              onChange={(e) => updateField("password", e.target.value)}
              autoComplete="new-password"
            />
            <input
              className={inputClass}
              type="password"
              placeholder={t.confirm}
              value={form.confirm}
              onChange={(e) => updateField("confirm", e.target.value)}
              autoComplete="new-password"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <input
              className={inputClass}
              placeholder={t.region}
              value={form.region}
              onChange={(e) => updateField("region", e.target.value)}
            />
            <input
              className={inputClass}
              placeholder={t.district}
              value={form.district}
              onChange={(e) => updateField("district", e.target.value)}
            />
          </div>

          <textarea
            className={inputClass}
            placeholder={t.bio}
            rows={3}
            value={form.bio}
            onChange={(e) => updateField("bio", e.target.value)}
          />

          {/* Expertise */}
          <div className="grid grid-cols-2 gap-2">
            {Object.keys(expertise).map((key) => (
              <label
                key={key}
                className={`border rounded-xl px-3 py-2 text-sm text-center cursor-pointer ${
                  expertise[key]
                    ? "bg-amber-50 border-amber-400 text-amber-700"
                    : "border-slate-200"
                }`}
              >
                <input
                  type="checkbox"
                  className="hidden"
                  checked={expertise[key]}
                  onChange={() => toggleExpertise(key)}
                />
                {key.replace("expertise_", "").replace("_", " ")}
              </label>
            ))}
          </div>

          {/* ✅ MOVED: Google signup here (after expertise, before agree) */}
          <div className="pt-2">
            <div className="my-4 flex items-center gap-3">
              <div className="h-px w-full bg-slate-200" />
              <div className="text-xs text-slate-400 font-semibold">{t.or}</div>
              <div className="h-px w-full bg-slate-200" />
            </div>

            <button
              type="button"
              onClick={handleGoogleSignup}
              disabled={oauthLoading || loading}
              className={`w-full inline-flex items-center justify-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                oauthLoading || loading
                  ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                  : "bg-white hover:bg-slate-50 text-slate-900"
              }`}
            >
              <GoogleIcon />
              {oauthLoading ? "…" : t.google}
            </button>
          </div>

          <label className="flex gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={agree}
              onChange={(e) => setAgree(e.target.checked)}
            />
            {t.agree}
          </label>

          <button
            disabled={loading || oauthLoading}
            className={`w-full rounded-2xl py-3 font-semibold text-white ${
              loading || oauthLoading
                ? "bg-amber-300 cursor-not-allowed"
                : "bg-amber-500 hover:bg-amber-600"
            }`}
          >
            {loading ? "…" : t.submit}
          </button>
        </form>

        <p className="text-center text-sm mt-6">
          {t.haveAccount}{" "}
          <Link to="/swahiba/login" className="text-amber-600 font-semibold">
            {t.login}
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