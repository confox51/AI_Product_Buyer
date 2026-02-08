import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { createSpecFromChat } from "@/lib/services/spec-service";
import type { Message } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const { sessionId } = await request.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId is required" },
        { status: 400 }
      );
    }

    // Fetch conversation history
    const messageRows = await query(
      "SELECT id, session_id, role, content, created_at FROM messages WHERE session_id = $1 ORDER BY created_at ASC",
      [sessionId]
    );

    const messages: Message[] = messageRows.map((row) => ({
      id: row.id as string,
      sessionId: row.session_id as string,
      role: row.role as "user" | "assistant" | "system",
      content: row.content as string,
      createdAt: (row.created_at as Date).toISOString(),
    }));

    const spec = await createSpecFromChat(sessionId, messages);

    return NextResponse.json({ spec });
  } catch (error) {
    console.error("Finalize spec error:", error);
    return NextResponse.json(
      { error: "Failed to finalize spec" },
      { status: 500 }
    );
  }
}
