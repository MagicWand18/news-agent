"use client";

import { trpc } from "@/lib/trpc";
import { MentionRow } from "@/components/mention-row";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Plus, X } from "lucide-react";
import Link from "next/link";

const KEYWORD_TYPES = ["NAME", "BRAND", "COMPETITOR", "TOPIC", "ALIAS"] as const;
const typeLabels: Record<string, string> = {
  NAME: "Nombre",
  BRAND: "Marca",
  COMPETITOR: "Competidor",
  TOPIC: "Tema",
  ALIAS: "Alias",
};

export default function ClientDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const client = trpc.clients.getById.useQuery({ id });
  const addKeyword = trpc.clients.addKeyword.useMutation({
    onSuccess: () => {
      client.refetch();
      setNewKeyword({ word: "", type: "NAME" });
    },
  });
  const removeKeyword = trpc.clients.removeKeyword.useMutation({
    onSuccess: () => client.refetch(),
  });

  const [newKeyword, setNewKeyword] = useState<{
    word: string;
    type: (typeof KEYWORD_TYPES)[number];
  }>({ word: "", type: "NAME" });

  if (client.isLoading) return <div>Cargando...</div>;
  if (!client.data) return <div>Cliente no encontrado</div>;

  const c = client.data;

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/clients"
        className="flex items-center gap-2 text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a clientes
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{c.name}</h2>
          <p className="text-gray-500">
            {c.industry || "Sin industria"} · {c.description || "Sin descripcion"}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-sm font-medium ${
            c.active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"
          }`}
        >
          {c.active ? "Activo" : "Inactivo"}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Menciones</p>
          <p className="text-2xl font-bold">{c._count.mentions}</p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Tareas</p>
          <p className="text-2xl font-bold">{c._count.tasks}</p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Keywords</p>
          <p className="text-2xl font-bold">{c.keywords.length}</p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Grupo TG</p>
          <p className="text-2xl font-bold">{c.telegramGroupId ? "Si" : "No"}</p>
        </div>
      </div>

      {/* Keywords */}
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h3 className="mb-4 font-semibold">Keywords</h3>
        <div className="mb-4 flex flex-wrap gap-2">
          {c.keywords.map((kw) => (
            <span
              key={kw.id}
              className="flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-sm"
            >
              <span className="text-xs text-gray-400">{typeLabels[kw.type]}</span>
              {kw.word}
              <button
                onClick={() => removeKeyword.mutate({ id: kw.id })}
                className="ml-1 text-gray-400 hover:text-red-500"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (newKeyword.word.trim()) {
              addKeyword.mutate({ clientId: id, ...newKeyword });
            }
          }}
          className="flex gap-2"
        >
          <input
            placeholder="Nuevo keyword"
            value={newKeyword.word}
            onChange={(e) => setNewKeyword({ ...newKeyword, word: e.target.value })}
            className="flex-1 rounded-lg border px-3 py-2"
          />
          <select
            value={newKeyword.type}
            onChange={(e) =>
              setNewKeyword({
                ...newKeyword,
                type: e.target.value as (typeof KEYWORD_TYPES)[number],
              })
            }
            className="rounded-lg border px-3 py-2"
          >
            {KEYWORD_TYPES.map((t) => (
              <option key={t} value={t}>
                {typeLabels[t]}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="flex items-center gap-1 rounded-lg bg-brand-600 px-4 py-2 text-white hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" />
            Agregar
          </button>
        </form>
      </div>

      {/* Recent Mentions */}
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h3 className="mb-4 font-semibold">Menciones recientes</h3>
        {c.mentions.map((mention) => (
          <MentionRow
            key={mention.id}
            id={mention.id}
            title={mention.article.title}
            source={mention.article.source}
            clientName={c.name}
            sentiment={mention.sentiment}
            relevance={mention.relevance}
            urgency={mention.urgency}
            date={mention.createdAt}
            url={mention.article.url}
            summary={mention.aiSummary}
          />
        ))}
        {c.mentions.length === 0 && (
          <p className="text-gray-500">No hay menciones aun.</p>
        )}
      </div>
    </div>
  );
}
