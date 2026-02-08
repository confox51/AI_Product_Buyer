import { NextRequest, NextResponse } from "next/server";
import { getCartSummary } from "@/lib/services/cart-service";

export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId is required" },
        { status: 400 }
      );
    }

    const cart = await getCartSummary(sessionId);
    return NextResponse.json({ cart });
  } catch (error) {
    console.error("Cart summary error:", error);
    return NextResponse.json(
      { error: "Failed to get cart summary" },
      { status: 500 }
    );
  }
}
