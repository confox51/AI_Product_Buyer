"use client";

import type { ProductCandidate } from "@/lib/types";
import { ScoreBreakdown } from "@/components/ui/ScoreBreakdown";

interface CandidateCardProps {
  candidate: ProductCandidate;
  rank: number;
  onAddToCart: () => void;
  isInCart?: boolean;
}

export function CandidateCard({
  candidate,
  rank,
  onAddToCart,
  isInCart,
}: CandidateCardProps) {
  return (
    <div
      className={`border rounded-lg p-3 ${
        rank === 1
          ? "border-blue-300 bg-blue-50/50"
          : "border-gray-200 bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                rank === 1
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-gray-600"
              }`}
            >
              #{rank}
            </span>
            <span className="text-xs text-gray-500 truncate">
              {candidate.retailerName}
            </span>
          </div>
          <h4 className="text-sm font-medium text-gray-900 line-clamp-2">
            {candidate.title}
          </h4>
        </div>
        {candidate.imageUrl && (
          <img
            src={candidate.imageUrl}
            alt={candidate.title}
            className="w-16 h-16 object-cover rounded"
          />
        )}
      </div>

      <div className="flex items-center gap-3 mb-2 text-sm">
        <span className="font-semibold text-gray-900">
          ${candidate.price.toFixed(2)}
        </span>
        {candidate.deliveryEstimate && (
          <span className="text-gray-500 text-xs">
            {candidate.deliveryEstimate}
          </span>
        )}
        {candidate.inStock ? (
          <span className="text-green-600 text-xs">In Stock</span>
        ) : (
          <span className="text-red-500 text-xs">Out of Stock</span>
        )}
      </div>

      {candidate.variants.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {candidate.variants.map((v, i) => (
            <span
              key={i}
              className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded"
            >
              {v}
            </span>
          ))}
        </div>
      )}

      <ScoreBreakdown scores={candidate.scores} />

      {candidate.explanation && (
        <p className="text-xs text-gray-500 mt-2 italic">
          {candidate.explanation}
        </p>
      )}

      <div className="flex items-center gap-2 mt-3">
        <button
          onClick={onAddToCart}
          disabled={isInCart}
          className={`flex-1 text-xs font-medium py-1.5 rounded-lg transition-colors ${
            isInCart
              ? "bg-green-100 text-green-700 cursor-default"
              : "bg-blue-600 text-white hover:bg-blue-700"
          }`}
        >
          {isInCart ? "In Cart" : "Add to Cart"}
        </button>
        <a
          href={candidate.productUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-600 hover:text-blue-800 underline"
        >
          View
        </a>
      </div>
    </div>
  );
}
