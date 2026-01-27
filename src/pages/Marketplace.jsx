import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useLanguage } from "../context/LanguageContext.jsx";

const PRODUCT_IMAGES_BUCKET = "product-images";
const WHATSAPP_NUMBER = "+255780327697";

/**
 * =========================
 * PACK CONFIG (EDIT LATER)
 * =========================
 */
const CRUNCH_BAG_NAME = "Crunch Bag";
const ADDON_NAMES = ["HIV Test", "PrEP"];

const PACKS = {
  male_pack: {
    code: "male_pack",
    label: { en: "4Him", sw: "4Pack" },
    imageSrc: "/Him.jpg",
    includesBag: true,
    freeAddonLimit: 1,
    priceTzs: 0,
    defaultMainNames: ["Male Condom", "Lubricant", "Soap"],
  },
  female_pack: {
    code: "female_pack",
    label: { en: "4Her", sw: "4Her" },
    imageSrc: "/Her.jpg",
    includesBag: true,
    freeAddonLimit: 1,
    priceTzs: 0,
    defaultMainNames: [
      "Female Condom",
      "Contraceptive Pills",
      "Emergency Pills",
      "Sanitary Pads",
      "Wipes",
    ],
  },
  couple_pack: {
    code: "couple_pack",
    label: { en: "4Couple", sw: "4Couple" },
    imageSrc: "/Couple.jpg",
    includesBag: true,
    freeAddonLimit: 2,
    priceTzs: 0,
    defaultMainNames: [
      "Rapid STI Test",
      "Lubricant",
      "Soap",
      "Roll-on Deodorant",
      "Pain Killers",
      "Male Condom",
      "Female Condom",
    ],
  },
};

const LS_KEYS = {
  cart: "swahiba_market_cart_v2",
};

function digitsOnly(v) {
  return String(v || "").replace(/\D/g, "");
}
function waLink(message, overrideNumber) {
  const encoded = encodeURIComponent(message);
  const number = digitsOnly(overrideNumber || WHATSAPP_NUMBER);
  return `https://wa.me/${number}?text=${encoded}`;
}

const i18n = {
  sw: {
    title: "Bidhaa",
    desc:
      "Swahiba inaungwa mkono na wanachama wa Mtandao wa GenACT Africa, wanaofanya kazi ya kuwawezesha jamii. Kwa kununua bidhaa hizi, unaunga mkono dhamira ya GenACT Africa na kusaidia Swahiba kuendelea kuwepo.",
    loading: "Inapakia bidhaa…",
    empty: "Hakuna bidhaa kwa sasa.",
    talkCta: "Ongea na SWAHIBA",

    tabBuyPack: "Nunua Pack",
    tabRefill: "Jaza Tena Pack",
    shopTitle: "Nunua Moja Moja",
    shopDesc: "Unaweza pia kuongeza bidhaa moja moja pamoja na pack yako.",

    packIncludesBag: "Inakuja na Crunch Bag",
    freeAddons: "Nyongeza bure",
    selectPack: "Chagua Pack",
    refillTitle: "Jaza Tena Pack",
    refillDesc:
      "Ingiza Pack No. ili kuona bidhaa za pack yako kisha uhariri refill.",
    packNoLabel: "Pack No.",
    packNoPlaceholder: "Mfano: SWB-3F9A1C0B7D22",
    findPack: "Tafuta Pack",
    packNotFound:
      "Pack haijapatikana. Hakiki Pack No. au hakikisha umeingia (login).",

    stepMain: "Bidhaa kuu",
    stepAddons: "Nyongeza bure",
    stepReview: "Kagua",
    continue: "Endelea",
    back: "Rudi",

    selectedItems: "Bidhaa zilizopo kwenye pack",
    addMore: "Ongeza bidhaa zaidi",
    search: "Tafuta bidhaa…",

    selected: "Umechagua",
    addToCart: "Weka kwenye kikapu",
    view: "Tazama",
    close: "Funga",

    cart: "Kikapu",
    checkout: "Kamilisha oda",
    clearCart: "Futa kikapu",

    deliveryDetails: "Maelezo ya delivery",
    location: "Mahali (eneo/kitongoji/landmark)",
    phone: "Namba ya simu",
    payment: "Malipo (ukipokea)",
    cash: "Cash",
    lipa: "Lipa Namba",
    sendOrder: "Tuma oda WhatsApp",
    orderSummary: "Muhtasari wa oda",

    optionalAddBag: "Ongeza Crunch Bag",
    bagMissingWarning: "Hujachagua bag. Endelea bila bag?",
    included: "Imejumuishwa",
    free: "BURE",
    priceLabel: "TZS",

    notAvailable: "Haipatikani kwa sasa",
    mustPickOneItem: "Chagua angalau bidhaa 1.",

    // ✅ Pack Manager
    packManagerTitle: "Pack Manager",
    packManagerSubtitle:
      "Hariri bidhaa za pack yako, kisha bonyeza 'Oda mpya' kuendelea na refill.",
    saveChanges: "Hifadhi mabadiliko",
    saving: "Inahifadhi...",
    saved: "Mabadiliko yamehifadhiwa.",
    newOrder: "Oda mpya ya refill",
    freeAddon: "Nyongeza bure",
    remove: "Ondoa",
    addNewItems: "Ongeza bidhaa mpya",

    // ✅ Product details
    ratingLabel: "Uhakiki",
    reviewsLabel: "Maoni",
    regionLabel: "Mkoa",
    producerLabel: "Kikundi cha wazalishaji",
    noData: "—",
  },
  en: {
    title: "Products",
    desc:
      "Swahiba is supported by members of the GenACT Africa Network, whose work is to empower communities. By buying these products, you are helping GenACT Africa’s mission and helping this Swahiba to exist.",
    loading: "Loading products…",
    empty: "No products yet.",
    talkCta: "Talk to SWAHIBA",

    tabBuyPack: "Buy a Pack",
    tabRefill: "Refill My Pack",
    shopTitle: "Shop Individual Products",
    shopDesc: "You can also add individual products alongside your pack.",

    packIncludesBag: "Includes Crunch Bag",
    freeAddons: "Free add-ons",
    selectPack: "Select pack",
    refillTitle: "Refill My Pack",
    refillDesc:
      "Enter your Pack No. to load your previous products and customize your refill.",
    packNoLabel: "Pack No.",
    packNoPlaceholder: "Example: SWB-3F9A1C0B7D22",
    findPack: "Find pack",
    packNotFound:
      "Pack not found. Check the Pack No. or make sure you are logged in.",

    stepMain: "Main products",
    stepAddons: "Free add-ons",
    stepReview: "Review",
    continue: "Continue",
    back: "Back",

    selectedItems: "Items currently in your pack",
    addMore: "Add more products",
    search: "Search products…",

    selected: "Selected",
    addToCart: "Add to cart",
    view: "View",
    close: "Close",

    cart: "Cart",
    checkout: "Checkout",
    clearCart: "Clear cart",

    deliveryDetails: "Delivery details",
    location: "Location (area/landmark)",
    phone: "Phone number",
    payment: "Payment (on delivery)",
    cash: "Cash",
    lipa: "Lipa Namba",
    sendOrder: "Send order via WhatsApp",
    orderSummary: "Order summary",

    optionalAddBag: "Add Crunch Bag",
    bagMissingWarning: "No bag selected. Continue without a bag?",
    included: "Included",
    free: "FREE",
    priceLabel: "TZS",

    notAvailable: "Not available right now",
    mustPickOneItem: "Select at least 1 product.",

    // ✅ Pack Manager
    packManagerTitle: "Pack Manager",
    packManagerSubtitle:
      "Edit your pack contents, then click 'New order' to proceed with refill.",
    saveChanges: "Save changes",
    saving: "Saving...",
    saved: "Saved.",
    newOrder: "New refill order",
    freeAddon: "Free add-on",
    remove: "Remove",
    addNewItems: "Add new items",

    // ✅ Product details
    ratingLabel: "Rating",
    reviewsLabel: "Reviews",
    regionLabel: "Region",
    producerLabel: "Producer group",
    noData: "—",
  },
};

function fmtTzs(n) {
  const num = Number(n || 0);
  return new Intl.NumberFormat("sw-TZ").format(Number.isFinite(num) ? num : 0);
}

async function resolveProductImage(row) {
  if (row.image_path && supabase?.storage) {
    const { data, error } = await supabase.storage
      .from(PRODUCT_IMAGES_BUCKET)
      .createSignedUrl(row.image_path, 60 * 60);
    if (!error && data?.signedUrl) return data.signedUrl;
  }

  if (row.image_url && /^https?:\/\//i.test(row.image_url)) return row.image_url;

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
    whatsappNumber: row.whatsapp_order_number || null,

    // ✅ extra details for modal
    avgRating: row.avg_rating ?? null,
    reviewsCount: row.reviews_count ?? null,
    region: row.region ?? null,
    producerGroup: row.producer_group ?? null,
  };
}

async function fetchProducts() {
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, product_name, description, price_tzs, image_url, image_path, whatsapp_order_number, is_active, sort_order, avg_rating, reviews_count, region, producer_group"
    )
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/**
 * =========================
 * PACK LOAD via Pack No
 * Requires DB objects:
 * - public.packs
 * - public.pack_items
 * - rpc: claim_pack_by_no(p_pack_no text)
 * =========================
 */
async function loadPackByNumber(packNo) {
  const { data: fnData, error: fnErr } = await supabase.functions.invoke("pack-refill", {
    body: { pack_no: packNo },
  });
  if (!fnErr && fnData?.pack) {
    return fnData;
  }

  const { data: claim, error: claimErr } = await supabase.rpc("claim_pack_by_no", {
    p_pack_no: packNo,
  });
  if (claimErr) throw claimErr;
  if (!claim || !claim.length) return null;

  const pack = claim[0];

  const { data: items, error: itemsErr } = await supabase
    .from("pack_items")
    .select(
      "id, qty, is_free, product:products(id, product_name, description, price_tzs, image_url, image_path, whatsapp_order_number)"
    )
    .eq("pack_id", pack.pack_id);

  if (itemsErr) throw itemsErr;

  return { pack, items: items || [] };
}

/**
 * =========================
 * CART (localStorage)
 * =========================
 */
function loadCart() {
  try {
    const raw = localStorage.getItem(LS_KEYS.cart);
    if (!raw) return { items: [] };
    const parsed = JSON.parse(raw);
    if (!parsed?.items || !Array.isArray(parsed.items)) return { items: [] };
    return parsed;
  } catch {
    return { items: [] };
  }
}

function saveCart(cart) {
  try {
    localStorage.setItem(LS_KEYS.cart, JSON.stringify(cart));
  } catch {}
}

function upsertCartItem(cart, item) {
  const idx = cart.items.findIndex((x) => x.key === item.key);
  if (idx >= 0) {
    const next = [...cart.items];
    next[idx] = { ...next[idx], ...item };
    return { ...cart, items: next };
  }
  return { ...cart, items: [...cart.items, item] };
}

function removeCartItem(cart, key) {
  return { ...cart, items: cart.items.filter((x) => x.key !== key) };
}

function cartTotals(cart) {
  const paid = cart.items.reduce(
    (sum, it) =>
      sum + (it.isFree ? 0 : (Number(it.priceTzs) || 0) * (Number(it.qty) || 0)),
    0
  );
  return { paid };
}

function buildOrderMessage({ flowType, packLabel, packNo, items, location, phone, paymentMethod }) {
  const lines = [];
  lines.push("Hi Swahiba, I want to place an order.");
  lines.push("");
  lines.push(`Order type: ${flowType}${packLabel ? ` (${packLabel})` : ""}`);
  if (packNo) lines.push(`Pack No: ${packNo}`);
  lines.push("");
  lines.push("Items:");
  for (const it of items) {
    const pricePart = it.isFree ? "FREE" : `TZS ${it.priceTzs}`;
    lines.push(`- ${it.name} x${it.qty} (${pricePart})`);
  }
  lines.push("");
  lines.push(`Delivery location: ${location || "-"}`);
  lines.push(`Phone: ${phone || "-"}`);
  lines.push(`Payment on delivery: ${paymentMethod === "lipa" ? "Lipa Namba" : "Cash"}`);
  lines.push("");
  lines.push("Thanks!");
  return lines.join("\n");
}

export default function Marketplace() {
  const navigate = useNavigate();
  const { lang } = useLanguage();
  const langKey = useMemo(() => (lang === "SW" ? "sw" : "en"), [lang]);
  const t = useMemo(() => i18n[langKey] || i18n.sw, [langKey]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [products, setProducts] = useState([]);

  // ✅ Tabs now only: buy_pack | refill
  const [tab, setTab] = useState("buy_pack");

  const [cart, setCart] = useState(() => loadCart());
  const [cartOpen, setCartOpen] = useState(false);

  const [activeProduct, setActiveProduct] = useState(null);

  // Refill via Pack No
  const [packNo, setPackNo] = useState("");
  const [refillErr, setRefillErr] = useState("");
  const [refillLoading, setRefillLoading] = useState(false);

  // ✅ Pack Manager modal state
  const [pmPack, setPmPack] = useState(null); // { pack, items }
  const [pmItems, setPmItems] = useState([]); // editable: [{ productId, qty, isFree }]
  const [pmSearch, setPmSearch] = useState("");
  const [pmErr, setPmErr] = useState("");
  const [pmSaving, setPmSaving] = useState(false);
  const [pmSaved, setPmSaved] = useState("");

  // Available packs for purchase
  const [availablePacks, setAvailablePacks] = useState([]);
  const [availablePackItems, setAvailablePackItems] = useState({});
  const [availablePackError, setAvailablePackError] = useState("");
  const [availablePackLoading, setAvailablePackLoading] = useState(false);
  const [availablePackOpen, setAvailablePackOpen] = useState(null);

  // Builder
  const [builderOpen, setBuilderOpen] = useState(false);
  const [builderMode, setBuilderMode] = useState("PACK_PURCHASE"); // PACK_PURCHASE | PACK_REFILL
  const [builderPackCode, setBuilderPackCode] = useState(null);
  const [builderPackNo, setBuilderPackNo] = useState(null);
  const [builderStep, setBuilderStep] = useState(1);
  const [builderMain, setBuilderMain] = useState({});
  const [builderAddons, setBuilderAddons] = useState({});
  const [builderProductsMap, setBuilderProductsMap] = useState({});
  const [builderAddBag, setBuilderAddBag] = useState(false);
  const [builderSearch, setBuilderSearch] = useState("");

  // Checkout
  const [location, setLocation] = useState("");
  const [phone, setPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");

  const byName = useMemo(() => {
    const map = new Map();
    for (const p of products) map.set(String(p.name || "").toLowerCase().trim(), p);
    return map;
  }, [products]);

  const crunchBag = useMemo(() => {
    const p = byName.get(CRUNCH_BAG_NAME.toLowerCase());
    return (
      p || {
        id: "virtual-crunch-bag",
        name: CRUNCH_BAG_NAME,
        desc: "",
        priceTzs: 0,
        image: "",
        whatsappNumber: null,
        avgRating: null,
        reviewsCount: null,
        region: null,
        producerGroup: null,
      }
    );
  }, [byName]);

  const addonIds = useMemo(() => {
    const ids = new Set();
    for (const p of products) {
      const isFree = Number(p.priceTzs || 0) === 0;
      const isBag = String(p.name || "").toLowerCase() === CRUNCH_BAG_NAME.toLowerCase();
      if (isFree && !isBag) ids.add(p.id);
    }
    return ids;
  }, [products]);

  const bagProductIds = useMemo(() => {
    const ids = new Set();
    for (const p of products) {
      const name = String(p.name || "").toLowerCase();
      if (name.includes("bag")) ids.add(p.id);
    }
    return ids;
  }, [products]);

  const mainCandidates = useMemo(() => {
    const q = builderSearch.trim().toLowerCase();
    return products
      .filter((p) => {
        const isAddon = addonIds.has(p.id);
        if (isAddon) return false;
        if (builderPackCode === "female_pack") {
          const name = String(p.name || "").toLowerCase().trim();
          if (name === "pregnancy test") return false;
        }
        if (!q) return true;
        return String(p.name).toLowerCase().includes(q);
      })
      .slice(0, 30);
  }, [products, builderSearch, addonIds, builderPackCode]);

  const addonCandidates = useMemo(() => {
    const q = builderSearch.trim().toLowerCase();
    return products
      .filter((p) => {
        if (!addonIds.has(p.id)) return false;
        if (!q) return true;
        return String(p.name).toLowerCase().includes(q);
      })
      .slice(0, 30);
  }, [products, builderSearch, addonIds]);

  const pmCandidates = useMemo(() => {
    const q = pmSearch.trim().toLowerCase();
    const existing = new Set(pmItems.map((x) => String(x.productId)));
    return products
      .filter((p) => {
        const isBag = String(p.name).toLowerCase() === CRUNCH_BAG_NAME.toLowerCase();
        if (isBag) return false;
        if (existing.has(String(p.id))) return false;
        if (!q) return true;
        return String(p.name).toLowerCase().includes(q);
      })
      .slice(0, 40);
  }, [products, pmSearch, pmItems]);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setErr("");
      try {
        const rows = await fetchProducts();
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

  useEffect(() => saveCart(cart), [cart]);

  useEffect(() => {
    const onKeyDown = (e) =>
      e.key === "Escape" &&
      (setActiveProduct(null), setCartOpen(false), setBuilderOpen(false));
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function builderPack() {
    return builderPackCode ? PACKS[builderPackCode] : null;
  }

  function builderPackLabel() {
    const p = builderPack();
    if (!p) return "";
    return p.label?.[langKey] || p.label?.en || "";
  }

  function builderFreeLimit() {
    const p = builderPack();
    return p ? Number(p.freeAddonLimit || 0) : 0;
  }

  function updateMainQty(productId, delta) {
    setBuilderMain((prev) => {
      const cur = Number(prev[productId] || 0);
      const next = cur + delta;
      const out = { ...prev };
      if (next <= 0) delete out[productId];
      else out[productId] = next;
      return out;
    });
  }

  function toggleAddon(productId, limit) {
    setBuilderAddons((prev) => {
      const isOn = !!prev[productId];
      if (isOn) {
        const out = { ...prev };
        delete out[productId];
        return out;
      }
      const count = Object.keys(prev).length;
      if (count >= limit) return prev;
      return { ...prev, [productId]: true };
    });
  }

  function openPackBuilderFromDefaults(packCode) {
    const pack = PACKS[packCode];
    if (!pack) return;

    const nextMain = {};
    for (const name of pack.defaultMainNames) {
      const p = byName.get(String(name).toLowerCase().trim());
      if (p) nextMain[p.id] = 1;
    }

    setBuilderMode("PACK_PURCHASE");
    setBuilderPackCode(packCode);
    setBuilderPackNo(null);
    setBuilderStep(1);
    setBuilderMain(nextMain);
    setBuilderAddons({});
    setBuilderProductsMap({});
    setBuilderAddBag(false);
    setBuilderSearch("");
    setBuilderOpen(true);
    loadAvailablePacks(packCode);
  }

  function openPackBuilderFromPackItems(packType, packNoValue, items) {
    const pack = PACKS[packType];
    if (!pack) return;

    const nextMain = {};
    const nextAddons = {};
    const nextMap = {};

    for (const it of items) {
      const product = it.product;
      if (!product?.id) continue;
      nextMap[String(product.id)] = {
        id: product.id,
        name: product.product_name || "—",
        desc: product.description || "",
        priceTzs: Number(product.price_tzs || 0),
        image: product.image_url || product.image || "",
        whatsappNumber: product.whatsapp_order_number || null,
      };
      const pid = product.id;
      const qty = Number(it.qty || 1);

      const name = String(product.product_name || "").toLowerCase().trim();
      const isBag = name === CRUNCH_BAG_NAME.toLowerCase();
      if (isBag) continue;

      if (it.is_free) {
        nextAddons[pid] = true;
      } else {
        nextMain[pid] = qty;
      }
    }

    setBuilderMode("PACK_REFILL");
    setBuilderPackCode(packType);
    setBuilderPackNo(packNoValue);
    setBuilderStep(1);
    setBuilderMain(nextMain);
    setBuilderAddons(nextAddons);
    setBuilderProductsMap(nextMap);
    setBuilderAddBag(false);
    setBuilderSearch("");
    setBuilderOpen(true);
  }

  async function loadAvailablePacks(packType) {
    if (!packType) return;
    setAvailablePackError("");
    setAvailablePackLoading(true);
    try {
      let list = [];
      let items = [];

      const { data: fnData, error: fnErr } = await supabase.functions.invoke("available-packs", {
        body: { pack_type: packType },
      });

      if (!fnErr && fnData?.packs) {
        list = fnData.packs || [];
        items = fnData.items || [];
      } else {
        const { data: packs, error: packsErr } = await supabase
          .from("packs")
          .select("id, pack_no, pack_type, user_id, is_active, created_at")
          .eq("pack_type", packType)
          .eq("is_active", true)
          .is("user_id", null)
          .order("created_at", { ascending: true });
        if (packsErr) throw packsErr;
        list = packs || [];

        if (list.length) {
          const ids = list.map((p) => p.id);
          const { data: packItems, error: itemsErr } = await supabase
            .from("pack_items")
            .select("id, pack_id, product_id, qty, is_free, products:products(id, product_name, price_tzs, image_url, image_path)")
            .in("pack_id", ids);
          if (itemsErr) throw itemsErr;
          items = packItems || [];
        }
      }

      setAvailablePacks(list);

      if (!list.length) {
        setAvailablePackItems({});
        setAvailablePackOpen(null);
        return;
      }
      const grouped = {};
      for (const it of items || []) {
        const product = it.products || {};
        const image = await resolveProductImage({
          image_path: product.image_path,
          image_url: product.image_url,
        });
        const merged = {
          ...it,
          products: { ...product, image },
        };
        if (!grouped[it.pack_id]) grouped[it.pack_id] = [];
        grouped[it.pack_id].push(merged);
      }
      setAvailablePackItems(grouped);
    } catch (e) {
      setAvailablePackError(e?.message || String(e));
      setAvailablePacks([]);
      setAvailablePackItems({});
    } finally {
      setAvailablePackLoading(false);
    }
  }

  function addProductToCart(p, qty = 1, isFree = false, meta = {}) {
    const safeQty = Math.max(1, Number(qty) || 1);
    const key = `${p.id}::${isFree ? "free" : "paid"}::${meta.source || "INDIVIDUAL"}::${meta.packNo || ""}`;

    setCart((prev) => {
      const existing = prev.items.find((x) => x.key === key);
      const nextQty = existing ? existing.qty + safeQty : safeQty;

      return upsertCartItem(prev, {
        key,
        productId: p.id,
        name: p.name,
        priceTzs: Number(p.priceTzs || 0),
        qty: nextQty,
        isFree,
        source: meta.source || "INDIVIDUAL",
        packLabel: meta.packLabel || null,
        flowType: meta.flowType || null,
        packNo: meta.packNo || null,
        packId: meta.packId || null,
      });
    });
  }

  function builderMainItemsResolved() {
    const items = [];
    for (const [pid, qty] of Object.entries(builderMain)) {
      const p =
        builderProductsMap[String(pid)] || products.find((x) => String(x.id) === String(pid));
      if (p) items.push({ p, qty: Number(qty || 1) });
    }
    items.sort((a, b) => a.p.name.localeCompare(b.p.name));
    return items;
  }

  function builderAddonItemsResolved() {
    const items = [];
    for (const pid of Object.keys(builderAddons)) {
      const p =
        builderProductsMap[String(pid)] || products.find((x) => String(x.id) === String(pid));
      if (p) items.push(p);
    }
    items.sort((a, b) => a.name.localeCompare(b.name));
    return items;
  }

  function finalizePackToCart() {
    const pack = builderPack();
    if (!pack) return;

    const hasAtLeastOne = Object.keys(builderMain).length > 0;
    if (!hasAtLeastOne) {
      alert(t.mustPickOneItem);
      return;
    }

    const flowType = builderMode === "PACK_REFILL" ? "PACK_REFILL" : "PACK_PURCHASE";
    const packLabel = builderPackLabel();

    const hasBagSelected =
      Object.keys(builderMain).some((pid) => bagProductIds.has(String(pid))) ||
      Object.keys(builderAddons).some((pid) => bagProductIds.has(String(pid)));
    if (builderMode === "PACK_PURCHASE" && !hasBagSelected) {
      const proceed = window.confirm(t.bagMissingWarning);
      if (!proceed) return;
    }

    // Main items (paid)
    for (const [pid, qty] of Object.entries(builderMain)) {
      const p = products.find((x) => String(x.id) === String(pid));
      if (!p) continue;
      addProductToCart(p, Number(qty || 1), false, {
        source: "PACK_MAIN",
        packLabel,
        flowType,
        packNo: builderPackNo || null,
      });
    }

    // Add-ons (free)
    for (const pid of Object.keys(builderAddons)) {
      const p = products.find((x) => String(x.id) === String(pid));
      if (!p) continue;
      addProductToCart(p, 1, true, {
        source: "PACK_ADDON_FREE",
        packLabel,
        flowType,
        packNo: builderPackNo || null,
      });
    }

    setBuilderOpen(false);
    setCartOpen(true);
  }

  function clearCart() {
    const next = { items: [] };
    setCart(next);
    saveCart(next);
  }

  function setCartItemQty(key, nextQty) {
    const qty = Math.max(1, Number(nextQty) || 1);
    setCart((prev) => {
      const it = prev.items.find((x) => x.key === key);
      if (!it) return prev;
      return upsertCartItem(prev, { ...it, qty });
    });
  }

  function deleteCartItem(key) {
    setCart((prev) => removeCartItem(prev, key));
  }

  const totals = useMemo(() => cartTotals(cart), [cart]);
  const cartCount = useMemo(
    () => cart.items.reduce((n, it) => n + (Number(it.qty) || 0), 0),
    [cart]
  );

  function sendOrderOnWhatsApp() {
    if (!cart.items.length) return;
    if (!location.trim() || !phone.trim()) return;

    const anyPack = cart.items.find((x) => x.flowType === "PACK_PURCHASE" || x.flowType === "PACK_REFILL");
    const flowType =
      anyPack?.flowType === "PACK_REFILL"
        ? "Pack Refill"
        : anyPack?.flowType === "PACK_PURCHASE"
        ? "Pack Purchase"
        : "Individual Products";

    const packLabel = anyPack?.packLabel || "";
    const packNoValue = anyPack?.packNo || null;

    const msg = buildOrderMessage({
      flowType,
      packLabel,
      packNo: packNoValue,
      items: cart.items.map((it) => ({
        name: it.name,
        qty: it.qty,
        priceTzs: it.isFree ? t.free : fmtTzs(it.priceTzs),
        isFree: it.isFree,
      })),
      location,
      phone,
      paymentMethod,
    });

    window.open(waLink(msg, WHATSAPP_NUMBER), "_blank", "noreferrer");

    const availablePackIds = Array.from(
      new Set(
        cart.items
          .filter((it) => it.flowType === "PACK_PURCHASE" && it.packId)
          .map((it) => it.packId)
      )
    );
    if (availablePackIds.length) {
      supabase.auth.getUser().then(({ data: auth }) => {
        const userId = auth?.user?.id || null;
        availablePackIds.forEach(async (packId) => {
          const payload = userId
            ? { user_id: userId, buyer_phone: phone, is_active: false, updated_at: new Date().toISOString() }
            : { buyer_phone: phone, is_active: false, updated_at: new Date().toISOString() };
          await supabase.from("packs").update(payload).eq("id", packId);
        });
      });
    }
  }

  /** =========================
   * ✅ PACK MANAGER (EDIT PACK)
   * ========================= */
  function pmUpsert(productId, deltaQty) {
    setPmItems((prev) => {
      const pid = String(productId);
      const idx = prev.findIndex((x) => String(x.productId) === pid);
      if (idx >= 0) {
        const next = [...prev];
        const cur = Number(next[idx].qty || 0);
        const q = cur + Number(deltaQty || 0);
        if (q <= 0) return next.filter((x) => String(x.productId) !== pid);
        next[idx] = { ...next[idx], qty: q };
        return next;
      }
      if (deltaQty <= 0) return prev;
      return [...prev, { productId: pid, qty: Number(deltaQty || 1), isFree: false }];
    });
  }

  function pmRemove(productId) {
    setPmItems((prev) => prev.filter((x) => String(x.productId) !== String(productId)));
  }

  function pmToggleFree(productId) {
    setPmItems((prev) =>
      prev.map((x) => (String(x.productId) === String(productId) ? { ...x, isFree: !x.isFree } : x))
    );
  }

  async function pmSave() {
    setPmErr("");
    setPmSaved("");
    if (!pmPack?.pack?.pack_id) return;

    setPmSaving(true);
    try {
      const packId = pmPack.pack.pack_id;

      const { error: delErr } = await supabase.from("pack_items").delete().eq("pack_id", packId);
      if (delErr) throw delErr;

      const payload = pmItems
        .filter((x) => Number(x.qty || 0) > 0)
        .map((x) => ({
          pack_id: packId,
          product_id: x.productId,
          qty: Number(x.qty || 1),
          is_free: x.isFree === true,
        }));

      if (payload.length) {
        const { error: insErr } = await supabase.from("pack_items").insert(payload);
        if (insErr) throw insErr;
      }

      setPmSaved(t.saved);
    } catch (e) {
      setPmErr(e?.message || "Failed to save");
    } finally {
      setPmSaving(false);
    }
  }

  function pmNewOrder() {
    if (!pmPack?.pack) return;
    const items = pmItems.map((x) => {
      const prod = products.find((p) => String(p.id) === String(x.productId));
      return {
        qty: Number(x.qty || 1),
        is_free: x.isFree === true,
        product: prod
          ? {
              id: prod.id,
              product_name: prod.name,
              description: prod.desc,
              price_tzs: prod.priceTzs,
              image_url: prod.image,
              whatsapp_order_number: prod.whatsappNumber,
            }
          : { id: x.productId, product_name: "—" },
      };
    });

    openPackBuilderFromPackItems(pmPack.pack.pack_type, pmPack.pack.pack_no, items);
  }

  const pmPackLabel = useMemo(() => {
    const type = pmPack?.pack?.pack_type;
    const pk = type ? PACKS[type] : null;
    return pk ? pk.label?.[langKey] || pk.label?.en || type : type || "";
  }, [pmPack?.pack?.pack_type, langKey]);

  const pmResolvedRows = useMemo(() => {
    return pmItems
      .map((x) => {
        const p = products.find((pp) => String(pp.id) === String(x.productId));
        return { ...x, product: p || null };
      })
      .sort((a, b) => (a.product?.name || "").localeCompare(b.product?.name || ""));
  }, [pmItems, products]);

  async function onFindPack() {
    setRefillErr("");
    setPmErr("");
    setPmSaved("");
    const v = packNo.trim();
    if (!v) return;

    setRefillLoading(true);
    try {
      const result = await loadPackByNumber(v);
      if (!result) {
        setRefillErr(t.packNotFound);
        return;
      }

      const items = result.items || [];
      for (const it of items) {
        if (!it.product) continue;
        const img = await resolveProductImage({
          image_path: it.product.image_path,
          image_url: it.product.image_url,
        });
        it.product.image_url = img || it.product.image_url;
      }

      const rows = items
        .filter((it) => it?.product?.id)
        .filter(
          (it) =>
            String(it.product.product_name || "").toLowerCase().trim() !== CRUNCH_BAG_NAME.toLowerCase()
        )
        .map((it) => ({
          productId: it.product.id,
          qty: Number(it.qty || 1),
          isFree: it.is_free === true,
        }));

      setPmItems(rows);
      setPmSearch("");
      openPackBuilderFromPackItems(result.pack.pack_type, result.pack.pack_no, items);
    } catch (e) {
      setRefillErr(e?.message || t.packNotFound);
    } finally {
      setRefillLoading(false);
    }
  }

  function IndividualProductsSection() {
    return (
      <div className="mt-10">
        <div className="rounded-3xl border border-slate-200 bg-white p-6">
          <div className="text-lg font-extrabold">{t.shopTitle}</div>
          <div className="mt-2 text-sm text-slate-600">{t.shopDesc}</div>

          <div className="mt-6">
            {loading ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-7 text-sm text-slate-600">
                {t.loading}
              </div>
            ) : products.length === 0 ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-7 text-sm text-slate-600">
                {t.empty}
              </div>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {products.map((p) => (
                  <ProductCard
                    key={p.id}
                    p={p}
                    t={t}
                    onView={() => setActiveProduct(p)}
                    onAdd={() => {
                      addProductToCart(p, 1, false, { source: "INDIVIDUAL", flowType: "INDIVIDUAL" });
                      setCartOpen(true);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <main className="mx-auto max-w-[1200px] px-4 sm:px-6">
        <section className="py-14 sm:py-18">
          <div className="flex flex-col items-center text-center gap-4">
            <h2 className="font-serif text-3xl tracking-tight sm:text-4xl" style={{ fontFamily: "ui-serif, Georgia, Cambria, serif" }}>
              {t.title}
            </h2>
            <p className="max-w-3xl text-sm leading-6 text-slate-600">{t.desc}</p>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Tabs
              value={tab}
              onChange={setTab}
              options={[
                { value: "buy_pack", label: t.tabBuyPack },
                { value: "refill", label: t.tabRefill },
              ]}
            />

            <div className="flex items-center gap-3 justify-center sm:justify-end">
              <button
                type="button"
                onClick={() => setCartOpen(true)}
                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50"
              >
                {t.cart} {cartCount ? `(${cartCount})` : ""}
              </button>

              <button
                type="button"
                onClick={() => navigate("/talk")}
                className="inline-flex items-center justify-center rounded-2xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-600"
              >
                {t.talkCta}
              </button>
            </div>
          </div>

          {err && (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {err}
            </div>
          )}

          <div className="mt-8">
            {/* BUY PACK */}
            {tab === "buy_pack" && (
              <>
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {Object.values(PACKS).map((pk) => (
                    <PackCard
                      key={pk.code}
                      title={pk.label?.[langKey] || pk.label?.en}
                      imageSrc={pk.imageSrc}
                      subtitle={`${t.packIncludesBag} • ${t.freeAddons}: ${pk.freeAddonLimit}`}
                      onSelect={() => openPackBuilderFromDefaults(pk.code)}
                      cta={t.selectPack}
                    />
                  ))}
                </div>

                <IndividualProductsSection />
              </>
            )}

            {/* REFILL */}
            {tab === "refill" && (
              <>
                <div className="rounded-3xl border border-slate-200 bg-white p-6">
                  <div className="text-lg font-extrabold">{t.refillTitle}</div>
                  <div className="mt-2 text-sm text-slate-600">{t.refillDesc}</div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
                    <div>
                      <label className="text-xs font-semibold text-slate-700">{t.packNoLabel}</label>
                      <input
                        value={packNo}
                        onChange={(e) => setPackNo(e.target.value)}
                        placeholder={t.packNoPlaceholder}
                        className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-amber-300"
                      />
                      {refillErr && <div className="mt-2 text-sm text-red-600">{refillErr}</div>}
                    </div>

                    <button
                      type="button"
                      onClick={onFindPack}
                      disabled={!packNo.trim() || refillLoading}
                      className={`h-[46px] self-end inline-flex items-center justify-center rounded-2xl px-5 text-sm font-semibold text-white shadow-sm ${
                        !packNo.trim() || refillLoading ? "bg-slate-300 cursor-not-allowed" : "bg-amber-500 hover:bg-amber-600"
                      }`}
                    >
                      {refillLoading ? "..." : t.findPack}
                    </button>
                  </div>
                </div>

                <IndividualProductsSection />
              </>
            )}
          </div>
        </section>
      </main>

      {/* ✅ Pack Manager Modal */}
      {/* ✅ Product quick view (UPDATED) */}
      {activeProduct && (
        <Modal onClose={() => setActiveProduct(null)}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-lg font-extrabold">{activeProduct.name}</div>
              <div className="mt-1 text-sm text-slate-600">
                {t.priceLabel} {fmtTzs(activeProduct.priceTzs)}
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

          {/* Image */}
          <div className="mt-5 overflow-hidden rounded-3xl border border-slate-200 bg-slate-100">
            {activeProduct.image ? (
              <img
                src={activeProduct.image}
                alt={activeProduct.name}
                className="h-56 w-full object-cover sm:h-64"
                loading="lazy"
              />
            ) : (
              <div className="grid h-56 w-full place-items-center text-sm text-slate-500 sm:h-64">
                No image
              </div>
            )}
          </div>

          {/* Meta */}
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <MetaCard
              label={t.ratingLabel}
              value={
                activeProduct.avgRating !== null && activeProduct.avgRating !== undefined
                  ? String(activeProduct.avgRating)
                  : t.noData
              }
            />
            <MetaCard
              label={t.reviewsLabel}
              value={
                activeProduct.reviewsCount !== null && activeProduct.reviewsCount !== undefined
                  ? String(activeProduct.reviewsCount)
                  : t.noData
              }
            />
            <MetaCard label={t.regionLabel} value={activeProduct.region || t.noData} />
            <MetaCard label={t.producerLabel} value={activeProduct.producerGroup || t.noData} />
          </div>

          {/* Description */}
          {activeProduct.desc ? (
            <div className="mt-5 text-sm text-slate-700 whitespace-pre-line">{activeProduct.desc}</div>
          ) : null}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={() => {
                addProductToCart(activeProduct, 1, false, { source: "INDIVIDUAL", flowType: "INDIVIDUAL" });
                setActiveProduct(null);
                setCartOpen(true);
              }}
              className="inline-flex items-center justify-center rounded-2xl bg-amber-500 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-600"
            >
              {t.addToCart}
            </button>
          </div>
        </Modal>
      )}

      {/* Pack Builder */}
      {builderOpen && (
        <Modal onClose={() => setBuilderOpen(false)}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-lg font-extrabold">
                {builderMode === "PACK_REFILL" ? t.refillTitle : t.selectPack} {builderPackLabel()}
              </div>
              {builderPackNo ? (
                <div className="mt-1 text-xs text-slate-600">{t.packNoLabel}: {builderPackNo}</div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => setBuilderOpen(false)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50"
            >
              {t.close}
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <StepPill active={builderStep === 1} label={t.stepMain} />
            <StepPill active={builderStep === 2} label={t.stepAddons} />
            <StepPill active={builderStep === 3} label={t.stepReview} />
          </div>

          {builderStep === 1 && (
            <div className="mt-6 space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">
                    {langKey === "sw" ? "Packs zilizopo" : "Available packs"}
                  </div>
                  <div className="text-xs text-slate-500">
                    {availablePacks.length
                      ? `${langKey === "sw" ? "Jumla" : "Total"}: ${availablePacks.length}`
                      : "—"}
                  </div>
                </div>

                {availablePackLoading ? (
                  <div className="mt-3 text-sm text-slate-500">{langKey === "sw" ? "Inapakia…" : "Loading…"}</div>
                ) : availablePackError ? (
                  <div className="mt-3 text-sm text-red-600">{availablePackError}</div>
                ) : availablePacks.length === 0 ? (
                  <div className="mt-3 text-sm text-slate-500">
                    {langKey === "sw" ? "Hakuna pack zilizopo kwa sasa." : "No available packs right now."}
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    {availablePacks.map((p) => {
                      const items = availablePackItems[p.id] || [];
                      const paidItems = items.filter((x) => !x.is_free);
                      const freeItems = items.filter((x) => x.is_free);
                      const totalPaid = paidItems.reduce(
                        (sum, x) => sum + (Number(x.qty || 0) * Number(x.products?.price_tzs || 0)),
                        0
                      );
                      const open = availablePackOpen === p.id;

                      const hasBag =
                        items.some((x) =>
                          String(x.products?.product_name || "").toLowerCase().includes("bag")
                        );

                      return (
                        <div key={p.id} className="rounded-2xl border border-slate-200 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold">{p.pack_no}</div>
                              <div className="mt-1 text-xs text-slate-500">
                                {t.priceLabel} {fmtTzs(totalPaid)} •{" "}
                                {langKey === "sw"
                                  ? `Vya kulipia: ${paidItems.length}, Bure: ${freeItems.length}`
                                  : `Paid: ${paidItems.length}, Free: ${freeItems.length}`}
                              </div>
                            </div>
                            <div className="flex flex-col gap-2">
                              <button
                                type="button"
                                onClick={() => setAvailablePackOpen(open ? null : p.id)}
                                className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold hover:bg-slate-50"
                              >
                                {open ? t.close : t.view}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (!hasBag) {
                                    const proceed = window.confirm(t.bagMissingWarning);
                                    if (!proceed) return;
                                  }
                                  const packLabel = builderPackLabel();
                                  for (const it of items) {
                                    const prod = it.products;
                                    if (!prod?.id) continue;
                                    addProductToCart(
                                      {
                                        id: prod.id,
                                        name: prod.product_name || "—",
                                        priceTzs: Number(prod.price_tzs || 0),
                                      },
                                      Number(it.qty || 1),
                                      Boolean(it.is_free),
                                      {
                                        source: "PACK_AVAILABLE",
                                        packLabel,
                                        flowType: "PACK_PURCHASE",
                                        packNo: p.pack_no,
                                        packId: p.id,
                                      }
                                    );
                                  }
                                  setBuilderOpen(false);
                                  setCartOpen(true);
                                }}
                                className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                              >
                                {langKey === "sw" ? "Nunua pack hii" : "Buy this pack"}
                              </button>
                            </div>
                          </div>

                          {open ? (
                            <div className="mt-3 space-y-2">
                              {items.map((it) => (
                                <div
                                  key={it.id}
                                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-2"
                                >
                                  <div className="flex items-center gap-2">
                                    {it.products?.image ? (
                                      <img
                                        src={it.products.image}
                                        alt={it.products?.product_name || "product"}
                                        className="h-8 w-8 rounded-lg object-cover"
                                      />
                                    ) : null}
                                    <div className="text-xs font-semibold">{it.products?.product_name || "—"}</div>
                                  </div>
                                  <div className="text-xs text-slate-500">
                                    x{it.qty} •{" "}
                                    {it.is_free ? t.free : `${t.priceLabel} ${fmtTzs(it.products?.price_tzs || 0)}`}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="text-sm font-semibold text-slate-700">{t.selectedItems}</div>
              {builderMainItemsResolved().length === 0 ? (
                <div className="text-sm text-slate-500">{t.mustPickOneItem}</div>
              ) : (
                <div className="space-y-3">
                  {builderMainItemsResolved().map(({ p, qty }) => (
                    <QtyRow
                      key={p.id}
                      image={p.image}
                      name={p.name}
                      subtitle={`${t.priceLabel} ${fmtTzs(p.priceTzs)}`}
                      qty={qty}
                      onMinus={() => updateMainQty(p.id, -1)}
                      onPlus={() => updateMainQty(p.id, 1)}
                    />
                  ))}
                </div>
              )}

              {builderAddonItemsResolved().length ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="text-sm font-semibold">{t.freeAddons}</div>
                  <div className="mt-3 space-y-2">
                    {builderAddonItemsResolved().map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-2"
                      >
                        <div className="flex items-center gap-2">
                          <Thumb image={p.image} />
                          <div className="text-xs font-semibold">{p.name}</div>
                        </div>
                        <div className="text-xs text-emerald-700">{t.free}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-sm font-semibold">{t.addMore}</div>
                <input
                  value={builderSearch}
                  onChange={(e) => setBuilderSearch(e.target.value)}
                  placeholder={t.search}
                  className="mt-3 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-amber-300"
                />
                <div className="mt-4 space-y-3">
                  {mainCandidates.map((p) => (
                    <AddRow
                      key={p.id}
                      image={p.image}
                      name={p.name}
                      priceLabel={`${t.priceLabel} ${fmtTzs(p.priceTzs)}`}
                      onAdd={() => updateMainQty(p.id, 1)}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {builderStep === 2 && (
            <div className="mt-6 space-y-4">
              <div className="text-sm text-slate-600">
                {t.freeAddons}: {Object.keys(builderAddons).length}/{builderFreeLimit()}
              </div>
              {builderFreeLimit() > 0 && Object.keys(builderAddons).length < builderFreeLimit() ? (
                <div className="text-sm text-amber-700">
                  {langKey === "sw"
                    ? `Chagua nyongeza bure ${builderFreeLimit()}`
                    : `Select ${builderFreeLimit()} free add-on${builderFreeLimit() === 1 ? "" : "s"}`}
                </div>
              ) : null}
              <div className="space-y-3">
                {addonCandidates.map((p) => {
                  const selected = !!builderAddons[p.id];
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 p-3"
                    >
                      <div className="flex items-center gap-3">
                        <Thumb image={p.image} />
                        <div>
                          <div className="text-sm font-semibold">{p.name}</div>
                          <div className="text-xs text-slate-600">{t.free}</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleAddon(p.id, builderFreeLimit())}
                        className={`rounded-xl px-3 py-2 text-xs font-semibold ${
                          selected ? "bg-emerald-100 text-emerald-800" : "bg-amber-500 text-white hover:bg-amber-600"
                        }`}
                      >
                        {selected ? t.selected : "+ Add"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {builderStep === 3 && (
            <div className="mt-6 space-y-4">
              {builderMode === "PACK_PURCHASE" &&
              !(
                Object.keys(builderMain).some((pid) => bagProductIds.has(String(pid))) ||
                Object.keys(builderAddons).some((pid) => bagProductIds.has(String(pid)))
              ) ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  {t.bagMissingWarning}
                </div>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <MetaCard label={t.selectedItems} value={`${builderMainItemsResolved().length}`} />
                <MetaCard label={t.freeAddons} value={`${builderAddonItemsResolved().length}`} />
              </div>

              <div className="space-y-3">
                {builderMainItemsResolved().map(({ p, qty }) => (
                  <QtyRow
                    key={p.id}
                    image={p.image}
                    name={p.name}
                    subtitle={`${t.priceLabel} ${fmtTzs(p.priceTzs)}`}
                    qty={qty}
                    onMinus={() => updateMainQty(p.id, -1)}
                    onPlus={() => updateMainQty(p.id, 1)}
                  />
                ))}
              </div>

              {builderAddonItemsResolved().length ? (
                <div className="mt-4 space-y-2">
                  {builderAddonItemsResolved().map((p) => (
                    <div key={p.id} className="flex items-center justify-between rounded-2xl border border-slate-200 p-3">
                      <div className="flex items-center gap-3">
                        <Thumb image={p.image} />
                        <div className="text-sm font-semibold">{p.name}</div>
                      </div>
                      <span className="text-xs font-semibold text-emerald-700">{t.free}</span>
                    </div>
                  ))}
                </div>
              ) : null}

              {builderMode === "PACK_REFILL" ? (
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={builderAddBag}
                    onChange={(e) => setBuilderAddBag(e.target.checked)}
                  />
                  {t.optionalAddBag}
                </label>
              ) : null}
            </div>
          )}

          <div className="mt-6 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setBuilderStep((s) => Math.max(1, s - 1))}
              disabled={builderStep === 1}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              {t.back}
            </button>

            {builderStep < 3 ? (
              <button
                type="button"
                onClick={() => setBuilderStep((s) => Math.min(3, s + 1))}
                disabled={
                  (builderStep === 1 && Object.keys(builderMain).length === 0) ||
                  (builderStep === 2 &&
                    builderFreeLimit() > 0 &&
                    Object.keys(builderAddons).length < builderFreeLimit())
                }
                className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:bg-slate-300"
              >
                {t.continue}
              </button>
            ) : (
              <button
                type="button"
                onClick={finalizePackToCart}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                {t.addToCart}
              </button>
            )}
          </div>
        </Modal>
      )}

      {/* Cart & Checkout */}
      {cartOpen && (
        <Modal onClose={() => setCartOpen(false)}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-lg font-extrabold">{t.cart}</div>
              <div className="mt-1 text-sm text-slate-600">{t.orderSummary}</div>
            </div>
            <button
              type="button"
              onClick={() => setCartOpen(false)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50"
            >
              {t.close}
            </button>
          </div>

          {cart.items.length === 0 ? (
            <div className="mt-6 text-sm text-slate-500">{langKey === "sw" ? "Hakuna bidhaa kwenye kikapu." : "Your cart is empty."}</div>
          ) : (
            <>
              <div className="mt-6 space-y-3">
                {cart.items.map((it) => (
                  <div
                    key={it.key}
                    className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 p-3"
                  >
                    <div>
                      <div className="text-sm font-semibold">{it.name}</div>
                      <div className="text-xs text-slate-500">
                        {it.isFree ? t.free : `${t.priceLabel} ${fmtTzs(it.priceTzs)}`}
                      </div>
                      {it.packLabel ? (
                        <div className="mt-1 text-xs text-slate-500">{it.packLabel}</div>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCartItemQty(it.key, Number(it.qty || 1) - 1)}
                        className="h-8 w-8 rounded-xl border border-slate-200 text-sm font-bold hover:bg-slate-50"
                      >
                        −
                      </button>
                      <div className="w-8 text-center text-sm font-semibold">{it.qty}</div>
                      <button
                        type="button"
                        onClick={() => setCartItemQty(it.key, Number(it.qty || 1) + 1)}
                        className="h-8 w-8 rounded-xl border border-slate-200 text-sm font-bold hover:bg-slate-50"
                      >
                        +
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteCartItem(it.key)}
                        className="ml-1 text-xs font-semibold text-red-600 hover:text-red-700"
                      >
                        {t.remove}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="text-sm font-extrabold">{t.deliveryDetails}</div>
                  <label className="mt-3 block text-xs font-semibold text-slate-600">{t.location}</label>
                  <input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm outline-none focus:border-amber-300"
                  />
                  <label className="mt-3 block text-xs font-semibold text-slate-600">{t.phone}</label>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm outline-none focus:border-amber-300"
                  />
                  <label className="mt-3 block text-xs font-semibold text-slate-600">{t.payment}</label>
                  <div className="mt-2 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("cash")}
                      className={`rounded-xl px-3 py-2 text-xs font-semibold ${
                        paymentMethod === "cash" ? "bg-amber-500 text-white" : "border border-slate-200 text-slate-700"
                      }`}
                    >
                      {t.cash}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("lipa")}
                      className={`rounded-xl px-3 py-2 text-xs font-semibold ${
                        paymentMethod === "lipa" ? "bg-amber-500 text-white" : "border border-slate-200 text-slate-700"
                      }`}
                    >
                      {t.lipa}
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="text-sm font-extrabold">{t.orderSummary}</div>
                  <div className="mt-2 text-sm text-slate-600">
                    {t.priceLabel} {fmtTzs(totals.paid)}
                  </div>
                  <button
                    type="button"
                    onClick={sendOrderOnWhatsApp}
                    disabled={!location.trim() || !phone.trim()}
                    className={`mt-4 w-full rounded-xl px-4 py-2 text-sm font-semibold text-white ${
                      !location.trim() || !phone.trim() ? "bg-slate-300" : "bg-emerald-600 hover:bg-emerald-700"
                    }`}
                  >
                    {t.sendOrder}
                  </button>
                  <button
                    type="button"
                    onClick={clearCart}
                    className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    {t.clearCart}
                  </button>
                </div>
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}

/** =========================
 * UI COMPONENTS
 * ========================= */
function Tabs({ value, onChange, options }) {
  return (
    <div className="inline-flex rounded-2xl border border-slate-200 bg-white p-1">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              active ? "bg-amber-500 text-white" : "text-slate-700 hover:bg-slate-50"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function PackCard({ title, subtitle, cta, onSelect, imageSrc }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="relative h-44 w-full bg-slate-100">
        {imageSrc ? (
          <img src={imageSrc} alt={title || "Pack"} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-slate-400">
            PACK IMAGE
          </div>
        )}
      </div>

      <div className="p-6">
        <div className="text-lg font-extrabold">{title}</div>
        <div className="mt-2 text-sm text-slate-600">{subtitle}</div>

        <div className="mt-5">
          <button
            type="button"
            onClick={onSelect}
            className="inline-flex w-full items-center justify-center rounded-2xl bg-amber-500 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-600"
          >
            {cta}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProductCard({ p, t, onView, onAdd }) {
  const price = fmtTzs(p.priceTzs);

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="relative h-44 w-full bg-slate-100">
        {p.image ? (
          <img src={p.image} alt={p.name} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">No image</div>
        )}

        <div className="absolute left-3 top-3 rounded-full bg-white/85 px-3 py-1 text-xs font-semibold text-slate-900">
          {t.priceLabel} {price}
        </div>
      </div>

      <div className="p-5">
        <div className="text-sm font-extrabold">{p.name}</div>
        <div className="mt-1 text-sm text-slate-600">{p.desc}</div>

        <div className="mt-5 grid gap-3">
          <button
            type="button"
            onClick={onView}
            className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50"
          >
            {t.view}
          </button>

          <button
            type="button"
            onClick={onAdd}
            className="inline-flex items-center justify-center rounded-2xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-600"
          >
            {t.addToCart}
          </button>
        </div>
      </div>
    </div>
  );
}

function Thumb({ image }) {
  return (
    <div className="h-10 w-10 overflow-hidden rounded-xl bg-slate-100 border border-slate-200">
      {image ? <img src={image} alt="" className="h-full w-full object-cover" /> : null}
    </div>
  );
}

function QtyRow({ image, name, subtitle, qty, onMinus, onPlus }) {
  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Thumb image={image} />
          <div>
            <div className="text-sm font-extrabold">{name}</div>
            <div className="mt-1 text-xs text-slate-600">{subtitle}</div>
          </div>
        </div>

        <div className="inline-flex items-center gap-2">
          <button
            type="button"
            onClick={onMinus}
            className="h-9 w-9 rounded-xl border border-slate-200 text-sm font-bold hover:bg-slate-50"
          >
            −
          </button>
          <div className="w-10 text-center text-sm font-semibold">{qty || 0}</div>
          <button
            type="button"
            onClick={onPlus}
            className="h-9 w-9 rounded-xl border border-slate-200 text-sm font-bold hover:bg-slate-50"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}

function AddRow({ image, name, priceLabel, onAdd }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 p-3">
      <div className="flex items-center gap-3">
        <Thumb image={image} />
        <div>
          <div className="text-sm font-semibold">{name}</div>
          <div className="text-xs text-slate-600">{priceLabel}</div>
        </div>
      </div>

      <button
        type="button"
        onClick={onAdd}
        className="rounded-xl bg-amber-500 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-600"
      >
        + Add
      </button>
    </div>
  );
}

function StepPill({ active, label }) {
  return (
    <div className={`rounded-full px-3 py-1 ${active ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-600"}`}>
      {label}
    </div>
  );
}

function MetaCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-extrabold text-slate-900">{value}</div>
    </div>
  );
}

/**
 * ✅ Modal has max height + internal scrolling
 */
function Modal({ children, onClose }) {
  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        className="
          absolute inset-x-0 top-10 mx-auto w-[92%] max-w-2xl
          rounded-3xl bg-white p-6 shadow-xl sm:p-8
          max-h-[calc(100vh-5rem)] overflow-y-auto
        "
      >
        {children}
      </div>
    </div>
  );
}
