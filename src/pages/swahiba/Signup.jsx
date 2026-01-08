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
        };

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
  const [error, setError] = useState("");

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleExpertise(key) {
    setExpertise((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirm) {
      setError("Passwords do not match");
      return;
    }

    if (!agree) {
      setError("You must agree to the data use policy");
      return;
    }

    setLoading(true);

    try {
      /**
       * 1️⃣ Create Auth User
       * Profiles are auto-created via DB trigger
       */
      const { data, error: signUpError } =
        await supabase.auth.signUp({
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

      /**
       * 2️⃣ Update profile with extra fields
       */
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

      /**
       * 3️⃣ Redirect to login
       */
      navigate("/swahiba/login", { replace: true });
    } catch (err) {
      console.error(err);
      setError(err.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-3xl p-8 border">
        <h1 className="text-3xl font-semibold text-center">
          {t.title}
        </h1>
        <p className="text-sm text-center text-slate-600 mt-2">
          {t.subtitle}
        </p>

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
            onChange={(e) =>
              updateField("full_name", e.target.value)
            }
          />

          <input
            className={inputClass}
            type="email"
            placeholder={t.email}
            value={form.email}
            onChange={(e) =>
              updateField("email", e.target.value)
            }
          />

          <div className="grid grid-cols-2 gap-3">
            <input
              className={inputClass}
              type="password"
              placeholder={t.password}
              value={form.password}
              onChange={(e) =>
                updateField("password", e.target.value)
              }
            />
            <input
              className={inputClass}
              type="password"
              placeholder={t.confirm}
              value={form.confirm}
              onChange={(e) =>
                updateField("confirm", e.target.value)
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <input
              className={inputClass}
              placeholder={t.region}
              value={form.region}
              onChange={(e) =>
                updateField("region", e.target.value)
              }
            />
            <input
              className={inputClass}
              placeholder={t.district}
              value={form.district}
              onChange={(e) =>
                updateField("district", e.target.value)
              }
            />
          </div>

          <textarea
            className={inputClass}
            placeholder={t.bio}
            rows={3}
            value={form.bio}
            onChange={(e) =>
              updateField("bio", e.target.value)
            }
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
                  onChange={() =>
                    toggleExpertise(key)
                  }
                />
                {key
                  .replace("expertise_", "")
                  .replace("_", " ")}
              </label>
            ))}
          </div>

          <label className="flex gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={agree}
              onChange={(e) =>
                setAgree(e.target.checked)
              }
            />
            {t.agree}
          </label>

          <button
            disabled={loading}
            className="w-full bg-amber-500 text-white rounded-2xl py-3 font-semibold"
          >
            {loading ? "…" : t.submit}
          </button>
        </form>

        <p className="text-center text-sm mt-6">
          {t.haveAccount}{" "}
          <Link
            to="/swahiba/login"
            className="text-amber-600 font-semibold"
          >
            {t.login}
          </Link>
        </p>
      </div>
    </div>
  );
}