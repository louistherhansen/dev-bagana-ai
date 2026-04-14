import dynamic from "next/dynamic";
import { PageLayout } from "@/components/PageLayout";

const ChatContent = dynamic(() => import("@/components/ChatContent"), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex flex-col min-h-0 items-center justify-center px-4 py-12 text-slate-500 text-sm">
      Loading chat…
    </div>
  ),
});

export default function ChatPage() {
  return (
    <PageLayout currentPath="/chat">
      <div className="flex-1 flex flex-col min-h-0 w-full">
        <ChatContent />
      </div>
    </PageLayout>
  );
}
