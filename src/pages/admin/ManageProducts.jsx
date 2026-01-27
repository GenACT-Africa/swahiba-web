import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

const BUCKET = "product-images";

const EMPTY_FORM = {
  id: null,
  product_code: "",
  product_name: "",
  description: "",
  price_tzs: "",
  price_range: "",
  avg_rating: "",
  reviews_count: "",
  image_path: "",
  producer_group: "GenACT Youth Group",
  region: "Dar es Salaam",
  whatsapp_order_number: "",
  is_active: true,
  sort_order: 0,
};

function toInt(v, fallback = null) {
  if (v === "" || v === null || v === undefined) return fallback;
  const n = Number(v);
  if (Number.isNaN(n)) return fallback;
  return Math.trunc(n);
}

function toNum(v, fallback = null) {
  if (v === "" || v === null || v === undefined) return fallback;
  const n = Number(v);
  if (Number.isNaN(n)) return fallback;
  return n;
}

function extFromFile(file) {
  const name = file?.name || "";
  const dot = name.lastIndexOf(".");
  if (dot === -1) return "jpg";
  return name.slice(dot + 1).toLowerCase();
}

async function compressImage(file, { maxW = 1400, quality = 0.82 } = {}) {
  if (!file?.type?.startsWith("image/")) return file;

  const img = document.createElement("img");
  const url = URL.createObjectURL(file);

  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = url;
  });

  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;

  const scale = Math.min(1, maxW / w);
  const outW = Math.round(w * scale);
  const outH = Math.round(h * scale);

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, outW, outH);

  URL.revokeObjectURL(url);

  const mime = "image/jpeg";
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, mime, quality));

  const outFile = new File([blob], file.name.replace(/\.\w+$/, ".jpg"), {
    type: mime,
  });

  return outFile;
}

function publicImageUrl(image_path) {
  if (!image_path) return "";
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(image_path);
  return data?.publicUrl || "";
}

export default function ManageProducts() {
  const navigate = useNavigate();

  const [me, setMe] = useState(null);
  const [role, setRole] = useState(null);
  const [loadingRole, setLoadingRole] = useState(true);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [q, setQ] = useState("");
  const [rows, setRows] = useState([]);

  // modal
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const closeBtnRef = useRef(null);

  // scroll container ref (to reset scroll on open)
  const modalBodyRef = useRef(null);

  // image upload state
  const [pickedFile, setPickedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  // prevent background scroll while modal is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // load auth + role
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoadingRole(true);

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

  async function loadProducts() {
    setErr("");
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("products")
        .select(
          "id, product_code, product_name, description, price_tzs, price_range, avg_rating, reviews_count, image_path, image_url, producer_group, region, whatsapp_order_number, is_active, sort_order, updated_at"
        )
        .order("sort_order", { ascending: true })
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
    if (role === "admin") loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return (rows || []).filter((r) => {
      return (
        (r.product_code || "").toLowerCase().includes(s) ||
        (r.product_name || "").toLowerCase().includes(s) ||
        (r.region || "").toLowerCase().includes(s) ||
        (r.producer_group || "").toLowerCase().includes(s)
      );
    });
  }, [rows, q]);

  // modal a11y
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setTimeout(() => {
      closeBtnRef.current?.focus();
      // reset internal scroll to top when opening
      if (modalBodyRef.current) modalBodyRef.current.scrollTop = 0;
    }, 0);
  }, [open]);

  function resetImageState() {
    setPickedFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl("");
    setUploading(false);
  }

  function openNew() {
    setFormErr("");
    resetImageState();
    setForm({ ...EMPTY_FORM, sort_order: (rows?.length ?? 0) + 1 });
    setOpen(true);
  }

  function openEdit(row) {
    setFormErr("");
    resetImageState();
    setForm({
      id: row.id,
      product_code: row.product_code || "",
      product_name: row.product_name || "",
      description: row.description || "",
      price_tzs: row.price_tzs ?? "",
      price_range: row.price_range || "",
      avg_rating: row.avg_rating ?? "",
      reviews_count: row.reviews_count ?? "",
      image_path: row.image_path || "",
      producer_group: row.producer_group || "",
      region: row.region || "",
      whatsapp_order_number: row.whatsapp_order_number || "",
      is_active: !!row.is_active,
      sort_order: row.sort_order ?? 0,
    });
    setOpen(true);
  }

  function currentImageUrl() {
    return form.image_path ? publicImageUrl(form.image_path) : "";
  }

  async function uploadImageIfNeeded(productCode) {
    if (!pickedFile) return form.image_path || null;

    setUploading(true);
    try {
      const edited = await compressImage(pickedFile);

      const ext = extFromFile(edited);
      const safeCode = (productCode || "product").toLowerCase().replace(/[^a-z0-9_-]/g, "-");
      const path = `products/${safeCode}-${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, edited, { upsert: false, contentType: edited.type });

      if (upErr) throw upErr;

      return path;
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setFormErr("");

    if (!form.product_code.trim()) {
      setFormErr("Product code is required (e.g., p1).");
      return;
    }
    if (!form.product_name.trim()) {
      setFormErr("Product name is required.");
      return;
    }

    setSaving(true);
    try {
      const nextImagePath = await uploadImageIfNeeded(form.product_code.trim());

      const payload = {
        product_code: form.product_code.trim(),
        product_name: form.product_name.trim(),
        description: form.description?.trim() || null,
        price_tzs: toInt(form.price_tzs, null),
        price_range: form.price_range?.trim() || null,
        avg_rating: toNum(form.avg_rating, null),
        reviews_count: toInt(form.reviews_count, null),
        image_path: nextImagePath || null,
        producer_group: form.producer_group?.trim() || null,
        region: form.region?.trim() || null,
        whatsapp_order_number: form.whatsapp_order_number?.trim() || null,
        is_active: !!form.is_active,
        sort_order: toInt(form.sort_order, 0),
        updated_at: new Date().toISOString(),
      };

      let res;
      if (form.id) {
        res = await supabase.from("products").update(payload).eq("id", form.id).select("id").single();
      } else {
        res = await supabase.from("products").insert([payload]).select("id").single();
      }

      if (res.error) throw res.error;

      await loadProducts();
      setOpen(false);
      resetImageState();
    } catch (e) {
      setFormErr(e?.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(row) {
    setErr("");
    try {
      const { error } = await supabase
        .from("products")
        .update({ is_active: !row.is_active, updated_at: new Date().toISOString() })
        .eq("id", row.id);

      if (error) throw error;
      setRows((prev) => (prev || []).map((p) => (p.id === row.id ? { ...p, is_active: !row.is_active } : p)));
    } catch (e) {
      setErr(e?.message || String(e));
    }
  }

  async function remove(row) {
    const ok = window.confirm(`Delete "${row.product_name}"? This cannot be undone.`);
    if (!ok) return;

    setErr("");
    try {
      const { error } = await supabase.from("products").delete().eq("id", row.id);
      if (error) throw error;
      setRows((prev) => (prev || []).filter((p) => p.id !== row.id));
    } catch (e) {
      setErr(e?.message || String(e));
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate("/swahiba/login", { replace: true });
  }

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

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-[1100px] px-4 py-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-4xl tracking-tight" style={{ fontFamily: "ui-serif, Georgia, Cambria, serif" }}>
              Manage Products
            </h1>
            <div className="mt-2 text-sm text-slate-600">
              Logged in as: <span className="font-semibold">{me.email}</span> • role:{" "}
              <span className="font-semibold">admin</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => navigate("/")}
              className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
            >
              ← Back to site
            </button>
            <button
              onClick={openNew}
              className="rounded-2xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600"
            >
              + Add product
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
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{err}</div>
        )}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by code, name, region, producer group…"
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-300 sm:max-w-[520px]"
          />
          <button
            onClick={loadProducts}
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold hover:bg-slate-50"
          >
            Refresh
          </button>
        </div>

        <div className="mt-6 rounded-3xl border border-slate-200 bg-white">
          {loading ? (
            <div className="p-6 text-sm text-slate-600">Loading products…</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-sm text-slate-600">No products found.</div>
          ) : (
            <ul className="divide-y divide-slate-200">
              {filtered.map((p) => {
                const img = p.image_path ? publicImageUrl(p.image_path) : p.image_url || "";
                return (
                  <li key={p.id} className="p-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex gap-4">
                        <div className="h-16 w-16 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                          {img ? <img src={img} alt={p.product_name} className="h-full w-full object-cover" /> : null}
                        </div>

                        <div>
                          <div className="text-sm font-bold text-slate-900">
                            {p.product_name}{" "}
                            <span className="ml-2 rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                              {p.product_code || "—"}
                            </span>
                            <span
                              className={[
                                "ml-2 rounded-full px-2 py-1 text-xs font-semibold",
                                p.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700",
                              ].join(" ")}
                            >
                              {p.is_active ? "active" : "inactive"}
                            </span>
                          </div>

                          <div className="mt-1 text-sm text-slate-600">
                            TZS {p.price_tzs ?? "—"} • {p.region || "—"} • {p.producer_group || "—"}
                          </div>

                          <div className="mt-2 text-xs text-slate-500">
                            sort_order: <span className="font-semibold">{p.sort_order ?? 0}</span> • rating:{" "}
                            <span className="font-semibold">{p.avg_rating ?? "—"}</span> • reviews:{" "}
                            <span className="font-semibold">{p.reviews_count ?? "—"}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 sm:justify-end">
                        <button
                          onClick={() => toggleActive(p)}
                          className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
                        >
                          {p.is_active ? "Deactivate" : "Activate"}
                        </button>
                        <button
                          onClick={() => openEdit(p)}
                          className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => remove(p)}
                          className="rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
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
        </div>
      </div>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />

          {/* IMPORTANT: give the modal a max height and make it scrollable */}
          <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-3xl -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-white shadow-xl overflow-hidden">
            {/* Header stays fixed */}
            <div className="sticky top-0 z-10 border-b border-slate-200 bg-white p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div
                    className="text-2xl tracking-tight text-slate-900"
                    style={{ fontFamily: "ui-serif, Georgia, Cambria, serif" }}
                  >
                    {form.id ? "Edit product" : "Add product"}
                  </div>
                  <div className="mt-1 text-sm text-slate-600">
                    Upload an image (it will be stored in Supabase Storage).
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
            </div>

            {/* Scrollable body */}
            <div
              ref={modalBodyRef}
              className="max-h-[calc(90vh-160px)] overflow-y-auto p-6"
            >
              {/* Image uploader */}
              <div className="rounded-3xl border border-slate-200 p-5">
                <div className="text-sm font-semibold text-slate-700">Product image</div>

                <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="h-28 w-28 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                    {previewUrl ? (
                      <img src={previewUrl} alt="Preview" className="h-full w-full object-cover" />
                    ) : currentImageUrl() ? (
                      <img src={currentImageUrl()} alt="Current" className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-xs text-slate-500">No image</div>
                    )}
                  </div>

                  <div className="flex-1">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setPickedFile(file);
                        if (previewUrl) URL.revokeObjectURL(previewUrl);
                        setPreviewUrl(file ? URL.createObjectURL(file) : "");
                      }}
                      className="block w-full text-sm"
                    />
                    <p className="mt-2 text-xs text-slate-500">
                      Tip: we auto-resize/compress the image before upload (lightweight “edit”).
                    </p>
                  </div>
                </div>
              </div>

              {/* Form fields */}
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <Field label="Product code (e.g., p7)" required>
                  <input
                    value={form.product_code}
                    onChange={(e) => setForm((p) => ({ ...p, product_code: e.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
                  />
                </Field>

                <Field label="Product name" required>
                  <input
                    value={form.product_name}
                    onChange={(e) => setForm((p) => ({ ...p, product_name: e.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
                  />
                </Field>

                <Field label="Price (TZS)">
                  <input
                    value={form.price_tzs}
                    onChange={(e) => setForm((p) => ({ ...p, price_tzs: e.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
                  />
                </Field>

                <Field label="Price range (optional)">
                  <input
                    value={form.price_range}
                    onChange={(e) => setForm((p) => ({ ...p, price_range: e.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
                  />
                </Field>

                <Field label="Average rating (e.g., 4.6)">
                  <input
                    value={form.avg_rating}
                    onChange={(e) => setForm((p) => ({ ...p, avg_rating: e.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
                  />
                </Field>

                <Field label="Reviews count">
                  <input
                    value={form.reviews_count}
                    onChange={(e) => setForm((p) => ({ ...p, reviews_count: e.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
                  />
                </Field>

                <Field label="Producer group">
                  <input
                    value={form.producer_group}
                    onChange={(e) => setForm((p) => ({ ...p, producer_group: e.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
                  />
                </Field>

                <Field label="Region">
                  <input
                    value={form.region}
                    onChange={(e) => setForm((p) => ({ ...p, region: e.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
                  />
                </Field>

                <Field label="WhatsApp order number (optional)">
                  <input
                    value={form.whatsapp_order_number}
                    onChange={(e) => setForm((p) => ({ ...p, whatsapp_order_number: e.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
                  />
                </Field>

                <Field label="Sort order">
                  <input
                    value={form.sort_order}
                    onChange={(e) => setForm((p) => ({ ...p, sort_order: e.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
                  />
                </Field>

                <div className="sm:col-span-2">
                  <label className="text-sm font-semibold text-slate-700">Description</label>
                  <textarea
                    rows={3}
                    value={form.description}
                    onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
                  />
                </div>

                <div className="sm:col-span-2 flex items-center gap-3">
                  <input
                    id="is_active"
                    type="checkbox"
                    checked={!!form.is_active}
                    onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
                  />
                  <label htmlFor="is_active" className="text-sm font-semibold text-slate-700">
                    Active (visible to public)
                  </label>
                </div>
              </div>
            </div>

            {/* Footer stays fixed */}
            <div className="sticky bottom-0 border-t border-slate-200 bg-white p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saving || uploading}
                  onClick={save}
                  className="rounded-2xl bg-amber-500 px-5 py-3 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
                >
                  {uploading ? "Uploading image…" : saving ? "Saving…" : "Save product"}
                </button>
              </div>
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