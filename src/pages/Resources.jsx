import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useLanguage } from "../context/LanguageContext.jsx";

/**
 * DB table: public.resources
 * Columns used:
 * id uuid
 * title text
 * topic text
 * language text  ("sw" | "en")
 * content text
 * published boolean
 * updated_at timestamptz
 */

const TOPIC_TO_CATEGORY = {
  // SRHR
  contraception: "SRHR",
  sti_hiv: "SRHR",
  pregnancy: "SRHR",
  emergency_contraception: "SRHR",
  // Safety
  consent: "Safety",
  safety: "Safety",
  // GBV
  gbv: "GBV",
  // Mental
  mental_health: "Mental",
  mh: "Mental",
};

function splitParagraphs(text) {
  const raw = (text || "").trim();
  if (!raw) return [];
  return raw
    .split(/\n\s*\n+/g)
    .map((p) => p.trim())
    .filter(Boolean);
}

function makeSummary(content, max = 150) {
  const first = splitParagraphs(content)[0] || "";
  const s = first.replace(/\s+/g, " ").trim();
  if (!s) return "";
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trim() + "…";
}

/** =========================
 *  TRANSLATIONS (FULL)
 *  ========================= */
const i18n = {
  sw: {
    domain: "swahiba.org",

    pageTitle: "Rasilimali",
    pageSubtitle:
      "Majibu ya haraka ya SRHR unayoweza kuamini — salama, rahisi na rafiki kwa vijana.",

    backHome: "Rudi Nyumbani",

    disclaimerTitle: "Kumbuka",
    disclaimerText:
      "Swahiba si huduma ya dharura. Kama upo hatarini sasa hivi, tafuta msaada wa dharura au piga namba ya dharura/hotline iliyo karibu nawe.",

    searchPh: "Tafuta rasilimali… (mf: uzazi wa mpango, STI, GBV)",
    filterAll: "Zote",
    filterSafety: "Usalama",
    filterSRHR: "SRHR",
    filterGBV: "GBV",
    filterMental: "Afya ya akili",

    loading: "Inapakia rasilimali…",
    empty: "Hakuna rasilimali kwa sasa.",

    read: "Soma",
    dash: "—",

    talkBtn: "Nenda kuongea",
    navTalk: "Ongea na SWAHIBA",

    metaTopic: "Mada",
    metaLang: "Lugha",
    close: "Funga",

    footerC: "©",
  },
  en: {
    domain: "swahiba.org",

    pageTitle: "Resources",
    pageSubtitle: "Quick SRHR guidance you can trust — safe, clear, youth-friendly.",

    backHome: "Back Home",

    disclaimerTitle: "Reminder",
    disclaimerText:
      "Swahiba is not an emergency service. If you’re in immediate danger, seek emergency help or hotlines near you.",

    searchPh: "Search resources… (e.g., contraception, STI, GBV)",
    filterAll: "All",
    filterSafety: "Safety",
    filterSRHR: "SRHR",
    filterGBV: "GBV",
    filterMental: "Mental health",

    loading: "Loading resources…",
    empty: "No resources yet.",

    read: "Read",
    dash: "—",

    talkBtn: "Go to Talk",
    navTalk: "Talk to SWAHIBA",

    metaTopic: "Topic",
    metaLang: "Language",
    close: "Close",

    footerC: "©",
  },
};

export default function Resources() {
  const navigate = useNavigate();

  // ✅ global language from context: "SW" | "EN"
  const { lang } = useLanguage();
  const dbLang = lang === "SW" ? "sw" : "en";
  const t = useMemo(() => (dbLang === "sw" ? i18n.sw : i18n.en), [dbLang]);

  // ✅ Load from Supabase (both languages, published only)
  const [rawRows, setRawRows] = useState([]);
  const [loadingDb, setLoadingDb] = useState(true);
  const [dbErr, setDbErr] = useState("");

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoadingDb(true);
      setDbErr("");
      try {
        const { data, error } = await supabase
          .from("resources")
          .select("id, title, topic, language, content, published, updated_at")
          .eq("published", true)
          .order("topic", { ascending: true })
          .order("updated_at", { ascending: false });

        if (error) throw error;

        if (!alive) return;
        setRawRows(data ?? []);
      } catch (e) {
        if (!alive) return;
        setDbErr(e?.message || String(e));
      } finally {
        if (!alive) return;
        setLoadingDb(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  // Group rows by topic, keep both languages available
  const byTopic = useMemo(() => {
    const map = new Map(); // topic -> { sw: row, en: row }
    for (const r of rawRows || []) {
      const topic = (r.topic || "").trim();
      const lng = (r.language || "").trim().toLowerCase();
      if (!topic) continue;

      if (!map.has(topic)) map.set(topic, {});
      const bucket = map.get(topic);

      if (lng === "sw" || lng === "en") {
        if (!bucket[lng]) bucket[lng] = r; // already sorted by updated_at desc
      } else {
        if (!bucket.other) bucket.other = r;
      }
    }
    return map;
  }, [rawRows]);

  // Map grouped data -> UI resources (stable id = topic)
  const resources = useMemo(() => {
    const list = [];

    for (const [topic, bucket] of byTopic.entries()) {
      const chosen = bucket[dbLang] || bucket.sw || bucket.en || bucket.other;
      if (!chosen) continue;

      const category = TOPIC_TO_CATEGORY[topic] || "SRHR";

      const title = chosen.title || topic;
      const content = chosen.content || "";
      const body = splitParagraphs(content);
      const summary = makeSummary(content);

      list.push({
        id: topic, // stable across languages
        topic,
        category,
        language: chosen.language || dbLang,
        title,
        summary,
        body,
      });
    }

    const order = { SRHR: 1, Safety: 2, GBV: 3, Mental: 4 };
    list.sort((a, b) => {
      const ca = order[a.category] || 9;
      const cb = order[b.category] || 9;
      if (ca !== cb) return ca - cb;
      return (a.title || "").localeCompare(b.title || "");
    });

    return list;
  }, [byTopic, dbLang]);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All"); // All | SRHR | Safety | GBV | Mental
  const [openId, setOpenId] = useState(null);

  const openItem = resources.find((r) => r.id === openId) || null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return resources.filter((r) => {
      const matchesQuery =
        !q ||
        (r.title || "").toLowerCase().includes(q) ||
        (r.summary || "").toLowerCase().includes(q) ||
        (r.topic || "").toLowerCase().includes(q) ||
        (r.body || []).join(" ").toLowerCase().includes(q);

      const matchesFilter = filter === "All" || (r.category || "SRHR") === filter;

      return matchesQuery && matchesFilter;
    });
  }, [resources, query, filter]);

  // Modal a11y: close on ESC
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") setOpenId(null);
    };
    if (openId) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openId]);

  const modalCloseBtnRef = useRef(null);
  useEffect(() => {
    if (openId) setTimeout(() => modalCloseBtnRef.current?.focus(), 0);
  }, [openId]);

  return (
    <div className="min-h-screen bg-white">
      {/* Page intro */}
      <section className="mx-auto max-w-[1200px] px-4 py-12 sm:py-16">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1
              className="text-4xl tracking-tight sm:text-5xl"
              style={{ fontFamily: "ui-serif, Georgia, Cambria, serif" }}
            >
              {t.pageTitle}
            </h1>
            <p className="mt-3 max-w-2xl text-slate-600">{t.pageSubtitle}</p>
          </div>

          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-2xl bg-amber-500 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-amber-600"
          >
            {t.backHome}
          </Link>
        </div>

        {/* Disclaimer strip */}
        <div className="mt-8 rounded-3xl border border-slate-200 bg-slate-50 p-6">
          <div className="text-sm font-extrabold text-slate-900">{t.disclaimerTitle}</div>
          <div className="mt-1 text-sm leading-7 text-slate-600">{t.disclaimerText}</div>
        </div>

        {/* DB error */}
        {dbErr && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {dbErr}
          </div>
        )}

        {/* Search + filters */}
        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.searchPh}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-300"
          />

          <div className="flex flex-wrap gap-2">
            <FilterPill active={filter === "All"} onClick={() => setFilter("All")}>
              {t.filterAll}
            </FilterPill>
            <FilterPill active={filter === "SRHR"} onClick={() => setFilter("SRHR")}>
              {t.filterSRHR}
            </FilterPill>
            <FilterPill active={filter === "Safety"} onClick={() => setFilter("Safety")}>
              {t.filterSafety}
            </FilterPill>
            <FilterPill active={filter === "GBV"} onClick={() => setFilter("GBV")}>
              {t.filterGBV}
            </FilterPill>
            <FilterPill active={filter === "Mental"} onClick={() => setFilter("Mental")}>
              {t.filterMental}
            </FilterPill>
          </div>
        </div>

        {/* Grid */}
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {loadingDb ? (
            <div className="col-span-full rounded-3xl border border-slate-200 bg-white p-7 text-sm text-slate-600">
              {t.loading}
            </div>
          ) : filtered.length === 0 ? (
            <div className="col-span-full rounded-3xl border border-slate-200 bg-white p-7 text-sm text-slate-600">
              {t.empty}
            </div>
          ) : (
            filtered.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setOpenId(r.id)}
                className="group text-left rounded-3xl border border-slate-200 bg-white p-7 shadow-sm transition hover:-translate-y-[1px] hover:shadow-md"
              >
                <div className="flex items-center gap-2">
                  <div className="text-base font-extrabold text-slate-900">{r.title}</div>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-700">
                    {r.category}
                  </span>
                </div>

                <div className="mt-3 text-sm leading-7 text-slate-600">
                  {r.summary || t.dash}
                </div>

                <div className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-slate-900">
                  {t.read} <span className="transition group-hover:translate-x-0.5">→</span>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Bottom CTA */}
        <div className="mt-14 flex justify-center">
          <button
            type="button"
            onClick={() => navigate("/talk")}
            className="rounded-2xl bg-slate-900 px-7 py-3 text-sm font-semibold text-white hover:bg-slate-800"
          >
            {t.talkBtn}
          </button>
        </div>
      </section>

      {/* Modal */}
      {openItem && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpenId(null)} />
          <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-white p-7 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div
                  className="text-2xl tracking-tight text-slate-900"
                  style={{ fontFamily: "ui-serif, Georgia, Cambria, serif" }}
                >
                  {openItem.title}
                </div>

                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700">
                    {t.metaTopic}: {openItem.topic}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700">
                    {t.metaLang}: {openItem.language}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700">
                    {openItem.category}
                  </span>
                </div>

                {openItem.summary ? (
                  <div className="mt-3 text-sm text-slate-600">{openItem.summary}</div>
                ) : null}
              </div>

              <button
                ref={modalCloseBtnRef}
                type="button"
                onClick={() => setOpenId(null)}
                className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
              >
                {t.close}
              </button>
            </div>

            <div className="mt-6 space-y-4">
              {(openItem.body || []).length ? (
                (openItem.body || []).map((p, idx) => (
                  <p key={idx} className="text-sm leading-7 text-slate-700">
                    {p}
                  </p>
                ))
              ) : (
                <p className="text-sm leading-7 text-slate-700">{t.dash}</p>
              )}
            </div>

            <div className="mt-6 border-t border-slate-200 pt-5">
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setOpenId(null);
                    navigate("/talk");
                  }}
                  className="rounded-2xl bg-amber-500 px-5 py-3 text-sm font-semibold text-white hover:bg-amber-600"
                >
                  {t.navTalk}
                </button>

                <button
                  type="button"
                  onClick={() => setOpenId(null)}
                  className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold hover:bg-slate-50"
                >
                  {t.close}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}

function FilterPill({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-2xl border px-4 py-2 text-xs font-bold",
        active
          ? "border-slate-900 bg-slate-900 text-white"
          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
      ].join(" ")}
    >
      {children}
    </button>
  );
}