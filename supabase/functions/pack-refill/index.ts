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
    const packNo = String(body?.pack_no || "").trim();
    if (!packNo) return json({ error: "pack_no is required" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: claim, error: claimErr } = await admin.rpc("claim_pack_by_no", {
      p_pack_no: packNo,
    });
    if (claimErr) throw claimErr;
    if (!claim || !claim.length) return json({ pack: null, items: [] }, 200);

    const pack = claim[0];
    const { data: items, error: itemsErr } = await admin
      .from("pack_items")
      .select(
        "id, qty, is_free, product:products(id, product_name, description, price_tzs, image_url, image_path, whatsapp_order_number)"
      )
      .eq("pack_id", pack.pack_id);
    if (itemsErr) throw itemsErr;

    return json({ pack, items: items || [] }, 200);
  } catch (e) {
    return json({ error: "Internal error", details: String(e) }, 500);
  }
});
