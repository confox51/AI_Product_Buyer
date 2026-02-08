"use client";

import type { CandidateScores } from "@/lib/types";

const LABELS: { key: keyof Omit<CandidateScores, "total">; label: string; color: string }[] = [
  { key: "cost", label: "Cost", color: "bg-green-500" },
  { key: "delivery", label: "Delivery", color: "bg-blue-500" },
  { key: "preference", label: "Match", color: "bg-purple-500" },
  { key: "coherence", label: "Coherence", color: "bg-orange-500" },
];

export function ScoreBreakdown({ scores }: { scores: CandidateScores }) {
  return (
    <div className="space-y-1.5">
      {LABELS.map(({ key, label, color }) => (
        <div key={key} className="flex items-center gap-2 text-xs">
          <span className="w-16 text-gray-500">{label}</span>
          <div className="flex-1 bg-gray-200 rounded-full h-1.5">
            <div
              className={`${color} h-1.5 rounded-full transition-all`}
              style={{ width: `${(scores[key] * 100).toFixed(0)}%` }}
            />
          </div>
          <span className="w-8 text-right text-gray-600">
            {(scores[key] * 100).toFixed(0)}
          </span>
        </div>
      ))}
      <div className="flex items-center gap-2 text-xs font-medium pt-1 border-t border-gray-100">
        <span className="w-16 text-gray-700">Total</span>
        <div className="flex-1" />
        <span className="text-gray-900">
          {(scores.total * 100).toFixed(0)}/100
        </span>
      </div>
    </div>
  );
}
