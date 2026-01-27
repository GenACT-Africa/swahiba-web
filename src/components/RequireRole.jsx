import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function RequireRole({ allow = [], children }) {
  const [loading, setLoading] = useState(true);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    let alive = true;

    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) {
        if (alive) {
          setOk(false);
          setLoading(false);
        }
        return;
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role, is_banned")
        .eq("id", user.id)
        .single();

      if (!alive) return;

      if (error || !profile || profile.is_banned) {
        setOk(false);
      } else {
        setOk(allow.includes(profile.role));
      }
      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [allow]);

  if (loading) return <div className="p-4">Loading…</div>;
  if (!ok) return <Navigate to="/" replace />;
  return children;
}
