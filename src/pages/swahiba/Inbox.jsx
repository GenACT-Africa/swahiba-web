import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function Inbox() {
  const [initialLoading, setInitialLoading] = useState(true);

  const [availability, setAvailability] = useState("available");

  const [requests, setRequests] = useState([]);

  const [active, setActive] = useState(null); // request id
  const [search, setSearch] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState("");
  const [chatMessages, setChatMessages] = useState([]);
  const [chatConversationId, setChatConversationId] = useState(null);
  const [chatInput, setChatInput] = useState("");
  const chatChannelRef = useRef(null);
  const chatPollRef = useRef(null);
  const chatEndRef = useRef(null);

  const meRef = useRef(null);
  const startedRef = useRef(false);
  const channelRef = useRef(null);

  // snapshots to avoid setting state when nothing changed (prevents blinking)
  const snapshotRef = useRef({
    availability: null,
    requestsKey: "",
  });

  function makeKey(list, idField = "id", tsField = "updated_at") {
    return (list || [])
      .map((x) => `${x?.[idField]}:${x?.[tsField] || x?.created_at || ""}`)
      .join("|");
  }

  async function loadOnce() {
    const { data: auth } = await supabase.auth.getUser();
    const me = auth?.user;
    if (!me) {
      setInitialLoading(false);
      return null;
    }
    meRef.current = me;

    // availability (read only)
    const { data: profile } = await supabase
      .from("profiles")
      .select("availability")
      .eq("id", me.id)
      .maybeSingle();

    const avail = profile?.availability || "available";
    if (snapshotRef.current.availability !== avail) {
      snapshotRef.current.availability = avail;
      setAvailability(avail);
    }

    // requests
    const { data: reqRes, error: reqErr } = await supabase.functions.invoke(
      "requests-inbox",
      { body: {} }
    );

    if (reqErr) console.error(reqErr);

    const reqList = reqRes?.data || [];
    const requestsKey = makeKey(reqList, "id", "updated_at");
    if (snapshotRef.current.requestsKey !== requestsKey) {
      snapshotRef.current.requestsKey = requestsKey;
      setRequests(reqList);
    }

    // keep active stable
    setActive((prev) => {
      if (!prev && reqList.length) return reqList[0].id;
      if (prev && !reqList.find((x) => x.id === prev)) {
        return reqList[0] ? reqList[0].id : null;
      }
      return prev || null;
    });

    setInitialLoading(false);
    return me;
  }

  // ✅ init once (prevents StrictMode double effect issues)
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    let cancelled = false;

    (async () => {
      const me = await loadOnce();
      if (cancelled || !me) return;

      // realtime only (no polling)
    const ch = supabase
      .channel(`swahiba-unified-inbox:${me.id}`)
      .on(
        "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "requests",
            filter: `swahiba_id=eq.${me.id}`,
          },
          () => loadOnce()
        )
        .subscribe();

      channelRef.current = ch;
    })();

    return () => {
      cancelled = true;
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, []);

  // ✅ optional: ping last_seen_at quietly every 60s (NOT inside load)
  useEffect(() => {
    const t = setInterval(async () => {
      const me = meRef.current;
      if (!me) return;
      await supabase
        .from("profiles")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", me.id);
    }, 60000);

    return () => clearInterval(t);
  }, []);

  async function toggleAvailability() {
    const next =
      availability === "available"
        ? "busy"
        : availability === "busy"
        ? "offline"
        : "available";

    setAvailability(next);
    snapshotRef.current.availability = next;

    const me = meRef.current;
    if (!me) return;

    const { error } = await supabase
      .from("profiles")
      .update({ availability: next, last_seen_at: new Date().toISOString() })
      .eq("id", me.id);

    if (error) console.error(error);
  }

  async function closeRequest(id) {
    const { error } = await supabase.from("requests").update({ status: "closed" }).eq("id", id);
    if (error) console.error(error);
    await loadOnce();
  }

  const items = useMemo(() => {
    const all = buildItems(requests);
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter((x) => {
      const hay = `${x.title || ""} ${x.subtitle || ""} ${x.meta || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [requests, search]);

  const activeItem = useMemo(() => {
    if (!active) return null;
    return items.find((x) => x.id === active) || null;
  }, [active, items]);

  async function loadChatHistory(requestId, { silent = false } = {}) {
    if (!silent) {
      setChatLoading(true);
      setChatError("");
      setChatMessages([]);
    }

    const { data, error } = await supabase.functions.invoke("request-chat", {
      body: { request_id: requestId, action: "history" },
    });

    if (error) {
      if (!silent) {
        setChatError(error.message || "Failed to load chat.");
        setChatLoading(false);
      }
      return;
    }

    setChatConversationId(data?.conversation_id || null);
    setChatMessages(data?.messages || []);
    if (!silent) setChatLoading(false);
  }

  useEffect(() => {
    const request = activeItem?.raw;
    if (!request) {
      setChatMessages([]);
      setChatConversationId(null);
      setChatError("");
      setChatLoading(false);
      setChatInput("");
      if (chatChannelRef.current) {
        supabase.removeChannel(chatChannelRef.current);
        chatChannelRef.current = null;
      }
      if (chatPollRef.current) {
        clearInterval(chatPollRef.current);
        chatPollRef.current = null;
      }
      return;
    }

    setChatConversationId(request.conversation_id || null);
    loadChatHistory(request.id);

    if (chatPollRef.current) {
      clearInterval(chatPollRef.current);
      chatPollRef.current = null;
    }
    chatPollRef.current = setInterval(() => {
      loadChatHistory(request.id, { silent: true });
    }, 5000);

    return () => {
      if (chatPollRef.current) {
        clearInterval(chatPollRef.current);
        chatPollRef.current = null;
      }
    };
  }, [activeItem?.id]);

  useEffect(() => {
    if (!chatConversationId) {
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
      .channel(`request-chat:${chatConversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${chatConversationId}`,
        },
        (payload) => {
          const msg = payload?.new;
          if (!msg?.id) return;
          setChatMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
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
  }, [chatConversationId]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [chatMessages, chatConversationId]);

  async function sendChatMessage(request) {
    const text = chatInput.trim();
    if (!text) return;
    setChatLoading(true);
    setChatError("");

    const { data, error } = await supabase.functions.invoke("request-chat", {
      body: { request_id: request.id, action: "send", message: text },
    });

    if (error) {
      setChatError(error.message || "Failed to send message.");
      setChatLoading(false);
      return;
    }

    if (data?.conversation_id && data?.conversation_id !== chatConversationId) {
      setChatConversationId(data.conversation_id);
      setRequests((prev) =>
        prev.map((r) =>
          r.id === request.id ? { ...r, conversation_id: data.conversation_id, status: "accepted" } : r
        )
      );
    }
    setRequests((prev) =>
      prev.map((r) => (r.id === request.id ? { ...r, status: "accepted" } : r))
    );

    if (data?.message) {
      setChatMessages((prev) => [...prev, data.message]);
    }
    setChatInput("");
    setChatLoading(false);
  }

  if (initialLoading) return <div className="p-4">Loading inbox…</div>;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[78vh]">
        {/* LEFT */}
        <div className="lg:col-span-4 border border-slate-200 rounded-2xl bg-white overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <div className="min-w-0">
              <div className="font-extrabold text-slate-900">Inbox</div>
              <div className="text-xs text-slate-500">Requests</div>
            </div>

            <button
              onClick={toggleAvailability}
              className={`shrink-0 text-xs font-semibold rounded-full px-3 py-1 border ${
                availability === "available"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : availability === "busy"
                  ? "bg-amber-50 text-amber-800 border-amber-200"
                  : "bg-slate-50 text-slate-600 border-slate-200"
              }`}
              type="button"
            >
              {availability}
            </button>
          </div>

          <div className="p-3 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search…"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-amber-300"
              />
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            {items.length === 0 ? (
              <div className="p-4 text-sm text-slate-600">No requests yet.</div>
            ) : (
              items.map((x) => {
                const isActive = active === x.id;
                return (
                  <button
                    key={x.id}
                    onClick={() => setActive(x.id)}
                    className={`w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-slate-50 ${
                      isActive ? "bg-slate-50" : "bg-white"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-extrabold text-slate-900">{x.title}</div>
                        <div className="mt-1 truncate text-xs text-slate-600">{x.subtitle}</div>
                      </div>

                      <div className="shrink-0 text-[11px] text-slate-500">{formatTinyTime(x.time)}</div>
                    </div>

                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className="truncate text-[11px] text-slate-500">{x.meta}</div>
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold border border-slate-200 bg-slate-50 text-slate-700">
                        {x.status}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT */}
        <div className="lg:col-span-8 border border-slate-200 rounded-2xl bg-white overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <div className="min-w-0">
              <div className="font-extrabold text-slate-900">
                {activeItem ? activeItem.title : "Select an item"}
              </div>
              <div className="text-xs text-slate-600 truncate">
                {activeItem ? activeItem.subtitle : "Choose a request from the left."}
              </div>
            </div>

            {activeItem ? (
              <button
                onClick={() => closeRequest(activeItem.id)}
                className="shrink-0 rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700"
                type="button"
              >
                Close request
              </button>
            ) : null}
          </div>

          <div className="flex-1 overflow-auto">
            {!activeItem ? (
              <div className="h-full flex items-center justify-center text-sm text-slate-500">
                Select a request.
              </div>
            ) : (
              <RequestDetails
                request={activeItem.raw}
                meId={meRef.current?.id || null}
                onClose={() => closeRequest(activeItem.id)}
                chat={{
                  loading: chatLoading,
                  error: chatError,
                  messages: chatMessages,
                  conversationId: chatConversationId,
                  input: chatInput,
                  setInput: setChatInput,
                  onSend: () => sendChatMessage(activeItem.raw),
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* helpers */

function buildItems(requests = []) {
  const requestItems = (requests || []).map((r) => ({
    id: r.id,
    status: r.status || "pending",
    time: r.updated_at || r.created_at,
    title: r.nickname ? r.nickname : "Anonymous",
    subtitle: r.need ? `Needs help: ${r.need}` : "Support request",
    meta: [r.channel ? `Via: ${r.channel}` : null, r.location ? `From: ${r.location}` : null]
      .filter(Boolean)
      .join(" • "),
    raw: r,
  }));

  return requestItems.sort((a, b) => {
    const ta = a.time ? new Date(a.time).getTime() : 0;
    const tb = b.time ? new Date(b.time).getTime() : 0;
    return tb - ta;
  });
}

function formatTinyTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();

  if (sameDay) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function RequestDetails({ request, onClose, meId, chat }) {
  const chatEndRef = useRef(null);
  const canChat = Boolean(request?.created_by);
  const isSending = chat?.loading;
  const messages = chat?.messages || [];

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages.length]);

  return (
    <div className="h-full overflow-auto p-5">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="text-xs font-bold text-slate-600">REQUEST DETAILS</div>

        <div className="mt-3 grid gap-3">
          <Row label="Nickname" value={request?.nickname || "Anonymous"} />
          <Row label="Need" value={request?.need || "—"} />
          <Row label="Status" value={request?.status || "pending"} />
          <Row label="Channel" value={request?.channel || "—"} />
          <Row label="Phone" value={request?.phone || "—"} />
          <Row label="Location" value={request?.location || "—"} />
          <Row label="Created" value={request?.created_at ? new Date(request.created_at).toLocaleString() : "—"} />
        </div>

        <div className="mt-4">
          <div className="text-xs font-bold text-slate-600">Description</div>
          <div className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{request?.description || "—"}</div>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200">
          <div className="text-xs font-bold text-slate-600">CHAT</div>
          {!canChat ? (
            <div className="mt-1 text-xs text-slate-500">
              No user account attached to this request. Use the phone or channel to respond.
            </div>
          ) : null}
        </div>

        <div className="p-4 space-y-3">
          {chat?.error ? (
            <div className="text-sm text-red-600">{chat.error}</div>
          ) : chat?.loading && messages.length === 0 ? (
            <div className="text-sm text-slate-500">Loading chat…</div>
          ) : messages.length === 0 ? (
            <div className="text-sm text-slate-500">No messages yet.</div>
          ) : (
            messages.map((m) => {
              const isMe = m.sender_id === meId;
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
              value={chat?.input || ""}
              onChange={(e) => chat?.setInput?.(e.target.value)}
              placeholder={canChat ? "Type a message…" : "Chat unavailable for this request"}
              disabled={!canChat || isSending}
              className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-amber-300 disabled:bg-slate-50"
            />
            <button
              onClick={chat?.onSend}
              disabled={!canChat || isSending || !chat?.input?.trim()}
              className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:bg-slate-300"
              type="button"
            >
              Send
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          onClick={onClose}
          className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
          type="button"
        >
          Close request
        </button>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="grid grid-cols-12 gap-2 items-start">
      <div className="col-span-4 text-xs font-bold text-slate-600">{label}</div>
      <div className="col-span-8 text-sm text-slate-900">{value}</div>
    </div>
  );
}
