import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useLanguage } from "../context/LanguageContext.jsx";

const AVATAR_BUCKET = "avatars"; // if avatar_url is a storage path, we'll sign it

function initials(name) {
  const s = String(name || "").trim();
  if (!s) return "S";
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return s.slice(0, 1).toUpperCase();
}

async function resolveAvatar(avatarUrlOrPath) {
  const v = String(avatarUrlOrPath || "").trim();
  if (!v) return "";
  if (/^https?:\/\//i.test(v)) return v;

  try {
    const { data, error } = await supabase.storage
      .from(AVATAR_BUCKET)
      .createSignedUrl(v, 60 * 60);

    if (error) return "";
    return data?.signedUrl || "";
  } catch {
    return "";
  }
}

function expertiseFromProfileRow(row, langKey) {
  const labels =
    langKey === "sw"
      ? {
          expertise_contraceptives: "Uzazi wa mpango",
          expertise_hiv_stis: "VVU & Magonjwa ya zinaa",
          expertise_gbv: "Ukatili wa kijinsia",
          expertise_mental_health: "Afya ya akili",
          expertise_physical_health: "Afya ya mwili",
          expertise_nutrition: "Lishe",
        }
      : {
          expertise_contraceptives: "Contraceptives",
          expertise_hiv_stis: "HIV & STIs",
          expertise_gbv: "Gender-Based Violence",
          expertise_mental_health: "Mental Health",
          expertise_physical_health: "Physical Health",
          expertise_nutrition: "Nutrition",
        };

  const keys = Object.keys(labels);
  const on = keys.filter((k) => row?.[k] === true);
  return on.map((k) => labels[k]);
}

export default function Talk() {
  const { lang } = useLanguage();
  const langKey = useMemo(() => (lang === "SW" ? "sw" : "en"), [lang]);
  const navigate = useNavigate();
  const location = useLocation();

  const [swahibas, setSwahibas] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [selected, setSelected] = useState(null); // full details object
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [availability, setAvailability] = useState("all");

  const [form, setForm] = useState({
    nickname: "",
    location: "",
    need: "info",
    description: "",
    channel: "whatsapp",
    phone: "",
  });

  /* ======================
     COPY
  ====================== */
  const t =
    lang === "SW"
      ? {
          title: "Ongea na Swahiba",
          subtitle: "Chagua Swahiba au fanya tathmini ya haraka.",
          selfTitle: "Hujui uanze wapi?",
          selfBody: "Fanya tathmini fupi ili tukusaidie vizuri zaidi.",
          selfCta: "Anza tathmini ya haraka",
          search: "Tafuta kwa jina au eneo...",
          filter: "Wote",
          available: "Yupo",
          offline: "Hayupo",
          request: "Tuma ombi",
          talkTo: "Ongea na Swahiba Huyu",
          areas: "Mada anazoweza kusaidia",
          about: "Kuhusu",
          locationLabel: "Eneo",
          noBio: "Hajaweka maelezo kwa sasa.",
          selectHint: "Bofya ili uanze maombi ya kuzungumza.",
          formTitle: "Tuma Ombi",
          introForm: "Jaza fomu hii. Swahiba atawasiliana nawe.",
          close: "Funga",
          needLabel: "Aina ya msaada",
          descLabel: "Maelezo",
          channelLabel: "Njia ya mawasiliano",
          phoneLabel: "Namba ya simu",
          nicknameLabel: "Jina la utani (hiari)",
          whereLabel: "Mahali ulipo",
          success: "Ombi limetumwa. Swahiba atawasiliana nawe.",
        }
      : {
          title: "Talk to a Swahiba",
          subtitle: "Choose a Swahiba or start a quick self-assessment.",
          selfTitle: "Not sure where to start?",
          selfBody: "Do a short self-assessment so we can support you better.",
          selfCta: "Start self-assessment",
          search: "Search by name or location...",
          filter: "All",
          available: "Available",
          offline: "Offline",
          request: "Send request",
          talkTo: "Talk to this Swahiba",
          areas: "Areas of expertise",
          about: "About",
          locationLabel: "Location",
          noBio: "No bio added yet.",
          selectHint: "Click to start a talk request.",
          formTitle: "Send Request",
          introForm: "Fill this form. The Swahiba will contact you.",
          close: "Close",
          needLabel: "Need type",
          descLabel: "Description",
          channelLabel: "Preferred channel",
          phoneLabel: "Phone",
          nicknameLabel: "Nickname (optional)",
          whereLabel: "Your location",
          success: "Request sent. The Swahiba will contact you.",
        };

  /* ======================
     LOAD SWAHIBAS (with expertise fields)
  ====================== */
  useEffect(() => {
    fetchSwahibas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchSwahibas() {
    setLoading(true);

    const { data, error } = await supabase
      .from("profiles")
      .select(
        `
        id,
        full_name,
        avatar_url,
        region,
        district,
        bio,
        availability,
        role,
        phone_number,
        expertise_contraceptives,
        expertise_hiv_stis,
        expertise_gbv,
        expertise_mental_health,
        expertise_physical_health,
        expertise_nutrition
      `
      )
      .neq("role", "admin");

    if (!error) {
      const rows = data || [];
      // resolve avatar urls once
      const resolved = await Promise.all(rows.map((r) => resolveAvatar(r.avatar_url)));
      const withUi = rows.map((r, idx) => ({
        ...r,
        avatarResolved: resolved[idx] || "",
        expertiseLabels: expertiseFromProfileRow(r, langKey),
      }));
      setSwahibas(withUi);
      setFiltered(withUi);
    }

    setLoading(false);
  }

  /* ======================
     AUTO-OPEN FROM RESULTS
  ====================== */
  useEffect(() => {
    if (location.state?.swahiba) {
      const s = location.state.swahiba;
      // try to match in loaded list for full details
      const found = swahibas.find((x) => x.id === s.id) || s;
      onSelectSwahiba(found);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, swahibas]);

  /* ======================
     FILTERING
  ====================== */
  useEffect(() => {
    let list = [...swahibas];

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) =>
          s.full_name?.toLowerCase().includes(q) ||
          s.region?.toLowerCase().includes(q) ||
          s.district?.toLowerCase().includes(q)
      );
    }

    if (availability !== "all") {
      list = list.filter((s) => s.availability === availability);
    }

    setFiltered(list);
  }, [search, availability, swahibas]);

  function onSelectSwahiba(s) {
    setSelected(s);

    // Prefill phone if the swahiba has a phone number and user hasn't typed one
    if (s?.phone_number && !form.phone) {
      setForm((f) => ({ ...f, phone: s.phone_number }));
    }
  }

  /* ======================
     SUBMIT REQUEST
  ====================== */
  async function submitRequest() {
    if (!selected) return;

    const { data: request, error } = await supabase
      .from("requests")
      .insert([
        {
          swahiba_id: selected.id,
          nickname: form.nickname || "Anonymous",
          location: form.location || null,
          need: form.need,
          description: form.description || null,
          channel: form.channel || null,
          phone: form.phone || null,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Supabase error:", error);
      alert(error.message);
      return;
    }

    await supabase.from("notifications").insert([
      {
        user_id: selected.id,
        type: "request",
        title: "New request to talk",
        body: `${form.nickname || "Someone"} wants to talk about ${form.need}`,
        metadata: {
          request_id: request.id,
          description: form.description,
          channel: form.channel,
          phone: form.phone,
          location: form.location,
        },
      },
    ]);

    setSelected(null);
    setForm({
      nickname: "",
      location: "",
      need: "info",
      description: "",
      channel: "whatsapp",
      phone: "",
    });

    alert(t.success);
  }

  /* ======================
     UI
  ====================== */
  return (
    <div className="min-h-screen bg-white">
      <main className="mx-auto max-w-[1200px] px-4 py-12">
        <h1 className="text-3xl font-extrabold tracking-tight">{t.title}</h1>
        <p className="mt-2 text-slate-600">{t.subtitle}</p>

        {/* Self assessment */}
        <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="font-extrabold">{t.selfTitle}</div>
            <p className="mt-1 text-sm text-slate-600">{t.selfBody}</p>
          </div>
          <button
            onClick={() => navigate("/triage")}
            className="rounded-2xl bg-amber-500 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-600"
          >
            {t.selfCta}
          </button>
        </div>

        {/* Search & filter */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.search}
            className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-amber-300"
          />
          <select
            value={availability}
            onChange={(e) => setAvailability(e.target.value)}
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-amber-300"
          >
            <option value="all">{t.filter}</option>
            <option value="available">{t.available}</option>
            <option value="offline">{t.offline}</option>
          </select>
        </div>

        {/* Swahiba list */}
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {loading ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
              Loading…
            </div>
          ) : filtered.length ? (
            filtered.map((s) => (
              <SwahibaCard
                key={s.id}
                s={s}
                t={t}
                langKey={langKey}
                onTalk={() => onSelectSwahiba(s)}
              />
            ))
          ) : (
            <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
              —
            </div>
          )}
        </div>
      </main>

      {/* MODAL (details + request form) */}
      {selected && (
        <Modal onClose={() => setSelected(null)}>
          <div className="flex items-start justify-between gap-4">
            <div className="text-lg font-extrabold">{t.formTitle}</div>
            <button
              onClick={() => setSelected(null)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50"
              type="button"
            >
              {t.close}
            </button>
          </div>

          {/* Selected Swahiba details */}
          <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-start gap-4">
              <div className="h-14 w-14 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                {selected.avatarResolved ? (
                  <img
                    src={selected.avatarResolved}
                    alt={selected.full_name}
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-slate-900 text-white text-sm font-extrabold">
                    {initials(selected.full_name)}
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-base font-extrabold text-slate-900 truncate">
                    {selected.full_name || "Swahiba"}
                  </div>
                  <span
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
                      selected.availability === "available"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 bg-white text-slate-600"
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        selected.availability === "available"
                          ? "bg-emerald-500"
                          : "bg-slate-300"
                      }`}
                    />
                    {selected.availability === "available" ? t.available : t.offline}
                  </span>
                </div>

                <div className="mt-1 text-xs text-slate-500">
                  {selected.district || "—"}
                  {selected.region ? `, ${selected.region}` : ""}
                </div>

                <div className="mt-3">
                  <div className="text-xs font-bold text-slate-700">{t.about}</div>
                  <div className="mt-1 text-sm text-slate-700">
                    {selected.bio ? selected.bio : t.noBio}
                  </div>
                </div>

                <div className="mt-4">
                  <div className="text-xs font-bold text-slate-700">{t.areas}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(selected.expertiseLabels || []).length ? (
                      selected.expertiseLabels.map((x) => (
                        <span
                          key={x}
                          className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800"
                        >
                          {x}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-slate-500">—</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <p className="mt-5 text-sm text-slate-600">{t.introForm}</p>

          {/* Request form */}
          <div className="mt-4 grid gap-3">
            <input
              placeholder={t.nicknameLabel}
              value={form.nickname}
              onChange={(e) => setForm({ ...form, nickname: e.target.value })}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-amber-300"
            />
            <input
              placeholder={t.whereLabel}
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-amber-300"
            />

            <select
              value={form.need}
              onChange={(e) => setForm({ ...form, need: e.target.value })}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-amber-300"
            >
              <option value="info">{langKey === "sw" ? "Taarifa" : "Information"}</option>
              <option value="service">{langKey === "sw" ? "Huduma" : "Service"}</option>
              <option value="product">{langKey === "sw" ? "Bidhaa" : "Products"}</option>
            </select>

            <textarea
              placeholder={langKey === "sw" ? "Eleza unachotaka kuzungumzia" : "Tell us what you want to talk about"}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="min-h-[110px] rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-amber-300"
            />

            <select
              value={form.channel}
              onChange={(e) => setForm({ ...form, channel: e.target.value })}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-amber-300"
            >
              <option value="whatsapp">WhatsApp</option>
              <option value="sms">SMS</option>
              <option value="call">{langKey === "sw" ? "Simu" : "Phone call"}</option>
              <option value="email">Email</option>
              <option value="meetup">{langKey === "sw" ? "Tukutane" : "Meet up"}</option>
            </select>

            <input
              placeholder={t.phoneLabel}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-amber-300"
            />

            <button
              onClick={submitRequest}
              className="mt-2 rounded-2xl bg-amber-500 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-amber-600"
              type="button"
            >
              {t.request}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ======================
   Swahiba Card
====================== */
function SwahibaCard({ s, t, onTalk }) {
  const isAvailable = s.availability === "available";

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="h-14 w-14 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
          {s.avatarResolved ? (
            <img
              src={s.avatarResolved}
              alt={s.full_name}
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-slate-900 text-white text-sm font-extrabold">
              {initials(s.full_name)}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="truncate text-base font-extrabold text-slate-900">
              {s.full_name || "Swahiba"}
            </div>

            <span
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
                isAvailable
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 bg-white text-slate-600"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${isAvailable ? "bg-emerald-500" : "bg-slate-300"}`} />
              {isAvailable ? t.available : t.offline}
            </span>
          </div>

          <div className="mt-1 text-xs text-slate-500">
            {s.district || "—"}
            {s.region ? `, ${s.region}` : ""}
          </div>

          <div className="mt-3 line-clamp-3 text-sm text-slate-600">
            {s.bio ? s.bio : t.noBio}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {(s.expertiseLabels || []).slice(0, 4).map((x) => (
              <span
                key={x}
                className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800"
              >
                {x}
              </span>
            ))}
            {(s.expertiseLabels || []).length > 4 ? (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                +{(s.expertiseLabels || []).length - 4}
              </span>
            ) : null}
          </div>

          <div className="mt-5">
            <button
              type="button"
              onClick={onTalk}
              className="inline-flex w-full items-center justify-center rounded-2xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-600"
            >
              {t.talkTo}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ======================
   Modal
====================== */
function Modal({ children, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        className="
          absolute inset-x-0 top-10 mx-auto w-[92%] max-w-xl
          rounded-3xl bg-white p-6 shadow-xl sm:p-8
          max-h-[calc(100vh-5rem)] overflow-y-auto
        "
      >
        {children}
      </div>
    </div>
  );
}