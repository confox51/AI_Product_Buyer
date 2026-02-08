"use client";

import type { RetailerCheckoutPlan } from "@/lib/types";

export function RetailerPlan({ plan }: { plan: RetailerCheckoutPlan }) {
  return (
    <div className="border border-gray-200 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold text-gray-900">
          {plan.retailerName}
        </h4>
        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
          Order #{plan.orderId}
        </span>
      </div>

      <div className="space-y-1 mb-3">
        {plan.items.map((item, idx) => (
          <div key={idx} className="flex items-center justify-between text-sm">
            <div className="flex-1 min-w-0">
              <span className="text-gray-900 truncate block">{item.title}</span>
              {item.variant !== "Standard" && (
                <span className="text-xs text-gray-500">{item.variant}</span>
              )}
            </div>
            <span className="text-gray-700 ml-2">
              ${item.price.toFixed(2)}
            </span>
          </div>
        ))}
      </div>

      <div className="border-t border-gray-100 pt-2 space-y-1">
        <div className="flex items-center justify-between text-sm font-medium">
          <span className="text-gray-600">Subtotal</span>
          <span className="text-gray-900">${plan.subtotal.toFixed(2)}</span>
        </div>
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Estimated Delivery</span>
          <span>{plan.estimatedDelivery}</span>
        </div>
      </div>

      <div className="mt-3 bg-gray-50 rounded p-2">
        <p className="text-xs font-medium text-gray-600 mb-1">
          Autofill Preview
        </p>
        {plan.autofillPreview.map((field, idx) => (
          <div key={idx} className="flex text-xs text-gray-500">
            <span className="w-28 text-gray-400">{field.field}:</span>
            <span>{field.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
