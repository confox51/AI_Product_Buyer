"use client";

import { useApp } from "@/components/AppProvider";

export function CartSummary() {
  const { cart, spec } = useApp();

  if (!cart) return null;

  const budget = spec?.budget ?? 0;
  const overBudget = cart.totalCost > budget;

  // Group by retailer
  const retailers = new Set(
    cart.items.map((item) => item.candidate.retailerName)
  );

  return (
    <div className="bg-gray-50 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600">Total</span>
        <span className="text-sm font-semibold text-gray-900">
          ${cart.totalCost.toFixed(2)}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600">Budget</span>
        <span className="text-sm text-gray-600">${budget.toFixed(2)}</span>
      </div>
      <div className="flex items-center justify-between border-t border-gray-200 pt-2">
        <span className="text-sm text-gray-600">Remaining</span>
        <span
          className={`text-sm font-semibold ${
            overBudget ? "text-red-600" : "text-green-600"
          }`}
        >
          {overBudget ? "-" : ""}$
          {Math.abs(budget - cart.totalCost).toFixed(2)}
        </span>
      </div>
      {overBudget && (
        <p className="text-xs text-red-500 font-medium">
          Over budget! Consider swapping items for cheaper alternatives.
        </p>
      )}
      <div className="flex items-center justify-between pt-1">
        <span className="text-xs text-gray-500">
          {cart.items.length} items from {retailers.size} retailer
          {retailers.size !== 1 ? "s" : ""}
        </span>
        {cart.latestDelivery && (
          <span className="text-xs text-gray-500">
            Est: {cart.latestDelivery}
          </span>
        )}
      </div>
    </div>
  );
}
