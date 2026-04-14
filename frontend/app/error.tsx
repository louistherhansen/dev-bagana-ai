"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const message = error && typeof error.message === "string" ? error.message : "Please reload the page.";

  useEffect(() => {
    if (error) console.error("[app]", error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
        fontFamily: "system-ui, sans-serif",
        backgroundColor: "#f8fafc",
        color: "#0f172a",
      }}
    >
      <p style={{ fontWeight: 600, marginBottom: "0.25rem" }}>Something went wrong</p>
      <p style={{ color: "#64748b", fontSize: "0.875rem", marginBottom: "1rem", maxWidth: "28rem", textAlign: "center" }}>
        {message}
      </p>
      <button
        type="button"
        onClick={() => reset?.()}
        style={{
          padding: "0.5rem 1.25rem",
          fontSize: "0.875rem",
          fontWeight: 500,
          color: "#fff",
          backgroundColor: "#0f766e",
          border: "none",
          borderRadius: "0.75rem",
          cursor: "pointer",
        }}
      >
        Try again
      </button>
    </div>
  );
}
