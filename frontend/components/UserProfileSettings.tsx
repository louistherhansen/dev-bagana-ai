"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import { IconCheck } from "./icons";

interface UserProfile {
  id: string;
  email: string;
  username: string;
  fullName?: string;
  role: string;
}

export function UserProfileSettings() {
  const { user: currentUser, loading: authLoading, checkAuth } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    email: "",
    username: "",
    fullName: "",
  });

  useEffect(() => {
    if (currentUser) {
      setProfile({
        id: currentUser.id || "",
        email: currentUser.email || "",
        username: currentUser.username || "",
        fullName: currentUser.fullName || "",
        role: currentUser.role || "user",
      });
      setFormData({
        email: currentUser.email || "",
        username: currentUser.username || "",
        fullName: currentUser.fullName || "",
      });
      setLoading(false);
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [currentUser, authLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);

    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          email: formData.email,
          username: formData.username,
          fullName: formData.fullName || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        // If session is no longer valid, let ProtectedLayout redirect to /login.
        if (res.status === 401) {
          await checkAuth();
          return;
        }
        const msg = (data?.error || data?.detail || "Failed to update profile").toString();
        // Avoid showing raw backend phrasing in UI
        const normalized =
          /session\s+has\s+expired/i.test(msg) ? "Unable to save changes. Please try again." : msg;
        throw new Error(normalized);
      }

      setSuccess("Profile updated successfully");
      setProfile(data);
      // Refresh auth to get updated user data
      if (checkAuth) {
        await checkAuth();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 border-2 border-bagana-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
        <p className="text-sm text-slate-600">Please login to view your profile</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">Profile Settings</h2>
        <p className="text-sm text-slate-600 mt-1">
          Update your account information
        </p>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="p-4 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">
          {success}
        </div>
      )}

      {/* Profile Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Email *
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-bagana-primary focus:outline-none focus:ring-2 focus:ring-bagana-primary/20"
              placeholder="user@example.com"
              disabled={saving}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Username *
            </label>
            <input
              type="text"
              required
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-bagana-primary focus:outline-none focus:ring-2 focus:ring-bagana-primary/20"
              placeholder="username"
              disabled={saving}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Full Name
            </label>
            <input
              type="text"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-bagana-primary focus:outline-none focus:ring-2 focus:ring-bagana-primary/20"
              placeholder="Full Name"
              disabled={saving}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Role
            </label>
            <input
              type="text"
              value={profile.role}
              disabled
              className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm bg-slate-50 text-slate-500 cursor-not-allowed"
            />
            <p className="text-xs text-slate-500 mt-1">Role cannot be changed</p>
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-bagana-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-bagana-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? (
              <>
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                {IconCheck}
                Save Changes
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
