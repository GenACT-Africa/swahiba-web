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

async function accessCodeHash(phone: string, accessCode: string) {
  return sha256Hex(`${phone}:${accessCode.toLowerCase()}`);
}

async function legacyAccessCodeHash(accessCode: string) {
  return sha256Hex(accessCode.toLowerCase());
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
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return json({ error: "Missing server configuration" }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");
    const phone = normalizePhone(String(body?.phone || ""));
    const otp = String(body?.otp || "").trim();
    const accessCode = String(body?.access_code || "").trim();
    const sessionToken = String(body?.session_token || "").trim();

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    if (!phone) return json({ error: "Phone is required" }, 400);

    if (action === "start_otp") {
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const codeHash = await sha256Hex(code);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      const { error } = await admin.from("otp_requests").insert({
        phone,
        code_hash: codeHash,
        expires_at: expiresAt,
      });
      if (error) throw error;

      return json({ ok: true, dev_code: code }, 200);
    }

    if (action === "verify_otp") {
      if (!otp) return json({ error: "OTP is required" }, 400);

      const otpHash = await sha256Hex(otp);
      const { data: row, error } = await admin
        .from("otp_requests")
        .select("id, code_hash, expires_at, verified_at")
        .eq("phone", phone)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!row) return json({ error: "OTP not found" }, 404);
      if (row.verified_at) return json({ ok: true }, 200);
      if (new Date(row.expires_at).getTime() < Date.now()) {
        return json({ error: "OTP expired" }, 410);
      }
      if (row.code_hash !== otpHash) return json({ error: "Invalid OTP" }, 401);

      const { error: updErr } = await admin
        .from("otp_requests")
        .update({ verified_at: new Date().toISOString() })
        .eq("id", row.id);
      if (updErr) throw updErr;

      return json({ ok: true }, 200);
    }

    if (action === "set_access_code" || action === "set_access_code_no_otp") {
      if (!/^[a-zA-Z0-9]{4}$/.test(accessCode)) {
        return json({ error: "Access code must be 4 letters/numbers" }, 400);
      }

      if (action === "set_access_code") {
        const { data: latestOtp, error: otpErr } = await admin
          .from("otp_requests")
          .select("verified_at")
          .eq("phone", phone)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (otpErr) throw otpErr;
        if (!latestOtp?.verified_at) return json({ error: "OTP not verified" }, 401);
        const verifiedAt = new Date(latestOtp.verified_at).getTime();
        if (Date.now() - verifiedAt > 15 * 60 * 1000) {
          return json({ error: "OTP verification expired" }, 410);
        }
      }

      const accessHash = await accessCodeHash(phone, accessCode);

      let userId: string | null = null;
      const { data: existingUser } = await admin
        .schema("auth")
        .from("users")
        .select("id")
        .eq("phone", phone)
        .maybeSingle();
      if (existingUser?.id) {
        userId = existingUser.id;
      } else {
        const { data: created, error: createErr } = await admin.auth.admin.createUser({
          phone,
          phone_confirm: true,
        });
        if (createErr) throw createErr;
        userId = created.user?.id || null;
      }

      if (!userId) return json({ error: "Failed to provision user" }, 500);

      await admin.from("profiles").update({ role: "guest" }).eq("id", userId);

      const { error: upsertErr } = await admin.from("user_access").upsert(
        {
          phone,
          access_code_hash: accessHash,
          user_id: userId,
        },
        { onConflict: "phone" }
      );
      if (upsertErr) throw upsertErr;

      return json({ ok: true }, 200);
    }

    if (action === "create_request_with_pin") {
      if (!/^[a-zA-Z0-9]{4}$/.test(accessCode)) {
        return json({ error: "Access code must be 4 letters/numbers" }, 400);
      }

      const accessHash = await accessCodeHash(phone, accessCode);
      let { data: accessRow, error: accessErr } = await admin
        .from("user_access")
        .select("user_id, phone")
        .eq("phone", phone)
        .eq("access_code_hash", accessHash)
        .maybeSingle();
      if (!accessRow) {
        const legacyHash = await legacyAccessCodeHash(accessCode);
        ({ data: accessRow, error: accessErr } = await admin
          .from("user_access")
          .select("user_id, phone")
          .eq("phone", phone)
          .eq("access_code_hash", legacyHash)
          .maybeSingle());
      }
      if (accessErr) throw accessErr;
      if (!accessRow?.user_id) return json({ error: "Invalid phone/PIN" }, 401);

      const payload = {
        swahiba_id: body?.swahiba_id ?? null,
        nickname: body?.nickname ?? "Anonymous",
        location: body?.location ?? null,
        need: body?.need ?? null,
        description: body?.description ?? null,
        channel: body?.channel ?? null,
        phone: phone,
        status: "pending",
        created_by: accessRow.user_id,
      };

      const { data: request, error: reqErr } = await admin
        .from("requests")
        .insert([payload])
        .select()
        .single();
      if (reqErr) throw reqErr;

      // Notification is handled by DB trigger (notify_on_new_request_targeted)

      return json({ request }, 200);
    }

    if (action === "create_request_with_session") {
      if (!sessionToken) return json({ error: "Missing session token" }, 400);
      const tokenHash = await sha256Hex(sessionToken);
      const { data: sess, error: sessErr } = await admin
        .from("chat_sessions")
        .select("user_id, phone, expires_at")
        .eq("token_hash", tokenHash)
        .maybeSingle();
      if (sessErr) throw sessErr;
      if (!sess?.user_id || !sess?.phone) return json({ error: "Invalid session" }, 401);
      if (new Date(sess.expires_at).getTime() < Date.now()) {
        return json({ error: "Session expired" }, 401);
      }

      const payload = {
        swahiba_id: body?.swahiba_id ?? null,
        nickname: body?.nickname ?? "Anonymous",
        location: body?.location ?? null,
        need: body?.need ?? null,
        description: body?.description ?? null,
        channel: body?.channel ?? null,
        phone: sess.phone,
        status: "pending",
        created_by: sess.user_id,
      };

      const { data: request, error: reqErr } = await admin
        .from("requests")
        .insert([payload])
        .select()
        .single();
      if (reqErr) throw reqErr;

      // Notification is handled by DB trigger (notify_on_new_request_targeted)

      return json({ request }, 200);
    }

    return json({ error: "Invalid action" }, 400);
  } catch (e) {
    return json({ error: "Internal error", details: String(e) }, 500);
  }
});
