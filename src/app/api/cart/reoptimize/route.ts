import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { reoptimize } from "@/lib/services/cart-service";
import type { ShoppingSpec } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const { sessionId } = await request.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId is required" },
        { status: 400 }
      );
    }

    // Get the latest spec for this session
    const specRows = await query(
      "SELECT spec_json FROM specs WHERE session_id = $1 ORDER BY created_at DESC LIMIT 1",
      [sessionId]
    );

    if (specRows.length === 0) {
      return NextResponse.json({ error: "No spec found" }, { status: 404 });
    }

    const spec = specRows[0].spec_json as ShoppingSpec;
    const result = await reoptimize(sessionId, spec);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Reoptimize error:", error);
    return NextResponse.json(
      { error: "Failed to reoptimize cart" },
      { status: 500 }
    );
  }
}
