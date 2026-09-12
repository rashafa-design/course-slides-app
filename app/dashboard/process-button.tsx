"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DeckStatus } from "@/lib/types";

export default function ProcessButton({
  deckId,
  status,
}: {
  deckId: string;
  status: DeckStatus;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  async function handleClick() {
    setRunning(true);
    setError(null);

    const response = await fetch("/api/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deckId }),
    });
    const body = await response.json();

    setRunning(false);

    if (!response.ok) {
      setError(body.error ?? "Something went wrong.");
      return;
    }

    router.refresh();
  }

  const label = running
    ? "Processing..."
    : status === "ready"
      ? "Re-process"
      : status === "failed"
        ? "Retry"
        : "Process this deck";

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={running}
        className="rounded-md border border-gray-300 px-3 py-1 text-xs hover:bg-gray-100 disabled:opacity-50"
      >
        {label}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
