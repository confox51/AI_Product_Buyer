import { NextRequest, NextResponse } from "next/server";
import { swapInCart } from "@/lib/services/cart-service";

export async function POST(request: NextRequest) {
  try {
    const { sessionId, itemId, newCandidateId, newCandidate } =
      await request.json();

    if (!sessionId || !itemId || !newCandidateId || !newCandidate) {
      return NextResponse.json(
        { error: "sessionId, itemId, newCandidateId, and newCandidate are required" },
        { status: 400 }
      );
    }

    const cart = await swapInCart(sessionId, itemId, newCandidateId, newCandidate);
    return NextResponse.json({ cart });
  } catch (error) {
    console.error("Swap in cart error:", error);
    return NextResponse.json(
      { error: "Failed to swap cart item" },
      { status: 500 }
    );
  }
}
