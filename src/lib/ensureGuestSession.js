import { supabase } from "./supabaseClient";

export async function ensureGuestSession() {
  const { data: existing } = await supabase.auth.getUser();
  if (existing?.user) return existing.user;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return data.user;
}
