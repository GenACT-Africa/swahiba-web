import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import { supabase } from "../lib/supabaseClient";

export default function Footer() {
  const { lang } = useLanguage();
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [roleChecked, setRoleChecked] = useState(false);

  // --- Track auth state ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data?.session?.user ?? null);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const t =
    lang === "SW"
      ? {
          brandDesc:
            "Rafiki wa kuaminika kwa maswali na msaada wa afya yako ya mwili na akili kwa siri, kwa heshima, na kwa usalama.",
          notEmergency: "Swahiba si huduma ya dharura.",
          support: "Msaada",
          talk: "Ongea na SWAHIBA",
          triage: "Tathmini ya haraka",
          resources: "Jifunze",
          safety: "Usalama",
          safeguarding: "Ulindi & Ulinzi",
          emergency: "Dharura",
          data: "Matumizi ya data",
          contact: "Mawasiliano",
          rights: "Haki zote zimehifadhiwa.",
          madeFor: "Imetengenezwa kwa uangalifu kwa vijana",
          login: "Ingia",
          logout: "Ondoka",
          manage: "Simamia",
        }
      : {
          brandDesc:
            "A trusted companion for your physical and mental health questions and support private, respectful, and safe.",
          notEmergency: "Swahiba is not an emergency service.",
          support: "Support",
          talk: "Talk to SWAHIBA",
          triage: "Quick check",
          resources: "Learn",
          safety: "Safety",
          safeguarding: "Safeguarding",
          emergency: "Emergency",
          data: "Data use",
          contact: "Contact",
          rights: "All rights reserved.",
          madeFor: "Built with care for young people",
          login: "Login",
          logout: "Logout",
          manage: "Manage",
        };

  // ✅ Resolve admin status safely (DB/RPC first; metadata last)
  async function isAdminSafe(u) {
    if (!u) return false;

    // 1) If you have an RPC, this is best (optional)
    try {
      const { data, error } = await supabase.rpc("is_admin");
      if (!error && typeof data === "boolean") return data;
    } catch {
      // ignore
    }

    // 2) Try common profile tables/columns
    const candidates = [
      { table: "profiles", cols: "role,is_admin" },
      { table: "user_profiles", cols: "role,is_admin" },
    ];

    for (const c of candidates) {
      try {
        const { data, error } = await supabase
          .from(c.table)
          .select(c.cols)
          .eq("id", u.id)
          .maybeSingle?.() ?? supabase.from(c.table).select(c.cols).eq("id", u.id).single();

        if (!error && data) {
          const role = String(data.role || "").toLowerCase();
          const adminFlag = data.is_admin === true;
          return adminFlag || role === "admin";
        }
      } catch {
        // table may not exist or RLS blocks it; keep trying
      }
    }

    // 3) Last fallback: metadata (least reliable)
    const metaRole = String(
      u.user_metadata?.role ||
        u.app_metadata?.role ||
        u.user_metadata?.user_role ||
        u.app_metadata?.user_role ||
        ""
    ).toLowerCase();

    return metaRole === "admin";
  }

  // ✅ Re-check role whenever user changes
  useEffect(() => {
    let alive = true;

    (async () => {
      setRoleChecked(false);
      setIsAdmin(false);

      if (!user) {
        setRoleChecked(true);
        return;
      }

      const ok = await isAdminSafe(user);
      if (!alive) return;

      setIsAdmin(Boolean(ok));
      setRoleChecked(true);
    })();

    return () => {
      alive = false;
    };
  }, [user?.id]);

  const managePath = useMemo(() => {
    // default safe path for any non-admin
    return isAdmin ? "/admin" : "/swahiba/cases";
  }, [isAdmin]);

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate("/", { replace: true });
  }

  function handleManage() {
    navigate(managePath);
  }

  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-[1200px] px-6 py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div>
            <div className="text-lg font-extrabold text-slate-900">SWAHIBA</div>
            <p className="mt-3 text-sm leading-6 text-slate-600">{t.brandDesc}</p>
            <p className="mt-3 text-xs text-slate-500">{t.notEmergency}</p>
          </div>

          {/* Support */}
          <div>
            <div className="text-sm font-bold uppercase tracking-wide text-slate-900">{t.support}</div>
            <ul className="mt-4 space-y-3 text-sm">
              <li>
                <Link to="/talk" className="font-semibold text-amber-600 hover:text-amber-700">
                  {t.talk} →
                </Link>
              </li>
              <li>
                <Link to="/triage" className="text-slate-700 hover:text-slate-900">
                  {t.triage}
                </Link>
              </li>
              <li>
                <Link to="/resources" className="text-slate-700 hover:text-slate-900">
                  {t.resources}
                </Link>
              </li>
            </ul>
          </div>

          {/* Safety */}
          <div>
            <div className="text-sm font-bold uppercase tracking-wide text-slate-900">{t.safety}</div>
            <ul className="mt-4 space-y-3 text-sm">
              <li>
                <Link to="/safeguarding" className="text-slate-700 hover:text-slate-900">
                  {t.safeguarding}
                </Link>
              </li>
              <li>
                <Link to="/emergency-contacts" className="text-slate-700 hover:text-slate-900">
                  {t.emergency}
                </Link>
              </li>
              <li>
                <Link to="/data-use" className="text-slate-700 hover:text-slate-900">
                  {t.data}
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact + Login / Logout + Manage */}
          <div>
            <div className="text-sm font-bold uppercase tracking-wide text-slate-900">{t.contact}</div>
            <ul className="mt-4 space-y-3 text-sm text-slate-700">
              <li>swahiba.org</li>
              <li>
                WhatsApp: <span className="font-semibold">+255780327697</span>
              </li>
            </ul>

            <div className="mt-4">
              {!user ? (
                <Link
                  to="/swahiba/login"
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 underline underline-offset-4"
                >
                  {t.login}
                </Link>
              ) : (
                <>
                  <button
                    onClick={handleLogout}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-800 underline underline-offset-4"
                  >
                    {t.logout}
                  </button>

                  {/* ✅ Manage (below logout, same style) */}
                  <div className="mt-2">
                    <button
                      onClick={handleManage}
                      disabled={!roleChecked} // optional: avoids wrong click before role resolves
                      className="text-xs font-semibold text-slate-500 hover:text-slate-800 underline underline-offset-4 disabled:opacity-50 disabled:cursor-not-allowed"
                      title={!roleChecked ? "Loading…" : ""}
                    >
                      {t.manage}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 border-t border-slate-200 pt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-slate-500">
            © {new Date().getFullYear()} Swahiba. {t.rights}
          </div>
          <div className="text-xs text-slate-500">{t.madeFor} 🌱</div>
        </div>
      </div>
    </footer>
  );
}