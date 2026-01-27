import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers":
          "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY) {
      console.error("missing env", {
        SUPABASE_URL: Boolean(SUPABASE_URL),
        SERVICE_ROLE_KEY: Boolean(SERVICE_ROLE_KEY),
        ANON_KEY: Boolean(ANON_KEY),
      });
      return json({ error: "Missing server configuration" }, 500);
    }

    const authHeader =
      req.headers.get("Authorization") || req.headers.get("authorization") || "";
    if (!/^Bearer\s+\S+/i.test(authHeader)) {
      return json({ error: "Missing or invalid Authorization header" }, 401);
    }
    const jwt = authHeader.replace(/^Bearer\s+/i, "");

    const supabaseUser = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: authData, error: authErr } = await supabaseUser.auth.getUser(jwt);
    if (authErr || !authData?.user) {
      console.error("auth error", authErr);
      return json({ error: "Not authenticated", details: authErr?.message }, 401);
    }

    const userId = authData.user.id;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: profile, error: profileErr } = await admin
      .from("profiles")
      .select("id, role")
      .eq("id", userId)
      .maybeSingle();
    if (profileErr) {
      console.error("profile error", profileErr);
      throw profileErr;
    }
    if (!profile || profile.role !== "swahiba") {
      return json({ error: "Forbidden" }, 403);
    }

    const { data, error } = await admin
      .from("requests")
      .select(
        "id, status, need, nickname, location, description, channel, phone, created_at, swahiba_id, created_by, conversation_id"
      )
      .eq("swahiba_id", userId)
      .or("status.is.null,status.neq.closed")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("requests query error", error);
      throw error;
    }

    return json({ data: data || [] }, 200);
  } catch (e) {
    console.error("requests-inbox error", e);
    return json({ error: "Internal error", details: String(e) }, 500);
  }
});
