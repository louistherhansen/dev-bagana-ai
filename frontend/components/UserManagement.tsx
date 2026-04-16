"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import { IconCheck } from "./icons";

interface User {
  id: string;
  email: string;
  username: string;
  fullName?: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  lastLogin?: string;
}

const ROLE_OPTIONS = [
  { value: "user", label: "User" },
  { value: "admin", label: "Admin" },
  { value: "moderator", label: "Moderator" },
];

export function UserManagement({ showCreateByDefault = false }: { showCreateByDefault?: boolean }) {
  const { user: currentUser, loading: authLoading, checkAuth } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(showCreateByDefault);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [bootstrapping, setBootstrapping] = useState(false);

  const [formData, setFormData] = useState({
    email: "",
    username: "",
    password: "",
    fullName: "",
    role: "user",
  });

  useEffect(() => {
    if (authLoading) return;
    if (!currentUser) return;
    if (currentUser.role !== "admin") return;
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, currentUser?.id, currentUser?.role]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const headers: HeadersInit = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch("/api/users", { headers, credentials: "include" });
      const raw = await res.text();
      const data = raw ? JSON.parse(raw) : {};
      if (!res.ok) throw new Error(data.error || "Failed to fetch users");
      setUsers(data.users || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!formData.email || !formData.username || !formData.password) {
      setError("Email, username, and password are required");
      return;
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch("/api/users", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify(formData),
      });
      const raw = await res.text();
      const data = raw ? JSON.parse(raw) : {};

      if (!res.ok) {
        throw new Error(data.error || "Failed to create user");
      }

      setSuccess("User created successfully");
      setFormData({
        email: "",
        username: "",
        password: "",
        fullName: "",
        role: "user",
      });
      setShowCreateForm(false);
      fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user");
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    setError(null);
    setSuccess(null);

    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const updatePayload: any = {
        email: formData.email,
        username: formData.username,
        fullName: formData.fullName,
        role: formData.role,
      };
      
      // Only include password if provided
      if (formData.password && formData.password.trim()) {
        updatePayload.password = formData.password;
      }

      const res = await fetch(`/api/users/${editingUser.id}`, {
        method: "PUT",
        headers,
        credentials: "include",
        body: JSON.stringify(updatePayload),
      });
      const raw = await res.text();
      const data = raw ? JSON.parse(raw) : {};

      if (!res.ok) {
        throw new Error(data.error || "Failed to update user");
      }

      setSuccess("User updated successfully");
      setEditingUser(null);
      setFormData({
        email: "",
        username: "",
        password: "",
        fullName: "",
        role: "user",
      });
      fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update user");
    }
  };

  const handleToggleActive = async (userId: string, currentStatus: boolean) => {
    if (!confirm(`Are you sure you want to ${currentStatus ? "deactivate" : "activate"} this user?`)) {
      return;
    }

    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch(`/api/users/${userId}/toggle-active`, {
        method: "PATCH",
        headers,
        credentials: "include",
        body: JSON.stringify({ isActive: !currentStatus }),
      });

      if (!res.ok) {
        const raw = await res.text().catch(() => "");
        let msg = "Failed to update user status";
        try {
          const parsed = raw ? JSON.parse(raw) : {};
          if (parsed?.error) msg = String(parsed.error);
        } catch {
          if (raw) msg = raw;
        }
        throw new Error(msg);
      }

      fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update user status");
    }
  };

  const startEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      username: user.username,
      password: "",
      fullName: user.fullName || "",
      role: user.role,
    });
    setShowCreateForm(false);
    setError(null);
    setSuccess(null);
  };

  const cancelEdit = () => {
    setEditingUser(null);
    setShowCreateForm(false);
    setFormData({
      email: "",
      username: "",
      password: "",
      fullName: "",
      role: "user",
    });
    setError(null);
    setSuccess(null);
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 border-2 border-bagana-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Only show to admin users
  if (!currentUser) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
        <h3 className="font-semibold text-slate-800 mb-1">Please login</h3>
        <p className="text-sm text-slate-600">
          You need to be signed in to access User Management.
        </p>
      </div>
    );
  }

  if (currentUser.role !== "admin") {
    const bootstrapAdmin = async () => {
      try {
        setError(null);
        setSuccess(null);
        setBootstrapping(true);
        const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
        const res = await fetch("/api/admin/bootstrap", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || "Failed to enable admin access");
        }
        await checkAuth();
        setSuccess("Admin access enabled. User Management is now available.");
        await fetchUsers();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to enable admin access");
      } finally {
        setBootstrapping(false);
      }
    };

    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
        {error && (
          <div className="mb-4 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm text-left">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-4 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm text-left">
            {success}
          </div>
        )}
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-slate-100 text-slate-700 mb-4">
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0-8v2m-7.5 8h15a2 2 0 002-2V7a2 2 0 00-2-2h-15a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h3 className="font-semibold text-slate-800 mb-1">Admin access required</h3>
        <p className="text-sm text-slate-600 mb-4">
          User Management is available for admin users only.
        </p>
        <button
          type="button"
          onClick={bootstrapAdmin}
          disabled={bootstrapping}
          className="inline-flex items-center justify-center rounded-xl bg-bagana-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-bagana-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {bootstrapping ? "Enabling..." : "Enable Admin Access"}
        </button>
        <p className="text-xs text-slate-500 mt-3">
          This works only if no admin exists yet (bootstrap mode).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">User Management</h2>
          <p className="text-sm text-slate-600 mt-1">
            Create and manage users, assign roles and permissions
          </p>
        </div>
        {!showCreateForm && !editingUser && (
          <button
            onClick={() => {
              setShowCreateForm(true);
              setEditingUser(null);
              setFormData({
                email: "",
                username: "",
                password: "",
                fullName: "",
                role: "user",
              });
              setError(null);
              setSuccess(null);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-bagana-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-bagana-secondary transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add User
          </button>
        )}
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

      {/* Create/Edit Form */}
      {(showCreateForm || editingUser) && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h3 className="text-base font-semibold text-slate-800 mb-4">
            {editingUser ? "Edit User" : "Create New User"}
          </h3>
          <form onSubmit={editingUser ? handleUpdateUser : handleCreateUser} className="space-y-4">
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
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  {editingUser ? "New Password (leave blank to keep current)" : "Password *"}
                </label>
                <input
                  type="password"
                  required={!editingUser}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-bagana-primary focus:outline-none focus:ring-2 focus:ring-bagana-primary/20"
                  placeholder={editingUser ? "Enter new password" : "Min. 6 characters"}
                  minLength={editingUser ? 0 : 6}
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
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Role *
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-bagana-primary focus:outline-none focus:ring-2 focus:ring-bagana-primary/20"
                >
                  {ROLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-xl bg-bagana-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-bagana-secondary transition-colors"
              >
                {IconCheck}
                {editingUser ? "Update User" : "Create User"}
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors rounded-xl border border-slate-300 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Users Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                  Last Login
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-700 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-slate-500">
                    No users found
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <div className="text-sm font-medium text-slate-900">
                          {user.fullName || user.username}
                        </div>
                        <div className="text-sm text-slate-500">{user.email}</div>
                        <div className="text-xs text-slate-400">@{user.username}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize bg-bagana-primary/10 text-bagana-primary">
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => handleToggleActive(user.id, user.isActive)}
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          user.isActive
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {user.isActive ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {user.lastLogin
                        ? new Date(user.lastLogin).toLocaleDateString("id-ID", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })
                        : "Never"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => startEdit(user)}
                        className="text-bagana-primary hover:text-bagana-secondary mr-4"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
