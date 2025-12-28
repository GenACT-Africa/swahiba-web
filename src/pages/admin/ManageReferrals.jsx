import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

const CATS = [
  "fp",
  "sti_hiv",
  "gbv",
  "mental_health",
  "mch",
  "legal_support",
  "hotline",
];

function cleanPhone(p) {
  if (!p) return "";
  return String(p).replace(/[^\d]/g, "");
}

export default function ManageReferrals() {
  const navigate = useNavigate();

  const [role, setRole] = useState(null); // 'admin' | 'swahiba' | null
  const [me, setMe] = useState(null);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [rows, setRows] = useState([]);

  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [show, setShow] = useState("all"); // all | verified | unverified | inactive

  const [isNewOpen, setIsNewOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createErr, setCreateErr] = useState("");

  const [form, setForm] = useState({
    name: "",
    category: "fp",
    region: "",
    district: "",
    address: "",
    hours: "",
    phone: "",
    whatsapp: "",
    website: "",
    youth_friendly: false,
    free_service: false,
    notes: "",
    is_active: true,
    is_verified: false,
  });

  const closeBtnRef = useRef(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setErr("");
        setLoading(true);

        const { data: s } = await supabase.auth.getSession();
        const user = s?.session?.user ?? null;
        if (!alive) return;
        setMe(user);

        if (!user) {
          navigate("/swahiba/login", { replace: true });
          return;
        }

        // load profile role
        const { data: prof, error: pErr } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();

        if (pErr) throw pErr;
        if (!alive) return;
        setRole(prof?.role || "swahiba");

        // load services (admin policy required)
        const { data, error } = await supabase
          .from("referral_services")
          .select("*")
          .order("updated_at", { ascending: false });

        if (error) throw error;

        if (!alive) return;
        setRows(data ?? []);
      } catch (e) {
        console.error(e);
        if (!alive) return;
        setErr(e?.message || String(e));
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [navigate]);

  useEffect(() => {
    if (isNewOpen) setTimeout(() => closeBtnRef.current?.focus(), 0);
  }, [isNewOpen]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") setIsNewOpen(false);
    };
    if (isNewOpen) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isNewOpen]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();

    return (rows || []).filter((r) => {
      const matchesQ =
        !query ||
        (r.name || "").toLowerCase().includes(query) ||
        (r.region || "").toLowerCase().includes(query) ||
        (r.district || "").toLowerCase().includes(query);

      const matchesCat = cat === "all" || r.category === cat;

      const matchesShow =
        show === "all" ||
        (show === "verified" && r.is_verified === true) ||
        (show === "unverified" && r.is_verified === false) ||
        (show === "inactive" && r.is_active === false);

      return matchesQ && matchesCat && matchesShow;
    });
  }, [rows, q, cat, show]);

  async function reload() {
    const { data, error } = await supabase
      .from("referral_services")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) throw error;
    setRows(data ?? []);
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate("/swahiba/login", { replace: true });
  }

  async function toggleActive(r) {
    try {
      setErr("");
      const { error } = await supabase
        .from("referral_services")
        .update({ is_active: !r.is_active })
        .eq("id", r.id);
      if (error) throw error;
      await reload();
    } catch (e) {
      setErr(e?.message || String(e));
    }
  }

  async function toggleVerified(r) {
    try {
      setErr("");
      const { data: s } = await supabase.auth.getSession();
      const uid = s?.session?.user?.id;

      const patch = r.is_verified
        ? { is_verified: false, verified_at: null, verified_by: null }
        : { is_verified: true, verified_at: new Date().toISOString(), verified_by: uid };

      const { error } = await supabase
        .from("referral_services")
        .update(patch)
        .eq("id", r.id);

      if (error) throw error;
      await reload();
    } catch (e) {
      setErr(e?.message || String(e));
    }
  }

  async function removeRow(r) {
    if (!window.confirm(`Delete "${r.name}"? This cannot be undone.`)) return;
    try {
      setErr("");
      const { error } = await supabase.from("referral_services").delete().eq("id", r.id);
      if (error) throw error;
      await reload();
    } catch (e) {
      setErr(e?.message || String(e));
    }
  }

  async function createService() {
    try {
      setCreateErr("");
      setSaving(true);

      const payload = {
        ...form,
        phone: form.phone || null,
        whatsapp: form.whatsapp || null,
        website: form.website || null,
        region: form.region || null,
        district: form.district || null,
        address: form.address || null,
        hours: form.hours || null,
        notes: form.notes || null,
      };

      const { data: s } = await supabase.auth.getSession();
      const uid = s?.session?.user?.id;

      // if you tick "verified" on create, stamp verified_by/verified_at
      if (payload.is_verified) {
        payload.verified_at = new Date().toISOString();
        payload.verified_by = uid;
      }

      const { error } = await supabase.from("referral_services").insert([payload]);
      if (error) throw error;

      setIsNewOpen(false);
      setForm({
        name: "",
        category: "fp",
        region: "",
        district: "",
        address: "",
        hours: "",
        phone: "",
        whatsapp: "",
        website: "",
        youth_friendly: false,
        free_service: false,
        notes: "",
        is_active: true,
        is_verified: false,
      });

      await reload();
    } catch (e) {
      setCreateErr(e?.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  const isAdmin = role === "admin";

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-[1100px] px-4 py-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-4xl tracking-tight" style={{ fontFamily: "ui-serif, Georgia, Cambria, serif" }}>
              Manage Referrals
            </h1>
            <div className="mt-2 text-sm text-slate-600">
              Logged in as: <span className="font-semibold">{me?.email}</span>{" "}
              <span className="ml-2 rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                {role || "…"}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => navigate("/swahiba/cases")}
              className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
            >
              Back to Cases
            </button>

            <button
              type="button"
              onClick={() => setIsNewOpen(true)}
              disabled={!isAdmin}
              className={[
                "rounded-2xl px-4 py-2 text-sm font-semibold",
                isAdmin
                  ? "bg-amber-500 text-white hover:bg-amber-600"
                  : "bg-slate-200 text-slate-500 cursor-not-allowed",
              ].join(" ")}
            >
              + Add service
            </button>

            <button
              type="button"
              onClick={signOut}
              className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
            >
              Sign out
            </button>
          </div>
        </div>

        {!isAdmin && (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Your account is not admin, so you can’t add/verify/edit services.
          </div>
        )}

        {err && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {err}
          </div>
        )}

        {/* Filters */}
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name/region/district…"
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-300"
          />

          <select
            value={cat}
            onChange={(e) => setCat(e.target.value)}
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-300"
          >
            <option value="all">All categories</option>
            {CATS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={show}
            onChange={(e) => setShow(e.target.value)}
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-300"
          >
            <option value="all">All</option>
            <option value="verified">Verified</option>
            <option value="unverified">Unverified</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        {/* Table */}
        <div className="mt-6 rounded-3xl border border-slate-200 bg-white overflow-hidden">
          {loading ? (
            <div className="p-6 text-sm text-slate-600">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-sm text-slate-600">No services found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-5 py-4 text-left font-bold">Name</th>
                    <th className="px-5 py-4 text-left font-bold">Category</th>
                    <th className="px-5 py-4 text-left font-bold">Area</th>
                    <th className="px-5 py-4 text-left font-bold">Phone/WhatsApp</th>
                    <th className="px-5 py-4 text-left font-bold">Flags</th>
                    <th className="px-5 py-4 text-right font-bold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filtered.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-5 py-4">
                        <div className="font-extrabold text-slate-900">{r.name}</div>
                        {r.notes && <div className="mt-1 text-slate-600">{r.notes}</div>}
                      </td>
                      <td className="px-5 py-4">{r.category}</td>
                      <td className="px-5 py-4">
                        {(r.region || "—") + (r.district ? ` • ${r.district}` : "")}
                      </td>
                      <td className="px-5 py-4">
                        {r.phone ? <div>📞 {r.phone}</div> : <div className="text-slate-400">—</div>}
                        {r.whatsapp ? <div>💬 {r.whatsapp}</div> : null}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-2">
                          <span
                            className={[
                              "rounded-full px-2 py-1 text-xs font-semibold border",
                              r.is_active
                                ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                                : "bg-slate-100 text-slate-700 border-slate-200",
                            ].join(" ")}
                          >
                            {r.is_active ? "active" : "inactive"}
                          </span>
                          <span
                            className={[
                              "rounded-full px-2 py-1 text-xs font-semibold border",
                              r.is_verified
                                ? "bg-indigo-50 text-indigo-700 border-indigo-100"
                                : "bg-amber-50 text-amber-800 border-amber-100",
                            ].join(" ")}
                          >
                            {r.is_verified ? "verified" : "unverified"}
                          </span>
                          {r.youth_friendly && (
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 border border-slate-200">
                              youth-friendly
                            </span>
                          )}
                          {r.free_service && (
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 border border-slate-200">
                              free
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            disabled={!isAdmin}
                            onClick={() => toggleActive(r)}
                            className={[
                              "rounded-2xl border px-3 py-2 text-xs font-bold",
                              isAdmin
                                ? "border-slate-200 hover:bg-slate-50"
                                : "border-slate-200 text-slate-400 cursor-not-allowed",
                            ].join(" ")}
                          >
                            {r.is_active ? "Deactivate" : "Activate"}
                          </button>

                          <button
                            type="button"
                            disabled={!isAdmin}
                            onClick={() => toggleVerified(r)}
                            className={[
                              "rounded-2xl border px-3 py-2 text-xs font-bold",
                              isAdmin
                                ? "border-slate-200 hover:bg-slate-50"
                                : "border-slate-200 text-slate-400 cursor-not-allowed",
                            ].join(" ")}
                          >
                            {r.is_verified ? "Unverify" : "Verify"}
                          </button>

                          <button
                            type="button"
                            disabled={!isAdmin}
                            onClick={() => removeRow(r)}
                            className={[
                              "rounded-2xl border px-3 py-2 text-xs font-bold",
                              isAdmin
                                ? "border-red-200 text-red-700 hover:bg-red-50"
                                : "border-slate-200 text-slate-400 cursor-not-allowed",
                            ].join(" ")}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add modal */}
      {isNewOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setIsNewOpen(false)} />
          <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-white p-7 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div
                  className="text-2xl tracking-tight text-slate-900"
                  style={{ fontFamily: "ui-serif, Georgia, Cambria, serif" }}
                >
                  Add service
                </div>
                <div className="mt-2 text-sm text-slate-600">
                  Create a new referral option (verify when confirmed).
                </div>
              </div>

              <button
                ref={closeBtnRef}
                type="button"
                onClick={() => setIsNewOpen(false)}
                className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            {createErr && (
              <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {createErr}
              </div>
            )}

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Field label="Name">
                <input
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-300"
                />
              </Field>

              <Field label="Category">
                <select
                  value={form.category}
                  onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-300"
                >
                  {CATS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Region">
                <input
                  value={form.region}
                  onChange={(e) => setForm((p) => ({ ...p, region: e.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-300"
                />
              </Field>

              <Field label="District">
                <input
                  value={form.district}
                  onChange={(e) => setForm((p) => ({ ...p, district: e.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-300"
                />
              </Field>

              <Field label="Phone">
                <input
                  value={form.phone}
                  onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-300"
                />
              </Field>

              <Field label="WhatsApp">
                <input
                  value={form.whatsapp}
                  onChange={(e) => setForm((p) => ({ ...p, whatsapp: e.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-300"
                />
              </Field>

              <Field label="Hours">
                <input
                  value={form.hours}
                  onChange={(e) => setForm((p) => ({ ...p, hours: e.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-300"
                />
              </Field>

              <Field label="Website">
                <input
                  value={form.website}
                  onChange={(e) => setForm((p) => ({ ...p, website: e.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-300"
                />
              </Field>

              <div className="sm:col-span-2">
                <Field label="Address">
                  <input
                    value={form.address}
                    onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-300"
                  />
                </Field>
              </div>

              <div className="sm:col-span-2">
                <Field label="Notes">
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                    rows={3}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-300"
                  />
                </Field>
              </div>

              <div className="sm:col-span-2 flex flex-wrap gap-4 pt-2">
                <Check
                  checked={form.youth_friendly}
                  onChange={(v) => setForm((p) => ({ ...p, youth_friendly: v }))}
                  label="Youth-friendly"
                />
                <Check
                  checked={form.free_service}
                  onChange={(v) => setForm((p) => ({ ...p, free_service: v }))}
                  label="Free service"
                />
                <Check
                  checked={form.is_active}
                  onChange={(v) => setForm((p) => ({ ...p, is_active: v }))}
                  label="Active"
                />
                <Check
                  checked={form.is_verified}
                  onChange={(v) => setForm((p) => ({ ...p, is_verified: v }))}
                  label="Verified"
                />
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                disabled={saving || !form.name.trim()}
                onClick={createService}
                className={[
                  "rounded-2xl px-5 py-3 text-sm font-semibold text-white",
                  saving || !form.name.trim()
                    ? "bg-slate-300 cursor-not-allowed"
                    : "bg-amber-500 hover:bg-amber-600",
                ].join(" ")}
              >
                {saving ? "Saving…" : "Create service"}
              </button>

              <button
                type="button"
                onClick={() => setIsNewOpen(false)}
                className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <div className="mb-2 text-xs font-bold text-slate-600">{label}</div>
      {children}
    </label>
  );
}

function Check({ checked, onChange, label }) {
  return (
    <label className="inline-flex items-center gap-2 text-sm text-slate-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="font-semibold">{label}</span>
    </label>
  );
}