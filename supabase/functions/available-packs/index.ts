import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return json({ error: "Missing server configuration" }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const packType = String(body?.pack_type || "").trim();
    if (!packType) return json({ error: "pack_type is required" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: packs, error: packsErr } = await admin
      .from("packs")
      .select("id, pack_no, pack_type, user_id, is_active, created_at")
      .eq("pack_type", packType)
      .eq("is_active", true)
      .is("user_id", null)
      .order("created_at", { ascending: true });
    if (packsErr) throw packsErr;

    const list = packs || [];
    if (!list.length) return json({ packs: [], items: [] }, 200);

    const ids = list.map((p) => p.id);
    const { data: items, error: itemsErr } = await admin
      .from("pack_items")
      .select("id, pack_id, product_id, qty, is_free, products:products(id, product_name, price_tzs, image_url, image_path)")
      .in("pack_id", ids);
    if (itemsErr) throw itemsErr;

    return json({ packs: list, items: items || [] }, 200);
  } catch (e) {
    return json({ error: "Internal error", details: String(e) }, 500);
  }
});
