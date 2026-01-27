import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

const TABS = [
  { key: "new", label: "New" },
  { key: "active", label: "Active" },
  { key: "high", label: "High risk" },
  { key: "closed", label: "Closed" },
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
function normalizeTags(tags) {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags.filter(Boolean);
  if (typeof tags === "string")
    return tags
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
  return [];
}
function riskBadgeClass(level) {
  const v = (level || "").toLowerCase();
  if (v === "high") return "bg-red-100 text-red-700";
  if (v === "medium") return "bg-amber-100 text-amber-800";
  return "bg-emerald-100 text-emerald-700";
}

/**
 * ✅ IMPORTANT:
 * We will decide visibility based on admin role:
 * - Admin: sees ALL cases
 * - Swahiba: sees ONLY cases assigned to them
 *
 * To avoid guessing column names, we detect which "assigned" field exists.
 */
const CASE_ASSIGNEE_FIELD_CANDIDATES = [
  "assigned_swahiba_id",
  "assigned_swahiba",
  "swahiba_id",
  "assigned_to",
  "handler_id",
  "handled_by",
  "handled_by_id",
  "peer_id",
];

const CASE_SELECT =
  "id, case_code, nickname, location, risk_level, tags, status, outcome_status, last_contact_at, created_at, updated_at";

/** Admin check that works across auth methods (profiles role preferred) */
async function isAdminSafe(user) {
  if (!user) return false;

  // 1) Optional RPC if you created it
  try {
    const { data, error } = await supabase.rpc("is_admin");
    if (!error && typeof data === "boolean") return data;
  } catch {
    // ignore
  }

  // 2) profiles.role / profiles.is_admin
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("role, is_admin")
      .eq("id", user.id)
      .single();

    if (!error && data) {
      const role = String(data.role || "").toLowerCase();
      return data.is_admin === true || role === "admin";
    }
  } catch {
    // ignore
  }

  // 3) metadata fallback
  const metaRole = String(
    user.user_metadata?.role ||
      user.app_metadata?.role ||
      user.user_metadata?.user_role ||
      user.app_metadata?.user_role ||
      ""
  ).toLowerCase();

  return metaRole === "admin";
}

/**
 * Detect which assignee field exists and load cases accordingly.
 * - If admin => load all
 * - Else => load only cases where assignee field == user.id
 */
async function loadCasesForUser({ userId, isAdmin }) {
  // Try each candidate column until query succeeds
  for (const field of CASE_ASSIGNEE_FIELD_CANDIDATES) {
    // eslint-disable-next-line no-await-in-loop
    const q = supabase.from("cases").select(`${CASE_SELECT}, ${field}`).order("created_at", { ascending: false });

    // eslint-disable-next-line no-await-in-loop
    const res = isAdmin ? await q : await q.eq(field, userId);

    if (!res.error) {
      return { rows: res.data ?? [], assigneeField: field };
    }
  }

  // Fallback: load without assignee field (admin will still see all; swahiba might get blocked by RLS)
  const fallback = await supabase.from("cases").select(CASE_SELECT).order("created_at", { ascending: false });
  if (fallback.error) throw fallback.error;

  return { rows: fallback.data ?? [], assigneeField: null };
}

export default function Cases() {
  const navigate = useNavigate();

  const [tab, setTab] = useState("new");
  const [q, setQ] = useState("");
  const [me, setMe] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [assigneeField, setAssigneeField] = useState(null);

  const [loading, setLoading] = useState(true);
  const [cases, setCases] = useState([]);
  const [tasks, setTasks] = useState([]); // digest
  const [err, setErr] = useState("");
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null);

  // New Case modal state
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [newCase, setNewCase] = useState({
    nickname: "",
    location: "",
    risk_level: "low",
    tags: "",
  });

  async function loadAll() {
    setErr("");
    setLoading(true);

    try {
      // session/user
      const { data: s, error: sErr } = await supabase.auth.getSession();
      if (sErr) throw sErr;

      const user = s?.session?.user ?? null;
      setMe(user);

      if (!user?.id) {
        setCases([]);
        setTasks([]);
        setIsAdmin(false);
        setAssigneeField(null);
        setLastRefreshedAt(new Date().toISOString());
        return;
      }

      // role
      const adminFlag = await isAdminSafe(user);
      setIsAdmin(Boolean(adminFlag));

      // cases (admin => all; swahiba => only assigned to them)
      const { rows: cRows, assigneeField: detectedField } = await loadCasesForUser({
        userId: user.id,
        isAdmin: adminFlag,
      });

      setCases(cRows ?? []);
      setAssigneeField(detectedField);

      // tasks (nice-to-have)
      // If RLS blocks it, just ignore.
      const { data: t, error: tErr } = await supabase
        .from("follow_up_tasks")
        .select("id, case_id, title, due_at, status, completed_at, created_at")
        .order("due_at", { ascending: true });

      if (tErr) {
        console.warn("Tasks load warning:", tErr.message);
        setTasks([]);
      } else {
        // If swahiba, keep digest aligned with visible cases (even if tasks policy is permissive)
        if (!adminFlag) {
          const visibleCaseIds = new Set((cRows || []).map((x) => x.id));
          setTasks((t || []).filter((x) => visibleCaseIds.has(x.case_id)));
        } else {
          setTasks(t ?? []);
        }
      }

      setLastRefreshedAt(new Date().toISOString());
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!alive) return;
      await loadAll();
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- DAILY DIGEST ----------
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

    const activeCases = (cases || []).filter((c) => c.status !== "closed");
    const highRiskActive = activeCases.filter((c) => (c.risk_level || "").toLowerCase() === "high");

    const new24h = (cases || []).filter((c) => {
      const ts = new Date(c.created_at).getTime();
      return Number.isFinite(ts) && ts >= since24h;
    });

    const caseById = new Map((cases || []).map((c) => [c.id, c]));

    const topOverdue = overdueTasks
      .map((t) => ({ task: t, caseRow: caseById.get(t.case_id) }))
      .filter((x) => x.caseRow && x.caseRow.status !== "closed")
      .slice(0, 3);

    const topDueToday = dueTodayTasks
      .map((t) => ({ task: t, caseRow: caseById.get(t.case_id) }))
      .filter((x) => x.caseRow && x.caseRow.status !== "closed")
      .slice(0, 3);

    return {
      overdueCount: overdueCaseIds.size,
      dueTodayCount: dueTodayCaseIds.size,
      highRiskActiveCount: highRiskActive.length,
      new24hCount: new24h.length,
      topOverdue,
      topDueToday,
    };
  }, [cases, tasks]);

  // tab counts
  const tabCounts = useMemo(() => {
    const all = cases || [];
    return {
      new: all.filter((c) => c.status === "new").length,
      active: all.filter((c) => c.status === "active").length,
      closed: all.filter((c) => c.status === "closed").length,
      high: all.filter((c) => (c.risk_level || "").toLowerCase() === "high" && c.status !== "closed").length,
    };
  }, [cases]);

  // ---------- FILTERED LIST ----------
  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();

    return (cases || []).filter((c) => {
      const tagsArr = normalizeTags(c.tags);
      const matchesQuery =
        !query ||
        (c.case_code || "").toLowerCase().includes(query) ||
        (c.nickname || "").toLowerCase().includes(query) ||
        (c.location || "").toLowerCase().includes(query) ||
        tagsArr.join(" ").toLowerCase().includes(query);

      const matchesTab =
        (tab === "new" && c.status === "new") ||
        (tab === "active" && c.status === "active") ||
        (tab === "closed" && c.status === "closed") ||
        (tab === "high" && (c.risk_level || "").toLowerCase() === "high" && c.status !== "closed");

      return matchesQuery && matchesTab;
    });
  }, [cases, q, tab]);

  async function signOut() {
    await supabase.auth.signOut();
    navigate("/swahiba/login", { replace: true });
  }

  async function createCaseFromModal() {
    setCreateError("");
    setCreating(true);

    try {
      const { data: s } = await supabase.auth.getSession();
      const uid = s?.session?.user?.id;
      if (!uid) throw new Error("No session user.");

      const tagsArr = (newCase.tags || "")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);

      // Prefer the detected assignee field, otherwise default to your current schema
      const assignField = assigneeField || "assigned_swahiba";

      const payload = {
        [assignField]: uid,
        nickname: newCase.nickname || null,
        location: newCase.location || null,
        risk_level: newCase.risk_level,
        tags: tagsArr,
        status: "new",
        outcome_status: "ongoing",
      };

      const { data: inserted, error } = await supabase
        .from("cases")
        .insert([payload])
        .select(CASE_SELECT)
        .single();

      if (error) throw error;

      setCases((prev) => [inserted, ...(prev || [])]);
      setIsNewOpen(false);
      setNewCase({ nickname: "", location: "", risk_level: "low", tags: "" });
      setTab("new");
    } catch (e) {
      setCreateError(e?.message || String(e));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-[1100px] px-4 py-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1
              className="text-4xl tracking-tight"
              style={{ fontFamily: "ui-serif, Georgia, Cambria, serif" }}
            >
              SWAHIBA Dashboard
            </h1>
            <div className="mt-2 text-sm text-slate-600">
              Logged in as: <span className="font-semibold">{me?.email || "—"}</span>
              <span className="mx-2 text-slate-300">•</span>
              Role:{" "}
              <span className="font-semibold">
                {isAdmin ? "admin (all cases)" : "swahiba (assigned cases)"}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={loadAll}
              className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
            >
              Refresh
            </button>
            <button
              onClick={() => setIsNewOpen(true)}
              className="rounded-2xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600"
            >
              + New case
            </button>
            <button
              onClick={() => navigate("/swahiba/Inbox")}
              className="relative rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
            >
              Inbox
            </button>
          </div>
        </div>

        {err && (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {err}
          </div>
        )}

        {/* DAILY DIGEST */}
        <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-lg font-bold text-slate-900">Daily digest</div>
              <div className="mt-1 text-sm text-slate-600">
                Quick view of what needs attention today.
              </div>
            </div>
            <div className="text-xs text-slate-500">
              Updated:{" "}
              <span className="font-semibold">{fmtDateTime(lastRefreshedAt)}</span>
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Overdue" value={digest.overdueCount} />
            <Stat label="Due today" value={digest.dueTodayCount} />
            <Stat label="High risk active" value={digest.highRiskActiveCount} />
            <Stat label="New (24h)" value={digest.new24hCount} />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <DigestList
              title="Top overdue"
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
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-8 flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={[
                "rounded-2xl border px-4 py-2 text-sm font-semibold",
                tab === t.key
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
              ].join(" ")}
            >
              {t.label}{" "}
              <span className="ml-2 rounded-full bg-white/20 px-2 py-0.5 text-xs font-bold">
                {tabCounts[t.key] ?? 0}
              </span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="mt-5">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by case code, nickname, location, tags…"
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-300"
          />
        </div>

        {/* List */}
        <div className="mt-6 rounded-3xl border border-slate-200 bg-white">
          {loading ? (
            <div className="p-6 text-sm text-slate-600">Loading cases…</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-sm text-slate-600">
              No cases in this view yet.
              {!isAdmin && (
                <div className="mt-2 text-xs text-slate-500">
                  (As Swahiba, you only see cases assigned to you.)
                </div>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-slate-200">
              {filtered.map((c) => {
                const tagsArr = normalizeTags(c.tags);
                return (
                  <li key={c.id} className="p-6 hover:bg-slate-50">
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
                              riskBadgeClass(c.risk_level),
                            ].join(" ")}
                          >
                            {c.risk_level}
                          </span>
                        </div>

                        <div className="mt-2 text-sm text-slate-700">
                          {c.nickname || "—"} • {c.location || "—"}
                        </div>

                        {tagsArr.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {tagsArr.map((tag) => (
                              <span
                                key={tag}
                                className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => navigate(`/swahiba/cases/${c.id}`)}
                        className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                      >
                        Open
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Optional sign out (keep if you still need it)
        <div className="mt-6">
          <button
            onClick={signOut}
            className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
          >
            Sign out
          </button>
        </div>
        */}
      </div>

      {/* NEW CASE MODAL */}
      {isNewOpen && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => !creating && setIsNewOpen(false)}
          />
          <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-white p-7 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div
                  className="text-2xl tracking-tight text-slate-900"
                  style={{ fontFamily: "ui-serif, Georgia, Cambria, serif" }}
                >
                  Add new case
                </div>
                <div className="mt-2 text-sm text-slate-600">
                  Create a case card for follow-up.
                </div>
              </div>

              <button
                type="button"
                onClick={() => !creating && setIsNewOpen(false)}
                className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            {createError && (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {createError}
              </div>
            )}

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="text-sm font-semibold text-slate-700">Nickname (optional)</label>
                <input
                  value={newCase.nickname}
                  onChange={(e) => setNewCase((p) => ({ ...p, nickname: e.target.value }))}
                  placeholder="e.g. Asha"
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-sm font-semibold text-slate-700">Location (optional)</label>
                <input
                  value={newCase.location}
                  onChange={(e) => setNewCase((p) => ({ ...p, location: e.target.value }))}
                  placeholder="e.g. Kinondoni"
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700">Risk level</label>
                <select
                  value={newCase.risk_level}
                  onChange={(e) => setNewCase((p) => ({ ...p, risk_level: e.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400"
                >
                  <option value="low">low</option>
                  <option value="medium">medium</option>
                  <option value="high">high</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700">Tags</label>
                <input
                  value={newCase.tags}
                  onChange={(e) => setNewCase((p) => ({ ...p, tags: e.target.value }))}
                  placeholder="e.g. gbv, sti, followup"
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
                />
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={() => setIsNewOpen(false)}
                disabled={creating}
                className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={createCaseFromModal}
                disabled={creating}
                className="rounded-2xl bg-amber-500 px-5 py-3 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
              >
                {creating ? "Creating…" : "Create case"}
              </button>
            </div>
          </div>
        </div>
      )}
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
                      {caseRow.case_code}{" "}
                      <span className="ml-2 rounded-full bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-700">
                        {badge === "overdue"
                          ? `${daysOverdue(task.due_at)}d overdue`
                          : "due today"}
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-slate-700">
                      {task.title} • due {fmtDateTime(task.due_at)}
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