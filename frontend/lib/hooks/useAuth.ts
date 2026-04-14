"use client";

import { createContext, useContext, useEffect, useMemo, useState, useCallback, createElement } from "react";
import type { ReactNode } from "react";

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  fullName?: string;
  role: string;
}

/**
 * Session uses httpOnly cookie `auth_token` from POST /api/auth/login.
 * Some client helpers still send the same token via Authorization: Bearer from localStorage.
 */
type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  checkAuth: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function useProvideAuth(): AuthContextValue {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      if (res.ok) {
        const data = await res.json();
        const u = data.user;
        if (u) {
          setUser({
            id: u.id,
            email: u.email,
            username: u.username,
            fullName: u.fullName,
            role: u.role || "user",
          });
        } else {
          setUser(null);
        }
      } else {
        localStorage.removeItem("token");
        setUser(null);
      }
    } catch (error) {
      console.error("Auth check error:", error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch {
      /* ignore */
    }
    localStorage.removeItem("token");
    setUser(null);
    window.location.href = "/login";
  };

  return useMemo(() => ({ user, loading, checkAuth, logout }), [user, loading, checkAuth]);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const value = useProvideAuth();
  return createElement(AuthContext.Provider, { value }, children);
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within <AuthProvider />");
  }
  return ctx;
}
