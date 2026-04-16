"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";

export function RoleGuard({
  allowRoles,
  redirectTo = "/dashboard",
  children,
}: {
  allowRoles: string[];
  redirectTo?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!allowRoles.includes(user.role)) {
      router.replace(redirectTo);
    }
  }, [allowRoles, loading, redirectTo, router, user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 border-2 border-bagana-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;
  if (!allowRoles.includes(user.role)) return null;

  return <>{children}</>;
}

