import React from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";

export default function AboutUs() {
  const { lang } = useLanguage();
  const t = CONTENT[lang];

  return (
    <div className="bg-white">
      <section className="mx-auto max-w-[1000px] px-4 py-14 sm:py-20">
        {/* Hero */}
        <div className="max-w-3xl">
          <h1
            className="text-4xl tracking-tight sm:text-5xl"
            style={{ fontFamily: "ui-serif, Georgia, Cambria, serif" }}
          >
            {t.title}
          </h1>
          <p className="mt-4 text-lg leading-8 text-slate-600">
            {t.hero}
          </p>
        </div>

        {/* Why */}
        <div className="mt-14 grid gap-10 sm:grid-cols-2">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">
              {t.whyTitle}
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              {t.whyBody}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
            <div className="text-sm font-extrabold text-slate-900">
              {t.differentTitle}
            </div>
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              {t.different.map((item, i) => (
                <li key={i}>• {item}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* What we do / don’t */}
        <div className="mt-16 grid gap-10 sm:grid-cols-2">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              {t.doTitle}
            </h2>
            <ul className="mt-4 space-y-2 text-sm leading-7 text-slate-700">
              {t.do.map((item, i) => (
                <li key={i}>• {item}</li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-bold text-slate-900">
              {t.notTitle}
            </h2>
            <ul className="mt-4 space-y-2 text-sm leading-7 text-slate-700">
              {t.not.map((item, i) => (
                <li key={i}>• {item}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* Who is behind */}
        <div className="mt-16 rounded-3xl border border-slate-200 bg-white p-8">
          <h2 className="text-2xl font-semibold text-slate-900">
            {t.behindTitle}
          </h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            {t.behindBody1}
          </p>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            {t.behindBody2}
          </p>
        </div>

        {/* Safeguarding */}
        <div className="mt-16 rounded-3xl border border-amber-200 bg-amber-50 p-6">
          <div className="text-sm font-extrabold text-amber-900">
            {t.safeTitle}
          </div>
          <p className="mt-2 text-sm leading-7 text-amber-800">
            {t.safeBody}
          </p>
          <Link
            to="/safeguarding"
            className="mt-3 inline-block text-sm font-semibold text-amber-900 underline underline-offset-4"
          >
            {t.safeLink} →
          </Link>
        </div>

        {/* CTA */}
        <div className="mt-20 flex justify-center">
          <Link
            to="/talk"
            className="rounded-2xl bg-amber-500 px-8 py-4 text-sm font-semibold text-white shadow-sm hover:bg-amber-600"
          >
            {t.cta}
          </Link>
        </div>
      </section>
    </div>
  );
}

/* =========================
   Translations
========================= */

const CONTENT = {
  EN: {
    title: "About SWAHIBA",
    hero:
      "SWAHIBA is a human-led self-care companion supporting young people to access trusted Sexual and Reproductive Health (SRHR) information, counseling, and referrals — privately and without judgement.",

    whyTitle: "Why SWAHIBA exists",
    whyBody:
      "Many young people struggle to access accurate SRHR information and safe support due to stigma, fear, cost, or lack of youth-friendly services. SWAHIBA exists to bridge this gap — meeting young people where they are, with care, respect, and confidentiality.",

    differentTitle: "What makes SWAHIBA different",
    different: [
      "Human responses, not AI chatbots",
      "Anonymous-first and youth-friendly",
      "Grounded in local Tanzanian context",
      "Clear safeguarding and referral pathways",
    ],

    doTitle: "What SWAHIBA does",
    do: [
      "Answers SRHR questions with accurate, youth-friendly information",
      "Provides peer-based counseling and emotional support",
      "Helps assess urgency through guided triage",
      "Connects users to verified clinics, hotlines, and services",
    ],

    notTitle: "What SWAHIBA does not do",
    not: [
      "SWAHIBA is not an emergency service",
      "SWAHIBA does not replace medical professionals",
      "SWAHIBA does not judge or report users for seeking help",
    ],

    behindTitle: "Who is behind SWAHIBA",
    behindBody1:
      "SWAHIBA is supported by members of the GenACT Africa Network, a youth-led movement working to empower communities through access to sexual and reproductive health information, services, and advocacy.",
    behindBody2:
      "By engaging with SWAHIBA — whether through conversations or purchasing products — you directly support GenACT Africa’s mission and help keep SWAHIBA accessible to young people who need it most.",

    safeTitle: "Safeguarding & care",
    safeBody:
      "SWAHIBA prioritizes safety, confidentiality, and dignity. If a user is at risk of serious harm, SWAHIBA may support urgent referral to appropriate services in line with safeguarding principles.",
    safeLink: "Read our safeguarding policy",

    cta: "Talk to SWAHIBA",
  },

  SW: {
    title: "Kuhusu SWAHIBA",
    hero:
      "SWAHIBA ni mshirika wa huduma binafsi unaoongozwa na binadamu, unaosaidia vijana kupata taarifa sahihi za Afya ya Uzazi na Ngono (SRHR), ushauri, na rufaa — kwa faragha na bila hukumu.",

    whyTitle: "Kwa nini SWAHIBA ipo",
    whyBody:
      "Vijana wengi hukosa kupata taarifa sahihi na msaada salama wa SRHR kutokana na unyanyapaa, hofu, gharama, au ukosefu wa huduma rafiki kwa vijana. SWAHIBA ipo kuziba pengo hili — kwa kuwafikia vijana walipo kwa heshima, uangalifu, na usiri.",

    differentTitle: "Nini kinaitofautisha SWAHIBA",
    different: [
      "Majibu kutoka kwa binadamu, si roboti",
      "Huduma ya faragha kwanza, rafiki kwa vijana",
      "Inazingatia mazingira ya Tanzania",
      "Ina miongozo wazi ya ulinzi na rufaa",
    ],

    doTitle: "SWAHIBA hufanya nini",
    do: [
      "Hujibu maswali ya SRHR kwa lugha rahisi na sahihi",
      "Hutoa ushauri wa kijamii na msaada wa kihisia",
      "Husaidia kupima haraka hali ya mhitaji",
      "Huwaunganisha vijana na vituo na huduma zilizoidhinishwa",
    ],

    notTitle: "SWAHIBA haifanyi nini",
    not: [
      "SWAHIBA si huduma ya dharura",
      "SWAHIBA haibadilishi wahudumu wa afya",
      "SWAHIBA haihukumu wala kuripoti wanaotafuta msaada",
    ],

    behindTitle: "Nani yuko nyuma ya SWAHIBA",
    behindBody1:
      "SWAHIBA inaungwa mkono na wanachama wa Mtandao wa GenACT Africa, harakati zinazoongozwa na vijana zinazolenga kuwawezesha jamii kupitia taarifa, huduma, na utetezi wa SRHR.",
    behindBody2:
      "Kwa kutumia SWAHIBA — kwa mazungumzo au kununua bidhaa — unachangia moja kwa moja dhamira ya GenACT Africa na kusaidia SWAHIBA kuwafikia vijana wanaohitaji msaada.",

    safeTitle: "Ulinzi na usalama",
    safeBody:
      "SWAHIBA inatanguliza usalama, faragha, na heshima. Endapo kuna hatari kubwa ya madhara, SWAHIBA inaweza kusaidia kuelekeza mhusika kupata msaada wa haraka kwa kufuata kanuni za ulinzi.",
    safeLink: "Soma sera yetu ya ulinzi",

    cta: "Ongea na SWAHIBA",
  },
};