import React, { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext.jsx";

/** =========================
 *  TRANSLATIONS (FULL)
 *  ========================= */
const i18n = {
  sw: {
    backHome: "← Rudi",
    title: "Sera ya ulinzi",
    intro:
      "Maudhui ya muda (MVP). Badilisha hapa na mwongozo wako wa mwisho wa ulinzi na usalama.",
    confidentialityTitle: "Faragha:",
    confidentialityBody: "Tunahifadhi mazungumzo kwa siri.",
    limitsTitle: "Mipaka:",
    limitsBody:
      "Kama kuna hatari kubwa ya madhara, tunaweza kusaidia rufaa ya haraka ili kukuweka salama.",
    reportTitle: "Jinsi ya kutoa taarifa:",
    reportBody:
      "Ongeza njia yako ya kuripoti na mawasiliano muhimu hapa.",
  },
  en: {
    backHome: "← Back",
    title: "Safeguarding policy",
    intro:
      "MVP placeholder content. Replace with your final safeguarding guidance.",
    confidentialityTitle: "Confidentiality:",
    confidentialityBody: "We keep conversations private.",
    limitsTitle: "Limits:",
    limitsBody:
      "If there’s serious risk of harm, we may support urgent referral to keep you safe.",
    reportTitle: "How to report:",
    reportBody: "Add your reporting pathway and contacts here.",
  },
};

export default function SafeguardingPolicy() {
  const { lang } = useLanguage();
  const t = useMemo(() => (lang === "SW" ? i18n.sw : i18n.en), [lang]);
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-[900px] px-4 py-14">
       
      <button
          onClick={() => navigate(-1)}
          className="text-sm font-semibold text-slate-700 hover:text-slate-900"
        >
          {t.backHome}
        </button>


        <h1
          className="mt-6 text-4xl tracking-tight text-slate-900"
          style={{ fontFamily: "ui-serif, Georgia, Cambria, serif" }}
        >
          {t.title}
        </h1>

        <p className="mt-4 text-slate-600 leading-7">{t.intro}</p>

        <div className="mt-8 space-y-5 text-sm leading-7 text-slate-700">
          <p>
            <b>{t.confidentialityTitle}</b> {t.confidentialityBody}
          </p>
          <p>
            <b>{t.limitsTitle}</b> {t.limitsBody}
          </p>
          <p>
            <b>{t.reportTitle}</b> {t.reportBody}
          </p>
        </div>
      </div>
    </div>
  );
}