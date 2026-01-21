import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

/**
 * AdminPanel.jsx (Improved + Packs Manager)
 *
 * Adds:
 * ✅ "Packs" button between Products and Resources
 * ✅ Packs Manager modal:
 *   - View packs (by type, sold/not sold)
 *   - Create available packs (generates Pack No via RPC generate_pack_no(), then inserts pack)
 *   - Edit pack contents (add/remove products, update qty, mark is_free)
 *
 * Assumed tables:
 * - profiles (id, role)
 * - cases
 * - follow_up_tasks
 * - products (id, product_name, price_tzs, image_url/image_path, is_active)
 * - packs (id, pack_no, pack_type, user_id, is_active, created_at, updated_at)
 * - pack_items (id, pack_id, product_id, qty, is_free, created_at, updated_at)
 *
 * Notes:
 * - "Sold" is computed as packs.user_id != null (no extra column needed)
 * - "Need refill" can be added later as a DB field; currently shown as "—" (placeholder)
 */

const NOTE_TABLE_CANDIDATES = ["interactions", "case_notes"];

const QUICK_FILTERS = [
  { key: "all", label: "All" },
  { key: "new", label: "New" },
  { key: "active", label: "Active" },
  { key: "overdue", label: "Overdue" },
  { key: "referred", label: "Referred" },
  { key: "closed", label: "Closed" },
];

const SORTS = [
  { key: "updated_desc", label: "Latest updated" },
  { key: "risk_desc", label: "Highest risk" },
  { key: "created_desc", label: "Newest created" },
  { key: "overdue_first", label: "Overdue first" },
];

const PACK_TYPES = [
  { key: "male_pack", label: "Male Pack" },
  { key: "female_pack", label: "Female Pack" },
  { key: "couple_pack", label: "Couple Pack" },
];

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
function fmtDateTime(v) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}
function daysOverdue(dueAt) {
  if (!dueAt) return 0;
  const ms = Date.now() - new Date(dueAt).getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}
function riskRank(risk) {
  const r = String(risk || "").toLowerCase();
  if (r === "high") return 3;
  if (r === "medium") return 2;
  return 1;
}
function tzs(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return `${n.toLocaleString()} TZS`;
}

/** Try tables until one works */
async function tryTables(candidates, fn) {
  let lastErr = null;
  for (const name of candidates) {
    // eslint-disable-next-line no-await-in-loop
    const { ok, data, error } = await fn(name);
    if (ok) return { table: name, data, error: null };
    lastErr = error;
  }
  return { table: null, data: null, error: lastErr || new Error("No table worked") };
}

/** Safe count helper */
async function safeCount(table, builderFn) {
  try {
    const q = builderFn(supabase.from(table).select("id", { count: "exact", head: true }));
    const { count, error } = await q;
    if (error) throw error;
    return typeof count === "number" ? count : null;
  } catch {
    return null;
  }
}

/** Admin check that works for email+password and OAuth */
async function isAdminSafe(user) {
  if (!user) return false;

  // 1) Optional RPC (best if you created it)
  try {
    const { data, error } = await supabase.rpc("is_admin");
    if (!error && typeof data === "boolean") return data;
  } catch {
    // ignore
  }

  // 2) Profiles role (recommended)
  try {
    const { data, error } = await supabase.from("profiles").select("role, is_admin").eq("id", user.id).single();
    if (!error && data) {
      const role = String(data.role || "").toLowerCase();
      const adminFlag = data.is_admin === true;
      return adminFlag || role === "admin";
    }
  } catch {
    // ignore
  }

  // 3) Metadata fallback (least reliable)
  const metaRole = String(
    user.user_metadata?.role ||
      user.app_metadata?.role ||
      user.user_metadata?.user_role ||
      user.app_metadata?.user_role ||
      ""
  ).toLowerCase();

  return metaRole === "admin";
}

export default function AdminPanel() {
  const navigate = useNavigate();

  // Auth / role
  const [me, setMe] = useState(null);
  const [roleChecked, setRoleChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Dashboard loading / errors
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // Core data
  const [cases, setCases] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [noteTable, setNoteTable] = useState(null);
  const [notes, setNotes] = useState([]);

  // Health metrics
  const [health, setHealth] = useState({
    referralsActive: null,
    productsActive: null,
    productsMissingImage: null,
    resourcesActive: null,
    resourcesMissingLang: null,
  });

  // UI state
  const [lastRefresh, setLastRefresh] = useState(null);
  const [globalQ, setGlobalQ] = useState("");
  const [digestTab, setDigestTab] = useState("today"); // today | week | notes
  const [caseFilter, setCaseFilter] = useState("all");
  const [sortKey, setSortKey] = useState("updated_desc");

  // Packs Manager UI
  const [showPacks, setShowPacks] = useState(false);

  // --- Track auth state ---
  useEffect(() => {
    let alive = true;

    (async () => {
      setErr("");
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!alive) return;

        const u = data?.session?.user ?? null;
        setMe(u);
      } catch (e) {
        if (!alive) return;
        setErr(e?.message || String(e));
        setMe(null);
      }
    })();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setMe(session?.user ?? null);
    });

    return () => {
      alive = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  // --- Check admin role whenever user changes ---
  useEffect(() => {
    let alive = true;

    (async () => {
      setRoleChecked(false);
      setIsAdmin(false);

      if (!me) {
        setRoleChecked(true);
        return;
      }

      const ok = await isAdminSafe(me);
      if (!alive) return;

      setIsAdmin(Boolean(ok));
      setRoleChecked(true);
    })();

    return () => {
      alive = false;
    };
  }, [me?.id]);

  async function signOut() {
    await supabase.auth.signOut();
    navigate("/admin/login", { replace: true });
  }

  async function loadAll() {
    setErr("");
    setLoading(true);

    try {
      const [casesRes, tasksRes] = await Promise.all([
        supabase
          .from("cases")
          .select(
            "id, case_code, nickname, location, risk_level, tags, status, outcome_status, last_contact_at, created_at, updated_at"
          )
          .order("updated_at", { ascending: false }),

        supabase.from("follow_up_tasks").select("id, case_id, title, due_at, status, created_at, completed_at").order("due_at", {
          ascending: true,
        }),
      ]);

      if (casesRes.error) throw casesRes.error;
      const taskRows = tasksRes.error ? [] : tasksRes.data ?? [];

      const notesRes = await tryTables(NOTE_TABLE_CANDIDATES, async (table) => {
        const q =
          table === "interactions"
            ? supabase.from(table).select("id, case_id, note, created_at, author_role").order("created_at", { ascending: false }).limit(10)
            : supabase.from(table).select("id, case_id, note, created_at").order("created_at", { ascending: false }).limit(10);

        const { data, error } = await q;
        if (error) return { ok: false, data: null, error };
        return { ok: true, data: data ?? [], error: null };
      });

      setNoteTable(notesRes.table);
      setNotes(notesRes.data ?? []);

      const [referralsActive, productsActive, productsMissingImage, resourcesActive, resourcesMissingLang] = await Promise.all([
        safeCount("referral_services", (q) => q.eq("is_active", true)),
        safeCount("products", (q) => q.eq("is_active", true)),
        safeCount("products", (q) => q.eq("is_active", true).or("image_url.is.null,image_path.is.null")),
        safeCount("resources", (q) => q.eq("is_active", true)),
        safeCount("resources", (q) => q.eq("is_active", true).or("title_sw.is.null,title_en.is.null")),
      ]);

      setHealth({
        referralsActive,
        productsActive,
        productsMissingImage,
        resourcesActive,
        resourcesMissingLang,
      });

      setCases(casesRes.data ?? []);
      setTasks(taskRows);
      setLastRefresh(new Date().toISOString());
    } catch (e) {
      console.error(e);
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (roleChecked && isAdmin) loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleChecked, isAdmin]);

  // ---- Digest computations ----
  const digest = useMemo(() => {
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const since24h = Date.now() - 24 * 60 * 60 * 1000;

    const openTasks = (tasks || []).filter((t) => (t.status || "") === "open");

    const overdueTasks = openTasks
      .filter((t) => t.due_at && new Date(t.due_at) < now)
      .sort((a, b) => new Date(a.due_at) - new Date(b.due_at));

    const dueTodayTasks = openTasks
      .filter((t) => {
        if (!t.due_at) return false;
        const d = new Date(t.due_at);
        return d >= todayStart && d <= todayEnd;
      })
      .sort((a, b) => new Date(a.due_at) - new Date(b.due_at));

    const overdueCaseIds = new Set(overdueTasks.map((t) => t.case_id));

    const openCases = (cases || []).filter((c) => c.status !== "closed");

    const new24h = (cases || []).filter((c) => {
      const ts = new Date(c.created_at).getTime();
      return Number.isFinite(ts) && ts >= since24h;
    });

    const referredToday = (cases || []).filter((c) => {
      if (c.outcome_status !== "referred") return false;
      const ts = new Date(c.updated_at || c.created_at).getTime();
      return Number.isFinite(ts) && ts >= todayStart.getTime() && ts <= todayEnd.getTime();
    });

    const resolvedToday = (cases || []).filter((c) => {
      if (c.outcome_status !== "resolved") return false;
      const ts = new Date(c.updated_at || c.created_at).getTime();
      return Number.isFinite(ts) && ts >= todayStart.getTime() && ts <= todayEnd.getTime();
    });

    const staleCases = openCases
      .filter((c) => {
        const last = c.last_contact_at ? new Date(c.last_contact_at).getTime() : 0;
        if (!last) return true;
        return Date.now() - last > 7 * 24 * 60 * 60 * 1000;
      })
      .sort((a, b) => riskRank(b.risk_level) - riskRank(a.risk_level))
      .slice(0, 5);

    const caseById = new Map((cases || []).map((c) => [c.id, c]));

    const topOverdue = overdueTasks
      .map((t) => ({ task: t, caseRow: caseById.get(t.case_id) }))
      .filter((x) => x.caseRow && x.caseRow.status !== "closed")
      .slice(0, 5);

    const topDueToday = dueTodayTasks
      .map((t) => ({ task: t, caseRow: caseById.get(t.case_id) }))
      .filter((x) => x.caseRow && x.caseRow.status !== "closed")
      .slice(0, 5);

    return {
      openCasesCount: openCases.length,
      overdueCount: overdueCaseIds.size,
      new24hCount: new24h.length,
      referredTodayCount: referredToday.length,
      resolvedTodayCount: resolvedToday.length,
      topOverdue,
      topDueToday,
      staleCases,
    };
  }, [cases, tasks]);

  // ---- Week counts ----
  const week = useMemo(() => {
    const now = new Date();
    const start = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6));
    const days = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });

    const dayKey = (d) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    const buckets = new Map(days.map((d) => [dayKey(d), { day: d, opened: 0, closed: 0, referred: 0, resolved: 0 }]));

    (cases || []).forEach((c) => {
      const created = c.created_at ? new Date(c.created_at) : null;
      if (created) {
        const k = dayKey(created);
        if (buckets.has(k)) buckets.get(k).opened += 1;
      }
      const updated = c.updated_at ? new Date(c.updated_at) : null;
      if (updated) {
        const k = dayKey(updated);
        if (!buckets.has(k)) return;
        if (c.status === "closed") buckets.get(k).closed += 1;
        if (c.outcome_status === "referred") buckets.get(k).referred += 1;
        if (c.outcome_status === "resolved") buckets.get(k).resolved += 1;
      }
    });

    return Array.from(buckets.values());
  }, [cases]);

  const overdueCaseIds = useMemo(() => {
    const now = new Date();
    const openTasks = (tasks || []).filter((t) => (t.status || "") === "open");
    return new Set(openTasks.filter((t) => t.due_at && new Date(t.due_at) < now).map((t) => t.case_id));
  }, [tasks]);

  const inboxRows = useMemo(() => {
    const s = globalQ.trim().toLowerCase();

    let list = (cases || []).filter((c) => {
      const matchesQ =
        !s ||
        (c.case_code || "").toLowerCase().includes(s) ||
        (c.nickname || "").toLowerCase().includes(s) ||
        (c.location || "").toLowerCase().includes(s) ||
        (c.tags || []).join(" ").toLowerCase().includes(s);

      if (!matchesQ) return false;

      if (caseFilter === "all") return true;
      if (caseFilter === "new") {
        const ts = new Date(c.created_at).getTime();
        return Number.isFinite(ts) && ts >= Date.now() - 24 * 60 * 60 * 1000;
      }
      if (caseFilter === "overdue") return c.status !== "closed" && overdueCaseIds.has(c.id);
      if (caseFilter === "referred") return c.outcome_status === "referred" && c.status !== "closed";
      if (caseFilter === "active") return c.status !== "closed";
      return c.status === caseFilter;
    });

    const sorter = (a, b) => {
      if (sortKey === "updated_desc") return new Date(b.updated_at) - new Date(a.updated_at);
      if (sortKey === "created_desc") return new Date(b.created_at) - new Date(a.created_at);
      if (sortKey === "risk_desc") return riskRank(b.risk_level) - riskRank(a.risk_level);
      if (sortKey === "overdue_first") {
        const ao = overdueCaseIds.has(a.id) ? 1 : 0;
        const bo = overdueCaseIds.has(b.id) ? 1 : 0;
        if (bo !== ao) return bo - ao;
        return new Date(b.updated_at) - new Date(a.updated_at);
      }
      return 0;
    };

    return list.slice().sort(sorter);
  }, [cases, globalQ, caseFilter, sortKey, overdueCaseIds]);

  /** ---------------- Guards ---------------- */
  if (!me) {
    return (
      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-[1200px] px-4 py-10">
          <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
          <p className="mt-2 text-sm text-slate-600">Please log in first.</p>
          <button
            onClick={() => navigate("/admin/login")}
            className="mt-6 rounded-2xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Go to admin login
          </button>
        </div>
      </div>
    );
  }

  if (!roleChecked) {
    return (
      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-[1200px] px-4 py-10 text-sm text-slate-600">Checking admin access…</div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-[1200px] px-4 py-10">
          <h1 className="text-2xl font-bold text-slate-900">Not authorized</h1>
          <p className="mt-2 text-sm text-slate-600">Your account does not have admin access.</p>
          <div className="mt-6 flex flex-wrap gap-2">
            <button
              onClick={() => navigate("/")}
              className="rounded-2xl border border-slate-200 px-5 py-2 text-sm font-semibold hover:bg-slate-50"
            >
              Back home
            </button>
            <button
              onClick={signOut}
              className="rounded-2xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  /** ---------------- UI ---------------- */
  return (
    <div className="min-h-screen bg-white">
      {/* TOP STRIP */}
      <div className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto max-w-[1200px] px-4 py-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xl font-extrabold text-slate-900">Admin Panel</div>
              <div className="text-xs text-slate-500">
                Signed in as <span className="font-semibold">{me.email}</span>
                <span className="mx-2 text-slate-300">•</span>
                Last refresh: <span className="font-semibold">{lastRefresh ? fmtDateTime(lastRefresh) : "—"}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={loadAll}
                disabled={loading}
                className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60"
              >
                {loading ? "Refreshing…" : "Refresh"}
              </button>

              <button
                onClick={() => navigate("/admin/referrals")}
                className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
              >
                Referrals
              </button>

              <button
                onClick={() => navigate("/admin/products")}
                className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
              >
                Products
              </button>

              {/* ✅ Packs button (between Products and Resources) */}
              <button
                onClick={() => setShowPacks(true)}
                className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
              >
                Packs
              </button>

              <button
                onClick={() => navigate("/admin/resources")}
                className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
              >
                Resources
              </button>

              <button
                onClick={() => navigate("/swahiba/cases")}
                className="rounded-2xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600"
              >
                Swahiba Cases
              </button>

              <button
                onClick={signOut}
                className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Sign out
              </button>
            </div>
          </div>

          <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto] md:items-center">
            <input
              value={globalQ}
              onChange={(e) => setGlobalQ(e.target.value)}
              placeholder="Search cases (code, nickname, location, tags)…"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400"
            />

            <div className="flex items-center gap-2 justify-start md:justify-end">
              <label className="text-xs font-bold text-slate-500">Sort</label>
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value)}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400"
              >
                {SORTS.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {QUICK_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setCaseFilter(f.key)}
                className={[
                  "rounded-2xl border px-4 py-2 text-sm font-semibold",
                  caseFilter === f.key
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                ].join(" ")}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-[1200px] px-4 py-10">
        {err && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{err}</div>
        )}

        {/* SNAPSHOT */}
        <section className="rounded-3xl border border-slate-200 bg-white p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-4xl tracking-tight" style={{ fontFamily: "ui-serif, Georgia, Cambria, serif" }}>
                Control Center
              </h1>
              <div className="mt-2 text-sm text-slate-600">System-wide view (all cases, all tasks, and content health).</div>
            </div>
            <div className="text-xs text-slate-500">
              Status: <span className="font-semibold">{loading ? "loading…" : "ready"}</span>
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Stat label="Open cases" value={digest.openCasesCount} />
            <Stat label="Overdue follow-ups" value={digest.overdueCount} />
            <Stat label="New cases (24h)" value={digest.new24hCount} />
            <Stat label="Referred today" value={digest.referredTodayCount} />
            <Stat label="Resolved today" value={digest.resolvedTodayCount} />
          </div>
        </section>

        {/* DIGEST */}
        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-lg font-bold text-slate-900">Daily digest</div>
              <div className="mt-1 text-sm text-slate-600">Your command center.</div>
            </div>

            <div className="flex flex-wrap gap-2">
              <TabPill active={digestTab === "today"} onClick={() => setDigestTab("today")}>
                Today
              </TabPill>
              <TabPill active={digestTab === "week"} onClick={() => setDigestTab("week")}>
                This week
              </TabPill>
              <TabPill active={digestTab === "notes"} onClick={() => setDigestTab("notes")}>
                Notes
              </TabPill>
            </div>
          </div>

          {digestTab === "today" && (
            <div className="mt-6 grid gap-6 lg:grid-cols-3">
              <DigestList
                title="Overdue follow-ups"
                subtitle="Oldest open tasks past due"
                rows={digest.topOverdue}
                badge="overdue"
                onOpen={(id) => navigate(`/swahiba/cases/${id}`)}
              />
              <DigestList
                title="Due today"
                subtitle="Open tasks due today"
                rows={digest.topDueToday}
                badge="today"
                onOpen={(id) => navigate(`/swahiba/cases/${id}`)}
              />
              <StaleList
                title="Stale cases"
                subtitle="No contact in >7 days (or never)"
                rows={digest.staleCases}
                onOpen={(id) => navigate(`/swahiba/cases/${id}`)}
              />
            </div>
          )}

          {digestTab === "week" && (
            <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-5">
              <div className="text-sm font-bold text-slate-900">Last 7 days</div>
              <div className="mt-1 text-xs text-slate-600">Opened / Closed / Referred / Resolved (by day)</div>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="text-left text-xs font-bold text-slate-500">
                      <th className="py-2 pr-4">Day</th>
                      <th className="py-2 pr-4">Opened</th>
                      <th className="py-2 pr-4">Closed</th>
                      <th className="py-2 pr-4">Referred</th>
                      <th className="py-2 pr-4">Resolved</th>
                    </tr>
                  </thead>
                  <tbody>
                    {week.map((d) => (
                      <tr key={d.day.toISOString()} className="border-t border-slate-200">
                        <td className="py-3 pr-4 font-semibold text-slate-900">
                          {d.day.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                        </td>
                        <td className="py-3 pr-4">{d.opened}</td>
                        <td className="py-3 pr-4">{d.closed}</td>
                        <td className="py-3 pr-4">{d.referred}</td>
                        <td className="py-3 pr-4">{d.resolved}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="mt-3 text-xs text-slate-500">Note: these counts use created_at and updated_at as proxies (MVP).</p>
            </div>
          )}

          {digestTab === "notes" && (
            <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-5">
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-sm font-bold text-slate-900">Latest interaction notes</div>
                  <div className="mt-1 text-xs text-slate-600">Most recent 10 notes across all cases.</div>
                </div>
                <div className="text-xs text-slate-500">
                  Table: <span className="font-semibold">{noteTable || "—"}</span>
                </div>
              </div>

              <div className="mt-4">
                {notes.length === 0 ? (
                  <div className="text-sm text-slate-600">No notes found yet.</div>
                ) : (
                  <ul className="space-y-3">
                    {notes.map((n) => (
                      <li key={n.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-xs font-semibold text-slate-600">{fmtDateTime(n.created_at)}</div>
                          {n.author_role ? (
                            <span className="rounded-full bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-700">
                              {n.author_role}
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-2 text-sm text-slate-800 line-clamp-3">{n.note}</div>
                        {n.case_id ? (
                          <button
                            onClick={() => navigate(`/swahiba/cases/${n.case_id}`)}
                            className="mt-3 text-xs font-bold text-slate-900 hover:underline"
                          >
                            Open case →
                          </button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </section>

        {/* MAIN WORK AREA */}
        <section className="mt-6 grid gap-6 lg:grid-cols-3">
          {/* Left: Case Inbox */}
          <div className="lg:col-span-2 rounded-3xl border border-slate-200 bg-white p-6">
            <div className="flex flex-col gap-1">
              <div className="text-lg font-bold text-slate-900">Case inbox</div>
              <div className="text-sm text-slate-600">Admin overview (all cases). Open any case to operate.</div>
            </div>

            <div className="mt-5 rounded-3xl border border-slate-200">
              {loading ? (
                <div className="p-6 text-sm text-slate-600">Loading…</div>
              ) : inboxRows.length === 0 ? (
                <div className="p-6 text-sm text-slate-600">No cases in this view.</div>
              ) : (
                <ul className="divide-y divide-slate-200">
                  {inboxRows.slice(0, 30).map((c) => (
                    <li key={c.id} className="p-5 hover:bg-slate-50">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="text-sm font-bold text-slate-900">
                            {c.case_code || "—"}{" "}
                            <span className="ml-2 rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                              {c.status || "—"}
                            </span>

                            <span
                              className={[
                                "ml-2 rounded-full px-2 py-1 text-xs font-semibold",
                                String(c.risk_level || "").toLowerCase() === "high"
                                  ? "bg-red-100 text-red-700"
                                  : String(c.risk_level || "").toLowerCase() === "medium"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-emerald-100 text-emerald-700",
                              ].join(" ")}
                            >
                              {c.risk_level || "low"}
                            </span>

                            {c.outcome_status === "referred" && c.status !== "closed" ? (
                              <span className="ml-2 rounded-full bg-indigo-100 px-2 py-1 text-xs font-semibold text-indigo-700">
                                referred
                              </span>
                            ) : null}

                            {c.status !== "closed" && overdueCaseIds.has(c.id) ? (
                              <span className="ml-2 rounded-full bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-700">
                                overdue
                              </span>
                            ) : null}
                          </div>

                          <div className="mt-2 text-sm text-slate-700">
                            {c.nickname || "—"} • {c.location || "—"}
                          </div>

                          <div className="mt-1 text-xs text-slate-500">
                            Updated: <span className="font-semibold">{fmtDateTime(c.updated_at)}</span>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 sm:justify-end">
                          <button
                            onClick={() => navigate(`/swahiba/cases/${c.id}`)}
                            className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                          >
                            Open case
                          </button>
                          <button
                            onClick={() => navigate(`/swahiba/cases/${c.id}`)}
                            className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
                            title="Open case then use WhatsApp button there"
                          >
                            Start WhatsApp
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-3 text-xs text-slate-500">Showing up to 30 cases. (Add pagination later.)</div>
          </div>

          {/* Right: Operations */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6">
            <div className="text-lg font-bold text-slate-900">Operations</div>
            <div className="mt-1 text-sm text-slate-600">Quick tools + system health.</div>

            <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-5">
              <div className="text-sm font-bold text-slate-900">Quick actions</div>
              <div className="mt-3 grid gap-2">
                <button
                  onClick={() => navigate("/swahiba/cases")}
                  className="rounded-2xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600"
                >
                  Go to Swahiba cases
                </button>
                <button
                  onClick={() => navigate("/admin/referrals")}
                  className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
                >
                  Add referral service
                </button>
                <button
                  onClick={() => navigate("/admin/products")}
                  className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
                >
                  Add product
                </button>
                <button
                  onClick={() => setShowPacks(true)}
                  className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
                >
                  Manage packs
                </button>
                <button
                  onClick={() => navigate("/admin/resources")}
                  className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
                >
                  Add resource
                </button>
              </div>
            </div>

            <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-5">
              <div className="text-sm font-bold text-slate-900">Referral directory health</div>
              <div className="mt-3 grid gap-2 text-sm text-slate-700">
                <HealthRow label="Active facilities" value={health.referralsActive} />
                <p className="text-xs text-slate-500">Add more checks later (missing region/district, duplicates, etc.).</p>
              </div>
            </div>

            <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-5">
              <div className="text-sm font-bold text-slate-900">Marketplace health</div>
              <div className="mt-3 grid gap-2 text-sm text-slate-700">
                <HealthRow label="Active products" value={health.productsActive} />
                <HealthRow label="Missing image" value={health.productsMissingImage} />
              </div>
            </div>

            <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-5">
              <div className="text-sm font-bold text-slate-900">Resources health</div>
              <div className="mt-3 grid gap-2 text-sm text-slate-700">
                <HealthRow label="Published resources" value={health.resourcesActive} />
                <HealthRow label="Missing SW/EN title" value={health.resourcesMissingLang} />
              </div>
            </div>

            <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <div className="text-sm font-bold text-slate-900">Safety reminder</div>
              <div className="mt-2 text-sm text-slate-600">
                Swahiba is not an emergency service. If someone is in immediate danger, prioritize local emergency services/hotlines.
              </div>
              <button onClick={() => navigate("/safeguarding")} className="mt-3 text-sm font-bold text-slate-900 hover:underline">
                Safeguarding policy →
              </button>
            </div>
          </div>
        </section>

        <footer className="mt-10 border-t border-slate-200 pt-6 text-xs text-slate-500">
          © {new Date().getFullYear()} Swahiba • Admin Dashboard
        </footer>
      </main>

      {/* ✅ Packs Manager Modal */}
      {showPacks ? <PacksManager onClose={() => setShowPacks(false)} /> : null}
    </div>
  );
}

/** ---------------- Packs Manager ---------------- */
function PacksManager({ onClose }) {
  const [tab, setTab] = useState("packs"); // packs | contents
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const [packType, setPackType] = useState("female_pack");
  const [soldFilter, setSoldFilter] = useState("not_sold"); // all | sold | not_sold
  const [packs, setPacks] = useState([]);
  const [selectedPack, setSelectedPack] = useState(null);

  const [products, setProducts] = useState([]);
  const [items, setItems] = useState([]);

  const [addProductId, setAddProductId] = useState("");
  const [addQty, setAddQty] = useState(1);
  const [addIsFree, setAddIsFree] = useState(false);

  const selectedPackId = selectedPack?.id || null;

  async function loadProducts() {
    try {
      const { data, error } = await supabase
        .from("products")
        .select("id, product_name, price_tzs, image_url, image_path, is_active")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      setProducts(data || []);
    } catch (e) {
      // keep silent; still usable for pack list
      console.warn("Products load:", e?.message || e);
      setProducts([]);
    }
  }

  async function loadPacks() {
    setErr("");
    setMsg("");
    setBusy(true);

    try {
      let q = supabase
        .from("packs")
        .select("id, pack_no, pack_type, user_id, is_active, created_at, updated_at")
        .eq("pack_type", packType)
        .order("created_at", { ascending: false });

      const { data, error } = await q;
      if (error) throw error;

      let list = data || [];

      if (soldFilter === "sold") list = list.filter((p) => Boolean(p.user_id));
      if (soldFilter === "not_sold") list = list.filter((p) => !p.user_id);

      setPacks(list);
    } catch (e) {
      setErr(e?.message || String(e));
      setPacks([]);
    } finally {
      setBusy(false);
    }
  }

  async function loadPackItems(packId) {
    if (!packId) return;
    setErr("");
    setMsg("");
    setBusy(true);

    try {
      const { data, error } = await supabase
        .from("pack_items")
        .select("id, pack_id, product_id, qty, is_free, created_at, updated_at, products:products(id, product_name, price_tzs, image_url, image_path)")
        .eq("pack_id", packId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setItems(data || []);
    } catch (e) {
      setErr(e?.message || String(e));
      setItems([]);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    loadPacks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packType, soldFilter]);

  useEffect(() => {
    if (selectedPackId) loadPackItems(selectedPackId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPackId]);

  async function createAvailablePack() {
    setErr("");
    setMsg("");
    setBusy(true);

    try {
      // 1) generate pack_no using RPC (you created generate_pack_no())
      const { data: packNo, error: genErr } = await supabase.rpc("generate_pack_no");
      if (genErr) throw genErr;
      if (!packNo) throw new Error("Failed to generate pack number");

      // 2) insert pack (available = user_id null)
      const { data, error } = await supabase
        .from("packs")
        .insert([{ pack_no: packNo, pack_type: packType, user_id: null, is_active: true }])
        .select("id, pack_no, pack_type, user_id, is_active, created_at, updated_at")
        .single();

      if (error) throw error;

      setMsg(`Created pack ${data.pack_no}`);
      setPacks((prev) => [data, ...prev]);
      setSelectedPack(data);
      setTab("contents");
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function removePack(packId) {
    if (!packId) return;
    setErr("");
    setMsg("");
    setBusy(true);

    try {
      // delete pack (pack_items cascades if FK is cascade)
      const { error } = await supabase.from("packs").delete().eq("id", packId);
      if (error) throw error;

      setMsg("Pack deleted");
      setPacks((prev) => prev.filter((p) => p.id !== packId));
      if (selectedPackId === packId) {
        setSelectedPack(null);
        setItems([]);
        setTab("packs");
      }
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function togglePackActive(packId, nextActive) {
    setErr("");
    setMsg("");
    setBusy(true);

    try {
      const { error } = await supabase.from("packs").update({ is_active: nextActive, updated_at: new Date().toISOString() }).eq("id", packId);
      if (error) throw error;

      setPacks((prev) => prev.map((p) => (p.id === packId ? { ...p, is_active: nextActive } : p)));
      if (selectedPackId === packId) setSelectedPack((p) => ({ ...p, is_active: nextActive }));
      setMsg(nextActive ? "Pack activated" : "Pack deactivated");
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function addItem() {
    if (!selectedPackId) {
      setErr("Select a pack first.");
      return;
    }
    if (!addProductId) {
      setErr("Choose a product to add.");
      return;
    }

    setErr("");
    setMsg("");
    setBusy(true);

    try {
      const payload = {
        pack_id: selectedPackId,
        product_id: addProductId,
        qty: Math.max(1, Number(addQty) || 1),
        is_free: Boolean(addIsFree),
      };

      const { data, error } = await supabase
        .from("pack_items")
        .upsert([payload], { onConflict: "pack_id,product_id,is_free" })
        .select("id, pack_id, product_id, qty, is_free, created_at, updated_at, products:products(id, product_name, price_tzs, image_url, image_path)")
        .single();

      if (error) throw error;

      setMsg("Item added");
      setAddProductId("");
      setAddQty(1);
      setAddIsFree(false);

      // refresh list (simpler + correct)
      await loadPackItems(selectedPackId);
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function updateQty(itemId, nextQty) {
    const q = Math.max(1, Number(nextQty) || 1);
    setBusy(true);
    setErr("");
    setMsg("");

    try {
      const { error } = await supabase.from("pack_items").update({ qty: q, updated_at: new Date().toISOString() }).eq("id", itemId);
      if (error) throw error;

      setItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, qty: q } : it)));
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function toggleFree(itemId, nextFree) {
    setBusy(true);
    setErr("");
    setMsg("");

    try {
      // easiest: delete + re-insert because unique constraint includes is_free
      const target = items.find((x) => x.id === itemId);
      if (!target) throw new Error("Item not found");

      await supabase.from("pack_items").delete().eq("id", itemId);

      const { error: insErr } = await supabase.from("pack_items").insert([
        { pack_id: target.pack_id, product_id: target.product_id, qty: target.qty, is_free: nextFree },
      ]);
      if (insErr) throw insErr;

      setMsg("Updated item");
      await loadPackItems(selectedPackId);
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function removeItem(itemId) {
    setBusy(true);
    setErr("");
    setMsg("");

    try {
      const { error } = await supabase.from("pack_items").delete().eq("id", itemId);
      if (error) throw error;

      setItems((prev) => prev.filter((x) => x.id !== itemId));
      setMsg("Item removed");
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  const packTypeLabel = useMemo(() => PACK_TYPES.find((x) => x.key === packType)?.label || packType, [packType]);

  const packSummary = useMemo(() => {
    const totalItems = items.reduce((a, b) => a + (Number(b.qty) || 0), 0);
    const totalPaid = items
      .filter((x) => !x.is_free)
      .reduce((sum, x) => sum + (Number(x.qty) || 0) * (Number(x.products?.price_tzs) || 0), 0);
    return { totalItems, totalPaid };
  }, [items]);

  return (
    <div className="fixed inset-0 z-[80]">
      {/* overlay */}
      <div className="absolute inset-0 bg-slate-950/50" onClick={onClose} />

      {/* panel */}
      <div className="absolute left-1/2 top-1/2 w-[96vw] max-w-[1100px] -translate-x-1/2 -translate-y-1/2">
        <div className="rounded-3xl border border-slate-200 bg-white shadow-xl">
          {/* Header */}
          <div className="flex flex-col gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-lg font-extrabold text-slate-900">Packs Manager</div>
              <div className="text-xs text-slate-500">
                Manage pack inventory + pack contents. (Sold = linked to a user)
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={onClose}
                className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="p-5">
            {err ? (
              <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div>
            ) : null}
            {msg ? (
              <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{msg}</div>
            ) : null}

            {/* Controls */}
            <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <div className="text-xs font-bold text-slate-600">Pack type</div>
                  <select
                    value={packType}
                    onChange={(e) => {
                      setSelectedPack(null);
                      setItems([]);
                      setTab("packs");
                      setPackType(e.target.value);
                    }}
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400"
                  >
                    {PACK_TYPES.map((t) => (
                      <option key={t.key} value={t.key}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="text-xs font-bold text-slate-600">Sold status</div>
                  <select
                    value={soldFilter}
                    onChange={(e) => {
                      setSelectedPack(null);
                      setItems([]);
                      setTab("packs");
                      setSoldFilter(e.target.value);
                    }}
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400"
                  >
                    <option value="not_sold">Not sold (available)</option>
                    <option value="sold">Sold</option>
                    <option value="all">All</option>
                  </select>
                </div>

                <div>
                  <div className="text-xs font-bold text-slate-600">Mode</div>
                  <div className="mt-1 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setTab("packs")}
                      className={[
                        "flex-1 rounded-2xl border px-4 py-3 text-sm font-semibold",
                        tab === "packs"
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                      ].join(" ")}
                    >
                      Packs
                    </button>
                    <button
                      type="button"
                      onClick={() => setTab("contents")}
                      disabled={!selectedPackId}
                      className={[
                        "flex-1 rounded-2xl border px-4 py-3 text-sm font-semibold",
                        tab === "contents"
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                        !selectedPackId ? "opacity-50 cursor-not-allowed" : "",
                      ].join(" ")}
                      title={!selectedPackId ? "Select a pack first" : ""}
                    >
                      Contents
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 lg:justify-end">
                <button
                  onClick={loadPacks}
                  disabled={busy}
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60"
                >
                  {busy ? "Loading…" : "Refresh"}
                </button>

                <button
                  onClick={createAvailablePack}
                  disabled={busy}
                  className="rounded-2xl bg-amber-500 px-4 py-3 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
                  title="Create a new available pack (not sold)"
                >
                  + Create Available Pack
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
              {/* Left: Packs list */}
              <div className="rounded-3xl border border-slate-200 bg-white">
                <div className="flex items-center justify-between border-b border-slate-200 p-4">
                  <div>
                    <div className="text-sm font-extrabold text-slate-900">{packTypeLabel}</div>
                    <div className="text-xs text-slate-500">
                      Showing:{" "}
                      <span className="font-semibold">
                        {soldFilter === "not_sold" ? "not sold" : soldFilter === "sold" ? "sold" : "all"}
                      </span>
                      <span className="mx-2 text-slate-300">•</span>
                      Total: <span className="font-semibold">{packs.length}</span>
                    </div>
                  </div>
                  <div className="text-xs text-slate-500">
                    Need refill: <span className="font-semibold">—</span>
                  </div>
                </div>

                {packs.length === 0 ? (
                  <div className="p-5 text-sm text-slate-600">No packs found for this filter.</div>
                ) : (
                  <ul className="divide-y divide-slate-200">
                    {packs.slice(0, 50).map((p) => {
                      const sold = Boolean(p.user_id);
                      const active = Boolean(p.is_active);
                      const selected = selectedPackId === p.id;

                      return (
                        <li key={p.id} className={["p-4", selected ? "bg-amber-50/40" : "hover:bg-slate-50"].join(" ")}>
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPack(p);
                                setTab("contents");
                              }}
                              className="text-left"
                            >
                              <div className="text-sm font-extrabold text-slate-900">
                                {p.pack_no || "—"}
                                <span className="ml-2 rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                                  {p.pack_type}
                                </span>
                                <span
                                  className={[
                                    "ml-2 rounded-full px-2 py-1 text-xs font-semibold",
                                    sold ? "bg-indigo-100 text-indigo-700" : "bg-emerald-100 text-emerald-700",
                                  ].join(" ")}
                                >
                                  {sold ? "sold" : "not sold"}
                                </span>
                                <span
                                  className={[
                                    "ml-2 rounded-full px-2 py-1 text-xs font-semibold",
                                    active ? "bg-slate-200 text-slate-700" : "bg-rose-100 text-rose-700",
                                  ].join(" ")}
                                >
                                  {active ? "active" : "inactive"}
                                </span>
                              </div>
                              <div className="mt-1 text-xs text-slate-500">
                                Created: <span className="font-semibold">{fmtDateTime(p.created_at)}</span>
                              </div>
                            </button>

                            <div className="flex flex-wrap gap-2 sm:justify-end">
                              <button
                                onClick={() => togglePackActive(p.id, !active)}
                                disabled={busy}
                                className="rounded-2xl border border-slate-200 px-3 py-2 text-xs font-semibold hover:bg-slate-50 disabled:opacity-60"
                              >
                                {active ? "Deactivate" : "Activate"}
                              </button>

                              <button
                                onClick={() => removePack(p.id)}
                                disabled={busy || sold}
                                className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                title={sold ? "Cannot delete sold packs" : "Delete pack"}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}

                <div className="border-t border-slate-200 p-3 text-xs text-slate-500">Showing up to 50 packs.</div>
              </div>

              {/* Right: Pack contents editor */}
              <div className="rounded-3xl border border-slate-200 bg-white">
                <div className="border-b border-slate-200 p-4">
                  <div className="text-sm font-extrabold text-slate-900">Pack contents</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {selectedPack ? (
                      <>
                        Pack: <span className="font-semibold">{selectedPack.pack_no}</span>
                        <span className="mx-2 text-slate-300">•</span>
                        Items: <span className="font-semibold">{packSummary.totalItems}</span>
                        <span className="mx-2 text-slate-300">•</span>
                        Total (paid): <span className="font-semibold">{tzs(packSummary.totalPaid)}</span>
                      </>
                    ) : (
                      "Select a pack to edit its items."
                    )}
                  </div>
                </div>

                {!selectedPack ? (
                  <div className="p-5 text-sm text-slate-600">Choose a pack on the left to edit its contents.</div>
                ) : (
                  <div className="p-4">
                    {/* Add item */}
                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-xs font-bold text-slate-600">Add / update item</div>

                      <div className="mt-3 grid gap-3 sm:grid-cols-4">
                        <div className="sm:col-span-2">
                          <select
                            value={addProductId}
                            onChange={(e) => setAddProductId(e.target.value)}
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400"
                          >
                            <option value="">Select product…</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.product_name} • {tzs(p.price_tzs)}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <input
                            type="number"
                            min={1}
                            value={addQty}
                            onChange={(e) => setAddQty(e.target.value)}
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400"
                            placeholder="Qty"
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-2 text-sm text-slate-700">
                            <input type="checkbox" checked={addIsFree} onChange={(e) => setAddIsFree(e.target.checked)} />
                            Free
                          </label>

                          <button
                            onClick={addItem}
                            disabled={busy}
                            className="ml-auto rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                          >
                            Add
                          </button>
                        </div>
                      </div>

                      <div className="mt-2 text-xs text-slate-500">
                        Tip: Adding the same product again will update it (based on pack + product + free/paid).
                      </div>
                    </div>

                    {/* Items list */}
                    <div className="mt-4 rounded-3xl border border-slate-200">
                      {items.length === 0 ? (
                        <div className="p-4 text-sm text-slate-600">No items yet. Add products above.</div>
                      ) : (
                        <ul className="divide-y divide-slate-200">
                          {items.map((it) => {
                            const img = it.products?.image_url || it.products?.image_path || "";
                            return (
                              <li key={it.id} className="p-4">
                                <div className="flex items-start gap-3">
                                  <div className="h-12 w-12 flex-none overflow-hidden rounded-2xl border border-slate-200 bg-white">
                                    {img ? (
                                      <img src={img} alt="" className="h-full w-full object-cover" />
                                    ) : (
                                      <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-slate-400">
                                        IMG
                                      </div>
                                    )}
                                  </div>

                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <div className="text-sm font-extrabold text-slate-900">{it.products?.product_name || "—"}</div>
                                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                                        {tzs(it.products?.price_tzs)}
                                      </span>
                                      {it.is_free ? (
                                        <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
                                          free
                                        </span>
                                      ) : null}
                                    </div>

                                    <div className="mt-2 flex flex-wrap items-center gap-2">
                                      <div className="text-xs font-bold text-slate-600">Qty</div>
                                      <input
                                        type="number"
                                        min={1}
                                        value={it.qty}
                                        onChange={(e) => updateQty(it.id, e.target.value)}
                                        className="w-20 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                                      />

                                      <button
                                        onClick={() => toggleFree(it.id, !it.is_free)}
                                        disabled={busy}
                                        className="rounded-2xl border border-slate-200 px-3 py-2 text-xs font-semibold hover:bg-slate-50 disabled:opacity-60"
                                        title="Toggle free/paid"
                                      >
                                        {it.is_free ? "Make paid" : "Make free"}
                                      </button>

                                      <button
                                        onClick={() => removeItem(it.id)}
                                        disabled={busy}
                                        className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>

                    <div className="mt-3 text-xs text-slate-500">
                      “Sold/Not sold” is automatic (linked to a user). “Need refill” can be added later as a DB field if you want.
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 border-t border-slate-200 pt-4 text-xs text-slate-500">
              Packs Manager uses tables: <span className="font-semibold">packs</span> + <span className="font-semibold">pack_items</span>.
              If you see permission errors, make sure your admin RLS policies allow admin to select/insert/update/delete these tables.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** ---------------- UI Bits ---------------- */
function Stat({ label, value }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5">
      <div className="text-xs font-bold text-slate-500">{label}</div>
      <div className="mt-2 text-3xl font-extrabold text-slate-900">{value ?? 0}</div>
    </div>
  );
}

function TabPill({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-2xl border px-4 py-2 text-sm font-semibold",
        active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function DigestList({ title, subtitle, rows, badge, onOpen }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5">
      <div>
        <div className="text-sm font-bold text-slate-900">{title}</div>
        <div className="mt-1 text-xs text-slate-600">{subtitle}</div>
      </div>

      <div className="mt-4">
        {rows.length === 0 ? (
          <div className="text-sm text-slate-600">Nothing here 🎉</div>
        ) : (
          <ul className="space-y-3">
            {rows.map(({ task, caseRow }) => (
              <li key={task.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold text-slate-900">
                      {caseRow?.case_code || "—"}{" "}
                      <span className="ml-2 rounded-full bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-700">
                        {badge === "overdue" ? `${daysOverdue(task.due_at)}d overdue` : "due today"}
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-slate-700">
                      {task.title} • due {fmtDateTime(task.due_at)}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      Risk: <span className="font-semibold">{caseRow?.risk_level || "—"}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => onOpen(caseRow.id)}
                    className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    Open
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StaleList({ title, subtitle, rows, onOpen }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5">
      <div>
        <div className="text-sm font-bold text-slate-900">{title}</div>
        <div className="mt-1 text-xs text-slate-600">{subtitle}</div>
      </div>

      <div className="mt-4">
        {rows.length === 0 ? (
          <div className="text-sm text-slate-600">Nothing here 🎉</div>
        ) : (
          <ul className="space-y-3">
            {rows.map((c) => (
              <li key={c.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold text-slate-900">{c.case_code}</div>
                    <div className="mt-1 text-sm text-slate-700">
                      {c.nickname || "—"} • {c.location || "—"}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      Last contact: <span className="font-semibold">{fmtDateTime(c.last_contact_at)}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => onOpen(c.id)}
                    className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    Open
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function HealthRow({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <div className="text-slate-700">{label}</div>
      <div className="font-bold text-slate-900">{value === null ? "—" : value}</div>
    </div>
  );
}