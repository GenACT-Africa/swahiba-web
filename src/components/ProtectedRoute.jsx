import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function ProtectedRoute({ children, requireAdmin = false }) {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const checkAccess = async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session;

      if (!session) {
        setAuthorized(false);
        setLoading(false);
        return;
      }

      if (!requireAdmin) {
        setAuthorized(true);
        setLoading(false);
        return;
      }

      // 🔐 Admin check
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();

      setAuthorized(profile?.role === "admin");
      setLoading(false);
    };

    checkAccess();
  }, [requireAdmin]);

  if (loading) return null;

  if (!authorized) {
    return <Navigate to="/swahiba/login" replace />;
  }

  return children;
}