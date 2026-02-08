"use client";

import type { CheckoutPlan } from "@/lib/types";

export function OrderSummary({ plan }: { plan: CheckoutPlan }) {
  return (
    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
      <div className="text-center mb-4">
        <p className="text-3xl mb-2">&#9989;</p>
        <h3 className="text-lg font-semibold text-green-800">
          Order Complete!
        </h3>
        <p className="text-xs text-green-600">(Simulated)</p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Grand Total</span>
          <span className="text-lg font-bold text-gray-900">
            ${plan.grandTotal.toFixed(2)}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Orders Placed</span>
          <span className="text-gray-900">{plan.retailerPlans.length}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Delivery</span>
          <span className="text-gray-900">{plan.deliveryTimeline}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Payment</span>
          <span className="text-gray-900">
            {plan.paymentInfo.cardType} ending in{" "}
            {plan.paymentInfo.cardLastFour}
          </span>
        </div>
        <div className="text-sm">
          <span className="text-gray-600">Ship to: </span>
          <span className="text-gray-900">
            {plan.shippingAddress.name}, {plan.shippingAddress.street},{" "}
            {plan.shippingAddress.city}, {plan.shippingAddress.state}{" "}
            {plan.shippingAddress.zip}
          </span>
        </div>
      </div>
    </div>
  );
}
