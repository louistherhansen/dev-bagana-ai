"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/lib/hooks/useAuth";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading: authLoading, checkAuth } = useAuth();
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, [router]);

  useEffect(() => {
    if (!isMounted) return;
    if (authLoading) return;
    if (user) router.replace("/dashboard");
  }, [authLoading, isMounted, router, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
        }),
      });

      const raw = await res.text();
      let data: { error?: string; token?: string } = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        throw new Error(
          raw?.slice(0, 120) || "Login failed (invalid response from server)"
        );
      }
      if (!res.ok) throw new Error(data.error || "Login failed");

      if (data.token) {
        localStorage.setItem("token", data.token);
      }
      // Refresh auth state so protected routes don't bounce back to /login
      await checkAuth();
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setLoading(false);
    }
  };

  if (!isMounted) return null;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="flex flex-col items-center mb-6">
              <div className="relative w-40 h-40 rounded-xl shadow-lg p-3 bg-white">
                <Image
                  src="/bagana-ai-logo.png"
                  alt="BAGANA AI Logo"
                  width={128}
                  height={128}
                  className="object-contain w-full h-full"
                  priority
                />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-slate-800 mb-2">AI Content Strategy Platform</h1>
            <p className="text-sm text-slate-600 font-medium">
              Agentic AI for KOL &amp; influencer content strategy
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="login-email" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Email or username
                </label>
                <input
                  id="login-email"
                  type="text"
                  autoComplete="username"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-100 text-slate-900"
                  placeholder="Enter your email or username"
                />
              </div>

              <div>
                <label htmlFor="login-password" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Password
                </label>
                <input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-100 text-slate-900"
                  placeholder="Enter your password"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {loading ? (
                  <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
                {loading ? "Signing in…" : "Sign in"}
              </button>
            </form>
          </div>
        </div>
      </div>

      <footer className="py-4 px-4 text-center text-xs text-slate-500 border-t border-slate-200/80 bg-slate-50/50">
        Powered by{" "}
        <a href="https://baganatech.com/" className="underline hover:text-slate-700">
          Bagana AI
        </a>{" "}
        2025
      </footer>
    </div>
  );
}
