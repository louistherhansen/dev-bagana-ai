"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  getAllConversations,
  deleteConversation,
  deleteAllConversations,
  dropChatHistoryTables,
  createConversation,
  type Conversation,
} from "@/lib/chatHistory";

interface ChatHistorySidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectConversation: (conversationId: string | null) => void;
  currentConversationId: string | null;
}

export function ChatHistorySidebar({
  isOpen,
  onClose,
  onSelectConversation,
  currentConversationId,
}: ChatHistorySidebarProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingAll, setDeletingAll] = useState(false);
  const [droppingTables, setDroppingTables] = useState(false);

  const loadConversations = useCallback(async () => {
    try {
      setLoading(true);
      const convs = await getAllConversations();
      setConversations(convs);
    } catch (error) {
      console.error("Error loading conversations:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadConversations();
    }
  }, [isOpen, loadConversations]);

  const handleNewChat = useCallback(async () => {
    try {
      const newConv = await createConversation([]);
      onSelectConversation(newConv.id);
      onClose();
      // Reload conversations to show new one
      await loadConversations();
    } catch (error) {
      console.error("Error creating new conversation:", error);
    }
  }, [onSelectConversation, onClose, loadConversations]);

  const handleDelete = useCallback(
    async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!confirm("Are you sure you want to delete this conversation?")) {
        return;
      }

      try {
        setDeletingId(id);
        await deleteConversation(id);
        if (currentConversationId === id) {
          onSelectConversation(null);
        }
        await loadConversations();
      } catch (error) {
        console.error("Error deleting conversation:", error);
        alert("Failed to delete conversation");
      } finally {
        setDeletingId(null);
      }
    },
    [currentConversationId, onSelectConversation, loadConversations]
  );

  const handleDeleteAll = useCallback(async () => {
    if (conversations.length === 0) return;
    
    const confirmMessage = `Are you sure you want to delete all ${conversations.length} conversation(s)? This action cannot be undone.`;
    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      setDeletingAll(true);
      await deleteAllConversations();
      onSelectConversation(null);
      await loadConversations();
    } catch (error) {
      console.error("Error deleting all conversations:", error);
      alert("Failed to delete all conversations");
    } finally {
      setDeletingAll(false);
    }
  }, [conversations.length, onSelectConversation, loadConversations]);

  const handleDropTables = useCallback(async () => {
    const confirmMessage1 = `⚠️ WARNING: This will PERMANENTLY DELETE all chat history tables from the database!\n\nThis includes:\n- All conversations\n- All messages\n- The table structure itself\n\nThis action CANNOT be undone.`;
    if (!confirm(confirmMessage1)) {
      return;
    }

    const confirmMessage2 = `Are you ABSOLUTELY SURE?\n\nType "DELETE TABLES" to confirm:`;
    const userInput = prompt(confirmMessage2);
    if (userInput !== "DELETE TABLES") {
      alert("Operation cancelled. Tables were not dropped.");
      return;
    }

    try {
      setDroppingTables(true);
      await dropChatHistoryTables();
      onSelectConversation(null);
      await loadConversations();
      alert("Tables dropped successfully. Run 'python scripts/init-chat-history-db.py' to recreate them.");
    } catch (error) {
      console.error("Error dropping tables:", error);
      alert(`Failed to drop tables: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setDroppingTables(false);
    }
  }, [onSelectConversation, loadConversations]);

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  /**
   * Extract Brand Name from title
   * Handles formats like "Brand Information: - Brand Name: KO..." or just "KO..."
   */
  const extractBrandName = useCallback((title: string | null | undefined): string => {
    if (!title || typeof title !== 'string') return "New Chat";
    
    try {
      // Try to extract Brand Name from title
      const brandNamePatterns = [
        /Brand\s+Information:.*?-?\s*Brand\s+Name:\s*([^\n\r]+)/i,  // "Brand Information: - Brand Name: KO..."
        /-?\s*Brand\s+Name:\s*([^\n\r]+)/i,                        // "- Brand Name: KO..." or "Brand Name: KO..."
        /Brand\s+Name:\s*([^\n\r]+)/i,                            // "Brand Name: KO..."
      ];
      
      for (const pattern of brandNamePatterns) {
        const match = title.match(pattern);
        if (match && match[1]) {
          let brandName = match[1].trim();
          // Clean up: remove trailing info, punctuation
          brandName = brandName
            .split(/[,\-–—]/)[0]  // Take only before comma or dash
            .replace(/\s+(campaign|content|plan|strategy|company|type|product|information).*$/i, '')  // Remove trailing words
            .replace(/^\s*-\s*/, '')  // Remove leading dash if any
            .trim();
          
          if (brandName.length > 0 && brandName.length <= 50) {
            return brandName;
          }
        }
      }
      
      // If no pattern matches, return title as is (might already be just brand name)
      return title;
    } catch (error) {
      console.error("Error extracting brand name:", error);
      return title || "New Chat";
    }
  }, []);

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/20 z-40 sm:hidden"
        onClick={onClose}
      />

      {/* Sidebar */}
      <div className="fixed left-0 top-0 bottom-0 w-80 bg-white border-r border-slate-200 z-50 flex flex-col sm:relative sm:z-auto">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">
            Chat History
          </h2>
          <button
            onClick={onClose}
            className="sm:hidden p-1 rounded hover:bg-slate-100 text-slate-600"
            aria-label="Close sidebar"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* New Chat Button */}
        <div className="p-4 border-b border-slate-200 space-y-2">
          <button
            onClick={handleNewChat}
            className="w-full rounded-lg bg-bagana-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-bagana-secondary transition-colors flex items-center justify-center gap-2"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            New Chat
          </button>
          {conversations.length > 0 && (
            <>
              <button
                onClick={handleDeleteAll}
                disabled={deletingAll || droppingTables}
                className="w-full rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {deletingAll ? (
                  <>
                    <svg
                      className="w-3 h-3 animate-spin"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Deleting...
                  </>
                ) : (
                  <>
                    <svg
                      className="w-3 h-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                    Clear All History
                  </>
                )}
              </button>
              <button
                onClick={handleDropTables}
                disabled={deletingAll || droppingTables}
                className="w-full rounded-lg border-2 border-red-500 bg-red-100 px-4 py-2 text-xs font-bold text-red-900 hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {droppingTables ? (
                  <>
                    <svg
                      className="w-3 h-3 animate-spin"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Dropping Tables...
                  </>
                ) : (
                  <>
                    <svg
                      className="w-3 h-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                    ⚠️ Drop Tables (DANGEROUS)
                  </>
                )}
              </button>
            </>
          )}
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-slate-500 text-sm">
              Loading conversations...
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-4 text-center text-slate-500 text-sm">
              No conversations yet. Start a new chat!
            </div>
          ) : (
            <div className="py-2">
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => {
                    onSelectConversation(conv.id);
                    onClose();
                  }}
                  className={`group px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors border-l-2 ${
                    currentConversationId === conv.id
                      ? "border-bagana-primary bg-bagana-primary/5"
                      : "border-transparent"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-800 truncate">
                        {extractBrandName(conv.title || "New Chat")}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {formatDate(conv.updatedAt)}
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleDelete(conv.id, e)}
                      disabled={deletingId === conv.id}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-slate-200 text-slate-500 hover:text-red-600 transition-all disabled:opacity-50"
                      aria-label="Delete conversation"
                    >
                      {deletingId === conv.id ? (
                        <svg
                          className="w-4 h-4 animate-spin"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                      ) : (
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
