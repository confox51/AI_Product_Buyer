import { NextRequest, NextResponse } from "next/server";
import { getCheckoutSummary } from "@/lib/services/checkout-service";

export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId is required" },
        { status: 400 }
      );
    }

    const plan = await getCheckoutSummary(sessionId);
    if (!plan) {
      return NextResponse.json(
        { error: "No checkout plan found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ plan });
  } catch (error) {
    console.error("Checkout summary error:", error);
    return NextResponse.json(
      { error: "Failed to get checkout summary" },
      { status: 500 }
    );
  }
}
