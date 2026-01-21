import React, { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useLanguage } from "../context/LanguageContext.jsx";

export default function TopBar({ showTalkButton = true }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { lang, setLang } = useLanguage();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);

  const isStaffArea =
    location.pathname.startsWith("/swahiba") ||
    location.pathname.startsWith("/admin");

  const [me, setMe] = useState(null);
  const [profile, setProfile] = useState(null);

  const [scrolled, setScrolled] = useState(false);

  const handleScroll = () => {
    if (window.scrollY > 10) {
      setScrolled(true);
    } else {
      setScrolled(false);
    }
  };

  useEffect(() => {
    window.addEventListener("scroll", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  /* =======================
     LOAD AUTH + PROFILE
  ======================= */
  useEffect(() => {
    let alive = true;

    (async () => {
      if (!isStaffArea) {
        setMe(null);
        setProfile(null);
        return;
      }

      const { data } = await supabase.auth.getSession();
      const user = data?.session?.user ?? null;
      if (!alive) return;

      setMe(user);
      if (!user) return;

      const { data: prof } = await supabase
        .from("profiles")
        .select("role, full_name")
        .eq("id", user.id)
        .single();

      if (!alive) return;
      setProfile(prof);
    })();

    return () => {
      alive = false;
    };
  }, [isStaffArea]);

  /* =======================
     CLOSE DROPDOWN ON CLICK OUT
  ======================= */
  useEffect(() => {
    function onClick(e) {
      if (userMenuOpen && userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [userMenuOpen]);

  /* =======================
     LABELS
  ======================= */
  const labels = useMemo(() => {
    const SW = {
      home: "Nyumbani",
      learn: "Jifunze",
      products: "Bidhaa",
      about: "Kuhusu Sisi",
      talk: "Ongea na SWAHIBA",
      dashboard: "Dashibodi",
      inbox: "Inbox",
      profile: "Wasifu Wangu",
      signOut: "Ondoka",
    };
    const EN = {
      home: "Home",
      learn: "Learn",
      products: "Products",
      about: "About Us",
      talk: "Talk to SWAHIBA",
      dashboard: "Dashboard",
      inbox: "Inbox",
      profile: "My Profile",
      signOut: "Sign out",
    };
    return lang === "SW" ? SW : EN;
  }, [lang]);

  async function signOut() {
    setUserMenuOpen(false);
    setMobileOpen(false);
    await supabase.auth.signOut();
    navigate("/swahiba/login", { replace: true });
  }

  const profileName = profile?.full_name || me?.email || "Account";
  const role = profile?.role || "user";

  return (
    <header
      className={`sticky top-0 z-50 border-b border-slate-200 bg-[#f8eff2] transition-shadow duration-300 ${
        scrolled ? "shadow-md" : ""
      }`}
    >
      <div className="mx-auto max-w-[1200px] px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* BRAND (LOGO ONLY) */}
          <button
            onClick={() => navigate("/")}
            className="flex items-center"
            aria-label="Swahiba Home"
            title="Swahiba"
          >
            <img
              src="/logo_transparent.png"
              alt="Swahiba"
              className="h-12 w-auto object-contain"
              loading="eager"
            />
          </button>

          {/* CENTER NAV (DESKTOP) */}
          <nav className="hidden md:flex gap-8">
            <NavLink to="/" className="text-sm font-semibold">
              {labels.home}
            </NavLink>
            <NavLink to="/resources" className="text-sm font-semibold">
              {labels.learn}
            </NavLink>
            <NavLink to="/marketplace" className="text-sm font-semibold">
              {labels.products}
            </NavLink>
            <NavLink to="/about" className="text-sm font-semibold">
              {labels.about}
            </NavLink>
          </nav>

          {/* RIGHT CONTROLS */}
          <div className="flex items-center gap-3">
            {/* 🌍 LANGUAGE TOGGLE */}
            <div className="flex overflow-hidden rounded-2xl border border-slate-200">
              <button
                onClick={() => setLang("SW")}
                className={`px-3 py-2 text-xs font-bold ${
                  lang === "SW"
                    ? "bg-slate-900 text-white"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                SW
              </button>
              <button
                onClick={() => setLang("EN")}
                className={`px-3 py-2 text-xs font-bold ${
                  lang === "EN"
                    ? "bg-slate-900 text-white"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                EN
              </button>
            </div>

            {/* PUBLIC OR STAFF */}
            {!isStaffArea ? (
              showTalkButton && (
                <button
                  onClick={() => navigate("/talk")}
                  className="rounded-2xl bg-amber-500 px-5 py-2 text-sm font-semibold text-white"
                >
                  {labels.talk}
                </button>
              )
            ) : (
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen((p) => !p)}
                  className="flex items-center gap-3 rounded-2xl border px-3 py-2"
                >
                  <div className="h-9 w-9 rounded-2xl bg-slate-900 text-white flex items-center justify-center text-xs font-bold">
                    {profileName[0]?.toUpperCase()}
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-semibold">{profileName}</div>
                    <div className="text-xs text-slate-500">{role}</div>
                  </div>
                  ▾
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-64 rounded-3xl border bg-white shadow-lg overflow-hidden">
                    <div className="p-4">
                      <div className="font-bold text-sm">{profileName}</div>
                      <div className="text-xs text-slate-500">{me?.email}</div>
                    </div>

                    <div className="border-t" />

                    {/* DASHBOARD */}
                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        navigate("/swahiba/cases");
                      }}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50"
                    >
                      {labels.dashboard}
                    </button>

                    {/* INBOX */}
                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        navigate("/swahiba/inbox");
                      }}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50"
                    >
                      {labels.inbox}
                    </button>

                    {/* PROFILE */}
                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        navigate("/swahiba/profile");
                      }}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50"
                    >
                      {labels.profile}
                    </button>

                    <div className="border-t" />

                    {/* SIGN OUT */}
                    <button
                      onClick={signOut}
                      className="w-full px-4 py-3 text-left text-sm font-semibold text-red-600 hover:bg-red-50"
                    >
                      {labels.signOut}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}