import { NextRequest, NextResponse } from "next/server";
import { addToCart } from "@/lib/services/cart-service";

export async function POST(request: NextRequest) {
  try {
    const { sessionId, itemId, candidateId, candidate } = await request.json();

    if (!sessionId || !itemId || !candidateId || !candidate) {
      return NextResponse.json(
        { error: "sessionId, itemId, candidateId, and candidate are required" },
        { status: 400 }
      );
    }

    const cart = await addToCart(sessionId, itemId, candidateId, candidate);
    return NextResponse.json({ cart });
  } catch (error) {
    console.error("Add to cart error:", error);
    return NextResponse.json(
      { error: "Failed to add to cart" },
      { status: 500 }
    );
  }
}
