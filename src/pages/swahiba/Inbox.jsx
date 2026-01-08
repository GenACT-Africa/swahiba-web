import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

export default function Inbox() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [error, setError] = useState("");

  const [openItem, setOpenItem] = useState(null);
  const [processing, setProcessing] = useState(false);

  // =========================
  // LOAD REQUESTS
  // =========================
  async function loadRequests() {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) throw new Error("Not authenticated");

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .single();

      if (profileError || !profile) {
        throw new Error("Swahiba profile not found");
      }

      const { data, error: reqError } = await supabase
        .from("requests")
        .select("*")
        .eq("swahiba_id", profile.id)
        .order("created_at", { ascending: false });

      if (reqError) throw reqError;

      setRequests(data || []);
    } catch (e) {
      console.error(e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRequests();
  }, []);

  // =========================
  // ACCEPT REQUEST → CREATE CASE
  // =========================
  async function acceptRequest() {
    if (!openItem) return;
    setProcessing(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Not authenticated");

      const { data: newCase, error: caseErr } = await supabase
        .from("cases")
        .insert([
          {
            assigned_swahiba: user.id,
            nickname: openItem.nickname || "Anonymous",
            location: openItem.location || null,
            risk_level: "low",
            tags: [openItem.need],
            status: "new",
            outcome_status: "ongoing",
          },
        ])
        .select()
        .single();

      if (caseErr) throw caseErr;

      const { error: updateErr } = await supabase
        .from("requests")
        .update({
          status: "accepted",
          linked_case_id: newCase.id,
        })
        .eq("id", openItem.id);

      if (updateErr) throw updateErr;

      setOpenItem(null);
      await loadRequests();

      navigate(`/swahiba/cases/${newCase.id}`);
    } catch (e) {
      alert(e.message);
    } finally {
      setProcessing(false);
    }
  }

  // =========================
  // CANCEL REQUEST
  // =========================
  async function cancelRequest() {
    if (!openItem) return;
    setProcessing(true);

    try {
      const { error } = await supabase
        .from("requests")
        .update({ status: "cancelled" })
        .eq("id", openItem.id);

      if (error) throw error;

      setOpenItem(null);
      await loadRequests();
    } catch (e) {
      alert(e.message);
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-4xl px-4 py-10">
        {/* HEADER */}
        <div className="flex items-center justify-between">
          <div>
            <h1
              className="text-3xl tracking-tight"
              style={{ fontFamily: "ui-serif, Georgia, Cambria, serif" }}
            >
              Requests Inbox
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Incoming support requests
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={loadRequests}
              className="rounded-xl border px-4 py-2 text-sm"
            >
              Refresh
            </button>
            <button
              onClick={() => navigate("/swahiba/cases")}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white"
            >
              Back to cases
            </button>
          </div>
        </div>

        {/* ERROR */}
        {error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* LIST */}
        <div className="mt-8 space-y-4">
          {loading ? (
            <div className="text-sm text-slate-600">Loading…</div>
          ) : requests.length === 0 ? (
            <div className="rounded-2xl border p-6 text-center text-sm text-slate-600">
              🎉 No new requests right now
            </div>
          ) : (
            requests.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-2xl border p-5"
              >
                <div>
                  <div className="text-sm font-semibold flex items-center gap-2">
                    New request to talk
                    <span className="text-xs rounded-full bg-slate-100 px-2 py-0.5">
                      {(r.status || "pending").toUpperCase()}
                    </span>
                  </div>

                  <div className="mt-1 text-sm text-slate-700">
                    {r.nickname || "Someone"} wants to talk about{" "}
                    <span className="font-semibold">{r.need}</span>
                  </div>

                  <div className="mt-2 text-xs text-slate-500">
                    {new Date(r.created_at).toLocaleString()}
                  </div>
                </div>

                {/* OPEN BUTTON (ALWAYS AVAILABLE) */}
                <button
                  onClick={() => setOpenItem(r)}
                  className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50"
                >
                  Open
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* MODAL */}
      {openItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpenItem(null)}
          />

          <div className="relative z-10 w-[92vw] max-w-lg rounded-3xl bg-white p-6 shadow-xl">
            <div className="flex justify-between">
              <div>
                <h2 className="text-xl font-bold">Request details</h2>
                <p className="mt-2 text-sm text-slate-700">
                  <strong>{openItem.nickname || "Anonymous"}</strong> wants to
                  talk about <strong>{openItem.need}</strong>
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  {new Date(openItem.created_at).toLocaleString()}
                </p>
              </div>

              <button
                onClick={() => setOpenItem(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={cancelRequest}
                disabled={processing}
                className="rounded-xl border px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={acceptRequest}
                disabled={processing}
                className="rounded-xl bg-amber-500 px-4 py-2 text-sm text-white"
              >
                Accept & create case
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}