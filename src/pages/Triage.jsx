import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext.jsx";

const STORAGE_KEY = "swahiba_triage_v1";

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

/** =========================
 *  TRANSLATIONS (FULL)
 *  ========================= */
const i18n = {
  sw: {
    privacyTitle: "Faragha yako",
    privacyBodyA: "Unaweza kutumia jina la utani. Tunauliza maswali yanayotusaidia kukusaidia.",
    privacyBodyB: "Swahiba si huduma ya dharura.",
    privacyBodyC:
      "Kama upo hatarini sasa hivi, tumia huduma za dharura au hotline unayoamini.",
    required: "Lazima",
    optional: "Hiari",
    progressQ: "Swali",
    progressOf: "kati ya",
    tipMulti: "Kidokezo: Chagua yote yanayohusika.",
    currentTriage: "Tathmini ya sasa",
    score: "Alama",
    back: "Rudi nyuma",
    next: "Endelea",
    clear: "Futa",
    seeNext: "Ona hatua inayofuata",
    footerNote:
      "Uchunguzi huu ni wa mwongozo, si utambuzi wa ugonjwa. Kama upo hatarini sasa hivi, tafuta msaada wa dharura.",
    triageLabels: {
      low: "Hatari ndogo",
      medium: "Hatari ya kati",
      high: "Hatari kubwa",
      highEmergency: "Hatari kubwa (Inaelekezwa dharura)",
    },
    triageRecs: {
      emergency: "Uhamisho wa haraka kwa mtoa huduma / namba za dharura",
      low: "Rasilimali za kujisaidia + mazungumzo ya hiari na rika",
      medium: "Msaada wa rika + ufuatiliaji uliopangwa",
      high: "Uhamisho kwa mtoa huduma + rufaa",
    },
    questions: {
      intent: {
        label: "Kipi kinaelezea vizuri unachohitaji leo?",
        options: {
          info: "Nahitaji taarifa",
          help: "Nahitaji msaada",
          referral: "Nahitaji rufaa",
        },
      },
      urgency: {
        label: "Inaonekana ni ya dharura kiasi gani kwa sasa?",
        options: {
          not_urgent: "Si ya dharura (naweza kusoma/kujifunza)",
          soon: "Karibu (nahitaji mwongozo wiki hii)",
          now: "Sasa (nahitaji msaada leo)",
        },
      },
      danger_now: {
        label: "Je, upo kwenye hatari ya haraka au unaumizwa sasa hivi?",
        options: { no: "Hapana", yes: "Ndiyo" },
      },
      self_harm: {
        label: "Je, umewahi kuwa na mawazo ya kujiumiza au kujiua?",
        options: { no: "Hapana", yes: "Ndiyo" },
      },
      severe_symptoms: {
        label:
          "Je, una dalili kali sasa hivi (kutokwa damu nyingi, maumivu makali, kuzimia, homa kali)?",
        options: { no: "Hapana", yes: "Ndiyo" },
      },
      age_band: {
        label: "Una umri gani? (Hiari)",
        options: {
          prefer_not: "Napendelea kutosema",
          under_13: "Chini ya 13",
          "13_15": "13–15",
          "16_19": "16–19",
          "20_24": "20–24",
          "25_plus": "25+",
        },
      },
      topics: {
        label: "Ni mada zipi unazoulizia? (Chagua yote yanayohusika)",
        options: {
          contraception: "Uzazi wa mpango & kupanga familia",
          pregnancy: "Ujauzito / kuchelewa hedhi",
          sti_hiv: "Magonjwa ya zinaa / HIV",
          gbv: "Ukatili / kushurutishwa / hali isiyo salama",
          mental_health: "Afya ya akili / msongo",
          relationships: "Mahusiano & mawasiliano",
          other: "Nyingine",
        },
      },
      nickname: {
        label: "Jina la utani (Hiari)",
        placeholder: "mfano: Amina, KJ, StarGirl",
      },
      area: {
        label: "Eneo/mahali ulipo (Hiari)",
        placeholder: "mfano: Sinza, Mbagala, Arusha",
      },
      contact_pref: {
        label: "Njia unayopendelea kuwasiliana (Hiari)",
        options: {
          whatsapp: "WhatsApp",
          call: "Simu",
          sms: "SMS",
          prefer_not: "Napendelea kutosema",
        },
      },
    },
  },

  en: {
    privacyTitle: "Your privacy",
    privacyBodyA: "You can use a nickname. We only ask questions that help us support you.",
    privacyBodyB: "Swahiba is not an emergency service.",
    privacyBodyC: "If you are in immediate danger, use local emergency services or trusted hotlines.",
    required: "Required",
    optional: "Optional",
    progressQ: "Question",
    progressOf: "of",
    tipMulti: "Tip: Choose everything that applies.",
    currentTriage: "Current triage",
    score: "Score",
    back: "Back",
    next: "Next",
    clear: "Clear",
    seeNext: "See my next step",
    footerNote:
      "This triage is for guidance, not diagnosis. If you are in immediate danger, seek urgent help.",
    triageLabels: {
      low: "Low risk",
      medium: "Medium risk",
      high: "High risk",
      highEmergency: "High risk (Emergency routing)",
    },
    triageRecs: {
      emergency: "Immediate handoff to provider / emergency contacts",
      low: "Self-help resources + optional peer chat",
      medium: "Peer support + scheduled follow-up",
      high: "Provider handoff + referral",
    },
    questions: {
      intent: {
        label: "What best describes what you need today?",
        options: {
          info: "I need info",
          help: "I need help",
          referral: "I want a referral",
        },
      },
      urgency: {
        label: "How urgent does it feel right now?",
        options: {
          not_urgent: "Not urgent (I can read/learn)",
          soon: "Soon (I need guidance this week)",
          now: "Now (I need support today)",
        },
      },
      danger_now: {
        label: "Are you currently in immediate danger or being hurt right now?",
        options: { no: "No", yes: "Yes" },
      },
      self_harm: {
        label: "Have you had thoughts of harming yourself or ending your life?",
        options: { no: "No", yes: "Yes" },
      },
      severe_symptoms: {
        label:
          "Are you experiencing any severe symptoms right now (heavy bleeding, severe pain, fainting, high fever)?",
        options: { no: "No", yes: "Yes" },
      },
      age_band: {
        label: "How old are you? (Optional)",
        options: {
          prefer_not: "Prefer not to say",
          under_13: "Under 13",
          "13_15": "13–15",
          "16_19": "16–19",
          "20_24": "20–24",
          "25_plus": "25+",
        },
      },
      topics: {
        label: "Which topics are you asking about? (Select all that apply)",
        options: {
          contraception: "Contraception & family planning",
          pregnancy: "Pregnancy / missed period",
          sti_hiv: "STIs / HIV",
          gbv: "Violence / coercion / unsafe situation",
          mental_health: "Mental health / stress",
          relationships: "Relationships & communication",
          other: "Other",
        },
      },
      nickname: {
        label: "Nickname (Optional)",
        placeholder: "e.g., Amina, KJ, StarGirl",
      },
      area: {
        label: "Your area/location (Optional)",
        placeholder: "e.g., Sinza, Mbagala, Arusha",
      },
      contact_pref: {
        label: "Preferred contact method (Optional)",
        options: {
          whatsapp: "WhatsApp",
          call: "Phone call",
          sms: "SMS",
          prefer_not: "Prefer not to say",
        },
      },
    },
  },
};

export default function Triage() {
  const navigate = useNavigate();

  // ✅ global language from context: "SW" | "EN"
  const { lang } = useLanguage();
  const t = useMemo(() => (lang === "SW" ? i18n.sw : i18n.en), [lang]);

  // --------------------------
  // 1) Questions (MVP) — localized
  // --------------------------
  const questions = useMemo(() => {
    const q = t.questions;

    return [
      {
        id: "intent",
        label: q.intent.label,
        type: "single",
        required: true,
        options: [
          { value: "info", label: q.intent.options.info, points: 0 },
          { value: "help", label: q.intent.options.help, points: 1 },
          { value: "referral", label: q.intent.options.referral, points: 2 },
        ],
      },
      {
        id: "urgency",
        label: q.urgency.label,
        type: "single",
        required: true,
        options: [
          { value: "not_urgent", label: q.urgency.options.not_urgent, points: 0 },
          { value: "soon", label: q.urgency.options.soon, points: 1 },
          { value: "now", label: q.urgency.options.now, points: 2 },
        ],
      },

      // Emergency routing (must be early)
      {
        id: "danger_now",
        label: q.danger_now.label,
        type: "single",
        required: true,
        options: [
          { value: "no", label: q.danger_now.options.no, points: 0 },
          { value: "yes", label: q.danger_now.options.yes, points: 999, emergency: "DANGER_NOW" },
        ],
      },
      {
        id: "self_harm",
        label: q.self_harm.label,
        type: "single",
        required: true,
        options: [
          { value: "no", label: q.self_harm.options.no, points: 0 },
          { value: "yes", label: q.self_harm.options.yes, points: 999, emergency: "SELF_HARM" },
        ],
      },
      {
        id: "severe_symptoms",
        label: q.severe_symptoms.label,
        type: "single",
        required: true,
        options: [
          { value: "no", label: q.severe_symptoms.options.no, points: 0 },
          { value: "yes", label: q.severe_symptoms.options.yes, points: 999, emergency: "URGENT_MEDICAL" },
        ],
      },

      // Context
      {
        id: "age_band",
        label: q.age_band.label,
        type: "single",
        required: false,
        options: [
          { value: "prefer_not", label: q.age_band.options.prefer_not, points: 0 },
          { value: "under_13", label: q.age_band.options.under_13, points: 2 },
          { value: "13_15", label: q.age_band.options["13_15"], points: 1 },
          { value: "16_19", label: q.age_band.options["16_19"], points: 1 },
          { value: "20_24", label: q.age_band.options["20_24"], points: 0 },
          { value: "25_plus", label: q.age_band.options["25_plus"], points: 0 },
        ],
      },
      {
        id: "topics",
        label: q.topics.label,
        type: "multi",
        required: true,
        options: [
          { value: "contraception", label: q.topics.options.contraception, points: 0 },
          { value: "pregnancy", label: q.topics.options.pregnancy, points: 1 },
          { value: "sti_hiv", label: q.topics.options.sti_hiv, points: 1 },
          { value: "gbv", label: q.topics.options.gbv, points: 2 },
          { value: "mental_health", label: q.topics.options.mental_health, points: 1 },
          { value: "relationships", label: q.topics.options.relationships, points: 0 },
          { value: "other", label: q.topics.options.other, points: 0 },
        ],
      },
      {
        id: "nickname",
        label: q.nickname.label,
        type: "text",
        required: false,
        placeholder: q.nickname.placeholder,
      },
      {
        id: "area",
        label: q.area.label,
        type: "text",
        required: false,
        placeholder: q.area.placeholder,
      },
      {
        id: "contact_pref",
        label: q.contact_pref.label,
        type: "single",
        required: false,
        options: [
          { value: "whatsapp", label: q.contact_pref.options.whatsapp, points: 0 },
          { value: "call", label: q.contact_pref.options.call, points: 0 },
          { value: "sms", label: q.contact_pref.options.sms, points: 0 },
          { value: "prefer_not", label: q.contact_pref.options.prefer_not, points: 0 },
        ],
      },
    ];
  }, [t]);

  // --------------------------
  // 2) State
  // --------------------------
  const [answers, setAnswers] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  const [currentIndex, setCurrentIndex] = useState(0);

  // Persist draft
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(answers));
    } catch {}
  }, [answers]);

  const currentQ = questions[currentIndex];

  // --------------------------
  // 3) Helpers
  // --------------------------
  function setSingle(id, value) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }

  function toggleMulti(id, value) {
    setAnswers((prev) => {
      const existing = Array.isArray(prev[id]) ? prev[id] : [];
      const next = existing.includes(value)
        ? existing.filter((v) => v !== value)
        : [...existing, value];
      return { ...prev, [id]: next };
    });
  }

  function setText(id, value) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }

  function isAnswered(q) {
    const v = answers[q.id];
    if (!q.required) return true;

    if (q.type === "single") return typeof v === "string" && v.length > 0;
    if (q.type === "multi") return Array.isArray(v) && v.length > 0;
    if (q.type === "text") return typeof v === "string" && v.trim().length > 0;
    return false;
  }

  // Compute scoring + emergency
  const triageResult = useMemo(() => {
    let score = 0;
    let emergency = null;

    for (const q of questions) {
      const v = answers[q.id];

      if (q.type === "single") {
        const opt = q.options?.find((o) => o.value === v);
        if (opt) {
          if (opt.emergency) emergency = opt.emergency;
          score += opt.points || 0;
        }
      }

      if (q.type === "multi") {
        const arr = Array.isArray(v) ? v : [];
        for (const item of arr) {
          const opt = q.options?.find((o) => o.value === item);
          if (opt) score += opt.points || 0;
        }
      }
    }

    // Emergency routing overrides everything
    if (emergency) {
      return {
        emergency,
        score,
        risk: "HIGH",
        label: t.triageLabels.highEmergency,
        recommendation: t.triageRecs.emergency,
      };
    }

    // Risk thresholds (tweak anytime)
    const risk = score <= 2 ? "LOW" : score <= 5 ? "MEDIUM" : "HIGH";

    const label =
      risk === "LOW"
        ? t.triageLabels.low
        : risk === "MEDIUM"
        ? t.triageLabels.medium
        : t.triageLabels.high;

    const recommendation =
      risk === "LOW"
        ? t.triageRecs.low
        : risk === "MEDIUM"
        ? t.triageRecs.medium
        : t.triageRecs.high;

    return { emergency: null, score, risk, label, recommendation };
  }, [answers, questions, t]);

  const progress = useMemo(() => {
    const pct = ((currentIndex + 1) / questions.length) * 100;
    return clamp(pct, 0, 100);
  }, [currentIndex, questions.length]);

  // --------------------------
  // 4) Navigation
  // --------------------------
  function next() {
    if (!isAnswered(currentQ)) return;
    setCurrentIndex((i) => Math.min(i + 1, questions.length - 1));
  }

  function back() {
    setCurrentIndex((i) => Math.max(i - 1, 0));
  }

  function submit() {
    const missing = questions.find((q) => !isAnswered(q));
    if (missing) {
      const idx = questions.findIndex((q) => q.id === missing.id);
      setCurrentIndex(idx >= 0 ? idx : 0);
      return;
    }

    navigate("/result", {
      state: {
        triage: triageResult,
        answers,
        submittedAt: new Date().toISOString(),
      },
    });
  }

  // --------------------------
  // 5) UI
  // --------------------------
  return (
    <div className="min-h-screen bg-white">
      <main className="mx-auto max-w-[900px] px-4 py-10">
        {/* Safety note */}
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
          <div className="text-sm font-extrabold text-slate-900">{t.privacyTitle}</div>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {t.privacyBodyA}{" "}
            <span className="font-semibold">{t.privacyBodyB}</span>{" "}
            {t.privacyBodyC}
          </p>
        </div>

        {/* Progress */}
        <div className="mt-8">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>
              {t.progressQ}{" "}
              <span className="font-semibold text-slate-700">{currentIndex + 1}</span>{" "}
              {t.progressOf}{" "}
              <span className="font-semibold text-slate-700">{questions.length}</span>
            </span>
            <span className="font-semibold text-slate-700">{Math.round(progress)}%</span>
          </div>
          <div className="mt-2 h-2 w-full rounded-full bg-slate-100">
            <div
              className="h-2 rounded-full bg-amber-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Question card */}
        <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
            {currentQ.required ? t.required : t.optional}
          </div>

          <h1 className="mt-2 text-xl font-extrabold text-slate-900 sm:text-2xl">
            {currentQ.label}
          </h1>

          {/* Single */}
          {currentQ.type === "single" && (
            <div className="mt-6 grid gap-3">
              {currentQ.options.map((opt) => {
                const active = answers[currentQ.id] === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSingle(currentQ.id, opt.value)}
                    className={[
                      "w-full rounded-2xl border px-4 py-4 text-left text-sm font-semibold transition",
                      active
                        ? "border-amber-300 bg-amber-50 text-slate-900"
                        : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50",
                    ].join(" ")}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Multi */}
          {currentQ.type === "multi" && (
            <div className="mt-6 grid gap-3">
              {currentQ.options.map((opt) => {
                const arr = Array.isArray(answers[currentQ.id]) ? answers[currentQ.id] : [];
                const active = arr.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggleMulti(currentQ.id, opt.value)}
                    className={[
                      "w-full rounded-2xl border px-4 py-4 text-left text-sm font-semibold transition",
                      active
                        ? "border-amber-300 bg-amber-50 text-slate-900"
                        : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50",
                    ].join(" ")}
                  >
                    <span className="mr-2 inline-block">{active ? "✅" : "⬜️"}</span>
                    {opt.label}
                  </button>
                );
              })}

              <div className="text-xs text-slate-500">{t.tipMulti}</div>
            </div>
          )}

          {/* Text */}
          {currentQ.type === "text" && (
            <div className="mt-6">
              <input
                value={answers[currentQ.id] || ""}
                onChange={(e) => setText(currentQ.id, e.target.value)}
                placeholder={currentQ.placeholder || ""}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-amber-300 focus:ring-4 focus:ring-amber-100"
              />
              {!currentQ.required && (
                <div className="mt-2 text-xs text-slate-500">{t.optional}</div>
              )}
            </div>
          )}

          {/* Inline “preview” */}
          <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
              {t.currentTriage}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-900 shadow-sm">
                {triageResult.label}
              </span>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
                {t.score}: {triageResult.score}
              </span>
              <span className="rounded-full bg-white px-3 py-1 text-xs text-slate-600 shadow-sm">
                {triageResult.recommendation}
              </span>
            </div>
          </div>

          {/* Nav buttons */}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={back}
              disabled={currentIndex === 0}
              className={[
                "rounded-2xl border px-4 py-3 text-sm font-semibold",
                currentIndex === 0
                  ? "cursor-not-allowed border-slate-200 text-slate-300"
                  : "border-slate-200 text-slate-800 hover:bg-slate-50",
              ].join(" ")}
            >
              {t.back}
            </button>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={() => {
                  setAnswers({});
                  setCurrentIndex(0);
                  try {
                    localStorage.removeItem(STORAGE_KEY);
                  } catch {}
                }}
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                {t.clear}
              </button>

              {currentIndex < questions.length - 1 ? (
                <button
                  type="button"
                  onClick={next}
                  disabled={!isAnswered(currentQ)}
                  className={[
                    "rounded-2xl px-5 py-3 text-sm font-semibold shadow-sm",
                    isAnswered(currentQ)
                      ? "bg-amber-500 text-white hover:bg-amber-600"
                      : "cursor-not-allowed bg-slate-100 text-slate-400",
                  ].join(" ")}
                >
                  {t.next}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={submit}
                  className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
                >
                  {t.seeNext}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Footer hint */}
        <p className="mt-8 text-center text-xs text-slate-500">{t.footerNote}</p>
      </main>
    </div>
  );
}