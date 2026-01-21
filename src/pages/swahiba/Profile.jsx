import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

const AVATAR_BUCKET = "avatars"; // ✅ create this bucket in Supabase Storage (public or private with signed URLs)

function initials(nameOrEmail) {
  const s = String(nameOrEmail || "").trim();
  if (!s) return "U";
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return s.slice(0, 1).toUpperCase();
}

function guessFullNameFromUser(user) {
  // Supabase user metadata differs by provider; these are common keys
  const md = user?.user_metadata || {};
  const name =
    md.full_name ||
    md.name ||
    md.display_name ||
    md.user_name ||
    md.preferred_username ||
    "";
  return String(name || "").trim();
}

function guessAvatarFromUser(user) {
  const md = user?.user_metadata || {};
  // Google often has: avatar_url, picture
  const url = md.avatar_url || md.picture || md.photo_url || "";
  return String(url || "").trim();
}

export default function Profile() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Avatar UI state
  const fileRef = useRef(null);
  const [avatarUrl, setAvatarUrl] = useState(""); // resolved URL to display (google URL or signed URL)
  const [avatarBusy, setAvatarBusy] = useState(false);

  useEffect(() => {
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadProfile() {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
        error: uerr,
      } = await supabase.auth.getUser();

      if (uerr) throw uerr;
      if (!user) throw new Error("Not authenticated");
      setUser(user);

      const { data, error: perr } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (perr) throw perr;

      // ✅ If user signed up with Google, prefer metadata for name/avatar (only if profile is empty)
      const googleName = guessFullNameFromUser(user);
      const googleAvatar = guessAvatarFromUser(user);

      const merged = {
        ...data,
        full_name: data?.full_name || googleName || data?.full_name,
        avatar_url: data?.avatar_url || googleAvatar || data?.avatar_url,
      };

      setProfile(merged);

      // ✅ Resolve avatar display
      const resolved = await resolveAvatar(merged?.avatar_url);
      setAvatarUrl(resolved);
    } catch (err) {
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  async function resolveAvatar(avatar_value) {
    const v = String(avatar_value || "").trim();
    if (!v) return "";

    // If it's already an external url (Google picture), use it
    if (/^https?:\/\//i.test(v)) return v;

    // Otherwise treat as storage path in AVATAR_BUCKET
    try {
      const { data, error } = await supabase.storage
        .from(AVATAR_BUCKET)
        .createSignedUrl(v, 60 * 60); // 1 hour
      if (error) return "";
      return data?.signedUrl || "";
    } catch {
      return "";
    }
  }

  function updateField(key, value) {
    setProfile((prev) => ({ ...prev, [key]: value }));
  }

  function toggleExpertise(key) {
    setProfile((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function saveProfile() {
    if (!user) return;

    setSaving(true);
    setError("");

    try {
      const payload = {
        full_name: profile.full_name,
        phone_number: profile.phone_number || null,
        bio: profile.bio,
        availability: profile.availability,
        avatar_url: profile.avatar_url || null,
        expertise_contraceptives: profile.expertise_contraceptives,
        expertise_hiv_stis: profile.expertise_hiv_stis,
        expertise_gbv: profile.expertise_gbv,
        expertise_mental_health: profile.expertise_mental_health,
        expertise_physical_health: profile.expertise_physical_health,
        expertise_nutrition: profile.expertise_nutrition,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("profiles").update(payload).eq("id", user.id);
      if (error) throw error;

      // refresh avatar display (in case storage path changed)
      const resolved = await resolveAvatar(payload.avatar_url);
      setAvatarUrl(resolved);

      setEditing(false);
    } catch (err) {
      setError(err?.message || String(err));
    } finally {
      setSaving(false);
    }
  }

  /** =========================
   * AVATAR ACTIONS
   * - Upload: stores in bucket and saves storage path to profiles.avatar_url
   * - Remove: clears profiles.avatar_url
   * ========================= */
  async function uploadAvatar(file) {
    if (!file || !user) return;

    setAvatarBusy(true);
    setError("");

    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `profiles/${user.id}/${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type });

      if (upErr) throw upErr;

      // Save storage path in DB (not the signed URL)
      const { error: dbErr } = await supabase
        .from("profiles")
        .update({ avatar_url: path, updated_at: new Date().toISOString() })
        .eq("id", user.id);

      if (dbErr) throw dbErr;

      updateField("avatar_url", path);

      const signed = await resolveAvatar(path);
      setAvatarUrl(signed);
    } catch (err) {
      setError(err?.message || "Failed to upload avatar");
    } finally {
      setAvatarBusy(false);
    }
  }

  async function removeAvatar() {
    if (!user) return;

    setAvatarBusy(true);
    setError("");

    try {
      // Optionally delete file from storage if it is a storage path
      const current = String(profile?.avatar_url || "").trim();
      if (current && !/^https?:\/\//i.test(current)) {
        await supabase.storage.from(AVATAR_BUCKET).remove([current]).catch(() => {});
      }

      const { error: dbErr } = await supabase
        .from("profiles")
        .update({ avatar_url: null, updated_at: new Date().toISOString() })
        .eq("id", user.id);

      if (dbErr) throw dbErr;

      updateField("avatar_url", null);
      setAvatarUrl("");
    } catch (err) {
      setError(err?.message || "Failed to remove avatar");
    } finally {
      setAvatarBusy(false);
    }
  }

  const isAvailable = profile?.availability === "available";

  const expertiseList = useMemo(
    () => [
      ["expertise_contraceptives", "Contraceptives"],
      ["expertise_hiv_stis", "HIV & STIs"],
      ["expertise_gbv", "Gender-Based Violence"],
      ["expertise_mental_health", "Mental Health"],
      ["expertise_physical_health", "Physical Health"],
      ["expertise_nutrition", "Nutrition"],
    ],
    []
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-[1100px] px-4">
        <div className="my-16 rounded-3xl border border-slate-200 bg-white p-10 text-sm text-slate-600">
          Loading profile…
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-[1100px] px-4">
        <div className="my-16 rounded-3xl border border-red-200 bg-red-50 p-10 text-sm text-red-700">
          Profile not found
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1100px] px-4">
      {/* ✅ More spacing so it doesn't touch topbar/footer */}
      <div className="my-14 sm:my-16">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          {/* HEADER STRIP */}
          <div className="relative bg-gradient-to-r from-amber-50 via-white to-slate-50 px-6 py-6 sm:px-10">
            {error && (
              <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              {/* Left: Avatar + Name */}
              <div className="flex items-center gap-5">
                <div className="relative">
                  <div className="h-20 w-20 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt="Avatar"
                        className="h-full w-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-slate-900 text-white text-lg font-extrabold">
                        {initials(profile?.full_name || user?.email)}
                      </div>
                    )}
                  </div>

                  {/* tiny status dot */}
                  <div
                    className={`absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-4 border-white ${
                      isAvailable ? "bg-emerald-500" : "bg-slate-300"
                    }`}
                    title={isAvailable ? "Available" : "Offline"}
                  />
                </div>

                <div>
                  {editing ? (
                    <div className="space-y-2">
                      <input
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-lg font-extrabold outline-none focus:border-amber-300"
                        value={profile.full_name || ""}
                        onChange={(e) => updateField("full_name", e.target.value)}
                        placeholder="Full name"
                      />
                      <input
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none focus:border-amber-300"
                        placeholder="Phone number"
                        value={profile.phone_number || ""}
                        onChange={(e) => updateField("phone_number", e.target.value)}
                      />
                    </div>
                  ) : (
                    <>
                      <div className="text-2xl font-extrabold text-slate-900">
                        {profile.full_name || "Account"}
                      </div>
                      <div className="mt-1 text-sm text-slate-600">
                        {profile.phone_number || user?.email || "—"}
                      </div>
                    </>
                  )}

                  <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        isAvailable ? "bg-emerald-500" : "bg-slate-300"
                      }`}
                    />
                    {isAvailable ? "Available" : "Offline"}
                  </div>
                </div>
              </div>

              {/* Right: Actions */}
              <div className="flex flex-col gap-3 sm:items-end">
                {/* Avatar controls */}
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadAvatar(f);
                      e.target.value = "";
                    }}
                  />

                  <button
                    type="button"
                    disabled={avatarBusy}
                    onClick={() => fileRef.current?.click()}
                    className={`inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50 ${
                      avatarBusy ? "opacity-60 cursor-not-allowed" : ""
                    }`}
                  >
                    {avatarBusy ? "..." : "Upload avatar"}
                  </button>

                  <button
                    type="button"
                    disabled={avatarBusy || (!profile.avatar_url && !avatarUrl)}
                    onClick={removeAvatar}
                    className={`inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50 ${
                      avatarBusy || (!profile.avatar_url && !avatarUrl)
                        ? "opacity-60 cursor-not-allowed"
                        : ""
                    }`}
                  >
                    Remove
                  </button>
                </div>

                {/* Availability toggle (only while editing) */}
                {editing && (
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-semibold text-slate-700">Availability</div>
                    <button
                      onClick={() =>
                        updateField("availability", isAvailable ? "offline" : "available")
                      }
                      className={`w-12 h-6 rounded-full relative transition ${
                        isAvailable ? "bg-emerald-500" : "bg-slate-300"
                      }`}
                      type="button"
                      aria-label="Toggle availability"
                    >
                      <span
                        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${
                          isAvailable ? "left-6" : "left-1"
                        }`}
                      />
                    </button>
                  </div>
                )}

                {/* Edit / Save */}
                {!editing ? (
                  <button
                    onClick={() => setEditing(true)}
                    className="inline-flex items-center justify-center rounded-2xl bg-amber-500 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-600"
                    type="button"
                  >
                    ✏️ Edit profile
                  </button>
                ) : (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setEditing(false)}
                      className="rounded-2xl border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      type="button"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveProfile}
                      disabled={saving}
                      className={`rounded-2xl bg-slate-900 px-6 py-2 text-sm font-semibold text-white shadow-sm ${
                        saving ? "opacity-60 cursor-not-allowed" : "hover:bg-slate-800"
                      }`}
                      type="button"
                    >
                      {saving ? "Saving…" : "Save changes"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* BODY */}
          <div className="px-6 py-8 sm:px-10">
            <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
              {/* Left column */}
              <div className="space-y-8">
                {/* About */}
                <section className="rounded-3xl border border-slate-200 bg-white p-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-extrabold text-slate-900">About</h3>
                    <span className="text-xs text-slate-400">
                      {editing ? "Editable" : "Public"}
                    </span>
                  </div>

                  {editing ? (
                    <textarea
                      className="mt-4 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-amber-300"
                      rows={4}
                      value={profile.bio || ""}
                      onChange={(e) => updateField("bio", e.target.value)}
                      placeholder="Write a short bio…"
                    />
                  ) : (
                    <p className="mt-3 text-sm leading-6 text-slate-600">
                      {profile.bio || "This advisor hasn’t added a bio yet."}
                    </p>
                  )}
                </section>

                {/* Expertise */}
                <section className="rounded-3xl border border-slate-200 bg-white p-6">
                  <h3 className="text-sm font-extrabold text-slate-900">Areas of expertise</h3>
                  <p className="mt-2 text-sm text-slate-600">
                    Topics this advisor is comfortable supporting you with
                  </p>

                  <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {expertiseList.map(([key, label]) => {
                      const on = !!profile[key];
                      return (
                        <button
                          key={key}
                          type="button"
                          disabled={!editing}
                          onClick={() => toggleExpertise(key)}
                          className={`group flex items-center justify-between rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                            on
                              ? "border-amber-300 bg-amber-50 text-amber-800"
                              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          } ${!editing ? "cursor-default" : ""}`}
                        >
                          <span>{label}</span>
                          <span
                            className={`text-xs rounded-full px-2 py-1 ${
                              on ? "bg-amber-200 text-amber-900" : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {on ? "On" : "Off"}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {!editing && (
                    <div className="mt-4 text-xs text-slate-500">
                      Tip: Click <span className="font-semibold">Edit profile</span> to change your
                      expertise areas.
                    </div>
                  )}
                </section>
              </div>

              {/* Right column */}
              <div className="space-y-8">
                {/* Quick details */}
                <section className="rounded-3xl border border-slate-200 bg-white p-6">
                  <h3 className="text-sm font-extrabold text-slate-900">Quick details</h3>

                  <div className="mt-4 space-y-3 text-sm">
                    <div className="flex items-center justify-between">
                      <div className="text-slate-500">Email</div>
                      <div className="font-semibold text-slate-900">{user?.email || "—"}</div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="text-slate-500">Role</div>
                      <div className="font-semibold text-slate-900">{profile?.role || "user"}</div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="text-slate-500">Status</div>
                      <div className="font-semibold text-slate-900">
                        {isAvailable ? "Available" : "Offline"}
                      </div>
                    </div>
                  </div>

                  {!editing && (
                    <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
                      Keep your bio and expertise updated so clients can trust you faster.
                    </div>
                  )}
                </section>

                {/* Trust placeholder */}
                <section className="rounded-3xl border border-dashed border-slate-300 bg-white p-6 text-center">
                  <div className="text-sm font-extrabold text-slate-900">Trust signals</div>
                  <div className="mt-2 text-sm text-slate-500">
                    Community trust signals will appear here
                  </div>
                </section>
              </div>
            </div>
          </div>

          {/* FOOTER STRIP */}
          <div className="border-t border-slate-100 bg-white px-6 py-5 sm:px-10">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-slate-500">
                Your profile helps users know who they’re chatting with.
              </div>

              {editing ? (
                <div className="text-xs text-slate-500">
                  Remember to <span className="font-semibold">Save changes</span> after editing.
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="text-sm font-semibold text-amber-700 hover:text-amber-800"
                >
                  ✏️ Edit profile
                </button>
              )}
            </div>
          </div>
        </div>

        {/* extra bottom spacing so it never “touches” footer */}
        <div className="h-10" />
      </div>
    </div>
  );
}