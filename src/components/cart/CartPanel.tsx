"use client";

import { useApp } from "@/components/AppProvider";
import { CartItem } from "./CartItem";
import { CartSummary } from "./CartSummary";

export function CartPanel() {
  const { cart, discoveryResults, proceedToCheckout, goBackToDiscovery } =
    useApp();

  if (!cart || cart.items.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <div className="text-center">
          <p className="text-4xl mb-3">&#128722;</p>
          <p className="text-sm">Your cart is empty</p>
          <button
            onClick={goBackToDiscovery}
            className="mt-3 text-xs text-blue-600 hover:text-blue-800"
          >
            Back to Discovery
          </button>
        </div>
      </div>
    );
  }

  // Group cart items by retailer
  const retailerGroups: Record<string, typeof cart.items> = {};
  for (const item of cart.items) {
    const retailer = item.candidate.retailerName;
    if (!retailerGroups[retailer]) retailerGroups[retailer] = [];
    retailerGroups[retailer].push(item);
  }

  return (
    <div className="p-4 overflow-y-auto h-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Cart</h2>
        <button
          onClick={goBackToDiscovery}
          className="text-xs text-blue-600 hover:text-blue-800"
        >
          Back to Discovery
        </button>
      </div>

      <CartSummary />

      <div className="mt-4 space-y-6">
        {Object.entries(retailerGroups).map(([retailer, items]) => (
          <div key={retailer}>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              {retailer}
            </h3>
            <div className="space-y-2">
              {items.map((item) => {
                // Find alternatives from discovery results
                const itemResult = discoveryResults.find(
                  (r) => r.itemId === item.itemId
                );
                const alternatives = itemResult?.candidates ?? [];

                return (
                  <CartItem
                    key={item.id}
                    item={item}
                    alternatives={alternatives}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={proceedToCheckout}
        className="w-full mt-6 bg-green-600 text-white rounded-lg py-3 text-sm font-medium hover:bg-green-700 transition-colors"
      >
        Proceed to Checkout
      </button>
    </div>
  );
}
