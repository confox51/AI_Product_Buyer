import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { query } from "@/lib/db";
import { chatCompletion } from "@/lib/openai";

const SYSTEM_PROMPT = `You are a friendly, expert shopping assistant for an AI-powered agentic commerce platform. Your goal is to capture the user's shopping needs conversationally.

You need to gather:
1. What items they want to buy (be specific - e.g., "winter jacket", "running shoes")
2. Total budget
3. Delivery deadline (if any)
4. Preferences: size, color, brand, style, occasion
5. Must-haves vs nice-to-haves

Ask clarifying questions naturally. Don't ask everything at once — be conversational.

When you have enough information to create a shopping plan (at minimum: items + budget), add the EXACT text "[SPEC_READY]" at the end of your response (after your message to the user). This signals the system that we can proceed to creating a plan.

Keep responses concise and helpful. Use a warm, professional tone.`;

export async function POST(request: NextRequest) {
  try {
    const { sessionId: providedSessionId, message } = await request.json();

    let sessionId = providedSessionId;

    // Create session if needed
    if (!sessionId) {
      sessionId = uuidv4();
      await query("INSERT INTO sessions (id, title) VALUES ($1, $2)", [
        sessionId,
        "Shopping Session",
      ]);
    }

    // Store user message
    const userMsgId = uuidv4();
    await query(
      "INSERT INTO messages (id, session_id, role, content) VALUES ($1, $2, $3, $4)",
      [userMsgId, sessionId, "user", message]
    );

    // Fetch conversation history
    const messageRows = await query(
      "SELECT role, content FROM messages WHERE session_id = $1 ORDER BY created_at ASC",
      [sessionId]
    );

    const messages = [
      { role: "system" as const, content: SYSTEM_PROMPT },
      ...messageRows.map((row) => ({
        role: row.role as "user" | "assistant",
        content: row.content as string,
      })),
    ];

    // Get agent response
    const responseText = await chatCompletion(messages);

    // Check if spec is ready
    const specReady = responseText.includes("[SPEC_READY]");
    const cleanResponse = responseText.replace("[SPEC_READY]", "").trim();

    // Store assistant message
    const assistantMsgId = uuidv4();
    await query(
      "INSERT INTO messages (id, session_id, role, content) VALUES ($1, $2, $3, $4)",
      [assistantMsgId, sessionId, "assistant", cleanResponse]
    );

    return NextResponse.json({
      sessionId,
      response: cleanResponse,
      specReady,
    });
  } catch (error) {
    console.error("Chat error:", error);
    return NextResponse.json(
      { error: "Failed to process chat message" },
      { status: 500 }
    );
  }
}
