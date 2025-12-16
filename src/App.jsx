import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

const currency = (n) =>
  new Intl.NumberFormat("sw-TZ", {
    style: "currency",
    currency: "TZS",
    maximumFractionDigits: 0,
  }).format(n);

const TAGS = ["New", "Handmade", "Organic", "Limited", "Trending", "Gift"];
const CATEGORIES = ["Food", "Clothes", "Cosmetics", "Hygiene", "Spices", "Art", "Handmade", "Gifts"];

const REGIONS = [
  "Dar es Salaam",
  "Dodoma",
  "Arusha",
  "Mwanza",
  "Mbeya",
  "Zanzibar",
  "Morogoro",
  "Tanga",
  "Kilimanjaro",
];

const sampleMakers = [
  { id: "m1", name: "Kijani Youth Co-op", region: "Morogoro", categories: ["Spices", "Food"], avatar: "🧺" },
  { id: "m2", name: "Mrembo Makers", region: "Dar es Salaam", categories: ["Cosmetics", "Hygiene"], avatar: "🧴" },
  { id: "m3", name: "Sanaa Lab", region: "Arusha", categories: ["Art", "Handmade"], avatar: "🎨" },
  { id: "m4", name: "Nguo Street Studio", region: "Mwanza", categories: ["Clothes"], avatar: "👕" },
];

const sampleProducts = [
  {
    id: "p1",
    name: "Pilau Spice Mix",
    category: "Spices",
    tag: "Organic",
    price: 8500,
    status: "In stock",
    makerId: "m1",
    image:
      "https://images.unsplash.com/photo-1615486363973-1b9b3b7d3cfb?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "p2",
    name: "Handmade Kanga Tote",
    category: "Handmade",
    tag: "Handmade",
    price: 22000,
    status: "Low stock",
    makerId: "m1",
    image:
      "https://images.unsplash.com/photo-1604654894611-6973b376cbde?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "p3",
    name: "Shea Body Butter",
    category: "Cosmetics",
    tag: "Trending",
    price: 18000,
    status: "In stock",
    makerId: "m2",
    image:
      "https://images.unsplash.com/photo-1612810432410-7b0bb2745078?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "p4",
    name: "Natural Soap Bar",
    category: "Hygiene",
    tag: "New",
    price: 6000,
    status: "In stock",
    makerId: "m2",
    image:
      "https://images.unsplash.com/photo-1584305574647-0f78d0b3d2b2?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "p5",
    name: "Streetwear Tee (Limited)",
    category: "Clothes",
    tag: "Limited",
    price: 30000,
    status: "Preorder",
    makerId: "m4",
    image:
      "https://images.unsplash.com/photo-1520975661595-6453be3f7070?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "p6",
    name: "Mini Canvas Art",
    category: "Art",
    tag: "Gift",
    price: 25000,
    status: "In stock",
    makerId: "m3",
    image:
      "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "p7",
    name: "Chilli Sauce",
    category: "Food",
    tag: "Trending",
    price: 12000,
    status: "In stock",
    makerId: "m1",
    image:
      "https://images.unsplash.com/photo-1604909053195-25cfa55f2c5d?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "p8",
    name: "Spice Gift Box",
    category: "Gifts",
    tag: "Gift",
    price: 45000,
    status: "In stock",
    makerId: "m1",
    image:
      "https://images.unsplash.com/photo-1546554137-f86b9593a222?auto=format&fit=crop&w=1200&q=80",
  },
];

const sampleEvents = [
  { id: "e1", title: "SWAHIBA Pop-up Market + Live Performances", date: "Sat, 10 Feb", location: "Mwenge, Dar es Salaam" },
  { id: "e2", title: "Meet the Makers: Story Night", date: "Fri, 23 Feb", location: "Arusha CBD" },
  { id: "e3", title: "Youth Products Showcase", date: "Sun, 03 Mar", location: "Dodoma" },
];

const MAKERS_BY_ID = sampleMakers.reduce((acc, m) => {
  acc[m.id] = m;
  return acc;
}, {});

const HERO_STORY = {
  title: "SWAHIBA wa Siku",
  name: "Asha (Morogoro)",
  line: "From skills training to building a spice brand—today’s story + drop.",
  poster:
    "https://images.unsplash.com/photo-1526318472351-c75fcf070305?auto=format&fit=crop&w=1600&q=80",
  products: ["p1", "p7", "p8"],
};

const TODAY_IDS = new Set(HERO_STORY.products);
const FEATURED_PRODUCTS = sampleProducts.slice(0, 4);
const TODAYS_DROP = sampleProducts.filter((p) => TODAY_IDS.has(p.id));

function cn(...xs) {
  return xs.filter(Boolean).join(" ");
}

function Pill({ children, className = "" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
        className
      )}
    >
      {children}
    </span>
  );
}

function IconButton({ title, onClick, children }) {
  return (
    <button
      type="button"
      aria-label={title}
      title={title}
      onClick={onClick}
      className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border bg-white/70 shadow-sm backdrop-blur transition hover:bg-white"
    >
      {children}
    </button>
  );
}

function Overlay({ onClose }) {
  return <div aria-hidden="true" onClick={onClose} className="fixed inset-0 z-40 bg-black/40" />;
}

function useScrollLock(locked) {
  useEffect(() => {
    if (!locked) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [locked]);
}

function useEscapeToClose(open, onClose) {
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);
}

function useFocusRestore(open, focusRef) {
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement;
    const t = window.setTimeout(() => {
      focusRef?.current?.focus?.();
    }, 0);
    return () => {
      window.clearTimeout(t);
      prev?.focus?.();
    };
  }, [open, focusRef]);
}

function Drawer({ open, onClose, title, children }) {
  useEscapeToClose(open, onClose);
  const panelRef = useRef(null);
  useFocusRestore(open, panelRef);

  if (!open) return null;
  return (
    <>
      <Overlay onClose={onClose} />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="fixed right-0 top-0 z-50 h-full w-full max-w-md overflow-y-auto bg-white outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-5 py-4">
          <div className="text-base font-semibold">{title}</div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border p-2 hover:bg-zinc-50"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </>
  );
}

function Modal({ open, onClose, title = "Dialog", children }) {
  useEscapeToClose(open, onClose);
  const modalRef = useRef(null);
  useFocusRestore(open, modalRef);

  if (!open) return null;
  return (
    <>
      <Overlay onClose={onClose} />
      <div
        className="fixed inset-x-0 top-10 z-50 mx-auto w-[94%] max-w-3xl rounded-3xl bg-white shadow-2xl outline-none"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </>
  );
}

const ProductCard = memo(function ProductCard({ product, onQuickView, onAdd }) {
  return (
    <div className="group rounded-3xl border bg-white shadow-sm transition hover:shadow-md">
      <div className="relative overflow-hidden rounded-3xl">
        <img
          src={product.image}
          alt={product.name}
          className="h-56 w-full object-cover transition duration-500 group-hover:scale-[1.03]"
          loading="lazy"
        />
        <div className="absolute left-3 top-3 flex gap-2">
          <Pill className="bg-white/85 backdrop-blur">{product.tag}</Pill>
          <Pill
            className={cn(
              "bg-white/85 backdrop-blur",
              product.status === "Low stock" ? "border-amber-300" : ""
            )}
          >
            {product.status}
          </Pill>
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm text-zinc-500">{product.category}</div>
            <div className="mt-1 truncate text-base font-semibold">{product.name}</div>
          </div>
          <div className="text-right text-sm font-semibold">{currency(product.price)}</div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => onAdd(product)}
            className="flex-1 rounded-2xl bg-black px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Add to cart
          </button>
          <button
            type="button"
            onClick={() => onQuickView(product)}
            className="rounded-2xl border px-3 py-2.5 text-sm font-semibold hover:bg-zinc-50"
          >
            Quick view
          </button>
        </div>
      </div>
    </div>
  );
});

function Qty({ value, onChange }) {
  return (
    <div className="inline-flex items-center rounded-2xl border bg-white">
      <button
        type="button"
        onClick={() => onChange(Math.max(1, value - 1))}
        className="px-3 py-2 text-sm font-semibold hover:bg-zinc-50"
        aria-label="Decrease quantity"
      >
        −
      </button>
      <div className="min-w-[40px] text-center text-sm font-semibold">{value}</div>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        className="px-3 py-2 text-sm font-semibold hover:bg-zinc-50"
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  );
}

export default function SwahibaMVP() {
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState(REGIONS[0]);
  const [category, setCategory] = useState("All");
  const [tag, setTag] = useState("All");
  const [availability, setAvailability] = useState("All");
  const [priceMax, setPriceMax] = useState(60000);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [storyOpen, setStoryOpen] = useState(false);
  const [talkOpen, setTalkOpen] = useState(false);

  const [quickView, setQuickView] = useState(null);
  const [cart, setCart] = useState({}); // { productId: {product, qty} }

  useScrollLock(filtersOpen || cartOpen || !!quickView || storyOpen || talkOpen);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return sampleProducts
      .filter((p) => (category === "All" ? true : p.category === category))
      .filter((p) => (tag === "All" ? true : p.tag === tag))
      .filter((p) =>
        availability === "All"
          ? true
          : availability === "In stock"
          ? p.status === "In stock" || p.status === "Low stock"
          : p.status === "Preorder"
      )
      .filter((p) => p.price <= priceMax)
      .filter((p) => {
        if (!q) return true;
        return `${p.name} ${p.category} ${p.tag}`.toLowerCase().includes(q);
      });
  }, [query, category, tag, availability, priceMax]);

  const cartItems = useMemo(() => Object.values(cart), [cart]);
  const cartTotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.product.price * item.qty, 0),
    [cartItems]
  );

  const addToCart = useCallback((product) => {
    setCart((c) => {
      const next = { ...c };
      if (next[product.id]) next[product.id] = { product, qty: next[product.id].qty + 1 };
      else next[product.id] = { product, qty: 1 };
      return next;
    });
    setCartOpen(true);
  }, []);

  const updateQty = useCallback((productId, qty) => {
    setCart((c) => {
      const next = { ...c };
      if (!next[productId]) return next;
      if (qty <= 0) delete next[productId];
      else next[productId] = { ...next[productId], qty };
      return next;
    });
  }, []);

  const removeItem = useCallback((productId) => {
    setCart((c) => {
      const next = { ...c };
      delete next[productId];
      return next;
    });
  }, []);

  const clearFilters = useCallback(() => {
    setCategory("All");
    setTag("All");
    setAvailability("All");
    setPriceMax(60000);
    setQuery("");
  }, []);

  const openQuickView = useCallback((p) => setQuickView(p), []);
  const closeQuickView = useCallback(() => setQuickView(null), []);

  const scrollTo = useCallback((id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 via-white to-zinc-50 text-zinc-900">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 md:px-6">
          <div className="flex items-center gap-2">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-black text-white">✦</div>
            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-wide">SWAHIBA</div>
              <div className="text-[11px] text-zinc-500">Youth-made marketplace</div>
            </div>
          </div>

          {/* Desktop search */}
          <div className="ml-auto hidden w-[44%] items-center rounded-2xl border bg-white px-3 py-2 md:flex">
            <span className="text-zinc-500">⌕</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products, tags, categories…"
              className="ml-2 w-full bg-transparent text-sm outline-none"
            />
          </div>

          {/* Navbar (UPDATED) */}
          <nav className="hidden items-center gap-4 text-sm font-medium text-zinc-700 md:flex">
            <a href="#shop" className="hover:text-black">
              Shop
            </a>
            <a href="#events" className="hover:text-black">
              Events
            </a>
            <a href="#makers" className="hover:text-black">
              Meet the Makers
            </a>
            <a href="#seller" className="hover:text-black">
              Become a Seller
            </a>
            <button
              type="button"
              onClick={() => setTalkOpen(true)}
              className="rounded-full border bg-white px-3 py-1.5 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
            >
              Talk To SWAHIBA
            </button>
          </nav>

          <div className="flex items-center gap-2">
            <div className="md:hidden">
              <IconButton title="Filters" onClick={() => setFiltersOpen(true)}>
                ☰
              </IconButton>
            </div>

            {/* Mobile/All-sizes “Talk” quick button */}
            <IconButton title="Talk To SWAHIBA" onClick={() => setTalkOpen(true)}>
              💬
            </IconButton>

            <IconButton title="Cart" onClick={() => setCartOpen(true)}>
              <div className="relative">
                🛍️
                {cartItems.length > 0 && (
                  <span className="absolute -right-2 -top-2 grid h-5 w-5 place-items-center rounded-full bg-black text-[10px] font-semibold text-white">
                    {cartItems.length}
                  </span>
                )}
              </div>
            </IconButton>
          </div>
        </div>

        {/* Mobile search */}
        <div className="mx-auto max-w-6xl px-4 pb-3 md:hidden">
          <div className="flex items-center rounded-2xl border bg-white px-3 py-2">
            <span className="text-zinc-500">⌕</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products…"
              className="ml-2 w-full bg-transparent text-sm outline-none"
            />
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pt-6 md:px-6">
        <div className="relative overflow-hidden rounded-[32px] border bg-black">
          <div
            className="absolute inset-0 opacity-70"
            style={{
              backgroundImage: `url(${HERO_STORY.poster})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
          <div className="relative grid gap-6 p-6 md:grid-cols-2 md:p-10">
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
                ▶ {HERO_STORY.title}
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white md:text-5xl">
                {HERO_STORY.name}
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-white/85 md:text-base">
                {HERO_STORY.line}
              </p>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setStoryOpen(true)}
                  className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black"
                >
                  Watch story →
                </button>
                <button
                  type="button"
                  onClick={() => scrollTo("shop")}
                  className="rounded-2xl border border-white/30 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur hover:bg-white/15"
                >
                  Shop today’s drop ↓
                </button>
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                <Pill className="border-white/20 bg-white/10 text-white">Made in Tanzania</Pill>
                <Pill className="border-white/20 bg-white/10 text-white">40+ youth-led orgs</Pill>
                <Pill className="border-white/20 bg-white/10 text-white">Pop-up events</Pill>
              </div>
            </div>

            <div className="rounded-3xl bg-white/10 p-4 backdrop-blur md:p-5">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-white">Today’s Picks</div>
                <div className="text-xs text-white/70">Quick add</div>
              </div>

              <div className="mt-4 grid gap-3">
                {TODAYS_DROP.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addToCart(p)}
                    className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 p-3 text-left hover:bg-white/15"
                  >
                    <img
                      src={p.image}
                      alt={p.name}
                      className="h-14 w-14 rounded-2xl object-cover"
                      loading="lazy"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-white">{p.name}</div>
                      <div className="mt-0.5 text-xs text-white/75">
                        {currency(p.price)} • {p.tag}
                      </div>
                    </div>
                    <span className="text-white/70">→</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 pb-24 pt-10 md:px-6">
        {/* Featured */}
        <section>
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Featured Products</h2>
              <p className="mt-1 text-sm text-zinc-600">
                High-quality youth-made products—curated weekly.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {FEATURED_PRODUCTS.map((p) => (
              <ProductCard key={p.id} product={p} onQuickView={openQuickView} onAdd={addToCart} />
            ))}
          </div>
        </section>

        {/* Shop */}
        <section id="shop" className="mt-14">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Explore All Products</h2>
              <p className="mt-1 text-sm text-zinc-600">
                Filter by category, tags, availability, and price.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFiltersOpen(true)}
                className="rounded-2xl border px-4 py-2 text-sm font-semibold hover:bg-zinc-50 md:hidden"
              >
                Filters
              </button>
              <button
                type="button"
                onClick={clearFilters}
                className="rounded-2xl border px-4 py-2 text-sm font-semibold hover:bg-zinc-50"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-6 md:grid-cols-[260px,1fr]">
            {/* Desktop filters */}
            <aside className="hidden rounded-3xl border bg-white p-5 shadow-sm md:block">
              <div className="text-sm font-semibold">Filters</div>

              <div className="mt-5 space-y-5">
                <div>
                  <div className="text-xs font-semibold text-zinc-600">Category</div>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="mt-2 w-full rounded-2xl border px-3 py-2 text-sm"
                  >
                    <option value="All">All</option>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="text-xs font-semibold text-zinc-600">Tag</div>
                  <select
                    value={tag}
                    onChange={(e) => setTag(e.target.value)}
                    className="mt-2 w-full rounded-2xl border px-3 py-2 text-sm"
                  >
                    <option value="All">All</option>
                    {TAGS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="text-xs font-semibold text-zinc-600">Availability</div>
                  <select
                    value={availability}
                    onChange={(e) => setAvailability(e.target.value)}
                    className="mt-2 w-full rounded-2xl border px-3 py-2 text-sm"
                  >
                    <option value="All">All</option>
                    <option value="In stock">In stock</option>
                    <option value="Preorder">Preorder</option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold text-zinc-600">Max price</div>
                    <div className="text-xs font-semibold">{currency(priceMax)}</div>
                  </div>
                  <input
                    type="range"
                    min={5000}
                    max={100000}
                    step={1000}
                    value={priceMax}
                    onChange={(e) => setPriceMax(Number(e.target.value))}
                    className="mt-3 w-full"
                  />
                </div>

                <div>
                  <div className="text-xs font-semibold text-zinc-600">Delivery region</div>
                  <select
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    className="mt-2 w-full rounded-2xl border px-3 py-2 text-sm"
                  >
                    {REGIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </aside>

            {/* Products */}
            <div>
              <div className="flex items-center justify-between">
                <div className="text-sm text-zinc-600">
                  Showing <span className="font-semibold text-zinc-900">{filtered.length}</span>{" "}
                  products
                </div>
                <div className="hidden text-sm text-zinc-600 md:block">
                  Delivering to <span className="font-semibold text-zinc-900">{region}</span>
                </div>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((p) => (
                  <ProductCard key={p.id} product={p} onQuickView={openQuickView} onAdd={addToCart} />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Events */}
        <section id="events" className="mt-16">
          <h2 className="text-xl font-semibold tracking-tight">Next SWAHIBA Events</h2>
          <p className="mt-1 text-sm text-zinc-600">Pop-up markets, performances, and meet-the-maker moments.</p>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {sampleEvents.map((e) => (
              <div key={e.id} className="rounded-3xl border bg-white p-5 shadow-sm">
                <div className="text-sm font-semibold">{e.title}</div>
                <div className="mt-2 text-sm text-zinc-600">📅 {e.date}</div>
                <div className="mt-1 text-sm text-zinc-600">📍 {e.location}</div>
                <button
                  type="button"
                  className="mt-4 w-full rounded-2xl border px-4 py-2 text-sm font-semibold hover:bg-zinc-50"
                >
                  View event →
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Makers */}
        <section id="makers" className="mt-16">
          <h2 className="text-xl font-semibold tracking-tight">Meet the Makers</h2>
          <p className="mt-1 text-sm text-zinc-600">Real groups, real stories—shop their drops.</p>

          <div className="mt-6 grid gap-4 md:grid-cols-4">
            {sampleMakers.map((m) => (
              <div key={m.id} className="rounded-3xl border bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-zinc-50 text-2xl">
                    {m.avatar}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{m.name}</div>
                    <div className="mt-0.5 text-xs text-zinc-600">{m.region}</div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {m.categories.map((c) => (
                    <Pill key={c} className="bg-zinc-50">
                      {c}
                    </Pill>
                  ))}
                </div>
                <button
                  type="button"
                  className="mt-4 w-full rounded-2xl border px-4 py-2 text-sm font-semibold hover:bg-zinc-50"
                >
                  View maker →
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Seller */}
        <section id="seller" className="mt-16">
          <div className="rounded-[32px] border bg-black p-6 text-white md:p-10">
            <h3 className="text-2xl font-semibold tracking-tight md:text-3xl">Become a Seller on SWAHIBA</h3>
            <p className="mt-2 text-sm text-white/85 md:text-base">
              If you’re a youth-led organization or group, list your products and reach new buyers online + at pop-ups.
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button type="button" className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black">
                Apply to sell
              </button>
              <button
                type="button"
                className="rounded-2xl border border-white/30 bg-white/10 px-5 py-3 text-sm font-semibold text-white hover:bg-white/15"
              >
                Download product template
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Filters Drawer */}
      <Drawer open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filters">
        <div className="space-y-5">
          <div>
            <div className="text-xs font-semibold text-zinc-600">Category</div>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-2 w-full rounded-2xl border px-3 py-2 text-sm"
            >
              <option value="All">All</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="text-xs font-semibold text-zinc-600">Tag</div>
            <select
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              className="mt-2 w-full rounded-2xl border px-3 py-2 text-sm"
            >
              <option value="All">All</option>
              {TAGS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="text-xs font-semibold text-zinc-600">Availability</div>
            <select
              value={availability}
              onChange={(e) => setAvailability(e.target.value)}
              className="mt-2 w-full rounded-2xl border px-3 py-2 text-sm"
            >
              <option value="All">All</option>
              <option value="In stock">In stock</option>
              <option value="Preorder">Preorder</option>
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-zinc-600">Max price</div>
              <div className="text-xs font-semibold">{currency(priceMax)}</div>
            </div>
            <input
              type="range"
              min={5000}
              max={100000}
              step={1000}
              value={priceMax}
              onChange={(e) => setPriceMax(Number(e.target.value))}
              className="mt-3 w-full"
            />
          </div>

          <div>
            <div className="text-xs font-semibold text-zinc-600">Delivery region</div>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="mt-2 w-full rounded-2xl border px-3 py-2 text-sm"
            >
              {REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={clearFilters}
              className="flex-1 rounded-2xl border px-4 py-2 text-sm font-semibold hover:bg-zinc-50"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => setFiltersOpen(false)}
              className="flex-1 rounded-2xl bg-black px-4 py-2 text-sm font-semibold text-white"
            >
              Apply
            </button>
          </div>
        </div>
      </Drawer>

      {/* Cart Drawer */}
      <Drawer open={cartOpen} onClose={() => setCartOpen(false)} title="Your Cart">
        {cartItems.length === 0 ? (
          <div className="rounded-3xl border bg-zinc-50 p-6 text-center">
            <div className="text-sm font-semibold">Your cart is empty</div>
            <p className="mt-2 text-sm text-zinc-600">Add a product to start.</p>
            <button
              type="button"
              onClick={() => setCartOpen(false)}
              className="mt-4 rounded-2xl bg-black px-5 py-2.5 text-sm font-semibold text-white"
            >
              Continue shopping
            </button>
          </div>
        ) : (
          <div>
            <div className="space-y-4">
              {cartItems.map(({ product, qty }) => (
                <div key={product.id} className="flex gap-3 rounded-3xl border p-3">
                  <img
                    src={product.image}
                    alt={product.name}
                    className="h-16 w-16 rounded-2xl object-cover"
                    loading="lazy"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{product.name}</div>
                        <div className="mt-0.5 text-xs text-zinc-600">
                          {product.category} • {product.tag}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(product.id)}
                        className="rounded-xl border p-2 hover:bg-zinc-50"
                        aria-label="Remove item"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <Qty value={qty} onChange={(v) => updateQty(product.id, v)} />
                      <div className="text-sm font-semibold">{currency(product.price * qty)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-3xl border bg-zinc-50 p-4">
              <div className="flex items-center justify-between text-sm">
                <div className="text-zinc-600">Subtotal</div>
                <div className="font-semibold">{currency(cartTotal)}</div>
              </div>
              <button
                type="button"
                className="mt-4 w-full rounded-2xl bg-black px-5 py-3 text-sm font-semibold text-white"
              >
                Checkout
              </button>
            </div>
          </div>
        )}
      </Drawer>

      {/* Quick View Modal */}
      <Modal open={!!quickView} onClose={closeQuickView} title="Product quick view">
        {quickView && (
          <div className="grid md:grid-cols-2">
            <div className="relative">
              <img
                src={quickView.image}
                alt={quickView.name}
                className="h-72 w-full rounded-t-3xl object-cover md:h-full md:rounded-l-3xl md:rounded-tr-none"
              />
              <button
                type="button"
                onClick={closeQuickView}
                className="absolute right-3 top-3 rounded-2xl border bg-white/80 p-2 backdrop-blur hover:bg-white"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="p-6">
              <div className="flex flex-wrap gap-2">
                <Pill className="bg-zinc-50">{quickView.category}</Pill>
                <Pill className="bg-zinc-50">{quickView.tag}</Pill>
                <Pill className="bg-zinc-50">{quickView.status}</Pill>
              </div>

              <div className="mt-3 text-xl font-semibold">{quickView.name}</div>
              <div className="mt-2 text-lg font-semibold">{currency(quickView.price)}</div>

              <div className="mt-5 rounded-2xl border bg-zinc-50 p-4">
                <div className="text-xs font-semibold text-zinc-600">Made by</div>
                <div className="mt-1 text-sm font-semibold">
                  {MAKERS_BY_ID[quickView.makerId]?.name || "SWAHIBA Maker"}
                </div>
                <div className="mt-1 text-xs text-zinc-600">
                  {MAKERS_BY_ID[quickView.makerId]?.region || "Tanzania"}
                </div>
              </div>

              <div className="mt-6 flex gap-2">
                <button
                  type="button"
                  onClick={() => addToCart(quickView)}
                  className="flex-1 rounded-2xl bg-black px-5 py-3 text-sm font-semibold text-white"
                >
                  Add to cart
                </button>
                <button
                  type="button"
                  onClick={closeQuickView}
                  className="rounded-2xl border px-5 py-3 text-sm font-semibold hover:bg-zinc-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Story Modal (kept, just removed from navbar) */}
      <Modal open={storyOpen} onClose={() => setStoryOpen(false)} title="SWAHIBA wa Siku">
        <div className="overflow-hidden rounded-3xl">
          <div className="relative">
            <img src={HERO_STORY.poster} alt="SWAHIBA wa Siku" className="h-72 w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            <button
              type="button"
              onClick={() => setStoryOpen(false)}
              className="absolute right-3 top-3 rounded-2xl border bg-white/80 p-2 backdrop-blur hover:bg-white"
              aria-label="Close"
            >
              ✕
            </button>

            <div className="absolute bottom-4 left-4 right-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
                ▶ SWAHIBA wa Siku
              </div>
              <div className="mt-2 text-2xl font-semibold text-white">{HERO_STORY.name}</div>
              <div className="mt-1 text-sm text-white/85">{HERO_STORY.line}</div>
            </div>
          </div>

          <div className="p-6">
            <div className="grid gap-6 md:grid-cols-[1.2fr,1fr]">
              <div>
                <div className="text-sm font-semibold">Today’s Story</div>
                <p className="mt-2 text-sm leading-relaxed text-zinc-600">
                  Replace this with a 45–90s documentary video or photo slideshow, plus a short narrative.
                </p>
              </div>

              <div>
                <div className="text-sm font-semibold">Shop today’s drop</div>
                <div className="mt-3 space-y-3">
                  {TODAYS_DROP.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => addToCart(p)}
                      className="flex w-full items-center gap-3 rounded-2xl border p-3 text-left hover:bg-zinc-50"
                    >
                      <img src={p.image} alt={p.name} className="h-14 w-14 rounded-2xl object-cover" loading="lazy" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">{p.name}</div>
                        <div className="mt-0.5 text-xs text-zinc-600">
                          {currency(p.price)} • {p.tag}
                        </div>
                      </div>
                      <span className="text-zinc-500">→</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setStoryOpen(false);
                  scrollTo("shop");
                }}
                className="flex-1 rounded-2xl bg-black px-5 py-3 text-sm font-semibold text-white"
              >
                Explore all products
              </button>
              <button
                type="button"
                onClick={() => setStoryOpen(false)}
                className="flex-1 rounded-2xl border px-5 py-3 text-sm font-semibold hover:bg-zinc-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Talk To SWAHIBA Modal (NEW) */}
      <Modal open={talkOpen} onClose={() => setTalkOpen(false)} title="Talk To SWAHIBA">
        <div className="overflow-hidden rounded-3xl">
          <div className="flex items-center justify-between border-b px-6 py-4">
            <div>
              <div className="text-sm font-semibold">Talk To SWAHIBA</div>
              <div className="mt-0.5 text-xs text-zinc-600">Ask about products, sellers, delivery, and events.</div>
            </div>
            <button
              type="button"
              onClick={() => setTalkOpen(false)}
              className="rounded-2xl border px-3 py-2 text-sm font-semibold hover:bg-zinc-50"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <div className="grid gap-4 p-6 md:grid-cols-2">
            <div className="rounded-3xl border bg-zinc-50 p-5">
              <div className="text-sm font-semibold">💬 WhatsApp</div>
              <p className="mt-2 text-sm text-zinc-600">
                Fast support for buyers & sellers. (Replace the number with your real SWAHIBA line.)
              </p>
              <a
                className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-black px-5 py-3 text-sm font-semibold text-white hover:opacity-90"
                href="https://wa.me/255000000000?text=Habari%20SWAHIBA%2C%20nahitaji%20msaada%20tafadhali."
                target="_blank"
                rel="noreferrer"
              >
                Open WhatsApp →
              </a>
            </div>

            <div className="rounded-3xl border bg-zinc-50 p-5">
              <div className="text-sm font-semibold">📩 Email</div>
              <p className="mt-2 text-sm text-zinc-600">
                For partnerships, media, and seller onboarding. (Replace with your official email.)
              </p>
              <a
                className="mt-4 inline-flex w-full items-center justify-center rounded-2xl border bg-white px-5 py-3 text-sm font-semibold hover:bg-zinc-50"
                href="mailto:hello@swahiba.org?subject=Talk%20To%20SWAHIBA"
              >
                Email hello@swahiba.org →
              </a>
            </div>

            <div className="md:col-span-2 rounded-3xl border p-5">
              <div className="text-sm font-semibold">Quick message (demo)</div>
              <p className="mt-2 text-sm text-zinc-600">
                This is front-end only—wire it to your backend later (WhatsApp API, email service, or chat).
              </p>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <input
                  className="w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-black/10"
                  placeholder="Your name"
                />
                <input
                  className="w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-black/10"
                  placeholder="Phone or email"
                />
                <textarea
                  className="md:col-span-2 h-28 w-full resize-none rounded-2xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-black/10"
                  placeholder="Type your message…"
                />
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setTalkOpen(false)}
                  className="flex-1 rounded-2xl border px-5 py-3 text-sm font-semibold hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setTalkOpen(false)}
                  className="flex-1 rounded-2xl bg-black px-5 py-3 text-sm font-semibold text-white hover:opacity-90"
                >
                  Send (demo) →
                </button>
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}