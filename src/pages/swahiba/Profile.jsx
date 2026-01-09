import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function Profile() {
  const fileInputRef = useRef(null);

  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
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
      const filePath = `${user.id}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Save ONLY the path in DB
      updateField("avatar_path", filePath);
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
          avatar_path: profile.avatar_path,
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
  if (!profile) return <div className="p-10 text-red-600">Profile not found</div>;

  const avatarUrl =
    profile.avatar_path
      ? supabase.storage.from("avatars").getPublicUrl(profile.avatar_path).data
          .publicUrl
      : null;

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
    </div>
  );
}