"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import type {
  AppPhase,
  Message,
  ShoppingSpec,
  ItemRunResult,
  CartState,
  CheckoutPlan,
  ProductCandidate,
} from "@/lib/types";

interface AppState {
  phase: AppPhase;
  sessionId: string | null;
  messages: Message[];
  specReady: boolean;
  spec: ShoppingSpec | null;
  discoveryResults: ItemRunResult[];
  cart: CartState | null;
  checkoutPlan: CheckoutPlan | null;
  loading: boolean;
  error: string | null;
}

interface AppContextType extends AppState {
  sendMessage: (message: string) => Promise<void>;
  finalizeSpec: () => Promise<void>;
  runDiscovery: () => Promise<void>;
  addToCart: (itemId: string, candidate: ProductCandidate) => Promise<void>;
  addAllTopPicks: () => Promise<void>;
  removeFromCart: (itemId: string) => Promise<void>;
  swapInCart: (itemId: string, newCandidate: ProductCandidate) => Promise<void>;
  toggleLockInCart: (itemId: string) => Promise<void>;
  proceedToCheckout: () => void;
  submitCheckout: (paymentInfo: CheckoutPlan["paymentInfo"], shippingAddress: CheckoutPlan["shippingAddress"]) => Promise<void>;
  setPhase: (phase: AppPhase) => void;
  goBackToDiscovery: () => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>({
    phase: "discovery",
    sessionId: null,
    messages: [],
    specReady: false,
    spec: null,
    discoveryResults: [],
    cart: null,
    checkoutPlan: null,
    loading: false,
    error: null,
  });

  const sendMessage = useCallback(async (message: string) => {
    setState((s) => ({
      ...s,
      loading: true,
      error: null,
      messages: [
        ...s.messages,
        {
          id: Date.now().toString(),
          sessionId: s.sessionId ?? "",
          role: "user",
          content: message,
          createdAt: new Date().toISOString(),
        },
      ],
    }));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: state.sessionId, message }),
      });
      const data = await res.json();

      setState((s) => ({
        ...s,
        sessionId: data.sessionId,
        loading: false,
        specReady: data.specReady || s.specReady,
        messages: [
          ...s.messages,
          {
            id: (Date.now() + 1).toString(),
            sessionId: data.sessionId,
            role: "assistant",
            content: data.response,
            createdAt: new Date().toISOString(),
          },
        ],
      }));
    } catch {
      setState((s) => ({
        ...s,
        loading: false,
        error: "Failed to send message",
      }));
    }
  }, [state.sessionId]);

  const finalizeSpec = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));

    try {
      const res = await fetch("/api/finalize-spec", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: state.sessionId }),
      });
      const data = await res.json();

      setState((s) => ({
        ...s,
        loading: false,
        spec: data.spec,
        messages: [
          ...s.messages,
          {
            id: Date.now().toString(),
            sessionId: s.sessionId ?? "",
            role: "assistant",
            content: `I've created your shopping plan with ${data.spec.items.length} items and a total budget of $${data.spec.budget}. Click "Start Discovery" to find the best products!`,
            createdAt: new Date().toISOString(),
          },
        ],
      }));
    } catch {
      setState((s) => ({
        ...s,
        loading: false,
        error: "Failed to finalize spec",
      }));
    }
  }, [state.sessionId]);

  const runDiscovery = useCallback(async () => {
    if (!state.spec) return;
    setState((s) => ({ ...s, loading: true, error: null, discoveryResults: [] }));

    try {
      const res = await fetch("/api/run-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ specId: state.spec.id }),
      });
      const data = await res.json();
      const results = data.results ?? [];
      console.log(
        "[Discovery] run-plan returned",
        results.length,
        "item results. Candidates per item:",
        results.map((r: { itemName: string; candidates: unknown[] }) => `${r.itemName}: ${r.candidates?.length ?? 0}`)
      );

      setState((s) => ({
        ...s,
        loading: false,
        discoveryResults: results,
      }));
    } catch {
      setState((s) => ({
        ...s,
        loading: false,
        error: "Failed to run discovery",
      }));
    }
  }, [state.spec]);

  const addToCartAction = useCallback(
    async (itemId: string, candidate: ProductCandidate) => {
      try {
        const res = await fetch("/api/cart/add", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: state.sessionId,
            itemId,
            candidateId: candidate.id,
            candidate,
          }),
        });
        const data = await res.json();
        setState((s) => ({
          ...s,
          cart: {
            ...data.cart,
            budgetRemaining: (s.spec?.budget ?? 0) - data.cart.totalCost,
          },
        }));
      } catch {
        setState((s) => ({ ...s, error: "Failed to add to cart" }));
      }
    },
    [state.sessionId]
  );

  const addAllTopPicks = useCallback(async () => {
    for (const result of state.discoveryResults) {
      if (result.candidates.length > 0) {
        await addToCartAction(result.itemId, result.candidates[0]);
      }
    }
    setState((s) => ({ ...s, phase: "cart" }));
  }, [state.discoveryResults, addToCartAction]);

  const removeFromCartAction = useCallback(
    async (itemId: string) => {
      try {
        const res = await fetch("/api/cart/remove", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: state.sessionId, itemId }),
        });
        const data = await res.json();
        setState((s) => ({
          ...s,
          cart: {
            ...data.cart,
            budgetRemaining: (s.spec?.budget ?? 0) - data.cart.totalCost,
          },
        }));
      } catch {
        setState((s) => ({ ...s, error: "Failed to remove from cart" }));
      }
    },
    [state.sessionId]
  );

  const swapInCartAction = useCallback(
    async (itemId: string, newCandidate: ProductCandidate) => {
      try {
        const res = await fetch("/api/cart/swap", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: state.sessionId,
            itemId,
            newCandidateId: newCandidate.id,
            newCandidate,
          }),
        });
        const data = await res.json();
        setState((s) => ({
          ...s,
          cart: {
            ...data.cart,
            budgetRemaining: (s.spec?.budget ?? 0) - data.cart.totalCost,
          },
        }));
      } catch {
        setState((s) => ({ ...s, error: "Failed to swap item" }));
      }
    },
    [state.sessionId]
  );

  const toggleLockInCart = useCallback(
    async (itemId: string) => {
      // Optimistic toggle (no API call for lock — it's local state for hackathon simplicity)
      setState((s) => {
        if (!s.cart) return s;
        return {
          ...s,
          cart: {
            ...s.cart,
            items: s.cart.items.map((item) =>
              item.itemId === itemId ? { ...item, locked: !item.locked } : item
            ),
          },
        };
      });
    },
    []
  );

  const proceedToCheckout = useCallback(() => {
    setState((s) => ({ ...s, phase: "checkout" }));
  }, []);

  const submitCheckout = useCallback(
    async (
      paymentInfo: CheckoutPlan["paymentInfo"],
      shippingAddress: CheckoutPlan["shippingAddress"]
    ) => {
      setState((s) => ({ ...s, loading: true, error: null }));

      try {
        const res = await fetch("/api/checkout/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: state.sessionId,
            paymentInfo,
            shippingAddress,
          }),
        });
        const data = await res.json();

        setState((s) => ({
          ...s,
          loading: false,
          checkoutPlan: data.plan,
        }));
      } catch {
        setState((s) => ({
          ...s,
          loading: false,
          error: "Failed to complete checkout",
        }));
      }
    },
    [state.sessionId]
  );

  const setPhase = useCallback((phase: AppPhase) => {
    setState((s) => ({ ...s, phase }));
  }, []);

  const goBackToDiscovery = useCallback(() => {
    setState((s) => ({ ...s, phase: "discovery" }));
  }, []);

  return (
    <AppContext.Provider
      value={{
        ...state,
        sendMessage,
        finalizeSpec,
        runDiscovery,
        addToCart: addToCartAction,
        addAllTopPicks,
        removeFromCart: removeFromCartAction,
        swapInCart: swapInCartAction,
        toggleLockInCart,
        proceedToCheckout,
        submitCheckout,
        setPhase,
        goBackToDiscovery,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
