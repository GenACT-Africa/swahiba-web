import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(body: unknown, status = 200, origin = "*") {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Credentials": "true",
      Vary: "Origin",
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

function bufferToBase64url(buf: ArrayBuffer | Uint8Array) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  const base64 = btoa(binary);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64urlToBuffer(base64url: string) {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "===".slice((base64.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function getOriginAndRpId(req: Request) {
  const origin = req.headers.get("origin") || "https://swahiba.org";
  const host = new URL(origin).hostname;
  const rpId = host === "localhost" ? "localhost" : "swahiba.org";
  return { origin, rpId };
}

serve(async (req) => {
  const originHeader = req.headers.get("origin") || "*";
  console.log("passkey request", { method: req.method, origin: originHeader });

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": originHeader,
        "Access-Control-Allow-Credentials": "true",
        Vary: "Origin",
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

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");
    const phone = String(body?.phone || "").trim();
    const credential = body?.credential;
    const { origin, rpId } = getOriginAndRpId(req);

    if (action === "ping") {
      return json({ ok: true }, 200, originHeader);
    }

    if (action === "register_options") {
      console.log("passkey: register_options");
      if (!phone) return json({ error: "Phone is required" }, 400, originHeader);

      let userId: string | null = null;
      const { data: existing, error: existingErr } = await admin
        .schema("auth")
        .from("users")
        .select("id")
        .eq("phone", phone)
        .maybeSingle();
      if (existingErr) {
        console.error("auth.users lookup error", existingErr);
        throw existingErr;
      }
      if (existing?.id) {
        userId = existing.id;
      } else {
        const { data: created, error: createErr } = await admin.auth.admin.createUser({
          phone,
          phone_confirm: true,
        });
        if (createErr) throw createErr;
        userId = created.user?.id || null;
      }

      if (!userId) return json({ error: "Failed to provision user" }, 500);

      const challenge = bufferToBase64url(crypto.getRandomValues(new Uint8Array(32)));
      const userIdBuf = new TextEncoder().encode(userId);
      const userIdB64 = bufferToBase64url(userIdBuf);

      const options = {
        rp: { name: "Swahiba", id: rpId },
        user: { id: userIdB64, name: phone, displayName: phone },
        challenge,
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },
          { type: "public-key", alg: -257 },
        ],
        timeout: 60000,
        attestation: "none",
        authenticatorSelection: {
          residentKey: "preferred",
          userVerification: "preferred",
        },
      };

      const { error: chErr } = await admin.from("webauthn_challenges").insert({
        phone,
        user_id: userId,
        challenge: options.challenge,
        type: "register",
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      });
      if (chErr) {
        console.error("challenge insert error", chErr);
        throw chErr;
      }

      return json({ options }, 200, originHeader);
    }

    if (action === "register_verify") {
      console.log("passkey: register_verify");
      if (!phone || !credential) return json({ error: "Missing payload" }, 400, originHeader);

      const { data: latest, error: chErr } = await admin
        .from("webauthn_challenges")
        .select("id, challenge, user_id, expires_at")
        .eq("phone", phone)
        .eq("type", "register")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (chErr) {
        console.error("challenge lookup error", chErr);
        throw chErr;
      }
      if (!latest) return json({ error: "Challenge not found" }, 404, originHeader);
      if (new Date(latest.expires_at).getTime() < Date.now()) {
        return json({ error: "Challenge expired" }, 410, originHeader);
      }

      const { error: keyErr } = await admin.from("user_passkeys").insert({
        user_id: latest.user_id,
        phone,
        credential_id: credential?.id,
        public_key: credential?.response?.attestationObject || "",
        counter: 0,
      });
      if (keyErr) {
        console.error("passkey insert error", keyErr);
        throw keyErr;
      }

      const { error: accessErr } = await admin.from("user_access").upsert(
        {
          phone,
          user_id: latest.user_id,
          access_code_hash: null,
        },
        { onConflict: "phone" }
      );
      if (accessErr) {
        console.error("user_access upsert error", accessErr);
        throw accessErr;
      }

      const sessionToken = crypto.randomUUID();
      const tokenHash = await sha256Hex(sessionToken);
      const { error: sessErr } = await admin.from("chat_sessions").insert({
        token_hash: tokenHash,
        user_id: latest.user_id,
        phone,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });
      if (sessErr) {
        console.error("session insert error", sessErr);
        throw sessErr;
      }

      return json({ ok: true, session_token: sessionToken }, 200, originHeader);
    }

    if (action === "login_options") {
      console.log("passkey: login_options");
      const challenge = bufferToBase64url(crypto.getRandomValues(new Uint8Array(32)));
      const options = {
        rpId,
        challenge,
        timeout: 60000,
        userVerification: "preferred",
      };

      const { error: chErr } = await admin.from("webauthn_challenges").insert({
        phone: phone || null,
        user_id: null,
        challenge: options.challenge,
        type: "login",
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      });
      if (chErr) {
        console.error("login challenge insert error", chErr);
        throw chErr;
      }

      return json({ options }, 200, originHeader);
    }

    if (action === "login_verify") {
      console.log("passkey: login_verify");
      if (!credential) return json({ error: "Missing payload" }, 400, originHeader);

      const { data: latest, error: chErr } = await admin
        .from("webauthn_challenges")
        .select("id, challenge, expires_at")
        .eq("type", "login")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (chErr) {
        console.error("login challenge lookup error", chErr);
        throw chErr;
      }
      if (!latest) return json({ error: "Challenge not found" }, 404, originHeader);
      if (new Date(latest.expires_at).getTime() < Date.now()) {
        return json({ error: "Challenge expired" }, 410, originHeader);
      }

      const credId = credential?.id;
      const { data: keyRow, error: keyErr } = await admin
        .from("user_passkeys")
        .select("id, user_id, phone, credential_id, public_key, counter")
        .eq("credential_id", credId)
        .maybeSingle();
      if (keyErr) {
        console.error("passkey lookup error", keyErr);
        throw keyErr;
      }
      if (!keyRow) return json({ error: "Passkey not found" }, 404, originHeader);

      // Stub: no cryptographic verification, only credential id match

      const sessionToken = crypto.randomUUID();
      const tokenHash = await sha256Hex(sessionToken);
      const { error: sessErr } = await admin.from("chat_sessions").insert({
        token_hash: tokenHash,
        user_id: keyRow.user_id,
        phone: keyRow.phone,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });
      if (sessErr) {
        console.error("session insert error", sessErr);
        throw sessErr;
      }

      return json({ ok: true, session_token: sessionToken }, 200, originHeader);
    }

    return json({ error: "Invalid action" }, 400, originHeader);
  } catch (e) {
    console.error("passkey error", e);
    return json({ error: "Internal error", details: String(e), action }, 500, originHeader);
  }
});
