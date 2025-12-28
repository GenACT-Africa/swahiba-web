import React, { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

// ✅ matches your LanguageContext.jsx exports
import { useLanguage } from "../context/LanguageContext.jsx";

/**
 * TopBar (site-wide)
 * - Public pages: show menu + Talk + language toggle
 * - Swahiba/Admin pages: show profile + role + dropdown sign out
 *
 * Props:
 * - showTalkButton: boolean (default true)
 */
export default function TopBar({ showTalkButton = true }) {
  const navigate = useNavigate();
  const location = useLocation();

  // ✅ global language (saved in localStorage by LanguageProvider)
  const { lang, setLang } = useLanguage();

  const [mobileOpen, setMobileOpen] = useState(false);

  // Auth/profile UI only on Swahiba/Admin pages
  const isStaffArea =
    location.pathname.startsWith("/swahiba") || location.pathname.startsWith("/admin");

  const [me, setMe] = useState(null);
  const [profile, setProfile] = useState(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);

  // Load session + profile when in staff area
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        if (!isStaffArea) {
          setMe(null);
          setProfile(null);
          return;
        }

        const { data: s, error: sErr } = await supabase.auth.getSession();
        if (sErr) throw sErr;

        const user = s?.session?.user ?? null;
        if (!alive) return;

        setMe(user);

        if (!user) {
          setProfile(null);
          return;
        }

        const { data: prof, error: pErr } = await supabase
          .from("profiles")
          .select("role, full_name, name, display_name")
          .eq("id", user.id)
          .single();

        if (pErr) {
          setProfile({ role: null });
          return;
        }

        if (!alive) return;
        setProfile(prof ?? null);
      } catch (e) {
        console.warn("TopBar auth/profile load warning:", e?.message || e);
        setMe(null);
        setProfile(null);
      }
    })();

    return () => {
      alive = false;
    };
  }, [isStaffArea]);

  // Close user menu on outside click
  useEffect(() => {
    function onDoc(e) {
      if (!userMenuOpen) return;
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [userMenuOpen]);

  const labels = useMemo(() => {
    const SW = {
      brand: "SWAHIBA",
      tagline: "Your Selfcare Companion",
      home: "Nyumbani",
      learn: "Jifunze",
      products: "Bidhaa",
      about: "Kuhusu Sisi",
      talk: "Ongea na SWAHIBA",
      signOut: "Sign out",
      dashboard: "Dashboard",
    };
    const EN = {
      brand: "SWAHIBA",
      tagline: "Your Selfcare Companion",
      home: "Home",
      learn: "Learn",
      products: "Products",
      about: "About Us",
      talk: "Talk to SWAHIBA",
      signOut: "Sign out",
      dashboard: "Dashboard",
    };
    return lang === "SW" ? SW : EN;
  }, [lang]);

  function navClass({ isActive }) {
    return [
      "text-sm font-semibold transition",
      isActive ? "text-slate-900" : "text-slate-600 hover:text-slate-900",
    ].join(" ");
  }

  // Products behavior:
  const PRODUCTS_MODE = "section"; // "section" | "page"
  const PRODUCTS_ROUTE = "/marketplace"; // used only if PRODUCTS_MODE === "page"

  function goProducts(e) {
    e?.preventDefault?.();
    setMobileOpen(false);

    if (PRODUCTS_MODE === "page") {
      navigate(PRODUCTS_ROUTE);
      return;
    }

    // section on Home (#marketplace)
    if (location.pathname === "/") {
      const el = document.getElementById("marketplace");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    navigate("/");
    setTimeout(() => {
      const el = document.getElementById("marketplace");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
  }

  function goTalk() {
    setMobileOpen(false);
    navigate("/talk");
  }

  async function signOut() {
    setUserMenuOpen(false);
    setMobileOpen(false);
    await supabase.auth.signOut();
    navigate("/swahiba/login", { replace: true });
  }

  const profileName =
    profile?.full_name ||
    profile?.display_name ||
    profile?.name ||
    me?.user_metadata?.full_name ||
    me?.email ||
    "Account";

  const role = profile?.role || "user";

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="mx-auto max-w-[1200px] px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          {/* Left: brand */}
          <button
            type="button"
            onClick={() => {
              setMobileOpen(false);
              navigate("/");
            }}
            className="flex items-center gap-3"
          >
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-amber-500 text-white font-extrabold">
              S
            </div>
            <div className="text-left leading-tight">
              <div className="text-sm font-extrabold text-slate-900">{labels.brand}</div>
              <div className="text-xs text-slate-500">
                {isStaffArea ? labels.dashboard : labels.tagline}
              </div>
            </div>
          </button>

          {/* Center: nav (desktop) */}
          <nav className="hidden items-center gap-8 md:flex">
            <NavLink to="/" className={navClass} end>
              {labels.home}
            </NavLink>

            <NavLink to="/resources" className={navClass}>
              {labels.learn}
            </NavLink>

            <a
              href={PRODUCTS_MODE === "page" ? PRODUCTS_ROUTE : "/#marketplace"}
              onClick={goProducts}
              className="text-sm font-semibold text-slate-600 hover:text-slate-900"
            >
              {labels.products}
            </a>

            <NavLink to="/about" className={navClass}>
              {labels.about}
            </NavLink>
          </nav>

          {/* Right: Public actions OR Staff profile */}
          <div className="hidden items-center gap-2 md:flex">
            {!isStaffArea ? (
              <>
                {showTalkButton && (
                  <button
                    type="button"
                    onClick={goTalk}
                    className="rounded-2xl bg-amber-500 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-600"
                  >
                    {labels.talk}
                  </button>
                )}

                {/* ✅ GLOBAL language toggle */}
                <div className="flex items-center overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <button
                    type="button"
                    onClick={() => setLang("SW")}
                    className={[
                      "px-3 py-2 text-xs font-bold",
                      lang === "SW"
                        ? "bg-slate-900 text-white"
                        : "text-slate-700 hover:bg-slate-50",
                    ].join(" ")}
                  >
                    SW
                  </button>
                  <button
                    type="button"
                    onClick={() => setLang("EN")}
                    className={[
                      "px-3 py-2 text-xs font-bold",
                      lang === "EN"
                        ? "bg-slate-900 text-white"
                        : "text-slate-700 hover:bg-slate-50",
                    ].join(" ")}
                  >
                    EN
                  </button>
                </div>
              </>
            ) : (
              <div className="relative" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setUserMenuOpen((p) => !p)}
                  className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 hover:bg-slate-50"
                >
                  <div className="grid h-9 w-9 place-items-center rounded-2xl bg-slate-900 text-white text-xs font-extrabold">
                    {(profileName || "A").slice(0, 1).toUpperCase()}
                  </div>
                  <div className="text-left leading-tight">
                    <div className="text-sm font-semibold text-slate-900">{profileName}</div>
                    <div className="text-xs text-slate-500">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700">
                        {role}
                      </span>
                    </div>
                  </div>
                  <span className="text-slate-500">▾</span>
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-[260px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg">
                    <div className="p-4">
                      <div className="text-sm font-bold text-slate-900">{profileName}</div>
                      <div className="mt-1 text-xs text-slate-500">{me?.email}</div>
                    </div>

                    <div className="border-t border-slate-200" />

                    {/* Sign out pinned at bottom */}
                    <button
                      type="button"
                      onClick={signOut}
                      className="w-full px-4 py-3 text-left text-sm font-semibold text-red-700 hover:bg-red-50"
                    >
                      {labels.signOut}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mobile right controls */}
          <div className="flex items-center gap-2 md:hidden">
            {!isStaffArea ? (
              <>
                {showTalkButton && (
                  <button
                    type="button"
                    onClick={goTalk}
                    className="rounded-2xl bg-amber-500 px-4 py-2 text-xs font-semibold text-white"
                  >
                    {labels.talk}
                  </button>
                )}

                {/* ✅ GLOBAL language toggle (mobile) */}
                <button
                  type="button"
                  onClick={() => setLang((p) => (p === "SW" ? "EN" : "SW"))}
                  className="rounded-2xl border border-slate-200 px-3 py-2 text-xs font-bold"
                >
                  {lang}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setUserMenuOpen((p) => !p)}
                className="rounded-2xl border border-slate-200 px-3 py-2 text-xs font-bold"
              >
                {profileName?.slice(0, 1)?.toUpperCase() || "A"}
              </button>
            )}

            <button
              type="button"
              onClick={() => setMobileOpen((p) => !p)}
              className="rounded-2xl border border-slate-200 px-3 py-2 text-xs font-bold"
              aria-label="Open menu"
            >
              ☰
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="mt-3 rounded-3xl border border-slate-200 bg-white p-3 md:hidden">
            <div className="grid gap-2">
              <NavLink
                to="/"
                className="rounded-2xl px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                onClick={() => setMobileOpen(false)}
                end
              >
                {labels.home}
              </NavLink>

              <NavLink
                to="/resources"
                className="rounded-2xl px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                onClick={() => setMobileOpen(false)}
              >
                {labels.learn}
              </NavLink>

              <a
                href={PRODUCTS_MODE === "page" ? PRODUCTS_ROUTE : "/#marketplace"}
                onClick={goProducts}
                className="rounded-2xl px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                {labels.products}
              </a>

              <NavLink
                to="/about"
                className="rounded-2xl px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                onClick={() => setMobileOpen(false)}
              >
                {labels.about}
              </NavLink>

              {/* Staff-only: sign out at bottom on mobile */}
              {isStaffArea && (
                <>
                  <div className="my-1 border-t border-slate-200" />
                  <button
                    type="button"
                    onClick={signOut}
                    className="rounded-2xl px-4 py-3 text-left text-sm font-semibold text-red-700 hover:bg-red-50"
                  >
                    {labels.signOut}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Staff-only mini dropdown (mobile) */}
        {isStaffArea && userMenuOpen && (
          <div className="mt-3 rounded-3xl border border-slate-200 bg-white p-3 md:hidden">
            <div className="px-2 py-2">
              <div className="text-sm font-bold text-slate-900">{profileName}</div>
              <div className="mt-1 text-xs text-slate-500">{me?.email}</div>
              <div className="mt-2">
                <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-700">
                  {role}
                </span>
              </div>
            </div>
            <div className="mt-3 border-t border-slate-200" />
            <button
              type="button"
              onClick={signOut}
              className="mt-2 w-full rounded-2xl px-4 py-3 text-left text-sm font-semibold text-red-700 hover:bg-red-50"
            >
              {labels.signOut}
            </button>
          </div>
        )}
      </div>
    </header>
  );
}