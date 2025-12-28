import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

const NOTE_TABLE_CANDIDATES = ["interactions", "case_notes"];
const TASK_TABLE_CANDIDATES = ["follow_up_tasks", "followups"];

// Referral directory + assignment candidates
const REFERRAL_TABLE_CANDIDATES = ["referral_services", "referrals", "services"];
const CASE_REFERRAL_LINK_TABLE_CANDIDATES = ["case_referrals", "case_referral", "referrals_cases"];

function fmtDateTime(v) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function fmtDate(v) {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
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

export default function CaseDetails() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [me, setMe] = useState(null);
  const [caseRow, setCaseRow] = useState(null);

  const [noteTable, setNoteTable] = useState(null);
  const [taskTable, setTaskTable] = useState(null);

  const [notes, setNotes] = useState([]);
  const [tasks, setTasks] = useState([]);

  // add note
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [noteErr, setNoteErr] = useState("");

  // new task
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDue, setTaskDue] = useState(""); // YYYY-MM-DDTHH:mm
  const [creatingTask, setCreatingTask] = useState(false);
  const [taskErr, setTaskErr] = useState("");

  // outcome/status
  const [savingOutcome, setSavingOutcome] = useState(false);
  const [outcomeErr, setOutcomeErr] = useState("");

  // referrals
  const [referralTable, setReferralTable] = useState(null);
  const [referrals, setReferrals] = useState([]);
  const [refQ, setRefQ] = useState("");
  const [refErr, setRefErr] = useState("");
  const [selectedReferralId, setSelectedReferralId] = useState("");
  const [assigningReferral, setAssigningReferral] = useState(false);
  const [assignErr, setAssignErr] = useState("");

  // what’s currently assigned (best-effort; may come from cases columns or notes)
  const [assignedReferral, setAssignedReferral] = useState(null);

  const whatsappNumber = import.meta.env.VITE_SWAHIBA_WHATSAPP || "";

  const hasOverdue = useMemo(() => {
    const now = Date.now();
    return (tasks || []).some(
      (t) => (t.status || t.task_status) === "open" && new Date(t.due_at).getTime() < now
    );
  }, [tasks]);

  const filteredReferrals = useMemo(() => {
    const q = refQ.trim().toLowerCase();
    if (!q) return referrals || [];
    return (referrals || []).filter((r) => {
      const hay = [
        r.service_name,
        r.service_type,
        r.region,
        r.district,
        r.contact_phone,
        r.hours,
        r.notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [referrals, refQ]);

  async function loadAll() {
    setErr("");
    setRefErr("");
    setLoading(true);

    try {
      const { data: s, error: sErr } = await supabase.auth.getSession();
      if (sErr) throw sErr;

      const user = s?.session?.user ?? null;
      setMe(user);

      // Load case (base fields; avoid selecting unknown columns that could break)
      const { data: c, error: cErr } = await supabase
        .from("cases")
        .select(
          "id, case_code, nickname, location, risk_level, tags, status, outcome_status, last_contact_at, created_at, updated_at"
        )
        .eq("id", id)
        .single();

      if (cErr) throw cErr;
      setCaseRow(c);

      // Load notes (either interactions or case_notes)
      const notesRes = await tryTables(NOTE_TABLE_CANDIDATES, async (table) => {
        const q =
          table === "interactions"
            ? supabase
                .from(table)
                .select("id, case_id, author_role, note, created_at")
                .eq("case_id", id)
                .order("created_at", { ascending: false })
            : supabase
                .from(table)
                .select("id, case_id, note, created_at")
                .eq("case_id", id)
                .order("created_at", { ascending: false });

        const { data, error } = await q;
        if (error) return { ok: false, data: null, error };
        return { ok: true, data: data ?? [], error: null };
      });

      if (!notesRes.table) throw notesRes.error;
      setNoteTable(notesRes.table);
      setNotes(notesRes.data ?? []);

      // Try to infer assigned referral from notes (best-effort, if you used fallback logging earlier)
      const refNote = (notesRes.data || []).find((n) =>
        String(n.note || "").startsWith("[REFERRAL]")
      );
      if (refNote) {
        setAssignedReferral({ from: "note", note: refNote.note });
      } else {
        setAssignedReferral(null);
      }

      // Load tasks (either follow_up_tasks or followups)
      const tasksRes = await tryTables(TASK_TABLE_CANDIDATES, async (table) => {
        const q2 = supabase
          .from(table)
          .select("id, case_id, title, due_at, status, completed_at, created_at")
          .eq("case_id", id)
          .order("due_at", { ascending: true });

        const { data, error } = await q2;
        if (error) return { ok: false, data: null, error };
        return { ok: true, data: data ?? [], error: null };
      });

      if (!tasksRes.table) throw tasksRes.error;
      setTaskTable(tasksRes.table);
      setTasks(tasksRes.data ?? []);

      // Load referral directory (best-effort)
      const refsRes = await tryTables(REFERRAL_TABLE_CANDIDATES, async (table) => {
        const q3 = supabase
          .from(table)
          .select("id, service_name, service_type, region, district, hours, contact_phone, notes")
          .order("service_name", { ascending: true });

        const { data, error } = await q3;
        if (error) return { ok: false, data: null, error };
        return { ok: true, data: data ?? [], error: null };
      });

      if (!refsRes.table) {
        // not fatal; page should still work
        setReferralTable(null);
        setReferrals([]);
        setRefErr(refsRes.error?.message || "Referral directory not available yet.");
      } else {
        setReferralTable(refsRes.table);
        setReferrals(refsRes.data ?? []);
      }
    } catch (e) {
      console.error(e);
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function signOut() {
    await supabase.auth.signOut();
    navigate("/swahiba/login", { replace: true });
  }

  async function addNote() {
    setNoteErr("");
    if (!noteText.trim()) {
      setNoteErr("Please write a note first.");
      return;
    }
    if (!noteTable) {
      setNoteErr("Notes table not detected yet.");
      return;
    }

    setSavingNote(true);
    try {
      const nowIso = new Date().toISOString();

      const payload =
        noteTable === "interactions"
          ? { case_id: id, author_role: "swahiba", note: noteText.trim() }
          : { case_id: id, note: noteText.trim() };

      const { data: inserted, error } = await supabase
        .from(noteTable)
        .insert([payload])
        .select("id, case_id, note, created_at, author_role")
        .single();

      if (error) throw error;

      // update last_contact_at (+ status new→active)
      const { error: uErr } = await supabase
        .from("cases")
        .update({
          last_contact_at: nowIso,
          updated_at: nowIso,
          status: caseRow?.status === "new" ? "active" : caseRow?.status || "active",
        })
        .eq("id", id);

      if (uErr) throw uErr;

      setNotes((prev) => [inserted, ...(prev || [])]);

      setCaseRow((prev) =>
        prev
          ? {
              ...prev,
              last_contact_at: nowIso,
              status: prev.status === "new" ? "active" : prev.status,
              updated_at: nowIso,
            }
          : prev
      );

      setNoteText("");
    } catch (e) {
      setNoteErr(e?.message || String(e));
    } finally {
      setSavingNote(false);
    }
  }

  async function createTask() {
    setTaskErr("");
    if (!taskTable) {
      setTaskErr("Tasks table not detected yet.");
      return;
    }
    if (!taskTitle.trim()) {
      setTaskErr("Task title is required.");
      return;
    }
    if (!taskDue) {
      setTaskErr("Task due date/time is required.");
      return;
    }

    setCreatingTask(true);
    try {
      const dueISO = new Date(taskDue).toISOString();

      const { data: inserted, error } = await supabase
        .from(taskTable)
        .insert([
          {
            case_id: id,
            title: taskTitle.trim(),
            due_at: dueISO,
            status: "open",
          },
        ])
        .select("id, case_id, title, due_at, status, completed_at, created_at")
        .single();

      if (error) throw error;

      setTasks((prev) =>
        [...(prev || []), inserted].sort((a, b) => new Date(a.due_at) - new Date(b.due_at))
      );
      setTaskTitle("");
      setTaskDue("");
    } catch (e) {
      setTaskErr(e?.message || String(e));
    } finally {
      setCreatingTask(false);
    }
  }

  async function markTaskDone(taskId) {
    setTaskErr("");
    if (!taskTable) return;

    try {
      const { data: updated, error } = await supabase
        .from(taskTable)
        .update({ status: "done", completed_at: new Date().toISOString() })
        .eq("id", taskId)
        .select("id, case_id, title, due_at, status, completed_at, created_at")
        .single();

      if (error) throw error;

      setTasks((prev) => (prev || []).map((t) => (t.id === taskId ? updated : t)));
    } catch (e) {
      setTaskErr(e?.message || String(e));
    }
  }

  async function rescheduleTask(taskId, newDue) {
    setTaskErr("");
    if (!taskTable) return;
    if (!newDue) return;

    try {
      const { data: updated, error } = await supabase
        .from(taskTable)
        .update({ due_at: new Date(newDue).toISOString() })
        .eq("id", taskId)
        .select("id, case_id, title, due_at, status, completed_at, created_at")
        .single();

      if (error) throw error;

      setTasks((prev) =>
        (prev || [])
          .map((t) => (t.id === taskId ? updated : t))
          .sort((a, b) => new Date(a.due_at) - new Date(b.due_at))
      );
    } catch (e) {
      setTaskErr(e?.message || String(e));
    }
  }

  async function updateOutcome(nextOutcome) {
    setOutcomeErr("");
    setSavingOutcome(true);

    try {
      const nowIso = new Date().toISOString();

      const nextStatus =
        nextOutcome === "resolved" || nextOutcome === "lost" ? "closed" : "active";

      const patch = {
        outcome_status: nextOutcome,
        status: nextStatus,
        updated_at: nowIso,
      };

      const { data: updated, error } = await supabase
        .from("cases")
        .update(patch)
        .eq("id", id)
        .select(
          "id, case_code, nickname, location, risk_level, tags, status, outcome_status, last_contact_at, created_at, updated_at"
        )
        .single();

      if (error) throw error;

      setCaseRow(updated);
    } catch (e) {
      setOutcomeErr(e?.message || String(e));
    } finally {
      setSavingOutcome(false);
    }
  }

  async function assignReferral() {
    setAssignErr("");
    if (!caseRow) return;

    const ref = (referrals || []).find((r) => r.id === selectedReferralId);
    if (!ref) {
      setAssignErr("Please select a facility/service first.");
      return;
    }

    setAssigningReferral(true);
    try {
      const nowIso = new Date().toISOString();

      // 1) Best case: you have a link table for case ↔ referral assignment
      const linkAttempt = await tryTables(CASE_REFERRAL_LINK_TABLE_CANDIDATES, async (table) => {
        // try common column patterns; if this fails, we'll fallback
        const payloadOptions = [
          { case_id: id, referral_service_id: ref.id, assigned_at: nowIso },
          { case_id: id, service_id: ref.id, assigned_at: nowIso },
          { case_id: id, referral_id: ref.id, assigned_at: nowIso },
        ];

        for (const payload of payloadOptions) {
          // eslint-disable-next-line no-await-in-loop
          const { error } = await supabase.from(table).insert([payload]);
          if (!error) return { ok: true, data: { table }, error: null };
        }
        return { ok: false, data: null, error: new Error("Link insert failed") };
      });

      // 2) If link table didn’t work, try updating cases with likely columns
      if (!linkAttempt.table) {
        const patchOptions = [
          { referral_service_id: ref.id, referred_at: nowIso },
          { referral_id: ref.id, referred_at: nowIso },
          { service_id: ref.id, referred_at: nowIso },
        ];

        let updatedCaseOk = false;

        for (const extra of patchOptions) {
          // eslint-disable-next-line no-await-in-loop
          const { error } = await supabase
            .from("cases")
            .update({
              ...extra,
              outcome_status: "referred",
              status: "active",
              updated_at: nowIso,
            })
            .eq("id", id);

          if (!error) {
            updatedCaseOk = true;
            break;
          }
        }

        // 3) If schema doesn’t support it, fallback: log referral as a note (but still set outcome)
        if (!updatedCaseOk) {
          if (noteTable) {
            const note =
              `[REFERRAL] Assigned: ${ref.service_name || "Facility"} ` +
              `${ref.region ? `• ${ref.region}` : ""}${ref.district ? `/${ref.district}` : ""}` +
              `${ref.contact_phone ? ` • ${ref.contact_phone}` : ""}`;

            const payload =
              noteTable === "interactions"
                ? { case_id: id, author_role: "swahiba", note }
                : { case_id: id, note };

            await supabase.from(noteTable).insert([payload]);
          }
        }
      }

      // Always: set outcome to referred (harmonizes status too)
      await updateOutcome("referred");

      // Update local “assigned referral” UI
      setAssignedReferral({ from: "directory", ref });

      // Clear selection
      setSelectedReferralId("");
    } catch (e) {
      console.error(e);
      setAssignErr(e?.message || String(e));
    } finally {
      setAssigningReferral(false);
    }
  }

  function startWhatsApp() {
    if (!caseRow) return;

    const phone = (whatsappNumber || "").replace(/\D/g, "");
    const msg =
      `Hello, this is Swahiba.\n` +
      `Case ID: ${caseRow.case_code}\n` +
      `Checking in from our last conversation.\n\n` +
      `1) I am okay\n2) I need help\n3) I need a referral`;

    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;

    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-[1100px] px-4 py-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <button
              onClick={() => navigate("/swahiba/cases")}
              className="text-sm font-semibold text-slate-700 hover:text-slate-900"
            >
              ← Back to inbox
            </button>

            <h1
              className="mt-3 text-4xl tracking-tight"
              style={{ fontFamily: "ui-serif, Georgia, Cambria, serif" }}
            >
              Case Details
            </h1>

            <div className="mt-2 text-sm text-slate-600">
              Logged in as: <span className="font-semibold">{me?.email}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={startWhatsApp}
              className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Start WhatsApp chat
            </button>

            <button
              onClick={signOut}
              className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
            >
              Sign out
            </button>
          </div>
        </div>

        {err && (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {err}
          </div>
        )}

        {loading ? (
          <div className="mt-6 rounded-3xl border border-slate-200 p-6 text-sm text-slate-600">
            Loading…
          </div>
        ) : !caseRow ? (
          <div className="mt-6 rounded-3xl border border-slate-200 p-6 text-sm text-slate-600">
            Case not found.
          </div>
        ) : (
          <>
            {/* Summary */}
            <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-sm font-bold text-slate-900">
                    {caseRow.case_code}{" "}
                    <span className="ml-2 rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                      {caseRow.status}
                    </span>
                    <span className="ml-2 rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">
                      {caseRow.risk_level}
                    </span>
                    {hasOverdue && caseRow.status !== "closed" && (
                      <span className="ml-2 rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700">
                        overdue
                      </span>
                    )}
                  </div>

                  <div className="mt-2 text-sm text-slate-700">
                    {caseRow.nickname || "—"} • {caseRow.location || "—"}
                  </div>

                  <div className="mt-2 text-sm text-slate-600">
                    Last contact:{" "}
                    <span className="font-semibold">
                      {fmtDateTime(caseRow.last_contact_at)}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {(caseRow.tags || []).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Outcome */}
                <div className="w-full sm:w-[280px]">
                  <div className="text-sm font-semibold text-slate-700">Outcome status</div>
                  <select
                    value={caseRow.outcome_status || "ongoing"}
                    disabled={savingOutcome}
                    onChange={(e) => updateOutcome(e.target.value)}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400"
                  >
                    <option value="ongoing">ongoing</option>
                    <option value="referred">referred</option>
                    <option value="resolved">resolved</option>
                    <option value="lost">lost to follow-up</option>
                  </select>

                  {outcomeErr && (
                    <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                      {outcomeErr}
                    </div>
                  )}

                  <p className="mt-2 text-xs text-slate-500">
                    Tip: choosing “resolved” or “lost” will also close the case.
                  </p>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-6">
              <div className="flex items-end justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Interaction notes</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Notes are timestamped. Adding a note updates last contact automatically.
                  </p>
                </div>
                <div className="text-xs text-slate-500">
                  Table: <span className="font-semibold">{noteTable || "—"}</span>
                </div>
              </div>

              {noteErr && (
                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {noteErr}
                </div>
              )}

              <div className="mt-4">
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Write a note…"
                  rows={4}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
                />
                <div className="mt-3 flex justify-end">
                  <button
                    onClick={addNote}
                    disabled={savingNote}
                    className="rounded-2xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                  >
                    {savingNote ? "Saving…" : "Add note"}
                  </button>
                </div>
              </div>

              <div className="mt-6">
                {notes.length === 0 ? (
                  <div className="text-sm text-slate-600">No notes yet.</div>
                ) : (
                  <ul className="space-y-3">
                    {notes.map((n) => (
                      <li key={n.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-center justify-between">
                          <div className="text-xs font-semibold text-slate-600">
                            {fmtDateTime(n.created_at)}
                          </div>
                          {n.author_role && (
                            <span className="rounded-full bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-700">
                              {n.author_role}
                            </span>
                          )}
                        </div>
                        <div className="mt-2 whitespace-pre-wrap text-sm text-slate-800">
                          {n.note}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Tasks */}
            <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-6">
              <div className="flex items-end justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Follow-up tasks</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Create, complete, or reschedule follow-ups.
                  </p>
                </div>
                <div className="text-xs text-slate-500">
                  Table: <span className="font-semibold">{taskTable || "—"}</span>
                </div>
              </div>

              {taskErr && (
                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {taskErr}
                </div>
              )}

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label className="text-sm font-semibold text-slate-700">Task title</label>
                  <input
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    placeholder="e.g. Check-in call"
                    className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-700">Due at</label>
                  <input
                    type="datetime-local"
                    value={taskDue}
                    onChange={(e) => setTaskDue(e.target.value)}
                    className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
                  />
                </div>
              </div>

              <div className="mt-3 flex justify-end">
                <button
                  onClick={createTask}
                  disabled={creatingTask}
                  className="rounded-2xl bg-amber-500 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
                >
                  {creatingTask ? "Creating…" : "Add task"}
                </button>
              </div>

              <div className="mt-6">
                {tasks.length === 0 ? (
                  <div className="text-sm text-slate-600">No tasks yet.</div>
                ) : (
                  <ul className="divide-y divide-slate-200 rounded-2xl border border-slate-200">
                    {tasks.map((t) => {
                      const isDone = t.status === "done";
                      const due = fmtDateTime(t.due_at);
                      return (
                        <li key={t.id} className="p-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <div className="text-sm font-bold text-slate-900">
                                {t.title}{" "}
                                <span
                                  className={[
                                    "ml-2 rounded-full px-2 py-1 text-xs font-semibold",
                                    isDone
                                      ? "bg-emerald-100 text-emerald-700"
                                      : "bg-slate-100 text-slate-700",
                                  ].join(" ")}
                                >
                                  {isDone ? "done" : "open"}
                                </span>
                              </div>
                              <div className="mt-1 text-sm text-slate-600">Due: {due}</div>
                              {t.completed_at && (
                                <div className="mt-1 text-xs text-slate-500">
                                  Completed: {fmtDateTime(t.completed_at)}
                                </div>
                              )}
                            </div>

                            <div className="flex flex-col gap-2 sm:items-end">
                              {!isDone && (
                                <button
                                  onClick={() => markTaskDone(t.id)}
                                  className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                                >
                                  Mark done
                                </button>
                              )}

                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-slate-600">
                                  Reschedule:
                                </span>
                                <input
                                  type="date"
                                  defaultValue={fmtDate(t.due_at)}
                                  onChange={(e) => {
                                    const next = e.target.value ? `${e.target.value}T09:00` : "";
                                    if (next) rescheduleTask(t.id, next);
                                  }}
                                  className="rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-slate-400"
                                />
                              </div>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

            {/* Referrals */}
            <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Referrals</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Select a facility/service from the directory and assign it to this case.
                    Assigning a referral sets outcome status to <span className="font-semibold">referred</span>.
                  </p>
                </div>
                <div className="text-xs text-slate-500">
                  Directory table: <span className="font-semibold">{referralTable || "—"}</span>
                </div>
              </div>

              {refErr && (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  {refErr}
                </div>
              )}

              {/* Current assignment (best-effort) */}
              {assignedReferral && (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-bold text-slate-900">Assigned referral</div>
                  {assignedReferral.from === "directory" ? (
                    <div className="mt-2 text-sm text-slate-700">
                      <div className="font-semibold">{assignedReferral.ref.service_name}</div>
                      <div className="text-slate-600">
                        {[assignedReferral.ref.region, assignedReferral.ref.district].filter(Boolean).join(" / ")}
                        {assignedReferral.ref.contact_phone ? ` • ${assignedReferral.ref.contact_phone}` : ""}
                      </div>
                      {assignedReferral.ref.hours && (
                        <div className="text-slate-600">Hours: {assignedReferral.ref.hours}</div>
                      )}
                    </div>
                  ) : (
                    <div className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                      {assignedReferral.note}
                    </div>
                  )}
                </div>
              )}

              {assignErr && (
                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {assignErr}
                </div>
              )}

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label className="text-sm font-semibold text-slate-700">Search directory</label>
                  <input
                    value={refQ}
                    onChange={(e) => setRefQ(e.target.value)}
                    placeholder="Search by name, district, region, type…"
                    className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-700">Select facility</label>
                  <select
                    value={selectedReferralId}
                    onChange={(e) => setSelectedReferralId(e.target.value)}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400"
                    disabled={!referralTable || filteredReferrals.length === 0}
                  >
                    <option value="">— Choose —</option>
                    {filteredReferrals.slice(0, 200).map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.service_name}
                        {r.district ? ` • ${r.district}` : ""}
                        {r.region ? ` (${r.region})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Selected preview */}
              {selectedReferralId && (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                  {(() => {
                    const r = (referrals || []).find((x) => x.id === selectedReferralId);
                    if (!r) return null;
                    return (
                      <>
                        <div className="text-sm font-bold text-slate-900">{r.service_name}</div>
                        <div className="mt-1 text-sm text-slate-600">
                          Type: <span className="font-semibold">{r.service_type || "—"}</span>
                        </div>
                        <div className="mt-1 text-sm text-slate-600">
                          Location:{" "}
                          <span className="font-semibold">
                            {[r.region, r.district].filter(Boolean).join(" / ") || "—"}
                          </span>
                        </div>
                        {r.contact_phone && (
                          <div className="mt-1 text-sm text-slate-600">
                            Phone: <span className="font-semibold">{r.contact_phone}</span>
                          </div>
                        )}
                        {r.hours && (
                          <div className="mt-1 text-sm text-slate-600">
                            Hours: <span className="font-semibold">{r.hours}</span>
                          </div>
                        )}
                        {r.notes && (
                          <div className="mt-2 text-sm text-slate-700">{r.notes}</div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}

              <div className="mt-4 flex justify-end">
                <button
                  onClick={assignReferral}
                  disabled={assigningReferral || !selectedReferralId}
                  className="rounded-2xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {assigningReferral ? "Assigning…" : "Assign referral"}
                </button>
              </div>

              <p className="mt-3 text-xs text-slate-500">
                Note: If your database does not yet have a place to store referral assignments,
                the app will log a referral note and still set outcome to <span className="font-semibold">referred</span>.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}