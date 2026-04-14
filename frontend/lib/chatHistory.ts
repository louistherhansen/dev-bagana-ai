/**
 * Chat History Management
 * 
 * Manages chat conversations using PostgreSQL database via API.
 * Each conversation has:
 * - id: unique identifier
 * - title: auto-generated from first user message or "New Chat"
 * - createdAt: timestamp
 * - updatedAt: timestamp
 * - messages: array of message objects compatible with assistant-ui
 * 
 * Falls back to localStorage if API is unavailable (for offline/development).
 */

const STORAGE_KEY = "bagana_chat_history";
const CURRENT_CONVERSATION_KEY = "bagana_current_conversation_id";
const MAX_CONVERSATIONS = 50; // Limit to prevent localStorage bloat
const API_BASE = "/api/chat-history";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: Array<{ type: "text"; text: string }>;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
}

/**
 * Generate a unique conversation ID
 */
function generateConversationId(): string {
  return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate a title from the first user message
 * Extracts Brand Name if available, otherwise uses first 50 characters
 */
function generateTitle(messages: ChatMessage[]): string {
  const firstUserMessage = messages.find((m) => m.role === "user");
  if (firstUserMessage) {
    const text = firstUserMessage.content.find((c) => c.type === "text")?.text || "";
    
    // Try to extract Brand Name from the message
    // Handle various patterns including "Brand Information: - Brand Name: [name]"
    const brandNamePatterns = [
      /Brand\s+Information:.*?-?\s*Brand\s+Name:\s*([^\n\r]+)/i,  // "Brand Information: - Brand Name: Nike"
      /-?\s*Brand\s+Name:\s*([^\n\r]+)/i,                        // "- Brand Name: Nike" or "Brand Name: Nike"
      /Brand\s+Name:\s*([^\n\r]+)/i,                            // "Brand Name: Nike"
      /Brand:\s*([^\n\r]+)/i,                                    // "Brand: Nike"
      /create.*(?:for|campaign|content).*?([A-Z][a-zA-Z0-9\s&]+?)(?:\s+campaign|\s+content|$)/i, // "Create content for Nike campaign"
    ];
    
    for (const pattern of brandNamePatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        let brandName = match[1].trim();
        // Remove any trailing punctuation, extra info, or common words
        brandName = brandName
          .split(/[,\-–—]/)[0]  // Take only before comma or dash
          .replace(/\s+(campaign|content|plan|strategy|company|type|product).*$/i, '')  // Remove trailing words
          .replace(/^\s*-\s*/, '')  // Remove leading dash if any
          .trim();
        
        // Only use if it's a reasonable length and not too generic
        if (brandName.length > 0 && brandName.length <= 50 && !/^(the|a|an|for|with|information)$/i.test(brandName)) {
          return brandName;
        }
      }
    }
    
    // Fallback: Take first 50 characters, remove newlines, trim
    const title = text.replace(/\n/g, " ").trim().substring(0, 50);
    return title || "New Chat";
  }
  return "New Chat";
}

/**
 * Get all conversations from localStorage (synchronous fallback)
 */
function getAllConversationsFromStorage(): Conversation[] {
  if (typeof window === "undefined") return [];
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const conversations: Conversation[] = JSON.parse(stored);
    // Sort by updatedAt descending (most recent first)
    return conversations.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch (error) {
    console.error("Error loading conversations:", error);
    return [];
  }
}

/**
 * Get all conversations from PostgreSQL via API
 * Falls back to localStorage if API fails
 */
export async function getAllConversations(): Promise<Conversation[]> {
  if (typeof window === "undefined") return [];
  
  try {
    const response = await fetch(API_BASE);
    if (!response.ok) throw new Error(`API returned ${response.status}`);
    
    const conversations = await response.json() as Conversation[];
    return conversations;
  } catch (error) {
    console.warn("Failed to fetch conversations from API, falling back to localStorage:", error);
    // Fallback to localStorage
    return getAllConversationsFromStorage();
  }
}

/**
 * Get a specific conversation by ID from PostgreSQL via API
 * Falls back to localStorage if API fails
 */
export async function getConversation(id: string): Promise<Conversation | null> {
  if (typeof window === "undefined") return null;
  
  try {
    const response = await fetch(`${API_BASE}?id=${encodeURIComponent(id)}`);
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`API returned ${response.status}`);
    }
    
    const conversation = await response.json() as Conversation;
    return conversation;
  } catch (error) {
    console.warn("Failed to fetch conversation from API, falling back to localStorage:", error);
    // Fallback to localStorage
    try {
      const conversations = getAllConversationsFromStorage();
      return conversations.find((c) => c.id === id) || null;
    } catch (localError) {
      console.error("Error loading conversation from localStorage:", localError);
      return null;
    }
  }
}

/**
 * Save a conversation to PostgreSQL via API
 * Falls back to localStorage if API fails
 */
export async function saveConversation(conversation: Conversation): Promise<void> {
  if (typeof window === "undefined") return;
  
  try {
    // Try to get existing conversation to determine if it's new or update
    const existing = await getConversation(conversation.id);
    
    let response: Response;
    if (existing) {
      // Update existing conversation
      response = await fetch(API_BASE, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(conversation),
      });
    } else {
      // Create new conversation
      response = await fetch(API_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(conversation),
      });
    }
    
    if (!response.ok) throw new Error(`API returned ${response.status}`);
    return;
  } catch (error) {
    console.warn("Failed to save conversation to API, falling back to localStorage:", error);
    // Fallback to localStorage
    try {
      const conversations = getAllConversationsFromStorage();
      const existingIndex = conversations.findIndex((c) => c.id === conversation.id);
      
      if (existingIndex >= 0) {
        conversations[existingIndex] = conversation;
      } else {
        conversations.unshift(conversation);
        if (conversations.length > MAX_CONVERSATIONS) {
          conversations.splice(MAX_CONVERSATIONS);
        }
      }
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
    } catch (localError) {
      console.error("Error saving conversation to localStorage:", localError);
      if (localError instanceof DOMException && localError.name === "QuotaExceededError") {
        const conversations = getAllConversationsFromStorage();
        const trimmed = conversations.slice(0, 25);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
        try {
          await saveConversation(conversation);
        } catch (retryError) {
          console.error("Error saving conversation after cleanup:", retryError);
        }
      }
    }
  }
}

/**
 * Create a new conversation
 */
export async function createConversation(messages: ChatMessage[] = []): Promise<Conversation> {
  const id = generateConversationId();
  const now = Date.now();
  const title = generateTitle(messages);
  
  const conversation: Conversation = {
    id,
    title,
    createdAt: now,
    updatedAt: now,
    messages,
  };
  
  await saveConversation(conversation);
  return conversation;
}

/**
 * Update conversation messages
 */
export async function updateConversationMessages(
  id: string,
  messages: ChatMessage[]
): Promise<Conversation | null> {
  const conversation = await getConversation(id);
  if (!conversation) return null;
  
  const updated: Conversation = {
    ...conversation,
    messages,
    updatedAt: Date.now(),
    title: generateTitle(messages) || conversation.title, // Update title if first message changed
  };
  
  await saveConversation(updated);
  return updated;
}

/**
 * Delete a conversation from PostgreSQL via API
 * Falls back to localStorage if API fails
 */
export async function deleteConversation(id: string): Promise<void> {
  if (typeof window === "undefined") return;
  
  try {
    const response = await fetch(`${API_BASE}?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    
    if (!response.ok && response.status !== 404) {
      throw new Error(`API returned ${response.status}`);
    }
    
    // If deleted conversation was current, clear current
    const currentId = getCurrentConversationId();
    if (currentId === id) {
      clearCurrentConversationId();
    }
    return;
  } catch (error) {
    console.warn("Failed to delete conversation from API, falling back to localStorage:", error);
    // Fallback to localStorage
    try {
      const conversations = getAllConversationsFromStorage();
      const filtered = conversations.filter((c) => c.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
      
      const currentId = getCurrentConversationId();
      if (currentId === id) {
        clearCurrentConversationId();
      }
    } catch (localError) {
      console.error("Error deleting conversation from localStorage:", localError);
    }
  }
}

/**
 * Get current conversation ID
 */
export function getCurrentConversationId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(CURRENT_CONVERSATION_KEY);
}

/**
 * Set current conversation ID
 */
export function setCurrentConversationId(id: string | null): void {
  if (typeof window === "undefined") return;
  if (id) {
    localStorage.setItem(CURRENT_CONVERSATION_KEY, id);
  } else {
    localStorage.removeItem(CURRENT_CONVERSATION_KEY);
  }
}

/**
 * Clear current conversation ID
 */
export function clearCurrentConversationId(): void {
  setCurrentConversationId(null);
}

/**
 * Delete all conversations from PostgreSQL via API
 * Falls back to localStorage if API fails
 */
export async function deleteAllConversations(): Promise<void> {
  if (typeof window === "undefined") return;
  
  try {
    const response = await fetch(`${API_BASE}?all=true`, {
      method: "DELETE",
    });
    
    if (!response.ok && response.status !== 404) {
      throw new Error(`API returned ${response.status}`);
    }
    
    // Clear current conversation ID
    clearCurrentConversationId();
    return;
  } catch (error) {
    console.warn("Failed to delete all conversations from API, falling back to localStorage:", error);
    // Fallback to localStorage
    try {
      localStorage.removeItem(STORAGE_KEY);
      clearCurrentConversationId();
    } catch (localError) {
      console.error("Error deleting conversations from localStorage:", localError);
    }
  }
}

/**
 * Drop chat history tables from database (DANGEROUS: deletes all data and table structure)
 * This will permanently delete the conversations and messages tables
 */
export async function dropChatHistoryTables(): Promise<void> {
  if (typeof window === "undefined") return;
  
  try {
    const response = await fetch(`${API_BASE}?drop_tables=true`, {
      method: "DELETE",
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `API returned ${response.status}`);
    }
    
    // Clear current conversation ID and localStorage
    clearCurrentConversationId();
    localStorage.removeItem(STORAGE_KEY);
    
    return;
  } catch (error) {
    console.error("Failed to drop chat history tables:", error);
    throw error;
  }
}

/**
 * Clear all conversations (for testing/cleanup) - localStorage only
 */
export function clearAllConversations(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(CURRENT_CONVERSATION_KEY);
}
