"use client";

import { useState } from "react";
import { useApp } from "@/components/AppProvider";

export function CheckoutForm() {
  const { submitCheckout, loading } = useApp();

  const [form, setForm] = useState({
    cardNumber: "4242 4242 4242 4242",
    cardType: "Visa",
    billingName: "John Doe",
    name: "John Doe",
    street: "123 Main Street",
    city: "San Francisco",
    state: "CA",
    zip: "94102",
    country: "US",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitCheckout(
      {
        cardLastFour: form.cardNumber.slice(-4),
        cardType: form.cardType,
        billingName: form.billingName,
      },
      {
        name: form.name,
        street: form.street,
        city: form.city,
        state: form.state,
        zip: form.zip,
        country: form.country,
      }
    );
  };

  const inputClass =
    "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">
          Payment Information
        </h3>
        <p className="text-xs text-amber-600 bg-amber-50 rounded px-2 py-1 mb-2">
          Simulated checkout — no real payment will be processed
        </p>
        <div className="space-y-2">
          <input
            type="text"
            placeholder="Card Number"
            value={form.cardNumber}
            onChange={(e) => setForm({ ...form, cardNumber: e.target.value })}
            className={inputClass}
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Card Type"
              value={form.cardType}
              onChange={(e) => setForm({ ...form, cardType: e.target.value })}
              className={inputClass}
            />
            <input
              type="text"
              placeholder="Billing Name"
              value={form.billingName}
              onChange={(e) =>
                setForm({ ...form, billingName: e.target.value })
              }
              className={inputClass}
            />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">
          Shipping Address
        </h3>
        <div className="space-y-2">
          <input
            type="text"
            placeholder="Full Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={inputClass}
          />
          <input
            type="text"
            placeholder="Street Address"
            value={form.street}
            onChange={(e) => setForm({ ...form, street: e.target.value })}
            className={inputClass}
          />
          <div className="grid grid-cols-3 gap-2">
            <input
              type="text"
              placeholder="City"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              className={inputClass}
            />
            <input
              type="text"
              placeholder="State"
              value={form.state}
              onChange={(e) => setForm({ ...form, state: e.target.value })}
              className={inputClass}
            />
            <input
              type="text"
              placeholder="ZIP"
              value={form.zip}
              onChange={(e) => setForm({ ...form, zip: e.target.value })}
              className={inputClass}
            />
          </div>
          <input
            type="text"
            placeholder="Country"
            value={form.country}
            onChange={(e) => setForm({ ...form, country: e.target.value })}
            className={inputClass}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-green-600 text-white rounded-lg py-3 text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
      >
        {loading ? "Processing..." : "Complete Simulated Checkout"}
      </button>
    </form>
  );
}
