import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom"; // ✅ ADD useLocation
import { supabase } from "../lib/supabaseClient";
import { useLanguage } from "../context/LanguageContext.jsx";

export default function Talk() {
  const { lang } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation(); // ✅ ADD

  const [swahibas, setSwahibas] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [selected, setSelected] = useState(null);
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
     STEP 2 + 3: AUTO-OPEN FROM RESULTS
  ====================== */
  useEffect(() => {
    if (location.state?.swahiba) {
      const s = location.state.swahiba;

      setSelected(s); // 🔥 opens modal automatically

      // optional: prefill phone if provided
      if (s.phone_number) {
        setForm((f) => ({
          ...f,
          phone: s.phone_number,
        }));
      }
    }
  }, [location.state]);

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
          available: "Yupo Mtandaoni",
          offline: "Hayupo Mtandaoni",
          request: "Tuma ombi",
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
        };

  /* ======================
     LOAD SWAHIBAS
  ====================== */
  useEffect(() => {
    fetchSwahibas();
  }, []);

  async function fetchSwahibas() {
    setLoading(true);

    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id, full_name, avatar_url, region, district, bio, availability, role"
      )
      .neq("role", "admin");

    if (!error) {
      setSwahibas(data || []);
      setFiltered(data || []);
    }

    setLoading(false);
  }

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

  /* ======================
     SUBMIT REQUEST (FIXED)
  ====================== */
  async function submitRequest() {
    if (!selected) return;

    // 1️⃣ Create request (ONLY existing columns)
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

    // 2️⃣ Create notification with metadata
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

    // 3️⃣ Reset UI
    setSelected(null);
    setForm({
      nickname: "",
      location: "",
      need: "info",
      description: "",
      channel: "whatsapp",
      phone: "",
    });

    alert("Ombi limetumwa. Swahiba atawasiliana nawe.");
  }

  /* ======================
     UI
  ====================== */
  return (
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto max-w-[1200px] px-4 py-12">
        <h1 className="text-3xl font-semibold">{t.title}</h1>
        <p className="mt-2 text-slate-600">{t.subtitle}</p>

        {/* Self assessment */}
        <div className="mt-6 rounded-2xl border bg-white p-6 flex justify-between items-center">
          <div>
            <div className="font-semibold">{t.selfTitle}</div>
            <p className="text-sm text-slate-600">{t.selfBody}</p>
          </div>
          <button
            onClick={() => navigate("/triage")}
            className="rounded-xl bg-amber-500 px-5 py-2 text-sm font-semibold text-white"
          >
            {t.selfCta}
          </button>
        </div>

        {/* Search & filter */}
        <div className="mt-8 flex gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.search}
            className="flex-1 rounded-xl border px-4 py-2"
          />
          <select
            value={availability}
            onChange={(e) => setAvailability(e.target.value)}
            className="rounded-xl border px-3"
          >
            <option value="all">{t.filter}</option>
            <option value="available">{t.available}</option>
            <option value="offline">{t.offline}</option>
          </select>
        </div>

        {/* Swahiba list */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelected(s)}
              className="flex gap-4 rounded-2xl border bg-white p-4 text-left hover:shadow-sm"
            >
              <div className="h-14 w-14 rounded-full overflow-hidden bg-slate-100 border">
                {s.avatar_url ? (
                  <img
                    src={s.avatar_url}
                    alt={s.full_name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-xs text-slate-400">
                    No photo
                  </div>
                )}
              </div>

              <div>
                <div className="font-semibold">{s.full_name || "Swahiba"}</div>
                <div className="text-xs text-slate-500">
                  {s.district}, {s.region}
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      s.availability === "available"
                        ? "bg-green-500"
                        : "bg-slate-400"
                    }`}
                  />
                  {s.availability === "available"
                    ? t.available
                    : t.offline}
                </div>
              </div>
            </button>
          ))}
        </div>
      </main>

      {/* MODAL */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6">
            <div className="flex justify-between items-start">
              <div className="font-semibold">{selected.full_name}</div>
              <button onClick={() => setSelected(null)}>✕</button>
            </div>

            {selected.bio && (
              <p className="mt-3 text-sm text-slate-600">{selected.bio}</p>
            )}

            <div className="mt-4 grid gap-3">
              <input
                placeholder="Jina la utani (hiari)"
                value={form.nickname}
                onChange={(e) =>
                  setForm({ ...form, nickname: e.target.value })
                }
                className="rounded-xl border px-3 py-2 text-sm"
              />
              <input
                placeholder="Mahali ulipo"
                value={form.location}
                onChange={(e) =>
                  setForm({ ...form, location: e.target.value })
                }
                className="rounded-xl border px-3 py-2 text-sm"
              />
              <select
                value={form.need}
                onChange={(e) =>
                  setForm({ ...form, need: e.target.value })
                }
                className="rounded-xl border px-3 py-2 text-sm"
              >
                <option value="info">Taarifa</option>
                <option value="service">Huduma</option>
                <option value="product">Bidhaa</option>
              </select>
              <textarea
                placeholder="Eleza unachotaka kuzungumzia"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                className="rounded-xl border px-3 py-2 text-sm"
              />
              <select
                value={form.channel}
                onChange={(e) =>
                  setForm({ ...form, channel: e.target.value })
                }
                className="rounded-xl border px-3 py-2 text-sm"
              >
                <option value="whatsapp">WhatsApp</option>
                <option value="sms">SMS</option>
                <option value="call">Phone call</option>
                <option value="email">Email</option>
                <option value="meetup">Meet up</option>
              </select>
              <input
                placeholder="Namba ya simu"
                value={form.phone}
                onChange={(e) =>
                  setForm({ ...form, phone: e.target.value })
                }
                className="rounded-xl border px-3 py-2 text-sm"
              />
              <button
                onClick={submitRequest}
                className="mt-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white"
              >
                {t.request}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}