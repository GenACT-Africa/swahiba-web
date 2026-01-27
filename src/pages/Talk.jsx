import React, { useEffect, useMemo, useRef, useState } from "react";
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

function normalizePhoneInput(value) {
  const cleaned = String(value || "").replace(/[^\d+]/g, "").trim();
  if (!cleaned) return "";
  if (cleaned.startsWith("+")) return cleaned;
  if (cleaned.startsWith("255")) return `+${cleaned}`;
  if (cleaned.startsWith("0") && cleaned.length === 10) {
    return `+255${cleaned.slice(1)}`;
  }
  if (/^[67]\d{8}$/.test(cleaned)) {
    return `+255${cleaned}`;
  }
  return cleaned;
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

// (passkey helpers removed)

// (passkey helpers removed)

async function getFunctionErrorMessage(error, fallback) {
  if (!error) return fallback;
  const response = error?.context?.response;
  if (response?.json) {
    try {
      const data = await response.clone().json();
      if (data?.details) return data.details;
      if (data?.error) return data.error;
    } catch {
      // ignore parse errors
    }
    try {
      const text = await response.clone().text();
      if (text) return text;
    } catch {
      // ignore parse errors
    }
  }
  return error.message || fallback;
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
  const [requestSent, setRequestSent] = useState(false);
  const [activeRequest, setActiveRequest] = useState(null);
  const [accessCodeInput, setAccessCodeInput] = useState("");
  const [accessCodeSet, setAccessCodeSet] = useState(false);
  const [onboardError, setOnboardError] = useState("");
  const [onboardLoading, setOnboardLoading] = useState(false);
  const [userChatLoading, setUserChatLoading] = useState(false);
  const [userChatError, setUserChatError] = useState("");
  const [userChatMessages, setUserChatMessages] = useState([]);
  const [userChatInput, setUserChatInput] = useState("");
  const [userChatConversationId, setUserChatConversationId] = useState(null);
  const [chatWidgetOpen, setChatWidgetOpen] = useState(false);
  const [chatAccessCode, setChatAccessCode] = useState("");
  const [chatAccessCodeInput, setChatAccessCodeInput] = useState("");
  const [chatPhoneInput, setChatPhoneInput] = useState("");
  const [chatPhone, setChatPhone] = useState("");
  const [chatRequest, setChatRequest] = useState(null);
  const [chatUnread, setChatUnread] = useState(0);
  const chatChannelRef = useRef(null);
  const chatPollRef = useRef(null);
  const lastMessageCountRef = useRef(0);
  const chatEndRef = useRef(null);
  const finishRequestRef = useRef(null);

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
          needHelpTitle: "Unahitaji msaada gani?",
          needHelpDesc: "Chagua aina ya msaada unaohitaji kutoka kwa Swahiba.",
          descLabel: "Maelezo",
          channelLabel: "Njia ya mawasiliano",
          channelTitle: "Njia ya mawasiliano",
          channelDesc: "Chagua jinsi unavyopendelea Swahiba akuwasiliane.",
          phoneLabel: "Namba ya simu",
          nicknameLabel: "Jina la utani (hiari)",
          whereLabel: "Mahali ulipo",
          success: "Ombi limetumwa. Swahiba atawasiliana nawe.",
          createAccessCode: "Tengeneza nambari ya siri",
          accessCodeHint:
            "Chagua nambari/neno lenye herufi au namba 4. Utalitumia kufungua chat baadaye.",
          saveAccessCode: "Hifadhi nambari ya siri",
          finishRequest: "Maliza ombi",
          submitRequest: "Wasilisha ombi",
          rememberAccessCode:
            "Hifadhi nambari yako ya siri. Utaijumuia kufungua chat baadaye.",
          pinLabel: "PIN (herufi/namba 4)",
          accessChat: "Fungua chat",
          phoneRequired: "Namba ya simu inahitajika.",

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
          needHelpTitle: "What do you need?",
          needHelpDesc: "Choose the type of support you want from Swahiba.",
          descLabel: "Description",
          channelLabel: "Preferred channel",
          channelTitle: "Preferred communication",
          channelDesc: "Pick how you’d like Swahiba to reach you.",
          phoneLabel: "Phone",
          nicknameLabel: "Nickname (optional)",
          whereLabel: "Your location",
          success: "Request sent. The Swahiba will contact you.",
          createAccessCode: "Create access code",
          accessCodeHint:
            "Choose a 4 character code (letters or numbers). You will use it to open your chat later.",
          saveAccessCode: "Save access code",
          finishRequest: "Finish request",
          submitRequest: "Submit request",
          rememberAccessCode:
            "Keep your access code safe. You will use it to open your chat later.",
          pinLabel: "PIN (4 letters/numbers)",
          accessChat: "Open chat",
          phoneRequired: "Phone number is required.",

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
      .eq("role", "swahiba");

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
      const found = swahibas.find((x) => x.id === s.id) || s;
      onSelectSwahiba(found);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, swahibas]);

  useEffect(() => {
    if (!location.state?.assessment) return;
    const a = location.state.assessment;
    setForm((f) => ({
      ...f,
      nickname: a.nickname || f.nickname,
      location: a.location || f.location,
      need: a.need || f.need,
      description: a.description || f.description,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state?.assessment]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const openChat = params.get("chat");
    if (openChat) {
      setChatWidgetOpen(true);
    }
  }, [location.search]);

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
    setRequestSent(false);
    setActiveRequest(null);
    setAccessCodeInput("");
    setAccessCodeSet(false);
    setOnboardError("");
    setOnboardLoading(false);
    setUserChatMessages([]);
    setUserChatError("");
    setUserChatInput("");
    setUserChatConversationId(null);
    setChatRequest(null);
    setChatUnread(0);
    if (chatChannelRef.current) {
      supabase.removeChannel(chatChannelRef.current);
      chatChannelRef.current = null;
    }

    // Do not prefill phone number
  }

  /* ======================
     SUBMIT REQUEST
  ====================== */
  async function submitRequest() {
    if (!selected) return;
    if (!form.phone) {
      setOnboardError(t.phoneRequired);
      return;
    }
    if (!accessCodeInput || accessCodeInput.length < 4) {
      setOnboardError(t.accessCodeHint);
      return;
    }

    setOnboardError("");
    setOnboardLoading(true);

    const normalizedPhone = normalizePhoneInput(form.phone);
    const { error } = await supabase.functions.invoke("request-onboard", {
      body: {
        action: "set_access_code_no_otp",
        phone: normalizedPhone,
        access_code: accessCodeInput,
      },
    });

    if (error) {
      const message = await getFunctionErrorMessage(error, "PIN setup failed.");
      setOnboardError(message);
      setOnboardLoading(false);
      return;
    }

    setAccessCodeSet(true);
    setOnboardLoading(false);
    setTimeout(() => {
      if (finishRequestRef.current) {
        finishRequestRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
      }
    }, 0);
  }

  async function createRequestWithPin() {
    setOnboardError("");
    setOnboardLoading(true);

    const normalizedPhone = normalizePhoneInput(form.phone);
    const { data, error } = await supabase.functions.invoke("request-onboard", {
      body: {
        action: "create_request_with_pin",
        phone: normalizedPhone,
        access_code: accessCodeInput,
        swahiba_id: selected.id,
        nickname: form.nickname || "Anonymous",
        location: form.location || null,
        need: form.need,
        description: form.description || null,
        channel: form.channel || null,
      },
    });

    if (error) {
      const message = await getFunctionErrorMessage(error, "Failed to create request.");
      setOnboardError(message);
      setOnboardLoading(false);
      return;
    }

    setActiveRequest(data?.request || null);
    setRequestSent(true);
    setOnboardLoading(false);
  }

  async function loadUserChatHistory(phone, accessCode, { silent = false } = {}) {
    if (!silent) {
      setUserChatLoading(true);
      setUserChatError("");
      setUserChatMessages([]);
    }

    const normalizedPhone = normalizePhoneInput(phone);
    const { data, error } = await supabase.functions.invoke("user-request-chat", {
      body: { phone: normalizedPhone, access_code: accessCode, action: "history" },
    });

    if (error) {
      if (!silent) {
        const message = await getFunctionErrorMessage(error, "Failed to load chat.");
        setUserChatError(message);
        setUserChatLoading(false);
      }
      return;
    }

    setUserChatConversationId(data?.conversation_id || null);
    const nextMessages = data?.messages || [];
    setUserChatMessages(nextMessages);
    setChatRequest(data?.request || null);
    if (!chatWidgetOpen) {
      const prevCount = lastMessageCountRef.current;
      if (nextMessages.length > prevCount) {
        setChatUnread(nextMessages.length - prevCount);
      }
    }
    lastMessageCountRef.current = nextMessages.length;
    if (!silent) setUserChatLoading(false);
  }

  useEffect(() => {
    if (!chatPhone || !chatAccessCode) return;
    setChatAccessCodeInput(chatAccessCode);
    lastMessageCountRef.current = 0;
    setChatUnread(0);
    loadUserChatHistory(chatPhone, chatAccessCode);
  }, [chatPhone, chatAccessCode]);

  useEffect(() => {
    if (chatWidgetOpen) {
      setChatUnread(0);
    }
  }, [chatWidgetOpen]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [userChatMessages, userChatConversationId, chatWidgetOpen]);

  useEffect(() => {
    if (!userChatConversationId) {
      if (chatChannelRef.current) {
        supabase.removeChannel(chatChannelRef.current);
        chatChannelRef.current = null;
      }
      return;
    }

    if (chatChannelRef.current) {
      supabase.removeChannel(chatChannelRef.current);
      chatChannelRef.current = null;
    }

    const ch = supabase
      .channel(`request-chat-user:${userChatConversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${userChatConversationId}`,
        },
        (payload) => {
          const msg = payload?.new;
          if (!msg?.id) return;
          setUserChatMessages((prev) =>
            prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
          );
        }
      )
      .subscribe();

    chatChannelRef.current = ch;

    return () => {
      if (chatChannelRef.current) {
        supabase.removeChannel(chatChannelRef.current);
        chatChannelRef.current = null;
      }
    };
  }, [userChatConversationId]);

  useEffect(() => {
    const code = chatAccessCode;
    const phone = chatPhone;
    if (!code || !phone) return;

    if (chatPollRef.current) {
      clearInterval(chatPollRef.current);
      chatPollRef.current = null;
    }

    chatPollRef.current = setInterval(() => {
      loadUserChatHistory(phone, code, { silent: true });
    }, 5000);

    return () => {
      if (chatPollRef.current) {
        clearInterval(chatPollRef.current);
        chatPollRef.current = null;
      }
    };
  }, [chatAccessCode, chatPhone]);

  async function sendUserChatMessage() {
    const text = userChatInput.trim();
    if (!text || !chatAccessCode || !chatPhone) return;
    setUserChatLoading(true);
    setUserChatError("");

    const normalizedPhone = normalizePhoneInput(chatPhone);
    const { data, error } = await supabase.functions.invoke("user-request-chat", {
      body: { phone: normalizedPhone, access_code: chatAccessCode, action: "send", message: text },
    });

    if (error) {
      const message = await getFunctionErrorMessage(error, "Failed to send message.");
      setUserChatError(message);
      setUserChatLoading(false);
      return;
    }

    if (data?.conversation_id && data?.conversation_id !== userChatConversationId) {
      setUserChatConversationId(data.conversation_id);
      setChatRequest((prev) =>
        prev ? { ...prev, conversation_id: data.conversation_id, status: "accepted" } : prev
      );
    }

    if (data?.message) {
      setUserChatMessages((prev) => [...prev, data.message]);
    }
    setUserChatInput("");
    setUserChatLoading(false);
  }

  // (passkey login removed)

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
              <SwahibaCard key={s.id} s={s} t={t} langKey={langKey} onTalk={() => onSelectSwahiba(s)} />
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

            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-600">{t.needHelpTitle}</div>
              <div className="text-xs text-slate-500">{t.needHelpDesc}</div>
              <select
                value={form.need}
                onChange={(e) => setForm({ ...form, need: e.target.value })}
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-amber-300"
              >
                <option value="info">{langKey === "sw" ? "Taarifa" : "Information"}</option>
                <option value="service">{langKey === "sw" ? "Huduma" : "Service"}</option>
                <option value="product">{langKey === "sw" ? "Bidhaa" : "Products"}</option>
              </select>
            </div>

            <textarea
              placeholder={
                langKey === "sw"
                  ? "Eleza unachotaka kuzungumzia"
                  : "Tell us what you want to talk about"
              }
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="min-h-[110px] rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-amber-300"
            />

            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-600">{t.channelTitle}</div>
              <div className="text-xs text-slate-500">{t.channelDesc}</div>
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
            </div>

            <input
              placeholder={t.phoneLabel}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-amber-300"
            />

            <input
              placeholder={t.pinLabel}
              value={accessCodeInput}
              onChange={(e) => setAccessCodeInput(e.target.value)}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-amber-300"
            />
            <button
              onClick={submitRequest}
              disabled={requestSent || onboardLoading || accessCodeInput.length < 4}
              className="mt-2 rounded-2xl bg-amber-500 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-amber-600 disabled:bg-slate-300"
              type="button"
            >
              {t.saveAccessCode}
            </button>
          </div>

          {accessCodeSet && !requestSent ? (
            <div
              ref={finishRequestRef}
              className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 space-y-3"
            >
              <div className="text-sm font-semibold">{t.finishRequest}</div>
              <button
                type="button"
                disabled={onboardLoading}
                onClick={createRequestWithPin}
                className="w-full rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-slate-300"
              >
                {t.submitRequest}
              </button>
              <div className="text-xs text-slate-500">{t.rememberAccessCode}</div>
            </div>
          ) : null}

          {onboardError ? (
            <div className="mt-4 text-sm text-red-600">{onboardError}</div>
          ) : null}

          {requestSent ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {t.rememberAccessCode}
            </div>
          ) : null}
        </Modal>
      )}

      <div className="fixed bottom-5 right-5 z-[80]">
        {chatWidgetOpen ? (
          <div className="w-[320px] sm:w-[360px] rounded-3xl border border-slate-200 bg-white shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                Chat
                {chatUnread > 0 ? (
                  <span className="inline-flex min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[11px] font-bold items-center justify-center">
                    {chatUnread > 9 ? "9+" : chatUnread}
                  </span>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setChatWidgetOpen(false)}
                className="text-xs font-semibold text-slate-500 hover:text-slate-700"
              >
                Close
              </button>
            </div>

            {!chatAccessCode || !chatPhone ? (
              <div className="p-4 space-y-3">
                <div className="text-sm text-slate-600">{t.accessChat}</div>
                <input
                  value={chatPhoneInput}
                  onChange={(e) => setChatPhoneInput(e.target.value)}
                  placeholder={t.phoneLabel}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-amber-300"
                />
                <input
                  value={chatAccessCodeInput}
                  onChange={(e) => setChatAccessCodeInput(e.target.value)}
                  placeholder={t.pinLabel}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-amber-300"
                />
                <button
                  type="button"
                  onClick={() => {
                    const phone = normalizePhoneInput(chatPhoneInput);
                    const pin = chatAccessCodeInput.trim();
                    if (!phone || !pin) return;
                    setChatPhone(phone);
                    setChatAccessCode(pin);
                    loadUserChatHistory(phone, pin);
                  }}
                  className="w-full rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600"
                >
                  {t.accessChat}
                </button>
              </div>
            ) : (
              <>
                <div className="px-4 py-2 text-xs text-slate-500 border-b border-slate-200">
                  {chatRequest?.need ? `Topic: ${chatRequest.need}` : "Chat"}
                </div>
                <div className="max-h-64 overflow-auto p-4 space-y-3">
                  {userChatError ? (
                    <div className="text-sm text-red-600">{userChatError}</div>
                  ) : userChatLoading && userChatMessages.length === 0 ? (
                    <div className="text-sm text-slate-500">Loading chat…</div>
                  ) : userChatMessages.length === 0 ? (
                    <div className="text-sm text-slate-500">No messages yet.</div>
                  ) : (
                    userChatMessages.map((m) => {
                      const isMe = m.sender_id === chatRequest?.created_by;
                      return (
                        <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                          <div
                            className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                              isMe ? "bg-amber-500 text-white" : "bg-slate-100 text-slate-900"
                            }`}
                          >
                            <div className="whitespace-pre-wrap">{m.body}</div>
                            <div className={`mt-1 text-[10px] ${isMe ? "text-amber-100" : "text-slate-500"}`}>
                              {m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={chatEndRef} />
                </div>

                <div className="border-t border-slate-200 p-3">
                  <div className="flex items-center gap-2">
                    <input
                      value={userChatInput}
                      onChange={(e) => setUserChatInput(e.target.value)}
                      placeholder="Type a message…"
                      disabled={userChatLoading}
                      className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-amber-300 disabled:bg-slate-50"
                    />
                    <button
                      onClick={sendUserChatMessage}
                      disabled={userChatLoading || !userChatInput.trim()}
                      className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:bg-slate-300"
                      type="button"
                    >
                      Send
                    </button>
                  </div>
                  <div className="mt-2 flex justify-between text-[11px] text-slate-500">
                    <span>{`${chatPhone} • ${t.pinLabel}`}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setChatAccessCode("");
                        setChatAccessCodeInput("");
                        setChatPhone("");
                        setChatPhoneInput("");
                        setChatRequest(null);
                        setUserChatMessages([]);
                        setUserChatConversationId(null);
                        setUserChatError("");
                        setUserChatInput("");
                        if (chatChannelRef.current) {
                          supabase.removeChannel(chatChannelRef.current);
                          chatChannelRef.current = null;
                        }
                      }}
                      className="font-semibold text-slate-600 hover:text-slate-800"
                    >
                      Switch number
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setChatWidgetOpen(true)}
            className="relative rounded-full bg-amber-500 text-white px-4 py-3 shadow-lg hover:bg-amber-600"
          >
            Chat
            {chatUnread > 0 && (
              <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[11px] font-bold flex items-center justify-center">
                {chatUnread > 9 ? "9+" : chatUnread}
              </span>
            )}
          </button>
        )}
      </div>
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
