import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function Profile() {
  const fileInputRef = useRef(null);

  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState(null);

  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Not authenticated");
      setUser(user);

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) throw error;

      setProfile(data);

      // ✅ Resolve avatar public URL safely
      if (data.avatar_path) {
        const { data: storageData } = supabase.storage
          .from("avatars")
          .getPublicUrl(data.avatar_path);

        setAvatarUrl(storageData.publicUrl);
      } else {
        setAvatarUrl(null);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function updateField(key, value) {
    setProfile((prev) => ({ ...prev, [key]: value }));
  }

  function toggleExpertise(key) {
    setProfile((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function uploadAvatar(file) {
    if (!file || !user) return;

    setUploading(true);
    setError("");

    try {
      const ext = file.name.split(".").pop();
      const avatarPath = `${user.id}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(avatarPath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // ✅ Generate public URL immediately
      const { data } = supabase.storage
        .from("avatars")
        .getPublicUrl(avatarPath);

      // Update local state
      setAvatarUrl(data.publicUrl);
      updateField("avatar_path", avatarPath);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function saveProfile() {
    setSaving(true);
    setError("");

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: profile.full_name,
          phone_number: profile.phone_number || null,
          bio: profile.bio,
          availability: profile.availability,
          avatar_path: profile.avatar_path || null,
          expertise_contraceptives: profile.expertise_contraceptives,
          expertise_hiv_stis: profile.expertise_hiv_stis,
          expertise_gbv: profile.expertise_gbv,
          expertise_mental_health: profile.expertise_mental_health,
          expertise_physical_health: profile.expertise_physical_health,
          expertise_nutrition: profile.expertise_nutrition,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (error) throw error;

      setEditing(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-10">Loading profile…</div>;
  if (!profile)
    return <div className="p-10 text-red-600">Profile not found</div>;

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-3xl border p-8">
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl">
          {error}
        </div>
      )}

      {/* Avatar */}
      <div className="flex flex-col items-center">
        <div className="w-32 h-32 rounded-full bg-slate-100 overflow-hidden flex items-center justify-center">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="Avatar"
              className="w-full h-full object-cover"
              onError={() => setAvatarUrl(null)}
            />
          ) : (
            <span className="text-slate-400">No photo</span>
          )}
        </div>

        {editing && (
          <>
            <button
              className="mt-2 text-sm text-amber-600 font-semibold"
              onClick={() => fileInputRef.current.click()}
            >
              {uploading ? "Uploading…" : "Change"}
            </button>
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              hidden
              onChange={(e) => uploadAvatar(e.target.files[0])}
            />
          </>
        )}
      </div>

      {/* Name + Phone */}
      <div className="mt-6 text-center space-y-2">
        {editing ? (
          <>
            <input
              className="border rounded-xl px-4 py-2 w-full text-center"
              value={profile.full_name || ""}
              onChange={(e) => updateField("full_name", e.target.value)}
            />
            <input
              className="border rounded-xl px-4 py-2 w-full text-center"
              placeholder="Phone number"
              value={profile.phone_number || ""}
              onChange={(e) => updateField("phone_number", e.target.value)}
            />
          </>
        ) : (
          <>
            <h2 className="text-xl font-semibold">{profile.full_name}</h2>
            <p className="text-sm text-slate-500">
              {profile.phone_number || "No phone number added"}
            </p>
          </>
        )}
      </div>

      {/* Availability */}
      <div className="mt-4 flex justify-center gap-3 items-center">
        <span className="text-sm font-medium">Availability</span>
        <button
          disabled={!editing}
          onClick={() =>
            updateField(
              "availability",
              profile.availability === "available"
                ? "offline"
                : "available"
            )
          }
          className={`w-12 h-6 rounded-full relative ${
            profile.availability === "available"
              ? "bg-green-500"
              : "bg-slate-300"
          }`}
        >
          <span
            className={`absolute top-0.5 w-5 h-5 bg-white rounded-full ${
              profile.availability === "available" ? "left-6" : "left-1"
            }`}
          />
        </button>
        <span className="text-sm">
          {profile.availability === "available" ? "Available" : "Offline"}
        </span>
      </div>

      {/* About */}
      <div className="mt-6">
        <h3 className="font-semibold mb-1">About me</h3>
        {editing ? (
          <textarea
            className="w-full border rounded-xl px-4 py-2"
            rows={3}
            value={profile.bio || ""}
            onChange={(e) => updateField("bio", e.target.value)}
          />
        ) : (
          <p className="text-sm text-slate-600">
            {profile.bio || "No bio added yet."}
          </p>
        )}
      </div>

      {/* Expertise */}
      <div className="mt-6">
        <h3 className="font-semibold mb-3">Areas of expertise</h3>
        <div className="grid grid-cols-2 gap-3">
          {[
            ["expertise_contraceptives", "Contraceptives"],
            ["expertise_hiv_stis", "HIV & STIs"],
            ["expertise_gbv", "Gender-Based Violence"],
            ["expertise_mental_health", "Mental Health"],
            ["expertise_physical_health", "Physical Health"],
            ["expertise_nutrition", "Nutrition"],
          ].map(([key, label]) => (
            <button
              key={key}
              disabled={!editing}
              onClick={() => toggleExpertise(key)}
              className={`border rounded-xl px-3 py-2 text-sm ${
                profile[key]
                  ? "border-amber-400 bg-amber-50 text-amber-700"
                  : "border-slate-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="mt-8 flex justify-between">
        {!editing ? (
          <button
            onClick={() => setEditing(true)}
            className="text-amber-600 font-semibold"
          >
            Edit profile
          </button>
        ) : (
          <>
            <button
              onClick={() => setEditing(false)}
              className="text-slate-500"
            >
              Cancel
            </button>
            <button
              onClick={saveProfile}
              disabled={saving}
              className="bg-amber-500 text-white px-6 py-2 rounded-xl font-semibold"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </>
        )}
      </div>

      <div className="mt-8 border border-dashed rounded-xl p-4 text-center text-sm text-slate-400">
        Endorsements and ratings will appear here
      </div>
    </div>
  );
}