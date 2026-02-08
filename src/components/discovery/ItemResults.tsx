"use client";

import type { ItemRunResult } from "@/lib/types";
import { CandidateCard } from "./CandidateCard";
import { useApp } from "@/components/AppProvider";

export function ItemResults({ result }: { result: ItemRunResult }) {
  const { addToCart, cart } = useApp();

  const cartItemIds = new Set(
    cart?.items.map((item) => item.candidateId) ?? []
  );

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">
          {result.itemName}
        </h3>
        <span className="text-xs text-gray-400">
          {result.candidates.length} candidates
        </span>
      </div>

      {result.candidates.length === 0 ? (
        <p className="text-sm text-gray-500 italic">
          No products found for this item.
        </p>
      ) : (
        <div className="space-y-3">
          {result.candidates.map((candidate, idx) => (
            <CandidateCard
              key={candidate.id}
              candidate={candidate}
              rank={idx + 1}
              onAddToCart={() => addToCart(result.itemId, candidate)}
              isInCart={cartItemIds.has(candidate.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
