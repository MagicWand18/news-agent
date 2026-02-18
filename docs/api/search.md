# Search Router

Router de búsqueda global utilizado por el command palette (Cmd+K).

## Endpoints

### `search.search`

Búsqueda en clientes, menciones (por AI summary) y menciones sociales (por contenido).

**Tipo:** Query
**Auth:** `protectedProcedure`

**Input:**

| Campo | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `query` | `string` (1-200 chars) | requerido | Término de búsqueda |
| `limit` | `number` (1-20) | `5` | Resultados máximos por categoría |

**Output:**

```typescript
{
  clients: Array<{
    id: string;
    name: string;
    industry: string | null;
  }>;
  mentions: Array<{
    id: string;
    aiSummary: string | null;
    sentiment: Sentiment;
    article: { title: string; source: string | null };
    client: { name: string };
  }>;
  socialMentions: Array<{
    id: string;
    content: string;
    platform: SocialPlatform;
    authorHandle: string | null;
    client: { name: string };
  }>;
}
```

**Comportamiento:**
- Busca case-insensitive (`mode: "insensitive"`)
- Filtra por organización del usuario (SuperAdmin ve todo)
- Retorna hasta `limit` resultados por cada categoría
- Menciones ordenadas por `createdAt` descendente

**Ejemplo de uso:**

```typescript
const { data } = trpc.search.search.useQuery({ query: "crisis", limit: 5 });
// data.clients → clientes que contienen "crisis" en el nombre
// data.mentions → menciones con "crisis" en el resumen AI
// data.socialMentions → posts sociales con "crisis" en el contenido
```
