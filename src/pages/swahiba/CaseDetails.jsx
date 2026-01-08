import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { useLanguage } from "../../context/LanguageContext";

/* ===============================
   TABLE CANDIDATES (fallback-safe)
================================ */
const NOTE_TABLE_CANDIDATES = ["interactions", "case_notes"];
const TASK_TABLE_CANDIDATES = ["follow_up_tasks", "followups"];
const REFERRAL_TABLE_CANDIDATES = ["referral_services", "referrals", "services"];
const CASE_REFERRAL_LINK_TABLE_CANDIDATES = [
  "case_referrals",
  "case_referral",
  "referrals_cases",
];

/* ===============================
   HELPERS
================================ */
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

async function tryTables(candidates, fn) {
  let lastErr = null;
  for (const name of candidates) {
    const { ok, data, error } = await fn(name);
    if (ok) return { table: name, data, error: null };
    lastErr = error;
  }
  return { table: null, data: null, error: lastErr };
}

/* ===============================
   COMPONENT
================================ */
export default function CaseDetails() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { lang } = useLanguage();

  /* ===============================
     TRANSLATIONS
  ================================ */
  const t =
    lang === "SW"
      ? {
          title: "Maelezo ya Kesi",
          back: "← Rudi kwenye orodha",
          loggedAs: "Umeingia kama",
          summary: "Muhtasari wa Mteja",
          contact: "Mawasiliano",
          need: "Mahitaji",
          description: "Maelezo ya Ombi",
          channel: "Njia ya Mawasiliano",
          phone: "Namba ya Simu",
          location: "Mahali",
          outcome: "Hali ya Kesi",
          lastContact: "Mawasiliano ya mwisho",
          notes: "Kumbukumbu za mazungumzo",
          addNote: "Ongeza kumbukumbu",
          tasks: "Majukumu ya ufuatiliaji",
          referrals: "Rufaa",
          signOut: "Toka",
        }
      : {
          title: "Case Details",
          back: "← Back to inbox",
          loggedAs: "Logged in as",
          summary: "Client Summary",
          contact: "Contact",
          need: "Need",
          description: "Request description",
          channel: "Preferred channel",
          phone: "Phone number",
          location: "Location",
          outcome: "Outcome status",
          lastContact: "Last contact",
          notes: "Interaction notes",
          addNote: "Add note",
          tasks: "Follow-up tasks",
          referrals: "Referrals",
          signOut: "Sign out",
        };

  /* ===============================
     STATE
  ================================ */
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [me, setMe] = useState(null);
  const [caseRow, setCaseRow] = useState(null);
  const [requestRow, setRequestRow] = useState(null);

  const [noteTable, setNoteTable] = useState(null);
  const [taskTable, setTaskTable] = useState(null);

  const [notes, setNotes] = useState([]);
  const [tasks, setTasks] = useState([]);

  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [noteErr, setNoteErr] = useState("");

  const [taskTitle, setTaskTitle] = useState("");
  const [taskDue, setTaskDue] = useState("");
  const [creatingTask, setCreatingTask] = useState(false);
  const [taskErr, setTaskErr] = useState("");

  const [savingOutcome, setSavingOutcome] = useState(false);
  const [outcomeErr, setOutcomeErr] = useState("");

  const [referralTable, setReferralTable] = useState(null);
  const [referrals, setReferrals] = useState([]);
  const [refQ, setRefQ] = useState("");
  const [refErr, setRefErr] = useState("");
  const [selectedReferralId, setSelectedReferralId] = useState("");
  const [assigningReferral, setAssigningReferral] = useState(false);
  const [assignErr, setAssignErr] = useState("");
  const [assignedReferral, setAssignedReferral] = useState(null);

  const hasOverdue = useMemo(() => {
    const now = Date.now();
    return (tasks || []).some(
      (t) => t.status === "open" && new Date(t.due_at).getTime() < now
    );
  }, [tasks]);

  /* ===============================
     LOAD EVERYTHING
  ================================ */
  async function loadAll() {
    setLoading(true);
    setErr("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Not authenticated");
      setMe(user);

      const { data: caseData, error: caseErr } = await supabase
        .from("cases")
        .select("*")
        .eq("id", id)
        .single();

      if (caseErr) throw caseErr;
      setCaseRow(caseData);

      const { data: req } = await supabase
        .from("requests")
        .select("*")
        .eq("linked_case_id", id)
        .single();

      setRequestRow(req || null);

      const notesRes = await tryTables(NOTE_TABLE_CANDIDATES, async (table) => {
        const { data, error } = await supabase
          .from(table)
          .select("*")
          .eq("case_id", id)
          .order("created_at", { ascending: false });

        if (error) return { ok: false, error };
        return { ok: true, data };
      });

      setNoteTable(notesRes.table);
      setNotes(notesRes.data || []);

      const tasksRes = await tryTables(TASK_TABLE_CANDIDATES, async (table) => {
        const { data, error } = await supabase
          .from(table)
          .select("*")
          .eq("case_id", id)
          .order("due_at", { ascending: true });

        if (error) return { ok: false, error };
        return { ok: true, data };
      });

      setTaskTable(tasksRes.table);
      setTasks(tasksRes.data || []);

      const refsRes = await tryTables(REFERRAL_TABLE_CANDIDATES, async (table) => {
        const { data, error } = await supabase.from(table).select("*");
        if (error) return { ok: false, error };
        return { ok: true, data };
      });

      setReferralTable(refsRes.table);
      setReferrals(refsRes.data || []);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, [id]);

  async function signOut() {
    await supabase.auth.signOut();
    navigate("/swahiba/login", { replace: true });
  }

  if (loading) {
    return <div className="p-10 text-slate-600">Loading…</div>;
  }

  if (!caseRow) {
    return <div className="p-10 text-red-600">Case not found</div>;
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-[1100px] px-4 py-10">

        {/* HEADER */}
        <div className="flex justify-between items-start">
          <div>
            <button
              onClick={() => navigate("/swahiba/cases")}
              className="text-sm font-semibold text-slate-700"
            >
              {t.back}
            </button>

            <h1 className="mt-3 text-4xl tracking-tight">
              {t.title}
            </h1>

            <div className="mt-2 text-sm text-slate-600">
              {t.loggedAs}: <span className="font-semibold">{me?.email}</span>
            </div>
          </div>

          <button
            onClick={signOut}
            className="rounded-2xl border px-4 py-2 text-sm font-semibold"
          >
            {t.signOut}
          </button>
        </div>

        {/* CLIENT SUMMARY */}
        <div className="mt-6 rounded-3xl border p-6">
          <h2 className="text-lg font-bold mb-4">{t.summary}</h2>

          <div className="grid sm:grid-cols-2 gap-4 text-sm">
            <div><strong>{t.contact}:</strong> {requestRow?.nickname || "—"}</div>
            <div><strong>{t.phone}:</strong> {requestRow?.phone || "—"}</div>
            <div><strong>{t.location}:</strong> {requestRow?.location || "—"}</div>
            <div><strong>{t.channel}:</strong> {requestRow?.channel || "—"}</div>
            <div><strong>{t.need}:</strong> {requestRow?.need || "—"}</div>
          </div>

          <div className="mt-4 text-sm">
            <strong>{t.description}:</strong>
            <p className="mt-1 text-slate-700">
              {requestRow?.description || "—"}
            </p>
          </div>

          <div className="mt-4 text-sm text-slate-600">
            {t.lastContact}:{" "}
            <span className="font-semibold">
              {fmtDateTime(caseRow.last_contact_at)}
            </span>
          </div>
        </div>

        {/* ================= NOTES ================= */}
        <div className="mt-6 rounded-3xl border p-6 bg-white">
          <div className="flex justify-between items-end">
            <div>
              <h2 className="text-lg font-bold">{t.notes}</h2>
              <p className="text-sm text-slate-600">
                Notes are timestamped. Adding a note updates last contact.
              </p>
            </div>
            <div className="text-xs text-slate-500">
              Table: <span className="font-semibold">{noteTable || "—"}</span>
            </div>
          </div>

          {noteErr && (
            <div className="mt-4 rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {noteErr}
            </div>
          )}

          <div className="mt-4">
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={4}
              placeholder={t.addNote}
              className="w-full rounded-2xl border px-4 py-3 text-sm"
            />
            <div className="mt-3 flex justify-end">
              <button
                onClick={async () => {
                  if (!noteText.trim() || !noteTable) return;
                  setSavingNote(true);
                  try {
                    const payload =
                      noteTable === "interactions"
                        ? { case_id: id, author_role: "swahiba", note: noteText }
                        : { case_id: id, note: noteText };

                    const { data, error } = await supabase
                      .from(noteTable)
                      .insert([payload])
                      .select()
                      .single();

                    if (error) throw error;

                    await supabase
                      .from("cases")
                      .update({
                        last_contact_at: new Date().toISOString(),
                        status:
                          caseRow.status === "new"
                            ? "active"
                            : caseRow.status,
                      })
                      .eq("id", id);

                    setNotes((prev) => [data, ...prev]);
                    setNoteText("");
                  } catch (e) {
                    setNoteErr(e.message);
                  } finally {
                    setSavingNote(false);
                  }
                }}
                disabled={savingNote}
                className="rounded-xl bg-slate-900 text-white px-5 py-2 text-sm font-semibold"
              >
                {savingNote ? "Saving…" : t.addNote}
              </button>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {notes.length === 0 ? (
              <p className="text-sm text-slate-600">No notes yet.</p>
            ) : (
              notes.map((n) => (
                <div
                  key={n.id}
                  className="rounded-2xl border bg-slate-50 p-4"
                >
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>{fmtDateTime(n.created_at)}</span>
                    {n.author_role && (
                      <span className="rounded-full bg-slate-200 px-2 py-1 font-semibold">
                        {n.author_role}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 whitespace-pre-wrap text-sm">
                    {n.note}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ================= TASKS ================= */}
        <div className="mt-6 rounded-3xl border p-6 bg-white">
          <div className="flex justify-between items-end">
            <div>
              <h2 className="text-lg font-bold">{t.tasks}</h2>
              <p className="text-sm text-slate-600">
                Create, complete, or reschedule follow-ups.
              </p>
            </div>
            <div className="text-xs text-slate-500">
              Table: <span className="font-semibold">{taskTable || "—"}</span>
            </div>
          </div>

          {taskErr && (
            <div className="mt-4 rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {taskErr}
            </div>
          )}

          <div className="mt-4 grid sm:grid-cols-3 gap-3">
            <input
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="Task title"
              className="rounded-xl border px-4 py-3 text-sm sm:col-span-2"
            />
            <input
              type="datetime-local"
              value={taskDue}
              onChange={(e) => setTaskDue(e.target.value)}
              className="rounded-xl border px-4 py-3 text-sm"
            />
          </div>

          <div className="mt-3 flex justify-end">
            <button
              onClick={async () => {
                if (!taskTitle || !taskDue || !taskTable) return;
                setCreatingTask(true);
                try {
                  const { data, error } = await supabase
                    .from(taskTable)
                    .insert([
                      {
                        case_id: id,
                        title: taskTitle,
                        due_at: new Date(taskDue).toISOString(),
                        status: "open",
                      },
                    ])
                    .select()
                    .single();

                  if (error) throw error;

                  setTasks((prev) =>
                    [...prev, data].sort(
                      (a, b) => new Date(a.due_at) - new Date(b.due_at)
                    )
                  );
                  setTaskTitle("");
                  setTaskDue("");
                } catch (e) {
                  setTaskErr(e.message);
                } finally {
                  setCreatingTask(false);
                }
              }}
              disabled={creatingTask}
              className="rounded-xl bg-amber-500 text-white px-5 py-2 text-sm font-semibold"
            >
              {creatingTask ? "Creating…" : "Add task"}
            </button>
          </div>

          <div className="mt-6 divide-y rounded-2xl border">
            {tasks.length === 0 ? (
              <div className="p-4 text-sm text-slate-600">No tasks yet.</div>
            ) : (
              tasks.map((t) => (
                <div key={t.id} className="p-4 flex justify-between">
                  <div>
                    <div className="font-semibold text-sm">{t.title}</div>
                    <div className="text-xs text-slate-600">
                      Due: {fmtDateTime(t.due_at)}
                    </div>
                  </div>
                  {t.status === "open" && (
                    <button
                      onClick={async () => {
                        await supabase
                          .from(taskTable)
                          .update({
                            status: "done",
                            completed_at: new Date().toISOString(),
                          })
                          .eq("id", t.id);
                        setTasks((prev) =>
                          prev.map((x) =>
                            x.id === t.id
                              ? { ...x, status: "done" }
                              : x
                          )
                        );
                      }}
                      className="text-sm font-semibold text-emerald-600"
                    >
                      Mark done
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* ================= REFERRALS ================= */}
        <div className="mt-6 rounded-3xl border p-6 bg-white">
          <h2 className="text-lg font-bold">{t.referrals}</h2>

          {refErr && (
            <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm">
              {refErr}
            </div>
          )}

          <input
            value={refQ}
            onChange={(e) => setRefQ(e.target.value)}
            placeholder="Search services…"
            className="mt-4 w-full rounded-xl border px-4 py-3 text-sm"
          />

          <select
            value={selectedReferralId}
            onChange={(e) => setSelectedReferralId(e.target.value)}
            className="mt-3 w-full rounded-xl border px-4 py-3 text-sm"
          >
            <option value="">— Choose service —</option>
            {referrals
              .filter((r) =>
                JSON.stringify(r).toLowerCase().includes(refQ.toLowerCase())
              )
              .slice(0, 200)
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {r.service_name}
                </option>
              ))}
          </select>

          <div className="mt-4 flex justify-end">
            <button
              onClick={async () => {
                if (!selectedReferralId) return;
                setAssigningReferral(true);
                try {
                  const ref = referrals.find(
                    (r) => r.id === selectedReferralId
                  );
                  if (!ref) return;

                  await supabase.from(noteTable).insert([
                    {
                      case_id: id,
                      note: `[REFERRAL] ${ref.service_name}`,
                    },
                  ]);

                  await supabase
                    .from("cases")
                    .update({
                      outcome_status: "referred",
                      status: "active",
                    })
                    .eq("id", id);

                  setAssignedReferral(ref);
                  setSelectedReferralId("");
                } catch (e) {
                  setAssignErr(e.message);
                } finally {
                  setAssigningReferral(false);
                }
              }}
              disabled={assigningReferral}
              className="rounded-xl bg-slate-900 text-white px-5 py-2 text-sm font-semibold"
            >
              {assigningReferral ? "Assigning…" : "Assign referral"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}