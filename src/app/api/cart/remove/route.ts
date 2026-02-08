import { NextRequest, NextResponse } from "next/server";
import { removeFromCart } from "@/lib/services/cart-service";

export async function POST(request: NextRequest) {
  try {
    const { sessionId, itemId } = await request.json();

    if (!sessionId || !itemId) {
      return NextResponse.json(
        { error: "sessionId and itemId are required" },
        { status: 400 }
      );
    }

    const cart = await removeFromCart(sessionId, itemId);
    return NextResponse.json({ cart });
  } catch (error) {
    console.error("Remove from cart error:", error);
    return NextResponse.json(
      { error: "Failed to remove from cart" },
      { status: 500 }
    );
  }
}
