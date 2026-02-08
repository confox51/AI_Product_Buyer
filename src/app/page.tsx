"use client";

import { AppProvider, useApp } from "@/components/AppProvider";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { DiscoveryPanel } from "@/components/discovery/DiscoveryPanel";
import { CartPanel } from "@/components/cart/CartPanel";
import { CheckoutPanel } from "@/components/checkout/CheckoutPanel";
import { PhaseIndicator } from "@/components/ui/PhaseIndicator";

function RightPanel() {
  const { phase } = useApp();

  switch (phase) {
    case "discovery":
      return <DiscoveryPanel />;
    case "cart":
      return <CartPanel />;
    case "checkout":
      return <CheckoutPanel />;
  }
}

function AppContent() {
  const { phase, setPhase, error } = useApp();

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Header */}
      <header className="border-b border-gray-200 px-4 py-3 flex items-center justify-between bg-white">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-gray-900">
            AI Shopping Agent
          </h1>
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
            Demo
          </span>
        </div>
        <PhaseIndicator
          currentPhase={phase}
          onPhaseClick={(p) => setPhase(p)}
        />
      </header>

      {/* Error banner */}
      {error && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex min-h-0">
        {/* Left pane — Chat */}
        <div className="w-[400px] min-w-[350px] border-r border-gray-200 flex flex-col">
          <ChatPanel />
        </div>

        {/* Right pane — Discovery / Cart / Checkout */}
        <div className="flex-1 overflow-hidden">
          <RightPanel />
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
