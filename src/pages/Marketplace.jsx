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
      "Pregnancy Test",
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
  };
}

async function fetchProducts() {
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, product_name, description, price_tzs, image_url, image_path, whatsapp_order_number, is_active, sort_order"
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
  const [pmOpen, setPmOpen] = useState(false);
  const [pmPack, setPmPack] = useState(null); // { pack, items }
  const [pmItems, setPmItems] = useState([]); // editable: [{ productId, qty, isFree }]
  const [pmSearch, setPmSearch] = useState("");
  const [pmErr, setPmErr] = useState("");
  const [pmSaving, setPmSaving] = useState(false);
  const [pmSaved, setPmSaved] = useState("");

  // Builder
  const [builderOpen, setBuilderOpen] = useState(false);
  const [builderMode, setBuilderMode] = useState("PACK_PURCHASE"); // PACK_PURCHASE | PACK_REFILL
  const [builderPackCode, setBuilderPackCode] = useState(null);
  const [builderPackNo, setBuilderPackNo] = useState(null);
  const [builderStep, setBuilderStep] = useState(1);
  const [builderMain, setBuilderMain] = useState({});
  const [builderAddons, setBuilderAddons] = useState({});
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
      }
    );
  }, [byName]);

  const addonIds = useMemo(() => {
    const ids = new Set();
    for (const n of ADDON_NAMES) {
      const p = byName.get(String(n).toLowerCase().trim());
      if (p) ids.add(p.id);
    }
    return ids;
  }, [byName]);

  const mainCandidates = useMemo(() => {
    const q = builderSearch.trim().toLowerCase();
    return products
      .filter((p) => {
        const isBag = String(p.name).toLowerCase() === CRUNCH_BAG_NAME.toLowerCase();
        const isAddon = addonIds.has(p.id);
        if (isBag || isAddon) return false;
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
      (setActiveProduct(null), setCartOpen(false), setBuilderOpen(false), setPmOpen(false));
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
    setBuilderAddBag(false);
    setBuilderSearch("");
    setBuilderOpen(true);
  }

  function openPackBuilderFromPackItems(packType, packNoValue, items) {
    const pack = PACKS[packType];
    if (!pack) return;

    const nextMain = {};
    const nextAddons = {};

    for (const it of items) {
      const product = it.product;
      if (!product?.id) continue;
      const pid = product.id;
      const qty = Number(it.qty || 1);

      const name = String(product.product_name || "").toLowerCase().trim();
      const isBag = name === CRUNCH_BAG_NAME.toLowerCase();
      if (isBag) continue;

      const isAddon = ADDON_NAMES.map((x) => x.toLowerCase()).includes(name);
      if (isAddon || it.is_free) {
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
    setBuilderAddBag(false);
    setBuilderSearch("");
    setBuilderOpen(true);
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
      });
    });
  }

  function builderMainItemsResolved() {
    const items = [];
    for (const [pid, qty] of Object.entries(builderMain)) {
      const p = products.find((x) => String(x.id) === String(pid));
      if (p) items.push({ p, qty: Number(qty || 1) });
    }
    items.sort((a, b) => a.p.name.localeCompare(b.p.name));
    return items;
  }

  function builderAddonItemsResolved() {
    const items = [];
    for (const pid of Object.keys(builderAddons)) {
      const p = products.find((x) => String(x.id) === String(pid));
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

    // Bag logic
    if (builderMode === "PACK_PURCHASE" && pack.includesBag) {
      addProductToCart(crunchBag, 1, true, {
        source: "BAG_INCLUDED",
        packLabel,
        flowType,
        packNo: null,
      });
    } else if (builderMode === "PACK_REFILL" && builderAddBag) {
      addProductToCart(crunchBag, 1, false, {
        source: "BAG_OPTIONAL",
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

    setPmOpen(false);
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

      setPmPack(result);

      const rows = (result.items || [])
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
      setPmOpen(true);
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
      {pmOpen && (
        <Modal onClose={() => setPmOpen(false)}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-lg font-extrabold">
                {t.packManagerTitle} • {pmPackLabel}
              </div>
              <div className="mt-1 text-sm text-slate-600">
                <span className="font-semibold text-slate-800">Pack No:</span> {pmPack?.pack?.pack_no || "—"}
              </div>
              <div className="mt-1 text-xs text-slate-500">{t.packManagerSubtitle}</div>
            </div>

            <button
              type="button"
              onClick={() => setPmOpen(false)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50"
            >
              {t.close}
            </button>
          </div>

          {pmErr && (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{pmErr}</div>
          )}
          {pmSaved && (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{pmSaved}</div>
          )}

          {/* Current items */}
          <div className="mt-6">
            <div className="text-sm font-semibold text-slate-900">{t.selectedItems}</div>
            <div className="mt-3 space-y-3">
              {pmResolvedRows.length ? (
                pmResolvedRows.map((row) => (
                  <div key={row.productId} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Thumb image={row.product?.image || ""} />
                        <div>
                          <div className="text-sm font-extrabold">{row.product?.name || "—"}</div>
                          <div className="mt-1 text-xs text-slate-600">
                            {row.isFree ? (
                              <span className="font-bold text-amber-700">{t.freeAddon}</span>
                            ) : (
                              <>
                                {t.priceLabel} {fmtTzs(row.product?.priceTzs || 0)}
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => pmRemove(row.productId)}
                        className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold hover:bg-slate-50"
                      >
                        {t.remove}
                      </button>
                    </div>

                    <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => pmUpsert(row.productId, -1)}
                          className="h-9 w-9 rounded-xl border border-slate-200 text-sm font-bold hover:bg-slate-50"
                        >
                          −
                        </button>
                        <div className="w-10 text-center text-sm font-semibold">{row.qty || 0}</div>
                        <button
                          type="button"
                          onClick={() => pmUpsert(row.productId, +1)}
                          className="h-9 w-9 rounded-xl border border-slate-200 text-sm font-bold hover:bg-slate-50"
                        >
                          +
                        </button>
                      </div>

                      <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={row.isFree === true}
                          onChange={() => pmToggleFree(row.productId)}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        <span className="text-slate-700">{t.freeAddon}</span>
                      </label>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">—</div>
              )}
            </div>
          </div>

          {/* Add new items */}
          <div className="mt-8">
            <div className="text-sm font-semibold text-slate-900">{t.addNewItems}</div>

            <input
              value={pmSearch}
              onChange={(e) => setPmSearch(e.target.value)}
              placeholder={t.search}
              className="mt-3 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-amber-300"
            />

            <div className="mt-3 space-y-2">
              {pmCandidates.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 p-3"
                >
                  <div className="flex items-center gap-3">
                    <Thumb image={p.image} />
                    <div>
                      <div className="text-sm font-semibold">{p.name}</div>
                      <div className="text-xs text-slate-600">
                        {t.priceLabel} {fmtTzs(p.priceTzs)}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => pmUpsert(p.id, +1)}
                    className="rounded-xl bg-amber-500 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-600"
                  >
                    + Add
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Sticky actions */}
          <div className="sticky bottom-0 mt-8 bg-white pt-4 border-t border-slate-100 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={pmSave}
              disabled={pmSaving}
              className={`inline-flex items-center justify-center rounded-2xl px-5 py-2 text-sm font-semibold text-white shadow-sm ${
                pmSaving ? "bg-slate-300 cursor-not-allowed" : "bg-slate-900 hover:bg-slate-800"
              }`}
            >
              {pmSaving ? t.saving : t.saveChanges}
            </button>

            <button
              type="button"
              onClick={pmNewOrder}
              className="inline-flex items-center justify-center rounded-2xl bg-amber-500 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-600"
            >
              {t.newOrder}
            </button>
          </div>
        </Modal>
      )}

      {/* Product quick view */}
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

          <div className="mt-4 text-sm text-slate-700">{activeProduct.desc}</div>

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
                {builderMode === "PACK_REFILL" ? t.tabRefill : t.tabBuyPack} • {builderPackLabel()}
              </div>
              <div className="mt-1 text-sm text-slate-600">
                {builderPackNo ? (
                  <span className="text-slate-700 font-semibold">Pack No: {builderPackNo}</span>
                ) : (
                  `${t.packIncludesBag} • ${t.freeAddons}: ${builderFreeLimit()}`
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setBuilderOpen(false)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50"
            >
              {t.close}
            </button>
          </div>

          <div className="mt-5 flex gap-2 text-xs font-semibold">
            <StepPill active={builderStep === 1} label={t.stepMain} />
            <StepPill active={builderStep === 2} label={t.stepAddons} />
            <StepPill active={builderStep === 3} label={t.stepReview} />
          </div>

          {/* STEP 1: MAIN */}
          {builderStep === 1 && (
            <div className="mt-6">
              <div className="text-sm font-semibold text-slate-900">{t.selectedItems}</div>

              <div className="mt-3 space-y-3">
                {builderMainItemsResolved().length ? (
                  builderMainItemsResolved().map(({ p, qty }) => (
                    <QtyRow
                      key={p.id}
                      image={p.image}
                      name={p.name}
                      subtitle={`${t.priceLabel} ${fmtTzs(p.priceTzs)}`}
                      qty={qty}
                      onMinus={() => updateMainQty(p.id, -1)}
                      onPlus={() => updateMainQty(p.id, +1)}
                    />
                  ))
                ) : (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">—</div>
                )}
              </div>

              <div className="mt-6">
                <div className="text-sm font-semibold text-slate-900">{t.addMore}</div>

                <input
                  value={builderSearch}
                  onChange={(e) => setBuilderSearch(e.target.value)}
                  placeholder={t.search}
                  className="mt-3 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-amber-300"
                />

                <div className="mt-3 space-y-2">
                  {mainCandidates.map((p) => (
                    <AddRow
                      key={p.id}
                      image={p.image}
                      name={p.name}
                      priceLabel={`${t.priceLabel} ${fmtTzs(p.priceTzs)}`}
                      onAdd={() => updateMainQty(p.id, +1)}
                    />
                  ))}
                </div>
              </div>

              <div className="sticky bottom-0 mt-6 bg-white pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setBuilderOpen(false)}
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50"
                >
                  {t.close}
                </button>

                <button
                  type="button"
                  onClick={() => setBuilderStep(2)}
                  className="inline-flex items-center justify-center rounded-2xl bg-amber-500 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-600"
                >
                  {t.continue}
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: ADDONS */}
          {builderStep === 2 && (
            <div className="mt-6">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-slate-900">{t.stepAddons}</div>
                <div className="text-xs text-slate-600">
                  {t.selected}: {Object.keys(builderAddons).length}/{builderFreeLimit()}
                </div>
              </div>

              <div className="mt-3 space-y-3">
                {ADDON_NAMES.map((name) => {
                  const p = byName.get(String(name).toLowerCase().trim());
                  if (!p) {
                    return (
                      <div key={name} className="rounded-2xl border border-slate-200 p-4 text-sm text-slate-500">
                        <div className="font-semibold">{name}</div>
                        <div className="text-xs text-slate-400">{t.notAvailable}</div>
                      </div>
                    );
                  }

                  const checked = !!builderAddons[p.id];
                  const limit = builderFreeLimit();
                  const canToggleOn = checked || Object.keys(builderAddons).length < limit;

                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={!canToggleOn}
                      onClick={() => toggleAddon(p.id, limit)}
                      className={`w-full text-left rounded-2xl border p-4 text-sm transition ${
                        checked ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white hover:bg-slate-50"
                      } ${!canToggleOn ? "opacity-60 cursor-not-allowed" : ""}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <Thumb image={p.image} />
                          <div>
                            <div className="font-semibold">{p.name}</div>
                            <div className="text-xs text-slate-600">
                              {t.priceLabel} {fmtTzs(p.priceTzs)} • <span className="font-bold text-amber-700">{t.free}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="sticky bottom-0 mt-6 bg-white pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setBuilderStep(1)}
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50"
                >
                  {t.back}
                </button>

                <button
                  type="button"
                  onClick={() => setBuilderStep(3)}
                  className="inline-flex items-center justify-center rounded-2xl bg-amber-500 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-600"
                >
                  {t.continue}
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: REVIEW */}
          {builderStep === 3 && (
            <div className="mt-6">
              <div className="text-sm font-semibold text-slate-900">{t.orderSummary}</div>

              <div className="mt-3 rounded-2xl border border-slate-200 p-4">
                <div className="text-xs font-semibold text-slate-500">{t.stepMain}</div>
                <div className="mt-2 space-y-2">
                  {builderMainItemsResolved().length ? (
                    builderMainItemsResolved().map(({ p, qty }) => (
                      <div key={p.id} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <Thumb image={p.image} />
                          <div className="text-slate-900">
                            {p.name} x{qty}
                          </div>
                        </div>
                        <div className="text-slate-700">
                          {t.priceLabel} {fmtTzs(p.priceTzs)}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-slate-500">—</div>
                  )}
                </div>

                <div className="mt-4 text-xs font-semibold text-slate-500">{t.stepAddons}</div>
                <div className="mt-2 space-y-2">
                  {builderAddonItemsResolved().length ? (
                    builderAddonItemsResolved().map((p) => (
                      <div key={p.id} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <Thumb image={p.image} />
                          <div className="text-slate-900">{p.name} x1</div>
                        </div>
                        <div className="text-amber-700 font-bold">{t.free}</div>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-slate-500">—</div>
                  )}
                </div>

                <div className="mt-4 text-xs font-semibold text-slate-500">{CRUNCH_BAG_NAME}</div>
                {builderMode === "PACK_PURCHASE" ? (
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Thumb image={crunchBag.image} />
                      <div className="text-slate-900">{CRUNCH_BAG_NAME} x1</div>
                    </div>
                    <div className="text-amber-700 font-bold">{t.included}</div>
                  </div>
                ) : (
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <div className="text-slate-900">{t.optionalAddBag}</div>
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={builderAddBag}
                        onChange={(e) => setBuilderAddBag(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      <span className="text-slate-700">
                        {builderAddBag ? `${t.priceLabel} ${fmtTzs(crunchBag.priceTzs)}` : "—"}
                      </span>
                    </label>
                  </div>
                )}
              </div>

              <div className="sticky bottom-0 mt-6 bg-white pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setBuilderStep(2)}
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50"
                >
                  {t.back}
                </button>

                <button
                  type="button"
                  onClick={finalizePackToCart}
                  className="inline-flex items-center justify-center rounded-2xl bg-amber-500 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-600"
                >
                  {t.addToCart}
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* Cart & Checkout */}
      {cartOpen && (
        <Modal onClose={() => setCartOpen(false)}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-lg font-extrabold">{t.cart}</div>
              <div className="mt-1 text-sm text-slate-600">{cart.items.length ? `${cartCount} item(s)` : t.empty}</div>
            </div>

            <button
              type="button"
              onClick={() => setCartOpen(false)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50"
            >
              {t.close}
            </button>
          </div>

          <div className="mt-5 space-y-3">
            {cart.items.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">{t.empty}</div>
            ) : (
              cart.items.map((it) => (
                <div key={it.key} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-extrabold">{it.name}</div>
                      <div className="mt-1 text-xs text-slate-600">
                        {it.isFree ? (
                          <span className="font-bold text-amber-700">{t.free}</span>
                        ) : (
                          <>
                            {t.priceLabel} {fmtTzs(it.priceTzs)}
                          </>
                        )}
                        {it.packNo ? <span className="ml-2 text-slate-400">• Pack No: {it.packNo}</span> : null}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => deleteCartItem(it.key)}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold hover:bg-slate-50"
                    >
                      {t.close}
                    </button>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCartItemQty(it.key, it.qty - 1)}
                        className="h-9 w-9 rounded-xl border border-slate-200 text-sm font-bold hover:bg-slate-50"
                      >
                        −
                      </button>
                      <div className="w-10 text-center text-sm font-semibold">{it.qty}</div>
                      <button
                        type="button"
                        onClick={() => setCartItemQty(it.key, it.qty + 1)}
                        className="h-9 w-9 rounded-xl border border-slate-200 text-sm font-bold hover:bg-slate-50"
                      >
                        +
                      </button>
                    </div>

                    <div className="text-sm font-semibold text-slate-900">
                      {it.isFree ? (
                        <span className="text-amber-700">{t.free}</span>
                      ) : (
                        <>
                          {t.priceLabel} {fmtTzs((Number(it.priceTzs) || 0) * (Number(it.qty) || 0))}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {cart.items.length > 0 && (
            <>
              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between text-sm">
                  <div className="font-semibold text-slate-700">Total</div>
                  <div className="font-extrabold text-slate-900">
                    {t.priceLabel} {fmtTzs(totals.paid)}
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <div className="text-sm font-extrabold">{t.deliveryDetails}</div>

                <div className="mt-3 grid gap-3">
                  <input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder={t.location}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-amber-300"
                  />
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder={t.phone}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-amber-300"
                  />

                  <div className="rounded-2xl border border-slate-200 p-4">
                    <div className="text-sm font-semibold">{t.payment}</div>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <label className="inline-flex items-center gap-2 text-sm">
                        <input type="radio" name="pay" checked={paymentMethod === "cash"} onChange={() => setPaymentMethod("cash")} />
                        {t.cash}
                      </label>

                      <label className="inline-flex items-center gap-2 text-sm">
                        <input type="radio" name="pay" checked={paymentMethod === "lipa"} onChange={() => setPaymentMethod("lipa")} />
                        {t.lipa}
                      </label>
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={clearCart}
                    className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50"
                  >
                    {t.clearCart}
                  </button>

                  <button
                    type="button"
                    disabled={!location.trim() || !phone.trim()}
                    onClick={sendOrderOnWhatsApp}
                    className={`inline-flex items-center justify-center rounded-2xl px-5 py-2 text-sm font-semibold text-white shadow-sm ${
                      !location.trim() || !phone.trim() ? "bg-slate-300 cursor-not-allowed" : "bg-amber-500 hover:bg-amber-600"
                    }`}
                  >
                    {t.sendOrder}
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
        {/* ✅ Price badge removed (user hasn't selected items yet) */}
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