"use client";

import type { AppPhase } from "@/lib/types";

const PHASES: { key: AppPhase; label: string }[] = [
  { key: "discovery", label: "Discovery" },
  { key: "cart", label: "Cart" },
  { key: "checkout", label: "Checkout" },
];

export function PhaseIndicator({
  currentPhase,
  onPhaseClick,
}: {
  currentPhase: AppPhase;
  onPhaseClick?: (phase: AppPhase) => void;
}) {
  const currentIdx = PHASES.findIndex((p) => p.key === currentPhase);

  return (
    <div className="flex items-center gap-2">
      {PHASES.map((phase, idx) => (
        <div key={phase.key} className="flex items-center gap-2">
          <button
            onClick={() => onPhaseClick?.(phase.key)}
            disabled={!onPhaseClick}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              idx === currentIdx
                ? "bg-blue-600 text-white"
                : idx < currentIdx
                  ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                  : "bg-gray-100 text-gray-400"
            }`}
          >
            <span
              className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                idx < currentIdx
                  ? "bg-blue-200 text-blue-700"
                  : idx === currentIdx
                    ? "bg-blue-500 text-white"
                    : "bg-gray-200 text-gray-400"
              }`}
            >
              {idx < currentIdx ? "\u2713" : idx + 1}
            </span>
            {phase.label}
          </button>
          {idx < PHASES.length - 1 && (
            <div
              className={`w-6 h-0.5 ${idx < currentIdx ? "bg-blue-300" : "bg-gray-200"}`}
            />
          )}
        </div>
      ))}
    </div>
  );
}
