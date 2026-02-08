"use client";

import { useApp } from "@/components/AppProvider";
import { ItemResults } from "./ItemResults";
import { ItemProgressTile } from "./ItemProgressTile";

const DEFAULT_STEPS = {
  search: "pending" as const,
  extract: "pending" as const,
  rank: "pending" as const,
};

export function DiscoveryPanel() {
  const { spec, discoveryResults, loading, itemProgress, addAllTopPicks } =
    useApp();

  if (!spec) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <div className="text-center">
          <p className="text-4xl mb-3">&#128270;</p>
          <p className="text-sm">
            Chat with the assistant to create your shopping plan
          </p>
        </div>
      </div>
    );
  }

  const resultsByItemId = new Map(
    discoveryResults.map((r) => [r.itemId, r])
  );

  if (loading || discoveryResults.length > 0) {
    return (
      <div className="p-4 overflow-y-auto h-full">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {loading ? "Discovering Products..." : "Discovery Results"}
          </h2>
          {!loading && discoveryResults.length > 0 && (
            <button
              onClick={addAllTopPicks}
              className="bg-blue-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Add All Top Picks to Cart
            </button>
          )}
        </div>

        {spec.items.map((item) => {
          const result = resultsByItemId.get(item.id);
          if (result) {
            return <ItemResults key={item.id} result={result} />;
          }
          const progress =
            itemProgress[item.id] ?? {
              itemId: item.id,
              itemName: item.name,
              steps: { ...DEFAULT_STEPS },
            };
          return <ItemProgressTile key={item.id} progress={progress} />;
        })}
      </div>
    );
  }

  if (discoveryResults.length === 0) {
    return (
      <div className="p-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          Shopping Plan
        </h2>
        <div className="bg-gray-50 rounded-lg p-3 mb-3">
          <p className="text-sm text-gray-600">
            Budget: <span className="font-semibold">${spec.budget}</span>
          </p>
          {spec.deliveryDeadline && (
            <p className="text-sm text-gray-600">
              Deliver by:{" "}
              <span className="font-semibold">
                {new Date(spec.deliveryDeadline).toLocaleDateString()}
              </span>
            </p>
          )}
        </div>
        <div className="space-y-2">
          {spec.items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-3 py-2"
            >
              <span className="text-sm text-gray-900">{item.name}</span>
              <span className="text-xs text-gray-500">
                ${item.budgetAllocation.toFixed(0)}
              </span>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-3 text-center">
          Click &quot;Start Discovery&quot; in the chat to begin searching
        </p>
      </div>
    );
  }

  return null;
}
