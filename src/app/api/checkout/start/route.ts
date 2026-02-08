import { NextRequest, NextResponse } from "next/server";
import { getCartSummary } from "@/lib/services/cart-service";
import { generateCheckoutPlan } from "@/lib/services/checkout-service";

export async function POST(request: NextRequest) {
  try {
    const { sessionId, paymentInfo, shippingAddress } = await request.json();

    if (!sessionId || !paymentInfo || !shippingAddress) {
      return NextResponse.json(
        { error: "sessionId, paymentInfo, and shippingAddress are required" },
        { status: 400 }
      );
    }

    const cart = await getCartSummary(sessionId);
    if (cart.items.length === 0) {
      return NextResponse.json(
        { error: "Cart is empty" },
        { status: 400 }
      );
    }

    const plan = await generateCheckoutPlan(cart, paymentInfo, shippingAddress);
    return NextResponse.json({ plan });
  } catch (error) {
    console.error("Checkout start error:", error);
    return NextResponse.json(
      { error: "Failed to start checkout" },
      { status: 500 }
    );
  }
}
