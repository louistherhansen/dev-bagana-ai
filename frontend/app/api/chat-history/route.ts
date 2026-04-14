import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

// Use Node.js runtime to support pg module
export const runtime = 'nodejs';

/**
 * Chat History API Endpoints
 * 
 * GET /api/chat-history - Get all conversations
 * GET /api/chat-history?id=<conversation_id> - Get specific conversation
 * POST /api/chat-history - Create new conversation
 * PUT /api/chat-history - Update conversation
 * DELETE /api/chat-history?id=<conversation_id> - Delete conversation
 */

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
 * GET /api/chat-history
 * Get all conversations or a specific conversation by ID
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get("id");

    if (conversationId) {
      // Get specific conversation with messages
      const convResult = await query<{
        id: string;
        title: string;
        created_at: Date;
        updated_at: Date;
      }>(
        "SELECT id, title, created_at, updated_at FROM conversations WHERE id = $1",
        [conversationId]
      );

      if (convResult.rows.length === 0) {
        return NextResponse.json(
          { error: "Conversation not found" },
          { status: 404 }
        );
      }

      const conv = convResult.rows[0];

      // Get messages for this conversation
      const messagesResult = await query<{
        id: string;
        role: string;
        content: any;
        created_at: Date;
      }>(
        "SELECT id, role, content, created_at FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC",
        [conversationId]
      );

      const conversation: Conversation = {
        id: conv.id,
        title: conv.title,
        createdAt: conv.created_at.getTime(),
        updatedAt: conv.updated_at.getTime(),
        messages: messagesResult.rows.map((row) => {
          // Ensure content is in correct format
          let content = row.content;
          
          // Handle null or undefined content
          if (!content) {
            content = [{ type: "text", text: "" }];
          }
          // If content is a string (shouldn't happen but handle it), parse it
          else if (typeof content === 'string') {
            try {
              content = JSON.parse(content);
            } catch (e) {
              // If parsing fails, wrap in text format
              content = [{ type: "text", text: content }];
            }
          }
          // Ensure content is an array
          else if (!Array.isArray(content)) {
            // If it's an object with type and text, wrap it
            if (content && typeof content === 'object' && content.type && content.text) {
              content = [content];
            } else {
              // Otherwise, wrap in text format
              content = [{ type: "text", text: JSON.stringify(content) }];
            }
          }
          
          // Ensure each content item is valid
          if (Array.isArray(content)) {
            content = content.map((item: any) => {
              if (!item) {
                return { type: "text", text: "" };
              }
              if (typeof item === 'string') {
                return { type: "text", text: item };
              }
              if (item && typeof item === 'object' && item.type && item.text) {
                return item;
              }
              return { type: "text", text: JSON.stringify(item) };
            });
          } else {
            content = [{ type: "text", text: "" }];
          }
          
          return {
            id: row.id,
            role: (row.role || "assistant") as "user" | "assistant",
            content: content,
          };
        }),
      };

      return NextResponse.json(conversation);
    } else {
      // Get all conversations (without messages for performance)
      const result = await query<{
        id: string;
        title: string;
        created_at: Date;
        updated_at: Date;
      }>(
        "SELECT id, title, created_at, updated_at FROM conversations ORDER BY updated_at DESC LIMIT 100"
      );

      const conversations: Omit<Conversation, "messages">[] = result.rows.map(
        (row) => ({
          id: row.id,
          title: row.title,
          createdAt: row.created_at.getTime(),
          updatedAt: row.updated_at.getTime(),
          messages: [], // Not loaded for list view
        })
      );

      return NextResponse.json(conversations);
    }
  } catch (error) {
    console.error("Error fetching chat history:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch chat history",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/chat-history
 * Create a new conversation
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, title, messages = [] } = body as {
      id?: string;
      title?: string;
      messages?: ChatMessage[];
    };

    if (!id) {
      return NextResponse.json(
        { error: "Conversation ID is required" },
        { status: 400 }
      );
    }

    const conversationTitle = title || "New Chat";

    // Insert conversation
    await query(
      "INSERT INTO conversations (id, title) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET title = $2, updated_at = CURRENT_TIMESTAMP",
      [id, conversationTitle]
    );

    // Insert messages if provided
    if (messages.length > 0) {
      for (const message of messages) {
        await query(
          "INSERT INTO messages (id, conversation_id, role, content) VALUES ($1, $2, $3, $4::jsonb) ON CONFLICT (id) DO UPDATE SET role = $3, content = $4::jsonb",
          [message.id, id, message.role, JSON.stringify(message.content)]
        );
      }
    }

    // Fetch created conversation
    const convResult = await query<{
      id: string;
      title: string;
      created_at: Date;
      updated_at: Date;
    }>(
      "SELECT id, title, created_at, updated_at FROM conversations WHERE id = $1",
      [id]
    );

    const conv = convResult.rows[0];
    const conversation: Conversation = {
      id: conv.id,
      title: conv.title,
      createdAt: conv.created_at.getTime(),
      updatedAt: conv.updated_at.getTime(),
      messages,
    };

    return NextResponse.json(conversation, { status: 201 });
  } catch (error) {
    console.error("Error creating conversation:", error);
    return NextResponse.json(
      {
        error: "Failed to create conversation",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/chat-history
 * Update conversation (title and/or messages)
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, title, messages } = body as {
      id: string;
      title?: string;
      messages?: ChatMessage[];
    };

    if (!id) {
      return NextResponse.json(
        { error: "Conversation ID is required" },
        { status: 400 }
      );
    }

    // Update conversation title if provided
    if (title !== undefined) {
      await query(
        "UPDATE conversations SET title = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
        [title, id]
      );
    }

    // Update messages if provided
    if (messages !== undefined) {
      // Delete existing messages
      await query("DELETE FROM messages WHERE conversation_id = $1", [id]);

      // Insert new messages
      for (const message of messages) {
        await query(
          "INSERT INTO messages (id, conversation_id, role, content) VALUES ($1, $2, $3, $4::jsonb)",
          [message.id, id, message.role, JSON.stringify(message.content)]
        );
      }

      // Update conversation updated_at
      await query(
        "UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1",
        [id]
      );
    }

    // Fetch updated conversation
    const convResult = await query<{
      id: string;
      title: string;
      created_at: Date;
      updated_at: Date;
    }>(
      "SELECT id, title, created_at, updated_at FROM conversations WHERE id = $1",
      [id]
    );

    if (convResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    const conv = convResult.rows[0];

    // Get messages
    const messagesResult = await query<{
      id: string;
      role: string;
      content: any;
    }>(
      "SELECT id, role, content FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC",
      [id]
    );

    const conversation: Conversation = {
      id: conv.id,
      title: conv.title,
      createdAt: conv.created_at.getTime(),
      updatedAt: conv.updated_at.getTime(),
      messages: messagesResult.rows.map((row) => {
        // Ensure content is in correct format
        let content = row.content;
        
        // Handle null or undefined content
        if (!content) {
          content = [{ type: "text", text: "" }];
        }
        // If content is a string (shouldn't happen but handle it), parse it
        else if (typeof content === 'string') {
          try {
            content = JSON.parse(content);
          } catch (e) {
            // If parsing fails, wrap in text format
            content = [{ type: "text", text: content }];
          }
        }
        // Ensure content is an array
        else if (!Array.isArray(content)) {
          // If it's an object with type and text, wrap it
          if (content && typeof content === 'object' && content.type && content.text) {
            content = [content];
          } else {
            // Otherwise, wrap in text format
            content = [{ type: "text", text: JSON.stringify(content) }];
          }
        }
        
        // Ensure each content item is valid
        if (Array.isArray(content)) {
          content = content.map((item: any) => {
            if (!item) {
              return { type: "text", text: "" };
            }
            if (typeof item === 'string') {
              return { type: "text", text: item };
            }
            if (item && typeof item === 'object' && item.type && item.text) {
              return item;
            }
            return { type: "text", text: JSON.stringify(item) };
          });
        } else {
          content = [{ type: "text", text: "" }];
        }
        
        return {
          id: row.id,
          role: (row.role || "assistant") as "user" | "assistant",
          content: content,
        };
      }),
    };

    return NextResponse.json(conversation);
  } catch (error) {
    console.error("Error updating conversation:", error);
    return NextResponse.json(
      {
        error: "Failed to update conversation",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/chat-history?id=<conversation_id> - Delete a specific conversation
 * DELETE /api/chat-history?all=true - Delete all conversations
 * DELETE /api/chat-history?drop_tables=true - Drop tables (DANGEROUS: deletes all data and tables)
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get("id");
    const deleteAll = searchParams.get("all") === "true";
    const dropTables = searchParams.get("drop_tables") === "true";

    if (dropTables) {
      // DANGEROUS: Drop tables (this will delete all data and table structure)
      // Drop messages table first (due to foreign key constraint)
      await query("DROP TABLE IF EXISTS messages CASCADE");
      // Drop conversations table
      await query("DROP TABLE IF EXISTS conversations CASCADE");
      // Drop trigger function if exists
      await query("DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE");
      
      return NextResponse.json({ 
        success: true, 
        message: "Tables dropped successfully. Run init-chat-history-db.py to recreate them." 
      });
    }

    if (deleteAll) {
      // Delete all conversations (messages will be deleted automatically due to CASCADE)
      const result = await query("DELETE FROM conversations RETURNING id");
      const deletedCount = result.rows.length;
      
      return NextResponse.json({ 
        success: true, 
        deletedCount,
        message: `Deleted ${deletedCount} conversation(s)` 
      });
    }

    if (!conversationId) {
      return NextResponse.json(
        { error: "Conversation ID is required, or use ?all=true to delete all, or ?drop_tables=true to drop tables" },
        { status: 400 }
      );
    }

    // Delete specific conversation (messages will be deleted automatically due to CASCADE)
    const result = await query(
      "DELETE FROM conversations WHERE id = $1 RETURNING id",
      [conversationId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, id: conversationId });
  } catch (error) {
    console.error("Error deleting conversation:", error);
    return NextResponse.json(
      {
        error: "Failed to delete conversation",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
