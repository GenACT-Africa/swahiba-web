import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useLanguage } from "../context/LanguageContext.jsx";

/** 🔁 CHANGE THIS to your real Supabase Storage bucket name */
const PRODUCT_IMAGES_BUCKET = "product-images";

/** ============== WhatsApp ============== */
const WHATSAPP_NUMBER = "+255780327697";

function digitsOnly(v) {
  return String(v || "").replace(/\D/g, "");
}

function waLink(message, overrideNumber) {
  const encoded = encodeURIComponent(message);
  const number = digitsOnly(overrideNumber || WHATSAPP_NUMBER);
  return `https://wa.me/${number}?text=${encoded}`;
}

/** ============== i18n (FULL for this page) ============== */
const i18n = {
  sw: {
    title: "Bidhaa",
    desc:
      "Swahiba inaungwa mkono na wanachama wa Mtandao wa GenACT Africa, wanaofanya kazi ya kuwawezesha jamii. Kwa kununua bidhaa hizi, unaunga mkono dhamira ya GenACT Africa na kusaidia Swahiba kuendelea kuwepo.",
    viewReviews: "Soma maoni",
    orderWA: "Agiza kupitia WhatsApp",
    close: "Funga",
    writeReview: "Andika maoni (kupitia WhatsApp)",
    loading: "Inapakia bidhaa…",
    empty: "Hakuna bidhaa kwa sasa.",
    noReviews: "Bado hakuna maoni.",
    talkCta: "Ongea na SWAHIBA",
    reviewsWord: "maoni",
    priceLabel: "TZS",
    unknownName: "—",
  },
  en: {
    title: "Products",
    desc:
      "Swahiba is supported by members of the GenACT Africa Network, whose work is to empower communities. By buying these products, you are helping GenACT Africa’s mission and helping this Swahiba to exist.",
    viewReviews: "View reviews",
    orderWA: "Order via WhatsApp",
    close: "Close",
    writeReview: "Write a review (via WhatsApp)",
    loading: "Loading products…",
    empty: "No products yet.",
    noReviews: "No reviews yet.",
    talkCta: "Talk to SWAHIBA",
    reviewsWord: "reviews",
    priceLabel: "TZS",
    unknownName: "—",
  },
};

function fmtTzs(n) {
  const num = Number(n || 0);
  return new Intl.NumberFormat("sw-TZ").format(Number.isFinite(num) ? num : 0);
}

/** =========================
 * IMAGE: Prefer image_path first
 * - Uses signed URL so it works for PRIVATE buckets
 * ========================= */
async function resolveProductImage(row) {
  // 1) Prefer Storage path (uploaded image)
  if (row.image_path && supabase?.storage) {
    const { data, error } = await supabase.storage
      .from(PRODUCT_IMAGES_BUCKET)
      .createSignedUrl(row.image_path, 60 * 60); // 1 hour

    if (!error && data?.signedUrl) return data.signedUrl;
  }

  // 2) Fallback to absolute URL
  if (row.image_url && /^https?:\/\//i.test(row.image_url)) return row.image_url;

  // 3) If image_url contains a storage path by mistake, try signed URL
  if (row.image_url && supabase?.storage) {
    const { data, error } = await supabase.storage
      .from(PRODUCT_IMAGES_BUCKET)
      .createSignedUrl(row.image_url, 60 * 60);

    if (!error && data?.signedUrl) return data.signedUrl;
  }

  return "";
}

function normalizeProduct(row, resolvedImage) {
  return {
    id: row.id,
    name: row.product_name || "—",
    desc: row.description || "",
    priceTzs: Number(row.price_tzs ?? 0),
    image: resolvedImage || "",
    rating: row.avg_rating != null ? Number(row.avg_rating) : null,
    reviewsCount: row.reviews_count != null ? Number(row.reviews_count) : 0,
    whatsappNumber: row.whatsapp_order_number || null,
    // no reviews table yet → modal will show "No reviews yet"
    reviews: [],
  };
}

/** ============== Fetch ============== */
async function fetchProducts() {
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, product_name, description, price_tzs, avg_rating, reviews_count, image_url, image_path, whatsapp_order_number, is_active, sort_order, updated_at"
    )
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export default function Marketplace() {
  const navigate = useNavigate();
  const { lang } = useLanguage();
  const langKey = useMemo(() => (lang === "SW" ? "sw" : "en"), [lang]);
  const t = useMemo(() => i18n[langKey] || i18n.sw, [langKey]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [products, setProducts] = useState([]);
  const [activeProduct, setActiveProduct] = useState(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setErr("");

      try {
        const rows = await fetchProducts();

        // Resolve images (signed URLs) in parallel
        const images = await Promise.all(rows.map((r) => resolveProductImage(r)));
        const normalized = rows.map((r, idx) => normalizeProduct(r, images[idx]));

        if (!alive) return;
        setProducts(normalized);
      } catch (e) {
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
  }, [langKey]);

  useEffect(() => {
    const onKeyDown = (e) => e.key === "Escape" && setActiveProduct(null);
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <main className="mx-auto max-w-[1200px] px-4 sm:px-6">
        <section className="py-20 sm:py-24">
          <div className="flex flex-col items-center text-center gap-4">
            <h2
              className="font-serif text-3xl tracking-tight sm:text-4xl"
              style={{ fontFamily: "ui-serif, Georgia, Cambria, serif" }}
            >
              {t.title}
            </h2>

            <p className="max-w-3xl text-sm leading-6 text-slate-600">{t.desc}</p>
          </div>

          {err && (
            <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {err}
            </div>
          )}

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {loading ? (
              <div className="col-span-full rounded-3xl border border-slate-200 bg-white p-7 text-sm text-slate-600">
                {t.loading}
              </div>
            ) : products.length === 0 ? (
              <div className="col-span-full rounded-3xl border border-slate-200 bg-white p-7 text-sm text-slate-600">
                {t.empty}
              </div>
            ) : (
              products.map((p) => (
                <ProductCard key={p.id} p={p} t={t} onViewReviews={() => setActiveProduct(p)} />
              ))
            )}
          </div>

          <div className="mt-10 flex justify-center">
            <button
              type="button"
              onClick={() => navigate("/talk")}
              className="inline-flex items-center justify-center rounded-2xl bg-amber-500 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-amber-600"
            >
              {t.talkCta}
            </button>
          </div>
        </section>
      </main>

      {activeProduct && (
        <Modal onClose={() => setActiveProduct(null)}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-lg font-extrabold">{activeProduct.name}</div>
              <div className="mt-1 text-sm text-slate-600">
                {activeProduct.rating ? (
                  <>
                    ★ {activeProduct.rating} • {activeProduct.reviewsCount} {t.reviewsWord}
                  </>
                ) : (
                  <>
                    {t.priceLabel} {fmtTzs(activeProduct.priceTzs)}
                  </>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActiveProduct(null)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50"
            >
              {t.close}
            </button>
          </div>

          <div className="mt-6 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              {t.noReviews}
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <a
              href={waLink(`Hi Swahiba, I want to write a review for: ${activeProduct.name}. My review:`)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
            >
              {t.writeReview}
            </a>

            <a
              href={waLink(
                `Hi Swahiba, I want to order: ${activeProduct.name}. Price: TZS ${activeProduct.priceTzs}. My location:`,
                activeProduct.whatsappNumber || WHATSAPP_NUMBER
              )}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-2xl bg-amber-500 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-600"
            >
              {t.orderWA}
            </a>
          </div>
        </Modal>
      )}
    </div>
  );
}

/** ===== UI COMPONENTS ===== */

function ProductCard({ p, t, onViewReviews }) {
  const price = fmtTzs(p.priceTzs);

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="relative h-44 w-full bg-slate-100">
        {p.image ? (
          <img src={p.image} alt={p.name} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
            No image
          </div>
        )}

        <div className="absolute left-3 top-3 rounded-full bg-white/85 px-3 py-1 text-xs font-semibold text-slate-900">
          {t.priceLabel} {price}
        </div>
      </div>

      <div className="p-5">
        <div className="text-sm font-extrabold">{p.name}</div>
        <div className="mt-1 text-sm text-slate-600">{p.desc}</div>

        <div className="mt-3 flex items-center justify-between">
          <div className="text-sm text-amber-700">
            {p.rating ? (
              <>
                ★★★★☆
                <span className="ml-2 text-slate-600">
                  {p.rating} <span className="text-slate-400">({p.reviewsCount} {t.reviewsWord})</span>
                </span>
              </>
            ) : (
              <span className="text-slate-500"> </span>
            )}
          </div>
        </div>

        <div className="mt-5 grid gap-3">
          <button
            type="button"
            onClick={onViewReviews}
            className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50"
          >
            {t.viewReviews}
          </button>

          <a
            href={waLink(
              `Hi Swahiba, I want to order: ${p.name}. Price: TZS ${p.priceTzs}. My location:`,
              p.whatsappNumber || WHATSAPP_NUMBER
            )}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center rounded-2xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-600"
          >
            {t.orderWA}
          </a>
        </div>
      </div>
    </div>
  );
}

function Modal({ children, onClose }) {
  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className="absolute inset-x-0 top-10 mx-auto w-[92%] max-w-2xl rounded-3xl bg-white p-6 shadow-xl sm:p-8">
        {children}
      </div>
    </div>
  );
}