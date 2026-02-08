import { v4 as uuidv4 } from "uuid";
import { query } from "@/lib/db";
import type { CartState, CartItemEntry, ProductCandidate, ShoppingSpec } from "@/lib/types";

async function getOrCreateCart(sessionId: string): Promise<string> {
  const rows = await query(
    "SELECT id FROM carts WHERE session_id = $1 AND status = $2",
    [sessionId, "active"]
  );
  if (rows.length > 0) return rows[0].id as string;

  const cartId = uuidv4();
  await query(
    "INSERT INTO carts (id, session_id, status) VALUES ($1, $2, $3)",
    [cartId, sessionId, "active"]
  );
  return cartId;
}

export async function addToCart(
  sessionId: string,
  itemId: string,
  candidateId: string,
  candidateSnapshot: ProductCandidate
): Promise<CartState> {
  const cartId = await getOrCreateCart(sessionId);

  // Remove existing entry for this item if any
  await query(
    "DELETE FROM cart_items WHERE cart_id = $1 AND item_id = $2",
    [cartId, itemId]
  );

  const entryId = uuidv4();
  await query(
    `INSERT INTO cart_items (id, cart_id, item_id, candidate_id, candidate_snapshot_json, locked)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [entryId, cartId, itemId, candidateId, JSON.stringify(candidateSnapshot), false]
  );

  await query("UPDATE carts SET updated_at = NOW() WHERE id = $1", [cartId]);

  return getCartSummary(sessionId);
}

export async function removeFromCart(
  sessionId: string,
  itemId: string
): Promise<CartState> {
  const rows = await query(
    "SELECT id FROM carts WHERE session_id = $1 AND status = $2",
    [sessionId, "active"]
  );
  if (rows.length > 0) {
    await query(
      "DELETE FROM cart_items WHERE cart_id = $1 AND item_id = $2",
      [rows[0].id, itemId]
    );
    await query("UPDATE carts SET updated_at = NOW() WHERE id = $1", [rows[0].id]);
  }

  return getCartSummary(sessionId);
}

export async function swapInCart(
  sessionId: string,
  itemId: string,
  newCandidateId: string,
  newSnapshot: ProductCandidate
): Promise<CartState> {
  const rows = await query(
    "SELECT id FROM carts WHERE session_id = $1 AND status = $2",
    [sessionId, "active"]
  );
  if (rows.length > 0) {
    await query(
      `UPDATE cart_items SET candidate_id = $1, candidate_snapshot_json = $2
       WHERE cart_id = $3 AND item_id = $4`,
      [newCandidateId, JSON.stringify(newSnapshot), rows[0].id, itemId]
    );
    await query("UPDATE carts SET updated_at = NOW() WHERE id = $1", [rows[0].id]);
  }

  return getCartSummary(sessionId);
}

export async function toggleLock(
  sessionId: string,
  itemId: string
): Promise<CartState> {
  const rows = await query(
    "SELECT id FROM carts WHERE session_id = $1 AND status = $2",
    [sessionId, "active"]
  );
  if (rows.length > 0) {
    await query(
      `UPDATE cart_items SET locked = NOT locked
       WHERE cart_id = $1 AND item_id = $2`,
      [rows[0].id, itemId]
    );
    await query("UPDATE carts SET updated_at = NOW() WHERE id = $1", [rows[0].id]);
  }

  return getCartSummary(sessionId);
}

export async function getCartSummary(sessionId: string): Promise<CartState> {
  const cartRows = await query(
    "SELECT * FROM carts WHERE session_id = $1 AND status = $2",
    [sessionId, "active"]
  );

  if (cartRows.length === 0) {
    return {
      id: "",
      sessionId,
      status: "active",
      items: [],
      totalCost: 0,
      budgetRemaining: 0,
      latestDelivery: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  const cart = cartRows[0];
  const itemRows = await query(
    "SELECT * FROM cart_items WHERE cart_id = $1 ORDER BY added_at",
    [cart.id]
  );

  const items: CartItemEntry[] = itemRows.map((row) => ({
    id: row.id as string,
    cartId: row.cart_id as string,
    itemId: row.item_id as string,
    candidateId: row.candidate_id as string,
    candidate: row.candidate_snapshot_json as ProductCandidate,
    locked: row.locked as boolean,
    addedAt: (row.added_at as Date).toISOString(),
  }));

  const totalCost = items.reduce((sum, item) => sum + item.candidate.price, 0);

  // Find latest delivery
  let latestDelivery: string | null = null;
  for (const item of items) {
    if (item.candidate.deliveryEstimate) {
      latestDelivery = item.candidate.deliveryEstimate; // simplified
    }
  }

  return {
    id: cart.id as string,
    sessionId,
    status: cart.status as "active" | "checked_out",
    items,
    totalCost: Math.round(totalCost * 100) / 100,
    budgetRemaining: 0, // will be set by caller with spec budget
    latestDelivery,
    createdAt: (cart.created_at as Date).toISOString(),
    updatedAt: (cart.updated_at as Date).toISOString(),
  };
}

export async function reoptimize(
  sessionId: string,
  spec: ShoppingSpec
): Promise<{ suggestions: { itemId: string; currentPrice: number; suggestedCandidate: ProductCandidate }[] }> {
  const cart = await getCartSummary(sessionId);
  cart.budgetRemaining = spec.budget - cart.totalCost;

  if (cart.budgetRemaining >= 0) {
    return { suggestions: [] };
  }

  // Find unlocked items sorted by price (most expensive first)
  const unlocked = cart.items
    .filter((item) => !item.locked)
    .sort((a, b) => b.candidate.price - a.candidate.price);

  const suggestions: { itemId: string; currentPrice: number; suggestedCandidate: ProductCandidate }[] = [];

  for (const item of unlocked) {
    // Look for cheaper alternatives in the item_runs table
    const runs = await query(
      "SELECT ranked_candidates_json FROM item_runs WHERE item_id = $1 ORDER BY created_at DESC LIMIT 1",
      [item.itemId]
    );

    if (runs.length > 0) {
      const candidates = runs[0].ranked_candidates_json as ProductCandidate[];
      const cheaper = candidates.find(
        (c) => c.price < item.candidate.price && c.id !== item.candidateId
      );
      if (cheaper) {
        suggestions.push({
          itemId: item.itemId,
          currentPrice: item.candidate.price,
          suggestedCandidate: cheaper,
        });
      }
    }
  }

  return { suggestions };
}
