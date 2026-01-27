import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const APP_URL = Deno.env.get("APP_URL") || "https://example.com";

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

type RequestRow = {
  id: string;
  swahiba_id: string | null;
  created_by: string | null;
  conversation_id: string | null;
  status: string | null;
  need: string | null;
  phone?: string | null;
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
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY) {
      return json({ error: "Missing server configuration" }, 500);
    }

    const authHeader =
      req.headers.get("Authorization") || req.headers.get("authorization") || "";
    if (!/^Bearer\s+\S+/i.test(authHeader)) {
      return json({ error: "Missing or invalid Authorization header" }, 401);
    }
    const jwt = authHeader.replace(/^Bearer\s+/i, "");

    const body = await req.json().catch(() => ({}));
    const requestId = String(body?.request_id || "");
    const action = String(body?.action || "history");
    const messageText = String(body?.message || "").trim();

    if (!requestId) return json({ error: "Missing request_id" }, 400);

    const supabaseUser = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: authData, error: authErr } = await supabaseUser.auth.getUser(jwt);
    if (authErr || !authData?.user) {
      return json({ error: "Not authenticated", details: authErr?.message }, 401);
    }

    const userId = authData.user.id;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: requestRow, error: reqErr } = await admin
      .from("requests")
      .select("id, swahiba_id, created_by, conversation_id, status, need, phone")
      .eq("id", requestId)
      .maybeSingle<RequestRow>();
    if (reqErr) throw reqErr;
    if (!requestRow) return json({ error: "Request not found" }, 404);
    const isSwahiba = requestRow.swahiba_id === userId;
    const isRequester = requestRow.created_by === userId;
    if (!isSwahiba && !isRequester) {
      return json({ error: "Forbidden" }, 403);
    }

    if (action === "history") {
      if (!requestRow.conversation_id) {
        return json({ conversation_id: null, messages: [] }, 200);
      }

      const { data: messages, error: msgErr } = await admin
        .from("messages")
        .select("id, sender_id, body, type, created_at")
        .eq("conversation_id", requestRow.conversation_id)
        .order("created_at", { ascending: true })
        .limit(200);
      if (msgErr) throw msgErr;

      return json(
        {
          conversation_id: requestRow.conversation_id,
          messages: messages || [],
        },
        200
      );
    }

    if (action !== "send") {
      return json({ error: "Invalid action" }, 400);
    }

    if (!messageText) return json({ error: "Message is empty" }, 400);
    if (!requestRow.created_by) {
      return json({ error: "Request has no user to chat with" }, 409);
    }

    let conversationId = requestRow.conversation_id;
    if (!conversationId && requestRow.phone) {
      const { data: existing } = await admin
        .from("requests")
        .select("conversation_id")
        .eq("phone", requestRow.phone)
        .eq("swahiba_id", requestRow.swahiba_id)
        .not("conversation_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing?.conversation_id) {
        conversationId = existing.conversation_id;
        await admin
          .from("requests")
          .update({ conversation_id: conversationId, status: "accepted" })
          .eq("id", requestId);
      }
    }

    if (!conversationId) {
      const assignedTo = requestRow.swahiba_id;
      if (!assignedTo) {
        return json({ error: "Request has no assigned Swahiba" }, 409);
      }

      const { data: convo, error: convoErr } = await admin
        .from("conversations")
        .insert({
          created_by: requestRow.created_by,
          assigned_to: assignedTo,
          status: "active",
          topic: requestRow.need || "request",
        })
        .select("id")
        .single();
      if (convoErr) throw convoErr;
      conversationId = convo.id;

      await admin.from("conversation_participants").insert([
        { conversation_id: conversationId, user_id: requestRow.created_by, role_in_convo: "guest" },
        { conversation_id: conversationId, user_id: assignedTo, role_in_convo: "peer" },
      ]);

      await admin
        .from("requests")
        .update({ conversation_id: conversationId, status: "accepted" })
        .eq("id", requestId);
    }

    const { data: messageRow, error: sendErr } = await admin
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender_id: userId,
        body: messageText,
        type: "text",
      })
      .select("id, sender_id, body, type, created_at")
      .single();
    if (sendErr) throw sendErr;

    if (isSwahiba && requestRow.phone) {
      try {
        await admin.from("outbound_notifications").insert({
          channel: "whatsapp",
          to_phone: requestRow.phone,
          body: "Swahiba has replied. Open your chat and use your access code to continue.",
          link_url: `${APP_URL}/talk?chat=1`,
          metadata: {
            request_id: requestId,
            conversation_id: conversationId,
          },
        });
      } catch (_e) {
        // ignore if table/provider not configured yet
      }
    }

    return json(
      {
        conversation_id: conversationId,
        message: messageRow,
      },
      200
    );
  } catch (e) {
    return json({ error: "Internal error", details: String(e) }, 500);
  }
});
