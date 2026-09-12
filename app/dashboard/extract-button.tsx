"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ExtractButton({ deckId }: { deckId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);

    const response = await fetch("/api/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deckId }),
    });
    const body = await response.json();

    setLoading(false);

    if (!response.ok) {
      setError(body.error ?? "Something went wrong.");
      return;
    }

    router.refresh();
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="rounded-md border border-gray-300 px-3 py-1 text-xs hover:bg-gray-100 disabled:opacity-50"
      >
        {loading ? "Reading..." : "Extract text"}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
