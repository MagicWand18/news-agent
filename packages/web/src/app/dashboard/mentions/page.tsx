"use client";

import { trpc } from "@/lib/trpc";
import { MentionRow } from "@/components/mention-row";
import { useState } from "react";

const SENTIMENTS = ["", "POSITIVE", "NEGATIVE", "NEUTRAL", "MIXED"] as const;

export default function MentionsPage() {
  const [clientId, setClientId] = useState<string>("");
  const [sentiment, setSentiment] = useState<string>("");

  const clients = trpc.clients.list.useQuery();
  const mentions = trpc.mentions.list.useQuery({
    clientId: clientId || undefined,
    sentiment: (sentiment || undefined) as "POSITIVE" | "NEGATIVE" | "NEUTRAL" | "MIXED" | undefined,
    limit: 30,
  });

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Menciones</h2>

      {/* Filters */}
      <div className="flex gap-4">
        <select
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          className="rounded-lg border bg-white px-3 py-2"
        >
          <option value="">Todos los clientes</option>
          {clients.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          value={sentiment}
          onChange={(e) => setSentiment(e.target.value)}
          className="rounded-lg border bg-white px-3 py-2"
        >
          <option value="">Todos los sentimientos</option>
          <option value="POSITIVE">Positivo</option>
          <option value="NEGATIVE">Negativo</option>
          <option value="NEUTRAL">Neutral</option>
          <option value="MIXED">Mixto</option>
        </select>
      </div>

      {/* Mentions list */}
      <div className="rounded-xl bg-white p-6 shadow-sm">
        {mentions.data?.mentions.map((mention) => (
          <MentionRow
            key={mention.id}
            id={mention.id}
            title={mention.article.title}
            source={mention.article.source}
            clientName={mention.client.name}
            sentiment={mention.sentiment}
            relevance={mention.relevance}
            urgency={mention.urgency}
            date={mention.createdAt}
            url={mention.article.url}
            summary={mention.aiSummary}
            action={mention.aiAction}
          />
        ))}
        {mentions.data?.mentions.length === 0 && (
          <p className="text-center text-gray-500">No hay menciones.</p>
        )}
        {mentions.data?.nextCursor && (
          <p className="mt-4 text-center text-sm text-gray-400">
            Hay mas resultados. Refina los filtros para ver menos.
          </p>
        )}
      </div>
    </div>
  );
}
