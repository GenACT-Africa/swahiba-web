import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext.jsx";


/**
 * TALK TO SWAHIBA — MVP
 * - Nickname optional (anonymous-first)
 * - 3 entry intents: info / help now / referral
 * - Opens WhatsApp with prefilled message
 */

const WA_NUMBER = "+255780327697"; // TODO: replace with real number (no +, no spaces)
const DEFAULT_AREA = "Dar es Salaam"; // optional placeholder

function waLink(message) {
  const text = encodeURIComponent(message);
  return `https://wa.me/${WA_NUMBER}?text=${text}`;
}

/** =========================
 *  TRANSLATIONS (FULL)
 *  ========================= */
const i18n = {
  sw: {
    pageTitle: "Ongea na SWAHIBA",
    subTitle: "Faragha kwanza. Rafiki kwa vijana. Siri.",
    emergencyTitle: "Si huduma ya dharura",
    emergencyBody:
      "Kama upo hatarini sasa hivi au una dalili kali, tafadhali piga simu huduma za dharura au hotline unayoamini.",
    emergencyLink: "Tazama namba za dharura",
    leftTitle: "Unahitaji nini?",
    guidedTitle: "Unataka uchunguzi wa haraka kwanza?",
    guidedBody:
      "Fanya uchunguzi mfupi wa dakika 2–5 ili SWAHIBA aweze kukusaidia vizuri zaidi.",
    guidedCta: "Anza uchunguzi wa haraka",
    rightTitle: "Kabla hatujafungua WhatsApp",
    rightBody:
      "Unaweza kubaki bila kujitambulisha. Ongeza tu taarifa zitakazotusaidia kukusaidia.",
    nickLabel: "Jina la utani (hiari)",
    nickPh: "mfano: Amina / Kijana21",
    areaLabel: "Eneo / Mahali ulipo (hiari)",
    areaPh: "mfano: Sinza / Mbagala / Mwanza",
    previewLabel: "Muonekano wa ujumbe (unaweza kuhariri WhatsApp)",
    continueBtn: "Endelea kwenda WhatsApp",
    consentNote:
      "Kwa kuendelea, unaelewa WhatsApp ndiyo itasimamia utumaji wa ujumbe. Hatukusanyi jina lako kamili isipokuwa ukiamua kulitoa.",
    backHome: "← Rudi Nyumbani",
    intents: {
      info: {
        title: "Nahitaji taarifa",
        desc: "Pata taarifa sahihi za SRHR — faragha, rafiki kwa vijana, bila kuhukumiwa.",
        label: "Nahitaji taarifa",
      },
      help: {
        title: "Nahitaji msaada sasa",
        desc: "Pata msaada kutoka kwa rika aliyehitimu, na hatua za haraka ikiwa itahitajika.",
        label: "Nahitaji msaada sasa",
      },
      referral: {
        title: "Nahitaji rufaa",
        desc: "Tunaweza kukuunganisha na kliniki/mtoa huduma kulingana na mahitaji na eneo lako.",
        label: "Nahitaji rufaa",
      },
    },
    msg: {
      hi: "Habari SWAHIBA,",
      nickProvided: "Jina la utani",
      nickHidden: "Jina la utani: (napendelea kutosema)",
      area: "Eneo",
      areaFallback: `${DEFAULT_AREA} (au sijui)`,
      myMessage: "Ujumbe wangu:",
    },
  },
  en: {
    pageTitle: "Talk to SWAHIBA",
    subTitle: "Anonymous-first. Youth-friendly. Private.",
    emergencyTitle: "Not an emergency service",
    emergencyBody:
      "If you are in immediate danger or have severe symptoms, please call local emergency services or a trusted hotline.",
    emergencyLink: "View emergency contacts",
    leftTitle: "What do you need?",
    guidedTitle: "Want a guided check first?",
    guidedBody:
      "Do a short 2–5 minute triage so SWAHIBA can support you better.",
    guidedCta: "Start quick check",
    rightTitle: "Before we open WhatsApp",
    rightBody:
      "You can stay anonymous. Add only what helps us support you.",
    nickLabel: "Nickname (optional)",
    nickPh: "e.g., Amina / Kijana21",
    areaLabel: "Area / Location (optional)",
    areaPh: "e.g., Sinza / Mbagala / Mwanza",
    previewLabel: "Message preview (you can edit in WhatsApp)",
    continueBtn: "Continue to WhatsApp",
    consentNote:
      "By continuing, you understand WhatsApp will handle the chat message delivery. We do not collect your full name unless you choose to share it.",
    backHome: "← Back to Home",
    intents: {
      info: {
        title: "I need info",
        desc: "Get reliable SRHR information—private, youth-friendly, no judgement.",
        label: "I need information",
      },
      help: {
        title: "I need help now",
        desc: "Get support from a trained peer educator, and fast next steps if needed.",
        label: "I need help now",
      },
      referral: {
        title: "I want a referral",
        desc: "We can help link you to a clinic/provider based on your needs and area.",
        label: "I want a referral",
      },
    },
    msg: {
      hi: "Hi SWAHIBA,",
      nickProvided: "Nickname",
      nickHidden: "Nickname: (prefer not to share)",
      area: "Area",
      areaFallback: `${DEFAULT_AREA} (or not sure)`,
      myMessage: "My message:",
    },
  },
};

export default function Talk() {
  const { lang } = useLanguage();
  const t = useMemo(() => (lang === "SW" ? i18n.sw : i18n.en), [lang]);

  const [nickname, setNickname] = useState("");
  const [location, setLocation] = useState("");
  const [intent, setIntent] = useState("help"); // "info" | "help" | "referral"

  const intents = useMemo(
    () => [
      { key: "info", ...t.intents.info },
      { key: "help", ...t.intents.help },
      { key: "referral", ...t.intents.referral },
    ],
    [t]
  );

  const message = useMemo(() => {
    const nick = nickname.trim();
    const loc = location.trim();

    const namePart = nick
      ? `${t.msg.nickProvided}: ${nick}\n`
      : `${t.msg.nickHidden}\n`;

    const locPart = loc
      ? `${t.msg.area}: ${loc}\n`
      : `${t.msg.area}: ${t.msg.areaFallback}\n`;

    const intentLabel =
      intent === "info"
        ? t.intents.info.label
        : intent === "referral"
        ? t.intents.referral.label
        : t.intents.help.label;

    return `${t.msg.hi}\n\n${intentLabel}.\n\n${namePart}${locPart}\n${t.msg.myMessage}\n`;
  }, [nickname, location, intent, t]);

  return (
    <div className="min-h-screen bg-white">
      <main className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6 sm:py-14">
        {/* Title */}
        <div className="max-w-3xl">
          <h1
            className="text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl"
            style={{ fontFamily: "ui-serif, Georgia, Cambria, serif" }}
          >
            {t.pageTitle}
          </h1>
          <p className="mt-4 text-base leading-7 text-slate-600 sm:text-lg">
            {t.subTitle}
          </p>
        </div>

        {/* Emergency notice */}
        <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <div className="text-sm font-semibold text-slate-900">
            {t.emergencyTitle}
          </div>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            {t.emergencyBody}
          </p>
          <div className="mt-3">
            <Link
              to="/emergency-contacts"
              className="text-sm font-semibold text-slate-900 underline decoration-slate-300 underline-offset-4 hover:decoration-slate-500"
            >
              {t.emergencyLink}
            </Link>
          </div>
        </div>

        {/* Grid */}
        <div className="mt-10 grid gap-8 lg:grid-cols-2">
          {/* Left: intent selection */}
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <h2
              className="text-2xl font-semibold text-slate-900"
              style={{ fontFamily: "ui-serif, Georgia, Cambria, serif" }}
            >
              {t.leftTitle}
            </h2>

            <div className="mt-6 grid gap-3">
              {intents.map((item) => {
                const active = item.key === intent;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setIntent(item.key)}
                    className={[
                      "text-left rounded-2xl border p-4 transition",
                      active
                        ? "border-amber-300 bg-amber-50 shadow-sm"
                        : "border-slate-200 bg-white hover:bg-slate-50",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-extrabold text-slate-900">
                          {item.title}
                        </div>
                        <div className="mt-1 text-sm leading-6 text-slate-600">
                          {item.desc}
                        </div>
                      </div>
                      <div
                        className={[
                          "mt-1 h-5 w-5 rounded-full border",
                          active
                            ? "border-amber-500 bg-amber-500"
                            : "border-slate-300 bg-white",
                        ].join(" ")}
                      />
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Optional shortcut */}
            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-900">
                {t.guidedTitle}
              </div>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                {t.guidedBody}
              </p>
              <Link
                to="/triage"
                className="mt-3 inline-flex rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
              >
                {t.guidedCta}
              </Link>
            </div>
          </section>

          {/* Right: minimal data + WhatsApp preview */}
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <h2
              className="text-2xl font-semibold text-slate-900"
              style={{ fontFamily: "ui-serif, Georgia, Cambria, serif" }}
            >
              {t.rightTitle}
            </h2>

            <p className="mt-3 text-sm leading-6 text-slate-600">{t.rightBody}</p>

            <div className="mt-6 grid gap-4">
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-slate-900">
                  {t.nickLabel}
                </span>
                <input
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder={t.nickPh}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-amber-400"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-semibold text-slate-900">
                  {t.areaLabel}
                </span>
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder={t.areaPh}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-amber-400"
                />
              </label>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold text-slate-700">
                  {t.previewLabel}
                </div>
                <pre className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-700">
                  {message}
                </pre>
              </div>

              <a
                href={waLink(message)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-2xl bg-amber-500 px-6 py-3 text-sm font-extrabold text-slate-900 shadow-sm hover:shadow-md"
              >
                {t.continueBtn}
              </a>

              <div className="text-xs text-slate-500">{t.consentNote}</div>
            </div>
          </section>
        </div>

        {/* Bottom back */}
        <div className="mt-10">
          <Link
            to="/"
            className="text-sm font-semibold text-slate-900 underline decoration-slate-300 underline-offset-4 hover:decoration-slate-500"
          >
            {t.backHome}
          </Link>
        </div>
      </main>
    </div>
  );
}