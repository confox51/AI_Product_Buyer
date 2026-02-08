"use client";

import { useApp } from "@/components/AppProvider";
import { CheckoutForm } from "./CheckoutForm";
import { RetailerPlan } from "./RetailerPlan";
import { OrderSummary } from "./OrderSummary";

export function CheckoutPanel() {
  const { checkoutPlan, cart, setPhase } = useApp();

  if (checkoutPlan) {
    return (
      <div className="p-4 overflow-y-auto h-full">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Order Confirmation
        </h2>

        <OrderSummary plan={checkoutPlan} />

        <div className="mt-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">
            Per-Retailer Breakdown
          </h3>
          {checkoutPlan.retailerPlans.map((plan) => (
            <RetailerPlan key={plan.orderId} plan={plan} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 overflow-y-auto h-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Checkout</h2>
        <button
          onClick={() => setPhase("cart")}
          className="text-xs text-blue-600 hover:text-blue-800"
        >
          Back to Cart
        </button>
      </div>

      {cart && (
        <div className="bg-gray-50 rounded-lg p-3 mb-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">
              {cart.items.length} item{cart.items.length !== 1 ? "s" : ""}
            </span>
            <span className="font-semibold text-gray-900">
              ${cart.totalCost.toFixed(2)}
            </span>
          </div>
        </div>
      )}

      <CheckoutForm />
    </div>
  );
}
