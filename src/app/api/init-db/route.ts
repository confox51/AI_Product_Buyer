import { NextResponse } from "next/server";
import { initializeSchema } from "@/lib/db";

export async function POST() {
  try {
    await initializeSchema();
    return NextResponse.json({ success: true, message: "Database schema initialized" });
  } catch (error) {
    console.error("DB init error:", error);
    return NextResponse.json(
      { error: "Failed to initialize database", details: String(error) },
      { status: 500 }
    );
  }
}
