import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext.jsx";

const WHATSAPP_NUMBER = "+255780327697";

function digitsOnly(v) {
  return String(v || "").replace(/\D/g, "");
}

function waLink(message, overrideNumber) {
  const encoded = encodeURIComponent(message);
  const number = digitsOnly(overrideNumber || WHATSAPP_NUMBER);
  return `https://wa.me/${number}?text=${encoded}`;
}

/** =========================
 *  TRANSLATIONS (HOME ONLY)
 *  ========================= */
const i18n = {
  sw: {
    heroHeadlinePrefix: "Kwa taarifa na mwongozo sahihi wa kujihudumia – ",
    heroHeadlineHighlight: "Afya ya Mwili & Akili",
    heroChips: "Mshirika wako Kwenye Kujitunza",

    whatCanDoTitle: "SWAHIBA Anaweza Kukusaidia Nini",
    cta1Title: "Kukupa taarifa sahihi",
    cta1Desc:
      "Majibu yaliyo wazi na rafiki kwa vijana unayoweza kuyaamini — kuvunja imani potofu, kukupa ukweli, na hatua za kuchukua.",
    cta2Title: "Kukupa msaada",
    cta2Desc:
      "Msaada wa faragha kutoka kwa rika — kuzungumza kwa utulivu kuhusu hali yako na kupanga hatua salama zinazofuata.",
    cta3Title: "Kukuunganisha na huduma",
    cta3Desc:
      "Inapohitajika, tunakuunganisha na watoa huduma waliopimwa na huduma zinazoaminika karibu nawe.",

    navTalk: "Ongea na SWAHIBA",

    howTitle: "Inavyofanya Kazi",
    step1Title: "Ukaguzi wa haraka",
    step1Desc: "Maswali ya dakika 2–5 ili kuelewa unachohitaji.",
    step2Title: "Ongea na SWAHIBA",
    step2Desc: "Zungumza kwa faragha kupitia WhatsApp.",
    step3Title: "Hatua inayofuata",
    step3Desc: "Taarifa, msaada wa ufuatiliaji, au rufaa kwa mtoa huduma.",

    trustTitle: "Usalama wako na faragha yako",
    trustA: "Faragha kwanza",
    trustAB1: "Unaweza kutumia jina la utani.",
    trustAB2: "Hatuombi jina lako kamili.",
    trustAB3: "Tunauliza tu taarifa zinazotusaidia kukusaidia.",
    trustALink: "Soma sera yetu ya matumizi ya data →",

    trustB: "Si huduma ya dharura",
    trustBText:
      "Ikiwa uko hatarini mara moja, piga simu ya dharura au namba ya msaada.",
    trustBBtn: "Mawasiliano ya dharura",

    trustC: "Ulinzi na usiri",
    trustCB1: "Tunahifadhi mazungumzo kwa faragha.",
    trustCB2:
      "Ikiwa kuna hatari kubwa ya madhara, tunaweza kukusaidia kupata msaada wa haraka.",
    trustCLink: "Sera ya ulinzi →",

    stickyTitle: "Unahitaji msaada sasa?",
    stickySub: "Faragha kwanza • WhatsApp",
  },

  en: {
    heroHeadlinePrefix: "For reliable self-care information and guidance on ",
    heroHeadlineHighlight: "Physical & Mental Health",
    heroChips: "Your Selfcare Companion",

    whatCanDoTitle: "What SWAHIBA Can Do For You",
    cta1Title: "Give you reliable information",
    cta1Desc:
      "Clear, youth-friendly answers you can trust — myths, facts, and what to do next.",
    cta2Title: "Offer you help",
    cta2Desc:
      "Private peer support to talk through your situation and plan safe next steps.",
    cta3Title: "Link you to services",
    cta3Desc:
      "When needed, we connect you to trained providers and trusted nearby services.",

    navTalk: "Talk to SWAHIBA",

    howTitle: "How It Works",
    step1Title: "Quick check",
    step1Desc: "2–5 minute questions to understand what you need.",
    step2Title: "Talk to SWAHIBA",
    step2Desc: "Chat privately on WhatsApp.",
    step3Title: "Next step",
    step3Desc: "Info, follow-up support, or provider referral.",

    trustTitle: "Your safety & privacy",
    trustA: "Anonymous-first",
    trustAB1: "You can use a nickname.",
    trustAB2: "We don't ask for your full name.",
    trustAB3: "We only ask what helps us support you.",
    trustALink: "Read our data use policy →",

    trustB: "Not an emergency service",
    trustBText:
      "If you are in immediate danger, call emergency services or a hotline.",
    trustBBtn: "Emergency contacts",

    trustC: "Safeguarding & confidentiality",
    trustCB1: "We keep conversations private.",
    trustCB2:
      "If there is serious risk of harm, we may help you access urgent support.",
    trustCLink: "Safeguarding policy →",

    stickyTitle: "Need help now?",
    stickySub: "Anonymous-first • WhatsApp",
  },
};

// ✅ HERO SLIDES (public folder)
const HERO_SLIDES = [
  "/Talk.png",
  "/Learn.png",
  "/4Him.png",
  "/4Her.png",
  "/4Couple.png",
];

export default function Home() {
  const { lang } = useLanguage();
  const t = useMemo(() => (lang === "SW" ? i18n.sw : i18n.en), [lang]);
  const navigate = useNavigate();

  const talkWhatsApp = () => {
    window.open(waLink(t.navTalk), "_blank", "noopener,noreferrer");
  };

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* HERO (FULL SCREEN) */}
      <section className="relative w-full min-h-screen">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url(/Hero.png)" }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/75 via-slate-950/45 to-slate-950/20" />

        {/* Full-height hero content */}
        <div className="relative mx-auto max-w-[1200px] px-4 sm:px-6 min-h-screen flex items-center">
          {/* ✅ Make columns full height + zero gap so slideshow can fill half */}
          <div className="w-full grid gap-0 lg:grid-cols-2 lg:items-stretch min-h-[70vh]">
            {/* LEFT: LOGO + TITLE */}
            <div className="text-white flex items-center">
              <div className="w-full">
                <img
                  src="/logo_transparent_1.png"
                  alt="Swahiba"
                  className="mb-10 w-[360px] sm:w-[440px] lg:w-[520px] max-w-full h-auto drop-shadow-md"
                />

                <p
                  className="font-serif text-4xl leading-tight tracking-tight sm:text-6xl"
                  style={{ fontFamily: "ui-serif, Georgia, Cambria, serif" }}
                >
                  {t.heroHeadlinePrefix}{" "}
                  <span className="text-amber-300">
                    {t.heroHeadlineHighlight}
                  </span>
                </p>

                <div className="mt-7 flex flex-col items-start gap-3">
                  <button
                    type="button"
                    onClick={() => navigate("/talk")}
                    className="inline-flex items-center justify-center rounded-2xl bg-amber-500 px-8 py-4 text-sm font-semibold text-white shadow-sm hover:bg-amber-600"
                  >
                    {t.navTalk}
                  </button>

                  <div className="text-sm text-white/80">{t.heroChips}</div>
                </div>
              </div>
            </div>

            {/* RIGHT: ✅ Slideshow fills the entire right half */}
            <div className="hidden lg:block relative">
              <HeroSlideshowFill />
            </div>
          </div>
        </div>
      </section>

      {/* MAIN */}
      <main className="mx-auto max-w-[1200px] px-4 sm:px-6">
        {/* What Swahiba can do - WITH BACKGROUND */}
        <section className="relative py-16 sm:py-20 -mx-4 sm:-mx-6 px-4 sm:px-6">
          {/* Background image */}
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: "url(/Hero.png)" }}
          />
          {/* Overlay */}
          <div className="absolute inset-0 bg-white/90" />
          
          {/* Content */}
          <div className="relative">
            <h2
              className="text-center text-3xl tracking-tight sm:text-5xl"
              style={{ fontFamily: "ui-serif, Georgia, Cambria, serif" }}
            >
              {t.whatCanDoTitle}
            </h2>

            <div className="mt-10 grid gap-5 sm:mt-12 md:grid-cols-3">
              <div className="rounded-3xl border border-slate-200 bg-white/90 backdrop-blur-sm p-7 shadow-sm">
                <div className="text-lg font-extrabold text-slate-900">
                  {t.cta1Title}
                </div>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  {t.cta1Desc}
                </p>
              </div>

              <div className="rounded-3xl border border-amber-200 bg-amber-50/90 backdrop-blur-sm p-7 shadow-sm">
                <div className="text-lg font-extrabold text-slate-900">
                  {t.cta2Title}
                </div>
                <p className="mt-3 text-sm leading-7 text-slate-700">
                  {t.cta2Desc}
                </p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white/90 backdrop-blur-sm p-7 shadow-sm">
                <div className="text-lg font-extrabold text-slate-900">
                  {t.cta3Title}
                </div>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  {t.cta3Desc}
                </p>
              </div>
            </div>

            <div className="mt-10 flex justify-center">
              <button
                type="button"
                onClick={() => navigate("/talk")}
                className="inline-flex items-center justify-center rounded-2xl bg-amber-500 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-amber-600"
              >
                {t.navTalk}
              </button>
            </div>
          </div>
        </section>

        {/* How it works - WITH BACKGROUND */}
        <section className="relative py-10 sm:py-24 -mx-4 sm:-mx-6 px-4 sm:px-6">
          {/* Background image */}
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: "url(/Hero.png)" }}
          />
          {/* Overlay */}
          <div className="absolute inset-0 bg-white/90" />
          
          {/* Content */}
          <div className="relative">
            <h2
              className="text-center font-serif text-3xl tracking-tight sm:text-4xl"
              style={{ fontFamily: "ui-serif, Georgia, Cambria, serif" }}
            >
              {t.howTitle}
            </h2>

            <div className="mt-10 rounded-3xl border border-slate-200 bg-white/90 backdrop-blur-sm p-6 shadow-sm sm:p-8">
              <div className="flex flex-col items-stretch gap-6 md:flex-row md:items-center md:justify-between">
                <StepBlock num="1" title={t.step1Title} desc={t.step1Desc} />
                <Arrow />
                <ArrowDown />
                <StepBlock num="2" title={t.step2Title} desc={t.step2Desc} />
                <Arrow />
                <ArrowDown />
                <StepBlock num="3" title={t.step3Title} desc={t.step3Desc} />
              </div>
            </div>
          </div>
        </section>

        {/* Trust - WITH BACKGROUND */}
        <section className="relative py-20 sm:py-24 -mx-4 sm:-mx-6 px-4 sm:px-6">
          {/* Background image */}
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: "url(/Hero.png)" }}
          />
          {/* Overlay */}
          <div className="absolute inset-0 bg-white/90" />
          
          {/* Content */}
          <div className="relative">
            <h2
              className="text-center font-serif text-3xl tracking-tight sm:text-4xl"
              style={{ fontFamily: "ui-serif, Georgia, Cambria, serif" }}
            >
              {t.trustTitle}
            </h2>

            <div className="mt-10 grid gap-5 lg:grid-cols-3">
              <div className="rounded-3xl border border-slate-200 bg-white/90 backdrop-blur-sm p-6 shadow-sm">
                <div className="text-sm font-extrabold">{t.trustA}</div>
                <ul className="mt-3 space-y-2 text-sm text-slate-600">
                  <li>• {t.trustAB1}</li>
                  <li>• {t.trustAB2}</li>
                  <li>• {t.trustAB3}</li>
                </ul>
                <Link
                  to="/data-use"
                  className="mt-6 inline-flex font-bold text-amber-700 hover:text-amber-800"
                >
                  {t.trustALink}
                </Link>
              </div>

              <div className="rounded-3xl border border-amber-200 bg-amber-50/90 backdrop-blur-sm p-6 shadow-sm">
                <div className="text-sm font-extrabold">{t.trustB}</div>
                <p className="mt-3 text-sm leading-6 text-slate-700">
                  {t.trustBText}
                </p>
                <button
                  type="button"
                  onClick={() => navigate("/emergency-contacts")}
                  className="mt-6 rounded-2xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  {t.trustBBtn}
                </button>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white/90 backdrop-blur-sm p-6 shadow-sm">
                <div className="text-sm font-extrabold">{t.trustC}</div>
                <ul className="mt-3 space-y-2 text-sm text-slate-600">
                  <li>• {t.trustCB1}</li>
                  <li>• {t.trustCB2}</li>
                </ul>
                <Link
                  to="/safeguarding"
                  className="mt-6 inline-flex font-bold text-amber-700 hover:text-amber-800"
                >
                  {t.trustCLink}
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Mobile sticky Talk button */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/85 backdrop-blur sm:hidden">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-extrabold">
              {t.stickyTitle}
            </div>
            <div className="truncate text-xs text-slate-600">{t.stickySub}</div>
          </div>
          <button
  type="button"
  onClick={() => navigate("/talk")} 
  className="shrink-0 rounded-2xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-600"
>
  {t.navTalk}
</button>
        </div>
      </div>
    </div>
  );
}

/** ✅ Slideshow that fills the entire right half (big) */
function HeroSlideshowFill() {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => {
      setIdx((i) => (i + 1) % HERO_SLIDES.length);
    }, 3200);
    return () => clearInterval(t);
  }, [paused]);

  const prev = () =>
    setIdx((i) => (i - 1 + HERO_SLIDES.length) % HERO_SLIDES.length);
  const next = () => setIdx((i) => (i + 1) % HERO_SLIDES.length);

  return (
    <div
      className="absolute inset-0 flex items-center justify-end"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* ✅ Take the FULL width/height of the right column */}
      <div className="w-full h-full">
        {/* ✅ Thin border + tiny padding so image is BIG */}
        <div className="relative h-full w-full overflow-hidden rounded-[26px] border border-white/15 bg-white/5 backdrop-blur-[2px] shadow-2xl">
          <div className="relative h-full w-full">
            {HERO_SLIDES.map((src, i) => (
              <img
                key={src}
                src={src}
                alt=""
                className={`absolute inset-0 h-full w-full object-contain p-2 xl:p-3 transition-opacity duration-700 ${
                  i === idx ? "opacity-100" : "opacity-0"
                }`}
                draggable="false"
              />
            ))}

            {/* Arrows */}
            <button
              type="button"
              onClick={prev}
              aria-label="Previous slide"
              className="absolute left-4 top-1/2 -translate-y-1/2 grid h-12 w-12 place-items-center rounded-2xl border border-white/15 bg-black/25 text-white hover:bg-black/35"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Next slide"
              className="absolute right-4 top-1/2 -translate-y-1/2 grid h-12 w-12 place-items-center rounded-2xl border border-white/15 bg-black/25 text-white hover:bg-black/35"
            >
              ›
            </button>

            {/* Dots */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
              {HERO_SLIDES.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Go to slide ${i + 1}`}
                  onClick={() => setIdx(i)}
                  className={`h-2.5 w-2.5 rounded-full transition ${
                    i === idx ? "bg-amber-300" : "bg-white/35 hover:bg-white/55"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** UI COMPONENTS */

function StepBlock({ num, title, desc }) {
  return (
    <div className="w-full rounded-3xl bg-slate-50/95 backdrop-blur-sm p-5 sm:p-6 md:w-[280px]">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-slate-900 text-sm font-extrabold text-white">
          {num}
        </div>
        <div className="text-sm font-extrabold text-slate-900">{title}</div>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-600">{desc}</p>
    </div>
  );
}

function Arrow() {
  return (
    <div className="hidden md:flex w-14 items-center justify-center text-slate-400">
      <span className="text-4xl leading-none">→</span>
    </div>
  );
}

function ArrowDown() {
  return (
    <div className="flex md:hidden w-full items-center justify-center text-slate-400">
      <span className="text-3xl leading-none">↓</span>
    </div>
  );
}