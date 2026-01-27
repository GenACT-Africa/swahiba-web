import React, { useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext.jsx";

/** =========================
 *  TRANSLATIONS (FULL)
 *  ========================= */
const i18n = {
  sw: {
    // Risk badges
    badgeHighEmergency: "Hatari kubwa • Routu ya dharura",
    badgeLow: "Hatari ndogo",
    badgeMedium: "Hatari ya kati",
    badgeHigh: "Hatari kubwa",

    // No triage fallback
    noResultTitle: "Hakuna matokeo ya uchunguzi yaliyopatikana",
    noResultBody:
      "Inaonekana umefungua ukurasa huu moja kwa moja. Tafadhali kamilisha uchunguzi ili tuweze kupendekeza hatua inayofuata.",
    goTriage: "Nenda kwenye Uchunguzi",
    talkToSwahiba: "Ongea na SWAHIBA",

    // Result page
    submitted: "Umetuma",
    nextTitle: "Hizi ndizo hatua za kufanya sasa",
    guidanceNote:
      "Huu ni mwongozo — si utambuzi wa ugonjwa. Swahiba ipo kukusaidia kwa faragha na kukusaidia kupata hatua salama zaidi inayofuata.",

    // CTA
    viewResources: "Tazama rasilimali za haraka",

    // Safeguarding
    safeguardingTitle: "Ulinzi",
    safeguardingBody:
      "Tunatunza mazungumzo kwa faragha. Kama kuna hatari kubwa ya madhara, Swahiba inaweza kukusaidia kupata msaada wa haraka.",

    // Summary chips labels
    chipScore: "Alama",
    chipIntent: "Nia",
    chipUrgency: "Uharaka",
    chipTopics: "Mada",
    chipArea: "Eneo",

    // WhatsApp message templates
    waIntro:
      "Habari Swahiba, nimekamilisha uchunguzi. Matokeo yangu ni:",
    waAsk: "Tafadhali nisaidie hatua inayofuata.",
  },
  en: {
    // Risk badges
    badgeHighEmergency: "High risk • Emergency routing",
    badgeLow: "Low risk",
    badgeMedium: "Medium risk",
    badgeHigh: "High risk",

    // No triage fallback
    noResultTitle: "No triage result found",
    noResultBody:
      "It looks like you opened this page directly. Please complete the triage so we can recommend the next step.",
    goTriage: "Go to Triage",
    talkToSwahiba: "Talk to SWAHIBA",

    // Result page
    submitted: "Submitted",
    nextTitle: "Here’s what to do next",
    guidanceNote:
      "This is guidance — not a diagnosis. Swahiba is here to support you privately and help you find the safest next step.",

    // CTA
    viewResources: "View quick resources",

    // Safeguarding
    safeguardingTitle: "Safeguarding",
    safeguardingBody:
      "We keep conversations private. If there is serious risk of harm, Swahiba may help you access urgent support.",

    // Summary chips labels
    chipScore: "Score",
    chipIntent: "Intent",
    chipUrgency: "Urgency",
    chipTopics: "Topics",
    chipArea: "Area",

    // WhatsApp message templates
    waIntro: "Hi Swahiba, I just completed the triage. My result is:",
    waAsk: "Please help me with the next step.",
  },
};

function Pill({ children, tone = "slate" }) {
  const tones = {
    slate: "bg-white text-slate-700 border-slate-200",
    amber: "bg-amber-50 text-amber-900 border-amber-200",
    red: "bg-red-50 text-red-900 border-red-200",
    green: "bg-green-50 text-green-900 border-green-200",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function RiskBadge({ risk, emergency, t }) {
  if (emergency) return <Pill tone="red">{t.badgeHighEmergency}</Pill>;
  if (risk === "LOW") return <Pill tone="green">{t.badgeLow}</Pill>;
  if (risk === "MEDIUM") return <Pill tone="amber">{t.badgeMedium}</Pill>;
  return <Pill tone="red">{t.badgeHigh}</Pill>;
}

const WHATSAPP_NUMBER = "+255780327697"; // ✅ no +, no spaces
const waLink = (text) => `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;

export default function Result() {
  const location = useLocation();
  const navigate = useNavigate();

  // ✅ global language from context: "SW" | "EN"
  const { lang } = useLanguage();
  const t = useMemo(() => (lang === "SW" ? i18n.sw : i18n.en), [lang]);

  // triage data expected from navigate("/result", { state: { triage, answers, submittedAt } })
  const state = location.state || null;

  const triage = state?.triage || null;
  const answers = state?.answers || null;
  const submittedAt = state?.submittedAt || null;

  const formattedTime = useMemo(() => {
    if (!submittedAt) return null;
    try {
      return new Date(submittedAt).toLocaleString();
    } catch {
      return submittedAt;
    }
  }, [submittedAt]);

  // If user opened /result directly, no state -> show fallback
  if (!triage) {
    return (
      <div className="min-h-screen bg-white">
        <main className="mx-auto max-w-[900px] px-4 py-14">
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <h1 className="text-2xl font-extrabold text-slate-900">{t.noResultTitle}</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">{t.noResultBody}</p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={() => navigate("/triage")}
                className="rounded-2xl bg-amber-500 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-amber-600"
              >
                {t.goTriage}
              </button>
              <button
                onClick={() => navigate("/talk")}
                className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                {t.talkToSwahiba}
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Next-step blocks based on risk/emergency (translated titles + bodies)
  const nextSteps = (() => {
    if (triage.emergency) {
      return lang === "SW"
        ? [
            {
              title: "Usalama kwanza, sasa hivi",
              body:
                "Kama upo hatarini sasa hivi au hujisikii salama, tafuta msaada wa haraka kutoka kwa watu unaowaamini karibu nawe au huduma za dharura.",
            },
            {
              title: "Pata msaada wa kitabibu sasa",
              body:
                "Majibu yako yanaonyesha hili linahitaji uangalizi wa haraka. Hatua ya haraka zaidi ni kuzungumza na mtoa huduma aliyehitimu kupitia Swahiba.",
            },
            {
              title: "Hauko peke yako",
              body:
                "Swahiba itashughulikia taarifa zako kwa faragha na kukusaidia kuamua hatua salama zaidi ya kuchukua.",
            },
          ]
        : [
            {
              title: "Immediate safety first",
              body:
                "If you are in immediate danger or feel unsafe, seek urgent help from trusted people nearby or local emergency services.",
            },
            {
              title: "Get clinical support now",
              body:
                "Your answers suggest this needs urgent attention. The fastest next step is to speak with a trained provider through Swahiba.",
            },
            {
              title: "You are not alone",
              body:
                "Swahiba will treat your case privately and help you decide the safest next action.",
            },
          ];
    }

    if (triage.risk === "HIGH") {
      return lang === "SW"
        ? [
            {
              title: "Rufaa kwa mtoa huduma inapendekezwa",
              body:
                "Hali yako inaweza kuhitaji ushauri wa kitabibu. Swahiba itakuunganisha na mtoa huduma aliyehitimu na kukuunga mkono kwenye hatua zinazofuata.",
            },
            {
              title: "Weka faragha",
              body:
                "Unaweza kutumia jina la utani. Shiriki tu unachojisikia kushiriki.",
            },
            {
              title: "Ufuatiliaji ni muhimu",
              body:
                "Kama umekuwa na hili kwa muda, ufuatiliaji wa mara kwa mara unaweza kuleta tofauti kubwa.",
            },
          ]
        : [
            {
              title: "Provider referral recommended",
              body:
                "Your situation may require clinical guidance. Swahiba will connect you to a trained provider and support you through the next steps.",
            },
            {
              title: "Keep it private",
              body:
                "You can use a nickname. Share only what you are comfortable sharing.",
            },
            {
              title: "Follow-up matters",
              body:
                "If you’ve been dealing with this for a while, consistent follow-up can make a big difference.",
            },
          ];
    }

    if (triage.risk === "MEDIUM") {
      return lang === "SW"
        ? [
            {
              title: "Msaada wa rika + ufuatiliaji",
              body:
                "Swahiba inaweza kuongea na wewe, kukusaidia kupanga hatua salama zinazofuata, na kukufuatilia tena baada ya siku chache.",
            },
            {
              title: "Rufaa kwa mtoa huduma (hiari)",
              body:
                "Kama hali itakuwa ya dharura zaidi au unahitaji ushauri wa kitabibu, Swahiba inaweza kukuunganisha na mtoa huduma.",
            },
            {
              title: "Rasilimali za vitendo",
              body:
                "Unaweza pia kufaidika na rasilimali fupi za SRHR wakati unasubiri ufuatiliaji.",
            },
          ]
        : [
            {
              title: "Peer support + follow-up",
              body:
                "Swahiba can talk with you, help you plan safe next steps, and check in again after a few days.",
            },
            {
              title: "Optional provider referral",
              body:
                "If your situation becomes more urgent or you want clinical advice, Swahiba can link you to a provider.",
            },
            {
              title: "Practical resources",
              body:
                "You may also benefit from quick SRHR resources while you wait for follow-up.",
            },
          ];
    }

    // LOW
    return lang === "SW"
      ? [
          {
            title: "Anza na taarifa sahihi",
            body:
              "Majibu yako yanaonyesha unaweza kuanza na taarifa za kuaminika za SRHR na mwongozo wa kujisaidia.",
          },
          {
            title: "Kama kitu kitabadilika",
            body:
              "Kama hujisikii salama, dalili zinaongezeka, au unahitaji msaada wa kuamua cha kufanya, unaweza kuongea na Swahiba muda wowote.",
          },
          {
            title: "Wewe ndiye unaamua unachoshiriki",
            body:
              "Tumia jina la utani na iwe rahisi — tunauliza tu kile kinachotusaidia kukusaidia.",
          },
        ]
      : [
          {
            title: "Reliable information first",
            body:
              "Your answers suggest you may be able to start with trusted SRHR information and self-help guidance.",
          },
          {
            title: "If anything changes",
            body:
              "If you feel unsafe, symptoms worsen, or you want help deciding what to do, you can talk to Swahiba anytime.",
          },
          {
            title: "You control what you share",
            body:
              "Use a nickname and keep it low-friction — we only ask what helps us support you.",
          },
        ];
  })();

  // Helpful “summary” (optional)
  const summaryChips = useMemo(() => {
    const chips = [];
    if (triage?.score !== undefined) chips.push({ label: `${t.chipScore}: ${triage.score}` });
    if (answers?.intent) chips.push({ label: `${t.chipIntent}: ${answers.intent}` });
    if (answers?.urgency) chips.push({ label: `${t.chipUrgency}: ${answers.urgency}` });
    if (Array.isArray(answers?.topics) && answers.topics.length)
      chips.push({ label: `${t.chipTopics}: ${answers.topics.join(", ")}` });
    if (answers?.area) chips.push({ label: `${t.chipArea}: ${answers.area}` });
    return chips.slice(0, 4);
  }, [triage, answers, t]);

  const waMessage = `${t.waIntro} ${triage.recommendation}. ${t.waAsk}`;

  return (
    <div className="min-h-screen bg-white">
      <main className="mx-auto max-w-[900px] px-4 py-12">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <RiskBadge risk={triage.risk} emergency={triage.emergency} t={t} />
            <Pill tone="slate">{triage.recommendation}</Pill>
            {formattedTime ? <Pill tone="slate">{t.submitted}: {formattedTime}</Pill> : null}
          </div>

          <h1 className="mt-4 text-2xl font-extrabold text-slate-900 sm:text-3xl">
            {t.nextTitle}
          </h1>

          <p className="mt-3 text-sm leading-7 text-slate-600">
            {t.guidanceNote}
          </p>

          {summaryChips.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {summaryChips.map((c, idx) => (
                <span
                  key={idx}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700"
                >
                  {c.label}
                </span>
              ))}
            </div>
          )}

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {nextSteps.map((s) => (
              <div
                key={s.title}
                className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="text-sm font-extrabold text-slate-900">{s.title}</div>
                <p className="mt-2 text-sm leading-7 text-slate-600">{s.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
  onClick={handleTalkToSwahiba}
  className="inline-flex items-center justify-center rounded-2xl bg-amber-500 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-amber-600"
>
  {t.talkToSwahiba}
</button>

            <Link
              to="/resources"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              {t.viewResources}
            </Link>
          </div>

          <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
              {t.safeguardingTitle}
            </div>
            <p className="mt-2 text-sm leading-7 text-slate-600">{t.safeguardingBody}</p>
          </div>
        </div>
      </main>
    </div>
  );

  async function handleTalkToSwahiba() {
    try {
      const intentMap = {
        info: "info",
        help: "service",
        referral: "product",
      };

      const summary =
        lang === "SW"
          ? [
              "Muhtasari wa uchunguzi:",
              triage?.recommendation ? `Mapendekezo: ${triage.recommendation}` : null,
              triage?.risk ? `Hatari: ${triage.risk}` : null,
              answers?.urgency ? `Uharaka: ${answers.urgency}` : null,
              Array.isArray(answers?.topics) && answers.topics.length
                ? `Mada: ${answers.topics.join(", ")}`
                : null,
              answers?.area ? `Eneo: ${answers.area}` : null,
            ]
          : [
              "Assessment summary:",
              triage?.recommendation ? `Recommendation: ${triage.recommendation}` : null,
              triage?.risk ? `Risk: ${triage.risk}` : null,
              answers?.urgency ? `Urgency: ${answers.urgency}` : null,
              Array.isArray(answers?.topics) && answers.topics.length
                ? `Topics: ${answers.topics.join(", ")}`
                : null,
              answers?.area ? `Location: ${answers.area}` : null,
            ];

      const summaryText = summary.filter(Boolean).join("\n");

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dynamic-api`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
        }
      );
  
      const data = await res.json();
  
      if (!res.ok) {
        throw new Error(data?.error || "No Swahiba available");
      }
  
      // Redirect user to Talk page with Swahiba info
      navigate("/talk", {
        state: {
          swahiba: data,
          assessment: {
            nickname: answers?.nickname || "",
            location: answers?.area || "",
            need: intentMap[answers?.intent] || "info",
            description: summaryText || "",
          },
        },
      });
    } catch (err) {
      alert(
        lang === "SW"
          ? "Hakuna Swahiba anayepatikana kwa sasa. Tafadhali jaribu tena."
          : "No Swahiba is available right now. Please try again."
      );
    }
  }

}
