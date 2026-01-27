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
  district: string | null;
  region: string | null;
  avatar_url: string | null;
  bio: string | null;
  availability: string;
  expertise_contraceptives: boolean | null;
  expertise_hiv_stis: boolean | null;
  expertise_gbv: boolean | null;
  expertise_mental_health: boolean | null;
  expertise_physical_health: boolean | null;
  expertise_nutrition: boolean | null;
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
        district,
        region,
        avatar_url,
        bio,
        availability,
        last_seen_at,
        expertise_contraceptives,
        expertise_hiv_stis,
        expertise_gbv,
        expertise_mental_health,
        expertise_physical_health,
        expertise_nutrition
      `
      )
      .eq("role", "swahiba")
      .eq("availability", "available")
      .order("last_seen_at", { ascending: false })
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
      const { data: fallback, error: fallbackErr } = await supabase
        .from("profiles")
        .select(
          `
          id,
          full_name,
          district,
          region,
          avatar_url,
          bio,
          availability,
          last_seen_at,
          expertise_contraceptives,
          expertise_hiv_stis,
          expertise_gbv,
          expertise_mental_health,
          expertise_physical_health,
          expertise_nutrition
        `
        )
        .eq("role", "swahiba")
        .neq("availability", "available")
        .order("last_seen_at", { ascending: true })
        .limit(1)
        .maybeSingle<SwahibaProfile>();

      if (fallbackErr) {
        return new Response(
          JSON.stringify({
            error: "Database error",
            details: fallbackErr.message,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      if (!fallback) {
        return new Response(
          JSON.stringify({ error: "No Swahiba available" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(JSON.stringify(fallback), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
