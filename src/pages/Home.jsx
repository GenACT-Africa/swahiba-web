import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useLanguage } from "../context/LanguageContext.jsx";

/**
 * Home.jsx — Products from Supabase (no mock list)
 * ✅ Prefers image_path (uploaded image) over image_url (old mock URL)
 * ✅ Uses signed URLs (works for PRIVATE buckets too)
 * ✅ Keeps modal (shows “No reviews yet”)
 */

// 🔁 CHANGE THIS to your real Supabase Storage bucket name
const PRODUCT_IMAGES_BUCKET = "product-images";

const WHATSAPP_NUMBER = "+255780327697";

function digitsOnly(v) {
  return String(v || "").replace(/\D/g, "");
}

function waLink(message, overrideNumber) {
  const encoded = encodeURIComponent(message);
  const number = digitsOnly(overrideNumber || WHATSAPP_NUMBER);
  return `https://wa.me/${number}?text=${encoded}`;
}

/** =========================
 *  TRANSLATIONS (FULL)
 *  ========================= */
const i18n = {
  sw: {
    heroHeadlinePrefix: "Kwa taarifa na mwongozo sahihi wa kujihudumia",
    heroHeadlineHighlight: "Afya ya Mwili & Akili",
    heroChips: "Faragha kwanza • Rafiki kwa vijana • Binafsi",
    heroDisclaimer:
      "Kanusho: Swahiba si huduma ya dharura. Ikiwa uko hatarini mara moja au unahitaji msaada wa haraka wa kitabibu, piga simu ya dharura ya eneo lako au namba ya msaada unayoamini sasa hivi. Swahiba pia si AI. Utasaidiwa na kijana rika aliyehitimu na kufunzwa kutoka GenACT Africa anayesikiliza, anakupa mwongozo, na anakusaidia kuunganishwa na huduma sahihi.",

    whatCanDoTitle: "SWAHIBA Anaweza Kukusaidia Nini",
    cta1Title: "Kukupa taarifa sahihi",
    cta1Desc:
      "Majibu yaliyo wazi na rafiki kwa vijana unayoweza kuyaamini — kuvunja imani potofu, kukupa ukweli, na hatua za kuchukua.",
    cta2Title: "Kukupa msaada",
    cta2Desc:
      "Msaada wa faragha kutoka kwa rika — kuzungumza kwa utulivu kuhusu hali yako na kupanga hatua salama zinazofuata.",
    cta3Title: "Kukuunganisha na huduma",
    cta3Desc:
      "Inapohitajika, tunakuunganisha na watoa huduma waliopimwa na huduma zinazoaminika karibu nawe.",

    navTalk: "Ongea na SWAHIBA",

    howTitle: "Inavyofanya Kazi",
    step1Title: "Ukaguzi wa haraka",
    step1Desc: "Maswali ya dakika 2–5 ili kuelewa unachohitaji.",
    step2Title: "Ongea na SWAHIBA",
    step2Desc: "Zungumza kwa faragha kupitia WhatsApp.",
    step3Title: "Hatua inayofuata",
    step3Desc: "Taarifa, msaada wa ufuatiliaji, au rufaa kwa mtoa huduma.",

    trustTitle: "Usalama wako na faragha yako",
    trustA: "Faragha kwanza",
    trustAB1: "Unaweza kutumia jina la utani.",
    trustAB2: "Hatuombi jina lako kamili.",
    trustAB3: "Tunauliza tu taarifa zinazotusaidia kukusaidia.",
    trustALink: "Soma sera yetu ya matumizi ya data →",

    trustB: "Si huduma ya dharura",
    trustBText:
      "Ikiwa uko hatarini mara moja, piga simu ya dharura au namba ya msaada.",
    trustBBtn: "Mawasiliano ya dharura",

    trustC: "Ulinzi na usiri",
    trustCB1: "Tunahifadhi mazungumzo kwa faragha.",
    trustCB2:
      "Ikiwa kuna hatari kubwa ya madhara, tunaweza kukusaidia kupata msaada wa haraka.",
    trustCLink: "Sera ya ulinzi →",

    productsTitle: "Bidhaa",
    productsDesc:
      "Swahiba inaungwa mkono na wanachama wa Mtandao wa GenACT Africa, wanaofanya kazi ya kuwawezesha jamii. Kwa kununua bidhaa hizi, unaunga mkono dhamira ya GenACT Africa na kusaidia Swahiba kuendelea kuwepo.",
    viewReviews: "Soma maoni",
    orderWA: "Agiza kupitia WhatsApp",
    seeMore: "Ona zaidi",

    close: "Funga",
    reviewsWord: "maoni",
    writeReview: "Andika maoni (kupitia WhatsApp)",
    noReviewsYet: "Bado hakuna maoni.",

    loadingProducts: "Inapakia bidhaa...",
    productsLoadFailed: "Imeshindikana kupakia bidhaa.",
    noProducts: "Hakuna bidhaa kwa sasa.",

    stickyTitle: "Unahitaji msaada sasa?",
    stickySub: "Faragha kwanza • WhatsApp",
  },

  en: {
    heroHeadlinePrefix: "For reliable self-care information and guidance on",
    heroHeadlineHighlight: "Physical & Mental Health",
    heroChips: "Anonymous-first • Youth-friendly • Private",
    heroDisclaimer:
      "Disclaimer: Swahiba is not an emergency service. If you are in immediate danger or need urgent medical help, call local emergency services or a trusted hotline right now. Swahiba is also not AI. You will be supported by a real, trained peer from GenACT Africa who listens, offers guidance, and helps connect you to appropriate services.",

    whatCanDoTitle: "What SWAHIBA Can Do For You",
    cta1Title: "Give you reliable information",
    cta1Desc:
      "Clear, youth-friendly answers you can trust — myths, facts, and what to do next.",
    cta2Title: "Offer you help",
    cta2Desc:
      "Private peer support to talk through your situation and plan safe next steps.",
    cta3Title: "Link you to services",
    cta3Desc:
      "When needed, we connect you to trained providers and trusted nearby services.",

    navTalk: "Talk to SWAHIBA",

    howTitle: "How It Works",
    step1Title: "Quick check",
    step1Desc: "2–5 minute questions to understand what you need.",
    step2Title: "Talk to SWAHIBA",
    step2Desc: "Chat privately on WhatsApp.",
    step3Title: "Next step",
    step3Desc: "Info, follow-up support, or provider referral.",

    trustTitle: "Your safety & privacy",
    trustA: "Anonymous-first",
    trustAB1: "You can use a nickname.",
    trustAB2: "We don’t ask for your full name.",
    trustAB3: "We only ask what helps us support you.",
    trustALink: "Read our data use policy →",

    trustB: "Not an emergency service",
    trustBText:
      "If you are in immediate danger, call emergency services or a hotline.",
    trustBBtn: "Emergency contacts",

    trustC: "Safeguarding & confidentiality",
    trustCB1: "We keep conversations private.",
    trustCB2:
      "If there is serious risk of harm, we may help you access urgent support.",
    trustCLink: "Safeguarding policy →",

    productsTitle: "Products",
    productsDesc:
      "Swahiba is supported by members of the GenACT Africa Network, whose work is to empower communities. By buying these products, you are helping GenACT Africa’s mission and helping this Swahiba to exist.",
    viewReviews: "View reviews",
    orderWA: "Order via WhatsApp",
    seeMore: "See more",

    close: "Close",
    reviewsWord: "reviews",
    writeReview: "Write a review (via WhatsApp)",
    noReviewsYet: "No reviews yet.",

    loadingProducts: "Loading products...",
    productsLoadFailed: "Failed to load products.",
    noProducts: "No products yet.",

    stickyTitle: "Need help now?",
    stickySub: "Anonymous-first • WhatsApp",
  },
};

/**
 * IMPORTANT:
 * Your rows still have image_url=unsplash, image_path=uploaded file.
 * So we ALWAYS prefer image_path first.
 *
 * We use signed URLs so this works even if the bucket is private.
 */
async function resolveProductImage(row) {
  // 1) Prefer Storage path first
  const storagePath = row.image_path || null;
  if (storagePath && supabase?.storage) {
    const { data, error } = await supabase.storage
      .from(PRODUCT_IMAGES_BUCKET)
      .createSignedUrl(storagePath, 60 * 60); // 1 hour

    if (!error && data?.signedUrl) return data.signedUrl;
    // if signed fails (e.g., bucket is public but policy blocks), fall back below
  }

  // 2) Fallback to full URL (unsplash etc.)
  if (row.image_url && /^https?:\/\//i.test(row.image_url)) return row.image_url;

  // 3) Some projects mistakenly store path in image_url — try signed URL
  if (row.image_url && supabase?.storage) {
    const { data, error } = await supabase.storage
      .from(PRODUCT_IMAGES_BUCKET)
      .createSignedUrl(row.image_url, 60 * 60);

    if (!error && data?.signedUrl) return data.signedUrl;
  }

  return "";
}

function normalizeProduct(row, image) {
  return {
    id: row.id,
    name: row.product_name,
    desc: row.description ?? "",
    priceTzs: Number(row.price_tzs ?? 0),
    image: image || "",
    rating: Number(row.avg_rating ?? 0),
    reviewsCount: Number(row.reviews_count ?? 0),
    whatsappNumber: row.whatsapp_order_number ?? null,
  };
}

export default function Home() {
  const { lang } = useLanguage();
  const t = useMemo(() => (lang === "SW" ? i18n.sw : i18n.en), [lang]);

  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState("");

  const [activeProduct, setActiveProduct] = useState(null);

  useEffect(() => {
    if (!supabase) return;

    let alive = true;

    (async () => {
      setProductsLoading(true);
      setProductsError("");

      try {
        const { data, error } = await supabase
          .from("products")
          .select(
            "id, product_name, description, price_tzs, image_url, image_path, whatsapp_order_number, is_active, sort_order, avg_rating, reviews_count, updated_at"
          )
          .eq("is_active", true)
          .order("sort_order", { ascending: true })
          .limit(6);

        if (!alive) return;

        if (error) {
          setProductsError(error.message || "Unknown error");
          setProducts([]);
          return;
        }

        const rows = data ?? [];

        // Resolve images (signed URLs) in parallel
        const images = await Promise.all(rows.map((r) => resolveProductImage(r)));

        if (!alive) return;

        setProducts(rows.map((r, idx) => normalizeProduct(r, images[idx])));
      } catch (e) {
        if (!alive) return;
        setProductsError(e?.message || String(e));
        setProducts([]);
      } finally {
        if (!alive) return;
        setProductsLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") setActiveProduct(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const talkWhatsApp = () => {
    window.open(waLink(t.navTalk), "_blank", "noopener,noreferrer");
  };

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* HERO */}
      <section className="relative w-full">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url(Hero.png)" }} />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/75 via-slate-950/45 to-slate-950/20" />

        <div className="relative mx-auto max-w-[1200px] px-4 py-20 sm:px-6 sm:py-24 lg:py-28">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
            <div className="text-white lg:pt-10">
              <div className="flex items-start justify-end gap-3">
                <div className="mt-2 hidden h-3 w-3 rounded-full bg-white/40 sm:block" />
                <div className="max-w-xl text-left">
                  <p
                    className="font-serif text-3xl leading-tight tracking-tight sm:text-5xl"
                    style={{ fontFamily: "ui-serif, Georgia, Cambria, serif" }}
                  >
                    {t.heroHeadlinePrefix}{" "}
                    <span className="text-amber-300">{t.heroHeadlineHighlight}</span>
                  </p>

                  <div className="mt-6 flex flex-col items-start gap-2">
                    <button
                      type="button"
                      onClick={() => navigate("/talk")}
                      className="inline-flex items-center justify-center rounded-2xl bg-amber-500 px-8 py-4 text-sm font-semibold text-white shadow-sm hover:bg-amber-600"
                    >
                      {t.navTalk}
                    </button>

                    <div className="text-xs text-white/75 sm:text-sm text-left">{t.heroChips}</div>
                  </div>

                  <div className="mt-5 text-xs text-white/70 text-left">{t.heroDisclaimer}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MAIN */}
      <main className="mx-auto max-w-[1200px] px-4 sm:px-6">
        {/* What Swahiba can do */}
        <section className="py-16 sm:py-20">
          <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
            <h2
              className="text-center text-3xl tracking-tight sm:text-5xl"
              style={{ fontFamily: "ui-serif, Georgia, Cambria, serif" }}
            >
              {t.whatCanDoTitle}
            </h2>

            <div className="mt-10 grid gap-5 sm:mt-12 md:grid-cols-3">
              <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
                <div className="text-lg font-extrabold text-slate-900">{t.cta1Title}</div>
                <p className="mt-3 text-sm leading-7 text-slate-600">{t.cta1Desc}</p>
              </div>

              <div className="rounded-3xl border border-amber-200 bg-amber-50 p-7 shadow-sm">
                <div className="text-lg font-extrabold text-slate-900">{t.cta2Title}</div>
                <p className="mt-3 text-sm leading-7 text-slate-700">{t.cta2Desc}</p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
                <div className="text-lg font-extrabold text-slate-900">{t.cta3Title}</div>
                <p className="mt-3 text-sm leading-7 text-slate-600">{t.cta3Desc}</p>
              </div>
            </div>
          </div>

          <div className="mt-10 flex justify-center">
            <button
              type="button"
              onClick={() => navigate("/talk")}
              className="inline-flex items-center justify-center rounded-2xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-600"
            >
              {t.navTalk}
            </button>
          </div>
        </section>

        {/* How it works */}
        <section className="py-10 sm:py-24">
          <h2
            className="text-center font-serif text-3xl tracking-tight sm:text-4xl"
            style={{ fontFamily: "ui-serif, Georgia, Cambria, serif" }}
          >
            {t.howTitle}
          </h2>

          <div className="mt-10 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-col items-stretch gap-6 md:flex-row md:items-center md:justify-between">
              <StepBlock num="1" title={t.step1Title} desc={t.step1Desc} />
              <Arrow className="hidden md:flex" />
              <ArrowDown className="flex md:hidden" />
              <StepBlock num="2" title={t.step2Title} desc={t.step2Desc} />
              <Arrow className="hidden md:flex" />
              <ArrowDown className="flex md:hidden" />
              <StepBlock num="3" title={t.step3Title} desc={t.step3Desc} />
            </div>
          </div>
        </section>

        {/* Trust */}
        <section className="py-20 sm:py-24">
          <h2
            className="text-center font-serif text-3xl tracking-tight sm:text-4xl"
            style={{ fontFamily: "ui-serif, Georgia, Cambria, serif" }}
          >
            {t.trustTitle}
          </h2>

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="text-sm font-extrabold">{t.trustA}</div>
              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                <li>• {t.trustAB1}</li>
                <li>• {t.trustAB2}</li>
                <li>• {t.trustAB3}</li>
              </ul>
              <Link to="/data-use" className="mt-6 inline-flex font-bold text-amber-700 hover:text-amber-800">
                {t.trustALink}
              </Link>
            </div>

            <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
              <div className="text-sm font-extrabold">{t.trustB}</div>
              <p className="mt-3 text-sm leading-6 text-slate-700">{t.trustBText}</p>
              <button
                type="button"
                onClick={() => navigate("/emergency-contacts")}
                className="mt-6 rounded-2xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800"
              >
                {t.trustBBtn}
              </button>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="text-sm font-extrabold">{t.trustC}</div>
              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                <li>• {t.trustCB1}</li>
                <li>• {t.trustCB2}</li>
              </ul>
              <Link to="/safeguarding" className="mt-6 inline-flex font-bold text-amber-700 hover:text-amber-800">
                {t.trustCLink}
              </Link>
            </div>
          </div>
        </section>

        {/* Marketplace */}
        <section id="marketplace" className="scroll-mt-28 py-20 sm:py-24">
          <div className="flex flex-col items-center text-center gap-4">
            <h2 className="font-serif text-3xl tracking-tight sm:text-4xl" style={{ fontFamily: "ui-serif, Georgia, Cambria, serif" }}>
              {t.productsTitle}
            </h2>
            <p className="max-w-3xl text-sm leading-6 text-slate-600">{t.productsDesc}</p>
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {productsLoading && (
              <div className="col-span-full text-center text-sm text-slate-600">{t.loadingProducts}</div>
            )}

            {!productsLoading && productsError && (
              <div className="col-span-full text-center text-sm text-rose-600">
                {t.productsLoadFailed} <span className="text-slate-500">({productsError})</span>
              </div>
            )}

            {!productsLoading && !productsError && products.length === 0 && (
              <div className="col-span-full text-center text-sm text-slate-600">{t.noProducts}</div>
            )}

            {!productsLoading &&
              !productsError &&
              products.map((p) => (
                <ProductCard key={p.id} p={p} t={t} onViewReviews={() => setActiveProduct(p)} />
              ))}
          </div>

          <div className="mt-10 flex justify-center">
            <button
              type="button"
              onClick={() => navigate("/marketplace")}
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
            >
              {t.seeMore} →
            </button>
          </div>
        </section>
      </main>

      {/* REVIEWS MODAL */}
      {activeProduct && (
        <Modal onClose={() => setActiveProduct(null)}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-lg font-extrabold">{activeProduct.name}</div>
              <div className="mt-1 text-sm text-slate-600">
                ★ {activeProduct.rating} • {activeProduct.reviewsCount} {t.reviewsWord}
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

          <div className="mt-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
              {t.noReviewsYet}
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

      {/* Mobile sticky Talk button */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/85 backdrop-blur sm:hidden">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-extrabold">{t.stickyTitle}</div>
            <div className="truncate text-xs text-slate-600">{t.stickySub}</div>
          </div>
          <button
            type="button"
            onClick={talkWhatsApp}
            className="shrink-0 rounded-2xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-600"
          >
            {t.navTalk}
          </button>
        </div>
      </div>
    </div>
  );
}

/** UI COMPONENTS */

function StepBlock({ num, title, desc }) {
  return (
    <div className="w-full rounded-3xl bg-slate-50 p-5 sm:p-6 md:w-[280px]">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-slate-900 text-sm font-extrabold text-white">
          {num}
        </div>
        <div className="text-sm font-extrabold text-slate-900">{title}</div>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-600">{desc}</p>
    </div>
  );
}

function Arrow() {
  return (
    <div className="hidden md:flex w-14 items-center justify-center text-slate-400">
      <span className="text-4xl leading-none">→</span>
    </div>
  );
}

function ArrowDown() {
  return (
    <div className="flex md:hidden w-full items-center justify-center text-slate-400">
      <span className="text-3xl leading-none">↓</span>
    </div>
  );
}

function Stars({ rating = 0 }) {
  const r = Math.max(0, Math.min(5, Number(rating) || 0));
  const full = Math.floor(r);
  const empty = 5 - full;

  return (
    <span className="text-amber-700">
      {"★".repeat(full)}
      <span className="text-slate-300">{"★".repeat(empty)}</span>
    </span>
  );
}

function ProductCard({ p, t, onViewReviews }) {
  const price = new Intl.NumberFormat("sw-TZ").format(p.priceTzs);

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
          TZS {price}
        </div>
      </div>

      <div className="p-5">
        <div className="text-sm font-extrabold">{p.name}</div>
        <div className="mt-1 text-sm text-slate-600">{p.desc}</div>

        <div className="mt-3 flex items-center justify-between">
          <div className="text-sm">
            <Stars rating={p.rating} />
            <span className="ml-2 text-slate-600">
              {p.rating}{" "}
              <span className="text-slate-400">
                ({p.reviewsCount} {t.reviewsWord})
              </span>
            </span>
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