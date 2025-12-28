import React, { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext.jsx";

/** =========================
 *  TRANSLATIONS (FULL)
 *  ========================= */
const i18n = {
  sw: {
    backHome: "Rudi",
    title: "Namba za dharura",
    subtitle: "Weka hapa namba sahihi za dharura/hotline za Tanzania kwa MVP yako.",
    cardTitle: "Kama upo hatarini sasa hivi",
    li1: "Piga simu huduma za dharura",
    li2: "Wasiliana na mtu mzima/rafiki unayemuamini aliye karibu",
    li3: "Kama ni salama, nenda kituo cha afya au kituo cha polisi kilicho karibu",
  },
  en: {
    backHome: "Back",
    title: "Emergency contacts",
    subtitle: "Add the correct Tanzania hotlines/contacts here for your MVP.",
    cardTitle: "If you are in immediate danger",
    li1: "Call local emergency services",
    li2: "Contact a trusted adult/friend nearby",
    li3: "If safe, go to the nearest clinic or police station",
  },
};

export default function EmergencyContacts() {
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
          ← {t.backHome}
        </button>

        <h1
          className="mt-6 text-4xl tracking-tight text-slate-900"
          style={{ fontFamily: "ui-serif, Georgia, Cambria, serif" }}
        >
          {t.title}
        </h1>

        <p className="mt-4 text-slate-600 leading-7">{t.subtitle}</p>

        <div className="mt-8 rounded-3xl border border-slate-200 bg-slate-50 p-6">
          <div className="text-sm font-extrabold text-slate-900">{t.cardTitle}</div>
          <ul className="mt-3 list-disc pl-5 text-sm leading-7 text-slate-700">
            <li>{t.li1}</li>
            <li>{t.li2}</li>
            <li>{t.li3}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}