"use client";

import { useEffect } from "react";

export default function ChatError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[chat]", error);
  }, [error]);

  return (
    <div className="flex-1 flex flex-col min-h-0 items-center justify-center px-4 py-12 text-center">
      <p className="text-slate-700 font-medium mb-1">Failed to load chat</p>
      <p className="text-slate-500 text-sm mb-4 max-w-md">
        {error.message || "Something went wrong. Please reload the page."}
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-xl bg-bagana-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-bagana-secondary transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
