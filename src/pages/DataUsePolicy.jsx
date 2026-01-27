import React, { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext.jsx";

/** =========================
 *  TRANSLATIONS (FULL)
 *  ========================= */
const i18n = {
  sw: {
    backHome: "← Rudi",
    title: "Sera ya matumizi ya data",
    subtitle: "sera rasmi.",
    aTitle: "Kipaumbele ni kutokujulikana:",
    aBody: "Unaweza kutumia jina la utani. Hatuhitaji jina lako kamili.",
    bTitle: "Tunachokusanya:",
    bBody:
      "Tunakusanya tu taarifa zinazotusaidia kukusaidia (shida yako, njia unayopendelea kuwasiliana, na eneo la jumla).",
    cTitle: "Tunavyotumia:",
    cBody: "Kutoa usaidizi wa rika, triage, rufaa, na ufuatiliaji.",
    dTitle: "Kushirikisha taarifa:",
    dBody:
      "Ni pale tu inapohitajika kwa rufaa/usaidizi na kwa kuzingatia ulinzi wa usalama (safeguarding).",
    eTitle: "Usalama:",
    eBody:
      "Kama kuna hatari kubwa ya madhara, tunaweza kukusaidia kupata msaada wa dharura.",
  },
  en: {
    backHome: "← Back",
    title: "Data use policy",
    subtitle: "Official policy.",
    aTitle: "Anonymous-first:",
    aBody: "You can use a nickname. We don’t require your full name.",
    bTitle: "What we collect:",
    bBody:
      "Only what helps us support you (your concern, preferred contact, general area).",
    cTitle: "How we use it:",
    cBody: "To provide peer support, triage, referral, and follow-up.",
    dTitle: "Sharing:",
    dBody:
      "Only when needed for referral/support and with safeguarding considerations.",
    eTitle: "Safety:",
    eBody:
      "If there is serious risk of harm, we may help you access urgent support.",
  },
};

export default function DataUsePolicy() {
  const { lang } = useLanguage(); // "SW" | "EN"
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

        <p className="mt-4 text-slate-600 leading-7">{t.subtitle}</p>

        <div className="mt-8 space-y-5 text-sm leading-7 text-slate-700">
          <p>
            <b>{t.aTitle}</b> {t.aBody}
          </p>
          <p>
            <b>{t.bTitle}</b> {t.bBody}
          </p>
          <p>
            <b>{t.cTitle}</b> {t.cBody}
          </p>
          <p>
            <b>{t.dTitle}</b> {t.dBody}
          </p>
          <p>
            <b>{t.eTitle}</b> {t.eBody}
          </p>
        </div>
      </div>
    </div>
  );
}