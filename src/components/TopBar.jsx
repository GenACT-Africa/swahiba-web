import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useLanguage } from "../context/LanguageContext.jsx";

export default function TopBar({ showTalkButton = true }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { lang, setLang } = useLanguage();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [isCompactHeight, setIsCompactHeight] = useState(false);

  const userMenuRef = useRef(null);
  const notifRef = useRef(null);

  const isStaffArea =
    location.pathname.startsWith("/swahiba") ||
    location.pathname.startsWith("/admin");

  const [me, setMe] = useState(null);
  const [profile, setProfile] = useState(null);

  const [scrolled, setScrolled] = useState(false);

  // Notifications state
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const handleScroll = () => setScrolled(window.scrollY > 10);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const handleResize = () => setIsCompactHeight(window.innerHeight <= 700);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const computeUnread = useCallback((list) => {
    return (list || []).reduce((acc, n) => acc + (n?.is_read ? 0 : 1), 0);
  }, []);

  /* =======================
     LOAD AUTH + PROFILE (STAFF AREA)
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
     LOAD + REALTIME NOTIFICATIONS (STAFF ONLY)
  ======================= */
  const loadNotifs = useCallback(async () => {
    if (!isStaffArea || !me?.id) return;

    const { data, error } = await supabase
      .from("notifications")
      .select("id, title, body, type, ref_table, ref_id, is_read, created_at")
      .eq("user_id", me.id)
      .order("created_at", { ascending: false })
      .limit(25);

    if (error) {
      // Fail silently to avoid breaking topbar
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    const list = data || [];
    setNotifications(list);
    setUnreadCount(computeUnread(list));
  }, [computeUnread, isStaffArea, me?.id]);

  useEffect(() => {
    if (!isStaffArea || !me?.id) return;

    let alive = true;
    let channel = null;

    (async () => {
      if (!alive) return;
      await loadNotifs();
    })();

    channel = supabase
      .channel(`notif:${me.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${me.id}`,
        },
        () => loadNotifs()
      )
      .subscribe();

    return () => {
      alive = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [isStaffArea, me?.id, loadNotifs]);

  async function markNotifRead(id) {
    if (!me?.id || !id) return;

    // Optimistic UI update (so color changes + badge decreases immediately)
    setNotifications((prev) => {
      const next = (prev || []).map((n) =>
        n.id === id ? { ...n, is_read: true } : n
      );
      setUnreadCount(computeUnread(next));
      return next;
    });

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id)
      .eq("user_id", me.id);

    // If DB update fails, re-sync from server
    if (error) {
      await loadNotifs();
    }
  }

  async function markAllNotifsRead() {
    if (!me?.id) return;

    // Optimistic UI update
    setNotifications((prev) => {
      const next = (prev || []).map((n) => ({ ...n, is_read: true }));
      setUnreadCount(0);
      return next;
    });

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", me.id)
      .eq("is_read", false);

    if (error) {
      await loadNotifs();
    }
  }

  /* =======================
     CLOSE DROPDOWNS ON CLICK OUT
  ======================= */
  useEffect(() => {
    function onClick(e) {
      // user menu
      if (
        userMenuOpen &&
        userMenuRef.current &&
        !userMenuRef.current.contains(e.target)
      ) {
        setUserMenuOpen(false);
      }

      // notifications
      if (notifOpen && notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [userMenuOpen, notifOpen]);

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
      notifications: "Arifa",
      markAllRead: "Soma zote",
      noNotifications: "Hakuna arifa kwa sasa.",
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
      notifications: "Notifications",
      markAllRead: "Mark all read",
      noNotifications: "No notifications yet.",
    };
    return lang === "SW" ? SW : EN;
  }, [lang]);

  async function signOut() {
    setUserMenuOpen(false);
    setNotifOpen(false);
    setMobileOpen(false);
    await supabase.auth.signOut();
    navigate("/swahiba/login", { replace: true });
  }

  const profileName = profile?.full_name || me?.email || "Account";
  const role = profile?.role || "user";
  const mainLinks = [
    { to: "/", label: labels.home },
    { to: "/resources", label: labels.learn },
    { to: "/marketplace", label: labels.products },
    { to: "/about", label: labels.about },
  ];

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
            {mainLinks.map((link) => (
              <NavLink key={link.to} to={link.to} className="text-sm font-semibold">
                {link.label}
              </NavLink>
            ))}
          </nav>

          {/* RIGHT CONTROLS */}
          <div className="flex items-center gap-3">
            {/* 🌍 LANGUAGE TOGGLE */}
            {!isCompactHeight && (
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
            )}

            {/* PUBLIC OR STAFF */}
            {!isStaffArea ? (
              !isCompactHeight &&
              showTalkButton && (
                <button
                  onClick={() => navigate("/talk")}
                  className="rounded-2xl bg-amber-500 px-5 py-2 text-sm font-semibold text-white"
                >
                  {labels.talk}
                </button>
              )
            ) : (
              <>
                {/* 🔔 NOTIFICATIONS BELL */}
                <div className="relative" ref={notifRef}>
                  <button
                    type="button"
                    onClick={() => setNotifOpen((p) => !p)}
                    className="relative rounded-2xl border border-slate-200 bg-white px-3 py-2 hover:bg-slate-50"
                    aria-label="Notifications"
                    title={labels.notifications}
                  >
                    🔔
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[11px] font-bold flex items-center justify-center">
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    )}
                  </button>

                  {notifOpen && (
                    <div className="absolute right-0 mt-2 w-[340px] rounded-3xl border border-slate-200 bg-white shadow-lg overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
                        <div className="font-bold text-sm">
                          {labels.notifications}
                        </div>
                        <button
                          type="button"
                          onClick={markAllNotifsRead}
                          className="text-xs font-semibold text-amber-700 hover:text-amber-800"
                        >
                          {labels.markAllRead}
                        </button>
                      </div>

                      <div className="max-h-[360px] overflow-y-auto">
                        {notifications.length === 0 ? (
                          <div className="p-4 text-sm text-slate-600">
                            {labels.noNotifications}
                          </div>
                        ) : (
                          notifications.map((n) => (
                            <button
                              key={n.id}
                              type="button"
                              onClick={async () => {
                                // mark read immediately (UI + DB)
                                await markNotifRead(n.id);

                                setNotifOpen(false);

                                // If linked to a request, go to inbox and pass open id
                                if (n.ref_table === "requests" && n.ref_id) {
                                  navigate(`/swahiba/inbox?open=${n.ref_id}`);
                                  return;
                                }

                                // Otherwise just go inbox
                                navigate("/swahiba/inbox");
                              }}
                              className={[
                                "w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-slate-50",
                                n.is_read ? "bg-white" : "bg-amber-50",
                              ].join(" ")}
                            >
                              <div className="text-sm font-extrabold text-slate-900">
                                {n.title}
                              </div>
                              {n.body && (
                                <div className="mt-1 text-xs text-slate-600">
                                  {n.body}
                                </div>
                              )}
                              <div className="mt-1 text-[11px] text-slate-500">
                                {new Date(n.created_at).toLocaleString()}
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* USER MENU */}
                <div className="relative" ref={userMenuRef}>
                  <button
                    onClick={() => setUserMenuOpen((p) => !p)}
                    className="flex items-center gap-3 rounded-2xl border px-3 py-2 bg-white hover:bg-slate-50"
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
              </>
            )}

            {isCompactHeight && (
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50"
                aria-label="Open menu"
              >
                ☰
              </button>
            )}
          </div>
        </div>
      </div>

      {isCompactHeight && mobileOpen && (
        <div className="fixed inset-0 z-[60]">
          <button
            type="button"
            className="absolute inset-0 bg-black/30"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          />
          <div className="absolute right-0 top-0 h-full w-72 bg-white shadow-xl border-l border-slate-200 p-4 flex flex-col">
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold">{labels.talk}</div>
              <button
                type="button"
                className="rounded-xl border border-slate-200 px-3 py-1 text-xs font-semibold"
                onClick={() => setMobileOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {mainLinks.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-xl px-3 py-2 text-sm font-semibold hover:bg-slate-50"
                >
                  {link.label}
                </NavLink>
              ))}

              {!isStaffArea && showTalkButton && (
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    navigate("/talk");
                  }}
                  className="w-full rounded-xl bg-amber-500 px-3 py-2 text-sm font-semibold text-white"
                >
                  {labels.talk}
                </button>
              )}
            </div>

            {isStaffArea && (
              <div className="mt-4 space-y-2 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    navigate("/swahiba/cases");
                  }}
                  className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold hover:bg-slate-50"
                >
                  {labels.dashboard}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    navigate("/swahiba/inbox");
                  }}
                  className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold hover:bg-slate-50"
                >
                  {labels.inbox}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    navigate("/swahiba/profile");
                  }}
                  className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold hover:bg-slate-50"
                >
                  {labels.profile}
                </button>
                <button
                  type="button"
                  onClick={signOut}
                  className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-red-600 hover:bg-red-50"
                >
                  {labels.signOut}
                </button>
              </div>
            )}

            <div className="mt-auto border-t border-slate-200 pt-4">
              <div className="text-xs font-semibold text-slate-500 mb-2">Language</div>
              <div className="flex overflow-hidden rounded-2xl border border-slate-200">
                <button
                  onClick={() => setLang("SW")}
                  className={`flex-1 px-3 py-2 text-xs font-bold ${
                    lang === "SW"
                      ? "bg-slate-900 text-white"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  SW
                </button>
                <button
                  onClick={() => setLang("EN")}
                  className={`flex-1 px-3 py-2 text-xs font-bold ${
                    lang === "EN"
                      ? "bg-slate-900 text-white"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  EN
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
