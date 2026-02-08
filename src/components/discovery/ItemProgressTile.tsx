"use client";

import type { ItemProgress, DiscoveryStepName } from "@/lib/types";

const STEPS: { key: DiscoveryStepName; label: string }[] = [
  { key: "search", label: "Search" },
  { key: "extract", label: "Extract" },
  { key: "rank", label: "Rank" },
];

interface ItemProgressTileProps {
  progress: ItemProgress;
}

function StepIcon({
  status,
}: {
  status: ItemProgress["steps"][DiscoveryStepName];
}) {
  if (status === "in_progress") {
    return (
      <div
        className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0"
        aria-hidden
      />
    );
  }
  if (status === "complete") {
    return (
      <div
        className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center shrink-0"
        aria-hidden
      >
        <svg
          className="w-2.5 h-2.5 text-white"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
      </div>
    );
  }
  if (status === "error") {
    return (
      <div
        className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center shrink-0"
        aria-hidden
      >
        <svg
          className="w-2.5 h-2.5 text-white"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </div>
    );
  }
  return (
    <div
      className="w-4 h-4 rounded-full border-2 border-gray-300 bg-gray-50 shrink-0"
      aria-hidden
    />
  );
}

export function ItemProgressTile({ progress }: ItemProgressTileProps) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-3 mb-2">
        <span className="text-sm font-medium text-gray-900">{progress.itemName}</span>
      </div>
      <div className="flex items-center gap-1">
        {STEPS.map(({ key, label }, i) => (
          <div key={key} className="flex items-center">
            <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-gray-50 border border-gray-200">
              <StepIcon status={progress.steps[key]} />
              <span className="text-xs text-gray-600">{label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className="w-4 h-0.5 bg-gray-200 mx-0.5 shrink-0"
                aria-hidden
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
