import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { runPipeline } from "@/lib/services/run-manager";
import type { ShoppingSpec, SpecItem, DiscoveryEvent } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const { specId, maxItems } = await request.json();

    if (!specId) {
      return NextResponse.json(
        { error: "specId is required" },
        { status: 400 }
      );
    }

    // Fetch spec
    const specRows = await query("SELECT * FROM specs WHERE id = $1", [specId]);
    if (specRows.length === 0) {
      return NextResponse.json({ error: "Spec not found" }, { status: 404 });
    }

    const specData = specRows[0].spec_json as ShoppingSpec;

    // Fetch items
    const itemRows = await query(
      "SELECT * FROM items WHERE spec_id = $1",
      [specId]
    );

    const items: SpecItem[] = itemRows.map((row) => ({
      id: row.id as string,
      specId: row.spec_id as string,
      name: row.name as string,
      constraints: row.constraints_json as SpecItem["constraints"],
      budgetAllocation: Number(row.budget_allocation),
      locked: row.locked as boolean,
    }));

    const spec: ShoppingSpec = {
      ...specData,
      items,
    };

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const write = (event: DiscoveryEvent) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
          );
        };
        try {
          await runPipeline(spec, maxItems, write);
          write({ type: "done" });
        } catch (error) {
          console.error("Run plan error:", error);
          write({
            type: "error",
            message:
              error instanceof Error ? error.message : "Failed to run discovery pipeline",
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Run plan error:", error);
    return NextResponse.json(
      { error: "Failed to run discovery pipeline" },
      { status: 500 }
    );
  }
}

export const maxDuration = 120;
