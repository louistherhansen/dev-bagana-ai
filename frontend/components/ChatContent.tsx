"use client";

import { useState, useEffect } from "react";
import { ChatRuntimeProvider } from "@/components/ChatRuntimeProvider";
import { ChatInterface } from "@/components/ChatInterface";

/**
 * Chat UI: runtime + interface. Loaded only on client via dynamic(ssr: false).
 * Renders only after mount so assistant-ui runs purely in the browser.
 */
export default function ChatContent() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex-1 flex flex-col min-h-0 items-center justify-center px-4 py-12 text-slate-500 text-sm">
        Loading chat…
      </div>
    );
  }

  return (
    <ChatRuntimeProvider>
      <div className="flex-1 flex flex-col min-h-0 w-full h-full">
        <ChatInterface />
      </div>
    </ChatRuntimeProvider>
  );
}
