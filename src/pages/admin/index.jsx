import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function AdminGuard({ children }) {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function checkAdmin() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || user.email !== "admin@genactafrica.org") {
        navigate("/login");
        return;
      }

      setChecking(false);
    }

    checkAdmin();
  }, [navigate]);

  if (checking) {
    return <div className="p-6 text-sm text-slate-500">Checking access…</div>;
  }

  return children;
}