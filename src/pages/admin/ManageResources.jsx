import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

/**
 * CURRENT DB table: public.resources
 *
 * Columns (based on your screenshot):
 * id uuid pk default gen_random_uuid()
 * title text
 * topic text
 * language text  -- "sw" | "en"
 * content text
 * published boolean default true
 * created_at timestamptz default now()
 * updated_at timestamptz default now()
 */

const EMPTY_FORM = {
  id: null,
  title: "",
  topic: "",
  language: "sw",
  content: "",
  resource_type: "article", // Added to handle different content types
  video_url: "", // For video content (YouTube/Vimeo)
  thumbnail_url: "", // For video thumbnail
  tags: "", // Tags to associate with the resource
  published: true,
};

const RESOURCE_TYPE_ICONS = { article: "📝", video: "🎥", infographic: "📊" };

export default function ManageResources() {
  const navigate = useNavigate();

  const [me, setMe] = useState(null);
  const [role, setRole] = useState(null);
  const [loadingRole, setLoadingRole] = useState(true);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [topicFilter, setTopicFilter] = useState("All");

  // modal
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const closeBtnRef = useRef(null);

  // Auth + role check
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoadingRole(true);
        setErr("");

        const { data: s, error: sErr } = await supabase.auth.getSession();
        if (sErr) throw sErr;

        const user = s?.session?.user ?? null;
        if (!alive) return;
        setMe(user);

        if (!user) {
          setRole(null);
          return;
        }

        const { data: prof, error: pErr } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();

        if (pErr) throw pErr;

        if (!alive) return;
        setRole(prof?.role ?? null);
      } catch (e) {
        if (!alive) return;
        setErr(e?.message || String(e));
      } finally {
        if (!alive) return;
        setLoadingRole(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  async function loadResources() {
    setErr("");
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("resources")
        .select("id, title, topic, language, content, resource_type, video_url, thumbnail_url, tags, published, created_at, updated_at")
        .order("updated_at", { ascending: false });

      if (error) throw error;
      setRows(data ?? []);
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (role === "admin") loadResources();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  // Modal a11y
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => closeBtnRef.current?.focus(), 0);
  }, [open]);

  const topics = useMemo(() => {
    const set = new Set((rows || []).map((r) => (r.topic || "").trim()).filter(Boolean));
    return ["All", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [rows]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (rows || []).filter((r) => {
      const matchesQ =
        !s ||
        (r.title || "").toLowerCase().includes(s) ||
        (r.topic || "").toLowerCase().includes(s) ||
        (r.language || "").toLowerCase().includes(s) ||
        (r.content || "").toLowerCase().includes(s);

      const matchesTopic = topicFilter === "All" || r.topic === topicFilter;

      return matchesQ && matchesTopic;
    });
  }, [rows, q, topicFilter]);

  function openNew() {
    setFormErr("");
    setForm({ ...EMPTY_FORM });
    setOpen(true);
  }

  function openEdit(r) {
    setFormErr("");
    setForm({
      id: r.id,
      title: r.title || "",
      topic: r.topic || "",
      language: r.language || "sw",
      content: r.content || "",
      resource_type: r.resource_type || "article", // Editing resource type
      video_url: r.video_url || "", // Editing video URL
      thumbnail_url: r.thumbnail_url || "", // Editing thumbnail URL
      tags: r.tags || "", // Editing tags
      published: !!r.published,
    });
    setOpen(true);
  }

  async function save() {
    setFormErr("");

    if (!form.title.trim()) {
      setFormErr("Title is required.");
      return;
    }
    if (!form.topic.trim()) {
      setFormErr("Topic is required (e.g. contraception, sti_hiv, gbv).");
      return;
    }
    if (!form.language.trim()) {
      setFormErr("Language is required (sw/en).");
      return;
    }
    if (!form.content.trim()) {
      setFormErr("Content is required.");
      return;
    }

    setSaving(true);
    try {
      const nowIso = new Date().toISOString();

      const payload = {
        title: form.title.trim(),
        topic: form.topic.trim(),
        language: form.language.trim().toLowerCase(),
        content: form.content.trim(),
        resource_type: form.resource_type.trim(),
        video_url: form.video_url.trim(),
        thumbnail_url: form.thumbnail_url.trim(),
        tags: form.tags.trim(),
        published: !!form.published,
        updated_at: nowIso,
      };

      let res;
      if (form.id) {
        res = await supabase
          .from("resources")
          .update(payload)
          .eq("id", form.id)
          .select("id")
          .single();
      } else {
        res = await supabase
          .from("resources")
          .insert([{ ...payload, created_at: nowIso }])
          .select("id")
          .single();
      }

      if (res.error) throw res.error;

      await loadResources();
      setOpen(false);
    } catch (e) {
      setFormErr(e?.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  async function togglePublished(r) {
    setErr("");
    try {
      const { error } = await supabase
        .from("resources")
        .update({ published: !r.published, updated_at: new Date().toISOString() })
        .eq("id", r.id);

      if (error) throw error;

      setRows((prev) =>
        (prev || []).map((x) => (x.id === r.id ? { ...x, published: !r.published } : x))
      );
    } catch (e) {
      setErr(e?.message || String(e));
    }
  }

  async function remove(r) {
    const ok = window.confirm(`Delete resource "${r.title}" (${r.topic}/${r.language})? This cannot be undone.`);
    if (!ok) return;

    setErr("");
    try {
      const { error } = await supabase.from("resources").delete().eq("id", r.id);
      if (error) throw error;
      setRows((prev) => (prev || []).filter((x) => x.id !== r.id));
    } catch (e) {
      setErr(e?.message || String(e));
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate("/swahiba/login", { replace: true });
  }

  // --- Guards ---
  if (loadingRole) {
    return (
      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-[1100px] px-4 py-10 text-sm text-slate-600">Loading…</div>
      </div>
    );
  }

  if (!me) {
    return (
      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-[1100px] px-4 py-10">
          <h1 className="text-2xl font-bold text-slate-900">Admin</h1>
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

  if (role !== "admin") {
    return (
      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-[1100px] px-4 py-10">
          <h1 className="text-2xl font-bold text-slate-900">Not authorized</h1>
          <p className="mt-2 text-sm text-slate-600">Your account does not have admin access.</p>
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

  // --- UI ---
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-[1100px] px-4 py-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-4xl tracking-tight" style={{ fontFamily: "ui-serif, Georgia, Cambria, serif" }}>
              Manage Resources
            </h1>
            <div className="mt-2 text-sm text-slate-600">
              Logged in as: <span className="font-semibold">{me.email}</span> • role:{" "}
              <span className="font-semibold">admin</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => navigate("/resources")}
              className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
            >
              View public Resources
            </button>
            <button
              onClick={openNew}
              className="rounded-2xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600"
            >
              + Add resource
            </button>
            <button
              onClick={signOut}
              className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
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

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by title, topic, language, content…"
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-300 sm:max-w-[520px]"
          />
          <button
            onClick={loadResources}
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold hover:bg-slate-50"
          >
            Refresh
          </button>
        </div>

        {/* Topic filter */}
        <div className="mt-4 flex flex-wrap gap-2">
          {topics.map((t) => (
            <button
              key={t}
              onClick={() => setTopicFilter(t)}
              className={[
                "rounded-2xl border px-4 py-2 text-sm font-semibold",
                topicFilter === t
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
              ].join(" ")}
            >
              {t}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="mt-6 rounded-3xl border border-slate-200 bg-white">
          {loading ? (
            <div className="p-6 text-sm text-slate-600">Loading resources…</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-sm text-slate-600">No resources found.</div>
          ) : (
            <ul className="divide-y divide-slate-200">
              {filtered.map((r) => (
                <li key={r.id} className="p-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="text-sm font-bold text-slate-900">
                        {r.title}{" "}
                        <span className="ml-2 rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                          {r.topic}
                        </span>
                        <span className="ml-2 rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                          {r.language}
                        </span>
                        <span
                          className={[
                            "ml-2 rounded-full px-2 py-1 text-xs font-semibold",
                            r.published ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700",
                          ].join(" ")}
                        >
                          {r.published ? "published" : "draft"}
                        </span>
                      </div>

                      <div className="mt-2 text-sm text-slate-700 line-clamp-2">
                        {r.content || "—"}
                      </div>

                      <div className="mt-2 text-xs text-slate-500">
                        Updated: <span className="font-semibold">{new Date(r.updated_at).toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 sm:justify-end">
                      <button
                        onClick={() => togglePublished(r)}
                        className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
                      >
                        {r.published ? "Unpublish" : "Publish"}
                      </button>
                      <button
                        onClick={() => openEdit(r)}
                        className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => remove(r)}
                        className="rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-3xl -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-white p-7 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-2xl tracking-tight text-slate-900" style={{ fontFamily: "ui-serif, Georgia, Cambria, serif" }}>
                  {form.id ? "Edit resource" : "Add resource"}
                </div>
                <div className="mt-1 text-sm text-slate-600">
                </div>
              </div>

              <button
                ref={closeBtnRef}
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            {formErr && (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {formErr}
              </div>
            )}

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Field label="Title" required>
                <input
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
                />
              </Field>

              <Field label="Topic" required>
                <input
                  value={form.topic}
                  onChange={(e) => setForm((p) => ({ ...p, topic: e.target.value }))}
                  placeholder="e.g. contraception, sti_hiv, gbv, mental_health"
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
                />
              </Field>

              <Field label="Language" required>
                <select
                  value={form.language}
                  onChange={(e) => setForm((p) => ({ ...p, language: e.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400"
                >
                  <option value="sw">sw</option>
                  <option value="en">en</option>
                </select>
              </Field>

              <Field label="Resource Type" required>
                <select
                  value={form.resource_type}
                  onChange={(e) => setForm((p) => ({ ...p, resource_type: e.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400"
                >
                  <option value="article">Article</option>
                  <option value="video">Video</option>
                  <option value="infographic">Infographic</option>
                </select>
              </Field>

              <Field label="Video URL (if applicable)">
                <input
                  value={form.video_url}
                  onChange={(e) => setForm((p) => ({ ...p, video_url: e.target.value }))}
                  placeholder="Enter YouTube or Vimeo link"
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
                />
              </Field>

              <Field label="Thumbnail URL (if applicable)">
                <input
                  value={form.thumbnail_url}
                  onChange={(e) => setForm((p) => ({ ...p, thumbnail_url: e.target.value }))}
                  placeholder="Enter thumbnail image URL"
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
                />
              </Field>

              <Field label="Tags (comma separated)">
                <input
                  value={form.tags}
                  onChange={(e) => setForm((p) => ({ ...p, tags: e.target.value }))}
                  placeholder="e.g. health, education, mental health"
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
                />
              </Field>

              <div className="flex items-center gap-3 sm:pt-8">
                <input
                  id="published"
                  type="checkbox"
                  checked={!!form.published}
                  onChange={(e) => setForm((p) => ({ ...p, published: e.target.checked }))}
                />
                <label htmlFor="published" className="text-sm font-semibold text-slate-700">
                  Published (visible to public)
                </label>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={save}
                className="rounded-2xl bg-amber-500 px-5 py-3 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save resource"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <div>
      <label className="text-sm font-semibold text-slate-700">
        {label} {required ? <span className="text-red-600">*</span> : null}
      </label>
      {children}
    </div>
  );
}
