import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

/**
 * AdminPanel.jsx
 * Admin-only dashboard page.
 *
 * Assumptions / tables used:
 * - profiles: id (uuid), role (text)
 * - cases: id, case_code, nickname, location, risk_level, tags (text[]), status, outcome_status, created_at, updated_at, last_contact_at
 * - follow_up_tasks: id, case_id, title, due_at, status, created_at
 * - interactions OR case_notes: (for Notes tab) id, case_id, note, created_at (and optional author_role)
 * - referral_services: (optional health card) id, is_active
 * - products: (optional health card) id, is_active, image_url (or image_path)
 * - resources: (optional health card) id, is_active, title_sw, title_en, summary_sw, summary_en
 *
 * If some optional tables don't exist yet, dashboard still renders.
 */

const ADMIN_EMAIL = "admin@genactafrica.org";

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
  const ms = Date.now() - new Date(dueAt).getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}
function riskRank(risk) {
  if (risk === "high") return 3;
  if (risk === "medium") return 2;
  return 1;
}

// Try a list of table names until one works.
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

export default function AdminPanel() {
  const navigate = useNavigate();

  // auth/role
  const [me, setMe] = useState(null);

  // core data
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [cases, setCases] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [noteTable, setNoteTable] = useState(null);
  const [notes, setNotes] = useState([]);

  // optional health metrics
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

  // 1) Auth + role guard
  useEffect(() => {
    let alive = true;
  
    (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
  
        const user = data?.session?.user ?? null;
        if (!alive) return;
  
        setMe(user);
      } catch (e) {
        setErr(e?.message || String(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
  
    return () => {
      alive = false;
    };
  }, []);

  async function loadAll() {
    setErr("");
    setLoading(true);

    try {
      // cases
      const { data: c, error: cErr } = await supabase
        .from("cases")
        .select(
          "id, case_code, nickname, location, risk_level, tags, status, outcome_status, last_contact_at, created_at, updated_at"
        )
        .order("updated_at", { ascending: false });

      if (cErr) throw cErr;

      // tasks (digest)
      const { data: t, error: tErr } = await supabase
        .from("follow_up_tasks")
        .select("id, case_id, title, due_at, status, created_at, completed_at")
        .order("due_at", { ascending: true });

      if (tErr) {
        console.warn("Tasks load warning:", tErr.message);
      }

      // latest notes across all cases (Notes tab)
      const notesRes = await tryTables(NOTE_TABLE_CANDIDATES, async (table) => {
        const q =
          table === "interactions"
            ? supabase
                .from(table)
                .select("id, case_id, note, created_at, author_role")
                .order("created_at", { ascending: false })
                .limit(10)
            : supabase
                .from(table)
                .select("id, case_id, note, created_at")
                .order("created_at", { ascending: false })
                .limit(10);

        const { data, error } = await q;
        if (error) return { ok: false, data: null, error };
        return { ok: true, data: data ?? [], error: null };
      });

      if (notesRes.table) {
        setNoteTable(notesRes.table);
        setNotes(notesRes.data ?? []);
      } else {
        setNoteTable(null);
        setNotes([]);
      }

      // Optional "health cards" – ignore errors if table missing
      const nextHealth = { ...health };

      // referralsActive
      try {
        const { data, error } = await supabase
          .from("referral_services")
          .select("id", { count: "exact", head: true })
          .eq("is_active", true);
        if (error) throw error;
        nextHealth.referralsActive = data?.length ?? null; // head:true doesn't return rows; keep null if unclear
      } catch {
        nextHealth.referralsActive = null;
      }

      // productsActive + productsMissingImage
      try {
        const { data: a, error: aErr, count: aCount } = await supabase
          .from("products")
          .select("id", { count: "exact", head: true })
          .eq("is_active", true);
        if (aErr) throw aErr;
        nextHealth.productsActive = aCount ?? null;

        // "missing image" depends on your schema; we check common fields
        const { data: m, error: mErr, count: mCount } = await supabase
          .from("products")
          .select("id", { count: "exact", head: true })
          .or("image_url.is.null,image_path.is.null")
          .eq("is_active", true);
        if (mErr) throw mErr;
        nextHealth.productsMissingImage = mCount ?? null;
      } catch {
        nextHealth.productsActive = null;
        nextHealth.productsMissingImage = null;
      }

      // resourcesActive + resourcesMissingLang
      try {
        const { count: rCount, error: rErr } = await supabase
          .from("resources")
          .select("id", { count: "exact", head: true })
          .eq("is_active", true);
        if (rErr) throw rErr;
        nextHealth.resourcesActive = rCount ?? null;

        // missing SW/EN: if either title_sw or title_en is null/empty
        // NOTE: Postgres empty-string checks are trickier; we'll do null check only (MVP).
        const { count: mlCount, error: mlErr } = await supabase
          .from("resources")
          .select("id", { count: "exact", head: true })
          .eq("is_active", true)
          .or("title_sw.is.null,title_en.is.null");
        if (mlErr) throw mlErr;
        nextHealth.resourcesMissingLang = mlCount ?? null;
      } catch {
        nextHealth.resourcesActive = null;
        nextHealth.resourcesMissingLang = null;
      }

      setHealth(nextHealth);

      setCases(c ?? []);
      setTasks(t ?? []);
      setLastRefresh(new Date().toISOString());
    } catch (e) {
      console.error(e);
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (me?.email === ADMIN_EMAIL) {
      loadAll();
    }
  }, [me]);

  async function signOut() {
    await supabase.auth.signOut();
    navigate("/swahiba/login", { replace: true });
  }

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
    const dueTodayCaseIds = new Set(dueTodayTasks.map((t) => t.case_id));

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
        if (!last) return true; // never contacted → stale
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

  // ---- Week counts (simple) ----
  const week = useMemo(() => {
    const now = new Date();
    const start = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6));
    const days = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });

    const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

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

  // ---- Case inbox filtering + sorting (admin overview) ----
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
      if (caseFilter === "overdue") return c.status !== "closed" && overdueCaseIds.has(c.id);
      if (caseFilter === "referred") return c.outcome_status === "referred" && c.status !== "closed";
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

    list = list.slice().sort(sorter);
    return list;
  }, [cases, globalQ, caseFilter, sortKey, overdueCaseIds]);

  // ---- Guards ----
if (loading) {
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-[1200px] px-4 py-10 text-sm text-slate-600">
        Loading…
      </div>
    </div>
  );
}

  if (!me) {
    return (
      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-[1200px] px-4 py-10">
          <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
          <p className="mt-2 text-sm text-slate-600">Please log in first.</p>
          <button
            onClick={() => navigate("/swahiba/login")}
            className="mt-6 rounded-2xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Go to login
          </button>
        </div>
      </div>
    );
  }

  if (me.email !== ADMIN_EMAIL) {
    return (
      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-[1200px] px-4 py-10">
          <h1 className="text-2xl font-bold text-slate-900">Not authorized</h1>
          <p className="mt-2 text-sm text-slate-600">
            Your account does not have admin access.
          </p>
          <div className="mt-6 flex gap-2">
            <button
              onClick={() => navigate("/swahiba/cases")}
              className="rounded-2xl border border-slate-200 px-5 py-2 text-sm font-semibold hover:bg-slate-50"
            >
              Back to cases
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

  // ---- UI ----
  return (
    <div className="min-h-screen bg-white">
      {/* TOP BAR (sticky) */}

      <main className="mx-auto max-w-[1200px] px-4 py-10">
        {err && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {err}
          </div>
        )}

<div className="mx-auto max-w-[1200px] px-4 py-4">
          <div className="flex items-center justify-between gap-3">

            <div className="hidden w-full max-w-[520px] md:block">
              <input
                value={globalQ}
                onChange={(e) => setGlobalQ(e.target.value)}
                placeholder="Search cases (code, nickname, location, tags)…"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400"
              />
            </div>
            
          </div>

          {/* Secondary row */}
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-slate-700">
              <span className="font-semibold">Today</span>{" "}
              <span className="text-slate-400">•</span>{" "}
              Last refresh: <span className="font-semibold">{lastRefresh ? fmtDateTime(lastRefresh) : "—"}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={loadAll}
                className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
              >
                Refresh
              </button>
              <button
                onClick={() => navigate("/admin/referrals")}
                className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
              >
                Manage referrals
              </button>
              <button
                onClick={() => navigate("/admin/products")}
                className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
              >
                Manage products
              </button>
              <button
                onClick={() => navigate("/admin/resources")}
                className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
              >
                Manage resources
              </button>
            </div>
          </div>

          {/* Mobile search */}
          <div className="mt-3 md:hidden">
            <input
              value={globalQ}
              onChange={(e) => setGlobalQ(e.target.value)}
              placeholder="Search cases…"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400"
            />
          </div>
        </div>


        {/* TODAY SNAPSHOT */}
        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-4xl tracking-tight" style={{ fontFamily: "ui-serif, Georgia, Cambria, serif" }}>
                Admin Panel
              </h1>
              <div className="mt-2 text-sm text-slate-600">System-wide view (all cases, all tasks).</div>
            </div>
            <div className="text-xs text-slate-500">
              Status:{" "}
              <span className="font-semibold">{loading ? "loading…" : "ready"}</span>
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

        {/* DAILY DIGEST */}
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

              <p className="mt-3 text-xs text-slate-500">
                Note: these counts use created_at and updated_at as proxies (MVP).
              </p>
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

        {/* MAIN WORK AREA (2 columns) */}
        <section className="mt-6 grid gap-6 lg:grid-cols-3">
          {/* Left: Case Inbox */}
          <div className="lg:col-span-2 rounded-3xl border border-slate-200 bg-white p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-lg font-bold text-slate-900">Case inbox</div>
                <div className="mt-1 text-sm text-slate-600">Admin view (all cases). Quick actions included.</div>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-500">Sort</label>
                <select
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value)}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none focus:border-slate-400"
                >
                  {SORTS.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Filter chips */}
            <div className="mt-4 flex flex-wrap gap-2">
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

            {/* Table/List */}
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
                            {c.case_code}{" "}
                            <span className="ml-2 rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                              {c.status}
                            </span>
                            <span
                              className={[
                                "ml-2 rounded-full px-2 py-1 text-xs font-semibold",
                                c.risk_level === "high"
                                  ? "bg-red-100 text-red-700"
                                  : c.risk_level === "medium"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-emerald-100 text-emerald-700",
                              ].join(" ")}
                            >
                              {c.risk_level}
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

            <div className="mt-3 text-xs text-slate-500">
              Showing up to 30 cases. (You can paginate later.)
            </div>
          </div>

          {/* Right: Operations panel */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6">
            <div className="text-lg font-bold text-slate-900">Operations</div>
            <div className="mt-1 text-sm text-slate-600">Quick tools + system health.</div>

            {/* Quick actions */}
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
                  onClick={() => navigate("/admin/resources")}
                  className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
                >
                  Add resource
                </button>
              </div>
            </div>

            {/* Health cards */}
            <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-5">
              <div className="text-sm font-bold text-slate-900">Referral directory health</div>
              <div className="mt-3 grid gap-2 text-sm text-slate-700">
                <HealthRow label="Active facilities" value={health.referralsActive} />
                <p className="text-xs text-slate-500">More checks (missing region/district) can be added once fields exist.</p>
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

            {/* Help strip */}
            <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <div className="text-sm font-bold text-slate-900">Safety reminder</div>
              <div className="mt-2 text-sm text-slate-600">
                Swahiba is not an emergency service. If someone is in immediate danger, prioritize local emergency
                services/hotlines.
              </div>
              <button
                onClick={() => navigate("/safeguarding")}
                className="mt-3 text-sm font-bold text-slate-900 hover:underline"
              >
                Safeguarding policy →
              </button>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-10 border-t border-slate-200 pt-6 text-xs text-slate-500">
          © {new Date().getFullYear()} Swahiba • Admin Dashboard
        </footer>
      </main>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5">
      <div className="text-xs font-bold text-slate-500">{label}</div>
      <div className="mt-2 text-3xl font-extrabold text-slate-900">{value}</div>
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
        active
          ? "border-slate-900 bg-slate-900 text-white"
          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
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

