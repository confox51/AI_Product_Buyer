"use client";

import { useState, useRef, useEffect } from "react";
import { useApp } from "@/components/AppProvider";
import { MessageBubble } from "./MessageBubble";

export function ChatPanel() {
  const {
    messages,
    loading,
    specReady,
    spec,
    sendMessage,
    finalizeSpec,
    runDiscovery,
    discoveryResults,
  } = useApp();
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    const msg = input;
    setInput("");
    await sendMessage(msg);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-gray-200 bg-white">
        <h2 className="text-lg font-semibold text-gray-900">Shopping Assistant</h2>
        <p className="text-xs text-gray-500">
          Tell me what you&apos;re looking for
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 mt-12">
            <p className="text-2xl mb-2">&#128722;</p>
            <p className="text-sm">
              Start by telling me what you want to buy!
            </p>
            <p className="text-xs mt-1 text-gray-300">
              e.g. &quot;I need a skiing outfit, budget $400, size M&quot;
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {loading && (
          <div className="flex justify-start mb-3">
            <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-2.5">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.1s]" />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]" />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Action buttons */}
      {specReady && !spec && (
        <div className="px-4 py-2 border-t border-gray-200 bg-blue-50">
          <button
            onClick={finalizeSpec}
            disabled={loading}
            className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "Creating plan..." : "Create Shopping Plan"}
          </button>
        </div>
      )}

      {spec && discoveryResults.length === 0 && (
        <div className="px-4 py-2 border-t border-gray-200 bg-green-50">
          <button
            onClick={runDiscovery}
            disabled={loading}
            className="w-full bg-green-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "Searching products..." : "Start Discovery"}
          </button>
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="px-4 py-3 border-t border-gray-200 bg-white"
      >
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
