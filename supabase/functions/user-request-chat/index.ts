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
      "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
  });
}

async function sha256Hex(value: string) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function accessCodeHash(phone: string, accessCode: string) {
  return sha256Hex(`${phone}:${accessCode.toLowerCase()}`);
}

async function legacyAccessCodeHash(accessCode: string) {
  return sha256Hex(accessCode.toLowerCase());
}

function normalizePhone(v: string) {
  const cleaned = v.replace(/[^\d+]/g, "").trim();
  if (!cleaned) return "";
  if (cleaned.startsWith("+")) return cleaned;
  if (cleaned.startsWith("255")) return `+${cleaned}`;
  if (cleaned.startsWith("0") && cleaned.length === 10) {
    return `+255${cleaned.slice(1)}`;
  }
  if (/^[67]\d{8}$/.test(cleaned)) {
    return `+255${cleaned}`;
  }
  return cleaned;
}

type RequestRow = {
  id: string;
  swahiba_id: string | null;
  created_by: string | null;
  conversation_id: string | null;
  status: string | null;
  need: string | null;
  phone: string | null;
};

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
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return json({ error: "Missing server configuration" }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const accessCode = String(body?.access_code || "").trim();
    const phoneRaw = String(body?.phone || "");
    const action = String(body?.action || "history");
    const messageText = String(body?.message || "").trim();

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const phoneNormalized = normalizePhone(phoneRaw);
    if (!phoneNormalized) return json({ error: "Missing phone" }, 400);
    if (!/^[a-zA-Z0-9]{4}$/.test(accessCode)) {
      return json({ error: "Invalid access code" }, 400);
    }

    const accessHash = await accessCodeHash(phoneNormalized, accessCode);
    let { data: accessRow, error: accessErr } = await admin
      .from("user_access")
      .select("phone, user_id")
      .eq("phone", phoneNormalized)
      .eq("access_code_hash", accessHash)
      .maybeSingle();
    if (!accessRow) {
      const legacyHash = await legacyAccessCodeHash(accessCode);
      ({ data: accessRow, error: accessErr } = await admin
        .from("user_access")
        .select("phone, user_id")
        .eq("phone", phoneNormalized)
        .eq("access_code_hash", legacyHash)
        .maybeSingle());
    }
    if (accessErr) {
      console.error("access lookup error", accessErr);
      throw accessErr;
    }
    if (!accessRow?.phone) return json({ error: "Invalid phone/PIN" }, 404);
    const phoneForLookup = accessRow.phone;
    const userIdFromAccess = accessRow.user_id || null;

  const { data: requestRow, error: reqErr } = await admin
    .from("requests")
    .select("id, swahiba_id, created_by, conversation_id, status, need, phone")
    .eq("phone", phoneForLookup)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<RequestRow>();
    if (reqErr) {
      console.error("request lookup error", reqErr);
      throw reqErr;
    }
  if (!requestRow) return json({ error: "No request found for access code" }, 404);

    if (action === "history") {
      if (!requestRow.conversation_id) {
        return json({ request: requestRow, conversation_id: null, messages: [] }, 200);
      }

      const { data: messages, error: msgErr } = await admin
        .from("messages")
        .select("id, sender_id, body, type, created_at")
        .eq("conversation_id", requestRow.conversation_id)
        .order("created_at", { ascending: true })
        .limit(200);
      if (msgErr) {
        console.error("messages history error", msgErr);
        throw msgErr;
      }

      return json(
        {
          request: requestRow,
          conversation_id: requestRow.conversation_id,
          messages: messages || [],
        },
        200
      );
    }

    if (action !== "send") return json({ error: "Invalid action" }, 400);
    if (!messageText) return json({ error: "Message is empty" }, 400);
    if (!userIdFromAccess) return json({ error: "Request has no user account" }, 409);
    if (!requestRow.swahiba_id) return json({ error: "Request has no Swahiba" }, 409);

    let conversationId = requestRow.conversation_id;
    if (!conversationId) {
      const { data: existing, error: existingErr } = await admin
        .from("requests")
        .select("conversation_id")
        .eq("phone", phoneForLookup)
        .eq("swahiba_id", requestRow.swahiba_id)
        .not("conversation_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existingErr) console.error("existing convo lookup error", existingErr);

      if (existing?.conversation_id) {
        conversationId = existing.conversation_id;
        await admin
          .from("requests")
          .update({ conversation_id: conversationId, status: "accepted" })
          .eq("id", requestRow.id);
      }
    }

    if (!conversationId) {
      const { data: convo, error: convoErr } = await admin
        .from("conversations")
        .insert({
          created_by: userIdFromAccess,
          assigned_to: requestRow.swahiba_id,
          status: "active",
          topic: requestRow.need || "request",
        })
        .select("id")
        .single();
      if (convoErr) {
        console.error("conversation insert error", convoErr);
        throw convoErr;
      }
      conversationId = convo.id;

      const { error: partErr } = await admin.from("conversation_participants").insert([
        { conversation_id: conversationId, user_id: userIdFromAccess, role_in_convo: "guest" },
        { conversation_id: conversationId, user_id: requestRow.swahiba_id, role_in_convo: "peer" },
      ]);
      if (partErr) {
        console.error("participants insert error", partErr);
        throw partErr;
      }

      const { error: reqUpdateErr } = await admin
        .from("requests")
        .update({ conversation_id: conversationId, status: "accepted" })
        .eq("id", requestRow.id);
      if (reqUpdateErr) {
        console.error("request update error", reqUpdateErr);
        throw reqUpdateErr;
      }
    }

    const { data: messageRow, error: sendErr } = await admin
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender_id: userIdFromAccess,
        body: messageText,
        type: "text",
      })
      .select("id, sender_id, body, type, created_at")
      .single();
    if (sendErr) {
      console.error("message insert error", sendErr);
      throw sendErr;
    }

    return json(
      {
        request: { ...requestRow, conversation_id: conversationId, status: "accepted" },
        conversation_id: conversationId,
        message: messageRow,
      },
      200
    );
  } catch (e) {
    console.error("user-request-chat error", e);
    return json({ error: "Internal error", details: String(e) }, 500);
  }
});
