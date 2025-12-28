import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function Invites() {
  const [expiresIn, setExpiresIn] = useState(7);
  const [maxUses, setMaxUses] = useState(1);
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(false);
  const [invite, setInvite] = useState(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  // Generate readable invite code
  function generateCode() {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
  }

  async function handleGenerateInvite() {
    setError("");
    setInvite(null);
    setCopied(false);

    if (expiresIn < 1 || maxUses < 1) {
      setError("Expires in days and max uses must be at least 1.");
      return;
    }

    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("You must be logged in to create invites.");
      }

      const inviteCode = generateCode();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresIn);

      const { data, error } = await supabase
        .from("peer_invites")
        .insert([
          {
            invite_code: inviteCode,
            created_by: user.id,
            expires_at: expiresAt.toISOString(),
            max_uses: maxUses,
            notes: notes || null,
            used: false,
            used_count: 0,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      setInvite(data);
    } catch (err) {
      setError(err.message || "Failed to generate invite.");
    } finally {
      setLoading(false);
    }
  }

  function copyInvite() {
    if (!invite?.invite_code) return;
    navigator.clipboard.writeText(invite.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mx-auto max-w-[720px] px-4 py-10">
      <h1
        className="text-3xl font-semibold tracking-tight"
        style={{ fontFamily: "ui-serif, Georgia, Cambria, serif" }}
      >
        Peer Invite Generator
      </h1>

      <p className="mt-2 text-sm text-slate-600">
        Generate invitation codes for Swahiba peers. Signup is invite-only and
        controlled by admins.
      </p>

      {/* Form */}
      <div className="mt-8 grid gap-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <label className="grid gap-1">
          <span className="text-sm font-semibold">Expires in (days)</span>
          <input
            type="number"
            min={1}
            value={expiresIn}
            onChange={(e) => setExpiresIn(Number(e.target.value))}
            className="rounded-xl border px-4 py-2"
          />
        </label>

        <label className="grid gap-1">
          <span className="text-sm font-semibold">Max uses</span>
          <input
            type="number"
            min={1}
            value={maxUses}
            onChange={(e) => setMaxUses(Number(e.target.value))}
            className="rounded-xl border px-4 py-2"
          />
        </label>

        <label className="grid gap-1">
          <span className="text-sm font-semibold">Notes (optional)</span>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Dar cohort – July"
            className="rounded-xl border px-4 py-2"
          />
        </label>

        <button
          onClick={handleGenerateInvite}
          disabled={loading}
          className="rounded-2xl bg-amber-500 py-3 font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
        >
          {loading ? "Generating…" : "Generate invite"}
        </button>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>

      {/* Result */}
      {invite && (
        <div className="mt-8 rounded-3xl border border-emerald-200 bg-emerald-50 p-6">
          <div className="text-sm font-bold text-emerald-900">
            Invite created successfully
          </div>

          <div className="mt-3 flex items-center justify-between gap-3">
            <code className="rounded-lg bg-white px-4 py-2 font-mono text-sm">
              {invite.invite_code}
            </code>

            <button
              onClick={copyInvite}
              className="text-sm font-semibold text-emerald-700 underline"
            >
              {copied ? "Copied ✓" : "Copy"}
            </button>
          </div>

          <div className="mt-3 text-xs text-emerald-800">
            Expires:{" "}
            <span className="font-semibold">
              {new Date(invite.expires_at).toLocaleString()}
            </span>
          </div>

          <div className="mt-1 text-xs text-emerald-800">
            Max uses: <span className="font-semibold">{invite.max_uses}</span>
          </div>
        </div>
      )}
    </div>
  );
}