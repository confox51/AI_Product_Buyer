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
  ItemProgress,
  DiscoveryEvent,
} from "@/lib/types";

const INITIAL_STEPS = {
  search: "pending" as const,
  extract: "pending" as const,
  rank: "pending" as const,
};

interface AppState {
  phase: AppPhase;
  sessionId: string | null;
  messages: Message[];
  specReady: boolean;
  spec: ShoppingSpec | null;
  discoveryResults: ItemRunResult[];
  itemProgress: Record<string, ItemProgress>;
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
    itemProgress: {},
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

    const initialProgress: Record<string, ItemProgress> = {};
    for (const item of state.spec.items) {
      initialProgress[item.id] = {
        itemId: item.id,
        itemName: item.name,
        steps: { ...INITIAL_STEPS },
      };
    }

    setState((s) => ({
      ...s,
      loading: true,
      error: null,
      discoveryResults: [],
      itemProgress: initialProgress,
    }));

    try {
      const res = await fetch("/api/run-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ specId: state.spec.id }),
      });

      if (!res.ok || !res.body) {
        throw new Error(res.statusText || "Failed to run discovery");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";

        for (const chunk of lines) {
          const match = chunk.match(/^data:\s*(.+)$/m);
          if (!match) continue;

          let event: DiscoveryEvent;
          try {
            event = JSON.parse(match[1]) as DiscoveryEvent;
          } catch {
            continue;
          }

          if (event.type === "item-step") {
            setState((s) => {
              const prev = s.itemProgress[event.itemId] ?? {
                itemId: event.itemId,
                itemName: event.itemName,
                steps: { ...INITIAL_STEPS },
              };
              return {
                ...s,
                itemProgress: {
                  ...s.itemProgress,
                  [event.itemId]: {
                    ...prev,
                    itemName: event.itemName,
                    steps: { ...prev.steps, [event.step]: event.status },
                  },
                },
              };
            });
          } else if (event.type === "item-complete") {
            setState((s) => ({
              ...s,
              discoveryResults: [
                ...s.discoveryResults,
                {
                  itemId: event.itemId,
                  itemName: event.itemName,
                  candidates: event.candidates,
                  query: event.query,
                },
              ],
            }));
          } else if (event.type === "done") {
            setState((s) => ({ ...s, loading: false }));
            return;
          } else if (event.type === "error") {
            setState((s) => ({
              ...s,
              loading: false,
              error: event.message,
            }));
            return;
          }
        }
      }

      setState((s) => ({ ...s, loading: false }));
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
