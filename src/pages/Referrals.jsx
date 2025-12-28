import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useLanguage } from "../context/LanguageContext.jsx";

/** =========================
 *  i18n (FULL for this page)
 *  ========================= */
const i18n = {
  sw: {
    // page
    pageTitle: "Orodha ya Rufaa",
    pageDesc:
      "Maeneo yaliyothibitishwa ya kupata msaada — kliniki, simu za dharura, huduma za GBV, na zaidi.",
    talkCta: "Ongea na SWAHIBA",

    // filters
    searchPlaceholder: "Tafuta (mf: GBV, Kinondoni, simu ya dharura)…",
    allRegions: "Mikoa yote",

    // categories (dropdown)
    cat_all: "Zote",
    cat_fp: "Uzazi wa Mpango",
    cat_sti_hiv: "Magonjwa ya Zinaa / VVU",
    cat_gbv: "Msaada wa GBV",
    cat_mental: "Afya ya Akili",
    cat_mch: "Afya ya Mama na Mtoto",
    cat_legal: "Msaada wa Kisheria",
    cat_hotline: "Namba za Dharura",

    // states
    loading: "Inapakia orodha…",
    empty: "Hakuna huduma zinazolingana na vichujio ulivyoweka.",
    dash: "—",

    // tags
    tagYouthFriendly: "Rafiki kwa Vijana",
    tagFree: "Bure",

    // fields
    hoursLabel: "Muda wa kazi",
    call: "Piga simu",
    whatsapp: "WhatsApp",
    website: "Tovuti",

    // footer
    footer: "©",
  },
  en: {
    // page
    pageTitle: "Referral Directory",
    pageDesc:
      "Verified places to get support — clinics, hotlines, GBV services, and more.",
    talkCta: "Talk to SWAHIBA",

    // filters
    searchPlaceholder: "Search (e.g., GBV, Kinondoni, hotline)…",
    allRegions: "All regions",

    // categories (dropdown)
    cat_all: "All",
    cat_fp: "Family Planning",
    cat_sti_hiv: "STI / HIV",
    cat_gbv: "GBV Support",
    cat_mental: "Mental Health",
    cat_mch: "Maternal & Child Health",
    cat_legal: "Legal Support",
    cat_hotline: "Hotlines",

    // states
    loading: "Loading directory…",
    empty: "No services match your filters.",
    dash: "—",

    // tags
    tagYouthFriendly: "Youth-friendly",
    tagFree: "Free",

    // fields
    hoursLabel: "Hours",
    call: "Call",
    whatsapp: "WhatsApp",
    website: "Website",

    // footer
    footer: "©",
  },
};

function cleanPhone(p) {
  if (!p) return "";
  return String(p).replace(/[^\d]/g, "");
}

export default function Referrals() {
  // ✅ global language from context: "SW" | "EN"
  const { lang } = useLanguage();
  const langKey = useMemo(() => (lang === "SW" ? "sw" : "en"), [lang]);
  const t = useMemo(() => i18n[langKey] || i18n.sw, [langKey]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [services, setServices] = useState([]);

  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [region, setRegion] = useState("all");

  const CATS = useMemo(
    () => [
      { key: "all", label: t.cat_all },
      { key: "fp", label: t.cat_fp },
      { key: "sti_hiv", label: t.cat_sti_hiv },
      { key: "gbv", label: t.cat_gbv },
      { key: "mental_health", label: t.cat_mental },
      { key: "mch", label: t.cat_mch },
      { key: "legal_support", label: t.cat_legal },
      { key: "hotline", label: t.cat_hotline },
    ],
    [t]
  );

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setErr("");
        setLoading(true);

        const { data, error } = await supabase
          .from("referral_services")
          .select(
            "id, name, category, region, district, address, hours, phone, whatsapp, website, youth_friendly, free_service, notes, is_verified, verified_at, is_active, updated_at"
          )
          .order("region", { ascending: true })
          .order("name", { ascending: true });

        if (error) throw error;

        if (!alive) return;
        setServices(data ?? []);
      } catch (e) {
        console.error(e);
        if (!alive) return;
        setErr(e?.message || String(e));
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const regions = useMemo(() => {
    const set = new Set();
    (services || []).forEach((s) => {
      if (s.region) set.add(s.region);
    });
    return ["all", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [services]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return (services || []).filter((s) => {
      const matchesQ =
        !query ||
        (s.name || "").toLowerCase().includes(query) ||
        (s.district || "").toLowerCase().includes(query) ||
        (s.region || "").toLowerCase().includes(query) ||
        (s.notes || "").toLowerCase().includes(query);

      const matchesCat = cat === "all" || s.category === cat;
      const matchesRegion = region === "all" || s.region === region;

      return matchesQ && matchesCat && matchesRegion;
    });
  }, [services, q, cat, region]);

  return (
    <div className="min-h-screen bg-white">
      <section className="mx-auto max-w-[1200px] px-4 py-12 sm:py-16">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1
              className="text-4xl tracking-tight sm:text-5xl"
              style={{ fontFamily: "ui-serif, Georgia, Cambria, serif" }}
            >
              {t.pageTitle}
            </h1>
            <p className="mt-3 max-w-2xl text-slate-600">{t.pageDesc}</p>
          </div>

          <Link
            to="/talk"
            className="inline-flex items-center justify-center rounded-2xl bg-amber-500 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-amber-600"
          >
            {t.talkCta}
          </Link>
        </div>

        {/* Filters */}
        <div className="mt-10 grid gap-3 sm:grid-cols-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-300"
          />

          <select
            value={cat}
            onChange={(e) => setCat(e.target.value)}
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-300"
          >
            {CATS.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>

          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-300"
          >
            {regions.map((r) => (
              <option key={r} value={r}>
                {r === "all" ? t.allRegions : r}
              </option>
            ))}
          </select>
        </div>

        {err && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {err}
          </div>
        )}

        {/* List */}
        <div className="mt-8">
          {loading ? (
            <div className="text-sm text-slate-600">{t.loading}</div>
          ) : filtered.length === 0 ? (
            <div className="text-sm text-slate-600">{t.empty}</div>
          ) : (
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((s) => {
                const call = s.phone ? `tel:${cleanPhone(s.phone)}` : null;
                const wa = s.whatsapp ? `https://wa.me/${cleanPhone(s.whatsapp)}` : null;

                return (
                  <li
                    key={s.id}
                    className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm"
                  >
                    <div className="text-base font-extrabold text-slate-900">{s.name}</div>

                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                        {s.category}
                      </span>
                      {s.youth_friendly && (
                        <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 border border-emerald-100">
                          {t.tagYouthFriendly}
                        </span>
                      )}
                      {s.free_service && (
                        <span className="rounded-full bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700 border border-indigo-100">
                          {t.tagFree}
                        </span>
                      )}
                    </div>

                    <div className="mt-4 text-sm text-slate-700">
                      {(s.region || t.dash) + (s.district ? ` • ${s.district}` : "")}
                    </div>

                    {s.hours && (
                      <div className="mt-2 text-sm text-slate-600">
                        {t.hoursLabel}: {s.hours}
                      </div>
                    )}

                    {s.address && <div className="mt-2 text-sm text-slate-600">{s.address}</div>}

                    {s.notes && (
                      <div className="mt-3 text-sm leading-7 text-slate-600">{s.notes}</div>
                    )}

                    <div className="mt-6 flex flex-wrap gap-2">
                      {call && (
                        <a
                          href={call}
                          className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
                        >
                          {t.call}
                        </a>
                      )}
                      {wa && (
                        <a
                          href={wa}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-2xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600"
                        >
                          {t.whatsapp}
                        </a>
                      )}
                      {s.website && (
                        <a
                          href={s.website}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
                        >
                          {t.website}
                        </a>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <footer className="border-t border-slate-200">
        <div className="mx-auto max-w-[1200px] px-4 py-10 text-sm text-slate-500">
          {t.footer} {new Date().getFullYear()} Swahiba — swahiba.org
        </div>
      </footer>
    </div>
  );
}