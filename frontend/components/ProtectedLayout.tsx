"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // 1. JANGAN lakukan apapun jika useAuth masih dalam proses loading
    if (loading) return;

    // 2. Jika loading sudah selesai dan user tetap NULL, lempar ke login
    if (!user) {
      const loginUrl = `/login?redirect=${encodeURIComponent(pathname || "/")}`;
      router.replace(loginUrl);
    }
  }, [user, loading, router, pathname]);

  // 3) Show full-screen loader during session check
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-2">
          <div className="h-10 w-10 border-4 border-slate-800 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 text-sm font-medium">Verifying session...</p>
        </div>
      </div>
    );
  }

  // 4) While redirecting to login, keep showing loader (avoid white screen)
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-2">
          <div className="h-10 w-10 border-4 border-slate-800 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 text-sm font-medium">Redirecting to sign in...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}