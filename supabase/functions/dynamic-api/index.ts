import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * CORS configuration
 * (Lock this down to your domain later)
 */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * Swahiba profile shape
 */
type SwahibaProfile = {
  id: string;
  full_name: string;
  phone_number: string | null;
  district: string | null;
  region: string | null;
  availability: string;
};

serve(async (req) => {
  // ─────────────────────────────────────────────
  // Handle CORS preflight
  // ─────────────────────────────────────────────
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ─────────────────────────────────────────────
    // Create Supabase client (SERVICE ROLE)
    // ─────────────────────────────────────────────
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ─────────────────────────────────────────────
    // Fetch ONE available Swahiba
    // (availability-only matching)
    // ─────────────────────────────────────────────
    const { data, error } = await supabase
      .from("profiles")
      .select(
        `
        id,
        full_name,
        phone_number,
        district,
        region,
        availability
      `
      )
      .eq("availability", "available")
      .limit(1)
      .maybeSingle<SwahibaProfile>();

    // ─────────────────────────────────────────────
    // Database error
    // ─────────────────────────────────────────────
    if (error) {
      return new Response(
        JSON.stringify({
          error: "Database error",
          details: error.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ─────────────────────────────────────────────
    // No Swahiba available
    // ─────────────────────────────────────────────
    if (!data) {
      return new Response(
        JSON.stringify({ error: "No Swahiba available" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ─────────────────────────────────────────────
    // Success
    // ─────────────────────────────────────────────
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    // ─────────────────────────────────────────────
    // Unexpected failure
    // ─────────────────────────────────────────────
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: String(e),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});