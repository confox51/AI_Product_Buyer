"use client";

import { useState } from "react";
import type { CartItemEntry, ProductCandidate } from "@/lib/types";
import { useApp } from "@/components/AppProvider";

interface CartItemProps {
  item: CartItemEntry;
  alternatives: ProductCandidate[];
}

export function CartItem({ item, alternatives }: CartItemProps) {
  const { removeFromCart, swapInCart, toggleLockInCart } = useApp();
  const [showAlternatives, setShowAlternatives] = useState(false);

  return (
    <div
      className={`border rounded-lg p-3 ${
        item.locked ? "border-yellow-300 bg-yellow-50/50" : "border-gray-200"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-gray-900 line-clamp-2">
            {item.candidate.title}
          </h4>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm font-semibold text-gray-900">
              ${item.candidate.price.toFixed(2)}
            </span>
            <span className="text-xs text-gray-500">
              {item.candidate.retailerName}
            </span>
            {item.candidate.deliveryEstimate && (
              <span className="text-xs text-gray-400">
                {item.candidate.deliveryEstimate}
              </span>
            )}
          </div>
          {item.candidate.variants.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {item.candidate.variants.map((v, i) => (
                <span
                  key={i}
                  className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded"
                >
                  {v}
                </span>
              ))}
            </div>
          )}
        </div>
        {item.candidate.imageUrl && (
          <img
            src={item.candidate.imageUrl}
            alt={item.candidate.title}
            className="w-14 h-14 object-cover rounded"
          />
        )}
      </div>

      <div className="flex items-center gap-2 mt-2">
        <button
          onClick={() => setShowAlternatives(!showAlternatives)}
          className="text-xs text-blue-600 hover:text-blue-800"
          disabled={alternatives.length === 0}
        >
          {showAlternatives ? "Hide" : "Swap"}{" "}
          ({alternatives.length} alt{alternatives.length !== 1 ? "s" : ""})
        </button>
        <button
          onClick={() => toggleLockInCart(item.itemId)}
          className={`text-xs ${
            item.locked
              ? "text-yellow-600 hover:text-yellow-800"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          {item.locked ? "Unlock" : "Lock"}
        </button>
        <button
          onClick={() => removeFromCart(item.itemId)}
          className="text-xs text-red-500 hover:text-red-700"
        >
          Remove
        </button>
        <a
          href={item.candidate.productUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-600 hover:text-blue-800 underline ml-auto"
        >
          View
        </a>
      </div>

      {showAlternatives && alternatives.length > 0 && (
        <div className="mt-2 space-y-2 border-t border-gray-100 pt-2">
          {alternatives
            .filter((alt) => alt.id !== item.candidateId)
            .map((alt) => (
              <div
                key={alt.id}
                className="flex items-center justify-between bg-gray-50 rounded p-2"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-900 truncate">{alt.title}</p>
                  <p className="text-xs text-gray-500">
                    ${alt.price.toFixed(2)} — {alt.retailerName}
                  </p>
                </div>
                <button
                  onClick={() => {
                    swapInCart(item.itemId, alt);
                    setShowAlternatives(false);
                  }}
                  className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200 ml-2 whitespace-nowrap"
                >
                  Swap
                </button>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
