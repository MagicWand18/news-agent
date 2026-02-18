# Guía de Desarrollo - MediaBot

Guía para desarrolladores que trabajan en el proyecto MediaBot.

## Setup del Entorno

### Requisitos

- Node.js 18+
- pnpm 8+ (usa pnpm workspaces)
- Docker y Docker Compose
- PostgreSQL 16 (vía Docker)
- Redis 7 (vía Docker)

### Instalación

```bash
# 1. Clonar el repositorio
git clone <repo-url>
cd news-agent

# 2. Instalar dependencias
pnpm install

# 3. Copiar variables de entorno
cp .env.example .env
# Editar .env con tus valores

# 4. Iniciar servicios con Docker
docker compose up -d postgres redis

# 5. Generar cliente Prisma
pnpm exec prisma generate

# 6. Aplicar schema
pnpm exec prisma db push

# 7. Iniciar en desarrollo
pnpm dev
```

### Variables de Entorno Requeridas

```env
# Base de datos
DATABASE_URL=postgresql://mediabot:mediabot@localhost:5432/mediabot

# Redis
REDIS_URL=redis://localhost:6379

# Antropic (Claude API)
ANTHROPIC_API_KEY=sk-ant-...

# Google (Gemini + Search)
GOOGLE_API_KEY=...

# Telegram Bot
TELEGRAM_BOT_TOKEN=...

# NextAuth
NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3000
```

---

## Estructura del Monorepo

```
/
├── packages/
│   ├── web/              # Frontend Next.js + API tRPC
│   │   ├── src/
│   │   │   ├── app/      # App Router (páginas)
│   │   │   ├── components/
│   │   │   ├── lib/      # Utilidades cliente
│   │   │   └── server/   # tRPC routers y contexto
│   │   └── package.json
│   │
│   ├── workers/          # Workers de background
│   │   ├── src/
│   │   │   ├── analysis/       # Análisis AI y crisis
│   │   │   ├── collectors/     # Recolección de noticias
│   │   │   ├── grounding/      # Búsqueda con Gemini
│   │   │   ├── notifications/  # Telegram notifications + recipients
│   │   │   ├── workers/        # Alert rules, comments, etc.
│   │   │   └── queues.ts       # Definición de colas (31 colas)
│   │   └── package.json
│   │
│   ├── bot/              # Bot de Telegram
│   │   ├── src/
│   │   │   ├── commands/
│   │   │   └── conversations/
│   │   └── package.json
│   │
│   └── shared/           # Código compartido
│       ├── src/
│       │   ├── prisma.ts
│       │   ├── config.ts
│       │   ├── queue-client.ts
│       │   ├── ai-client.ts
│       │   ├── telegram-notification-types.ts
│       │   ├── realtime-types.ts          # Tipos de eventos realtime
│       │   └── realtime-publisher.ts      # Publisher Redis Pub/Sub (NO en barrel)
│       └── package.json
│
├── prisma/
│   └── schema.prisma     # Schema de base de datos
│
├── docs/                 # Documentación
│   ├── api/              # API Reference
│   └── *.md
│
└── tests/
    └── e2e/              # Tests end-to-end
```

---

## Cómo Agregar un Router tRPC

### 1. Crear el archivo del router

```typescript
// packages/web/src/server/routers/mi-router.ts
import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { prisma } from "@mediabot/shared";

export const miRouter = router({
  // Query simple
  list: protectedProcedure.query(async ({ ctx }) => {
    return prisma.miModelo.findMany({
      where: { orgId: ctx.user.orgId },
    });
  }),

  // Query con input
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      return prisma.miModelo.findFirst({
        where: { id: input.id, orgId: ctx.user.orgId },
      });
    }),

  // Mutation
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      // ... más campos
    }))
    .mutation(async ({ input, ctx }) => {
      return prisma.miModelo.create({
        data: { ...input, orgId: ctx.user.orgId },
      });
    }),
});
```

### 2. Registrar en el app router

```typescript
// packages/web/src/server/routers/_app.ts
import { miRouter } from "./mi-router";

export const appRouter = router({
  // ... otros routers
  miRouter: miRouter,
});
```

### 3. Usar en el frontend

```typescript
// En componente React
const { data } = trpc.miRouter.list.useQuery();
const createMutation = trpc.miRouter.create.useMutation();
```

---

## Cómo Agregar un Comando de Telegram

### 1. Crear el handler

```typescript
// packages/bot/src/commands/mi-comando.ts
import type { BotContext } from "../types.js";
import { prisma } from "@mediabot/shared";

export async function handleMiComando(ctx: BotContext) {
  // Verificar autenticación
  if (!ctx.session.orgId) {
    await ctx.reply("No estas registrado en el sistema.");
    return;
  }

  // Parsear argumentos si es necesario
  const args = ctx.message?.text?.split(" ").slice(1).join(" ");

  // Lógica del comando
  const data = await prisma.miModelo.findMany({
    where: { orgId: ctx.session.orgId },
  });

  // Responder
  await ctx.reply(`Encontré ${data.length} resultados.`);
}
```

### 2. Registrar el comando

```typescript
// packages/bot/src/commands/index.ts
import { handleMiComando } from "./mi-comando.js";

export function registerCommands(bot: Bot<BotContext>) {
  // ... otros comandos
  bot.command("micomando", handleMiComando);
}
```

---

## Cómo Agregar un Worker/Collector

### 1. Crear el worker

```typescript
// packages/workers/src/mi-worker/worker.ts
import { Worker } from "bullmq";
import { prisma, getRedisConnection } from "@mediabot/shared";

export function createMiWorker() {
  const worker = new Worker(
    "mi-queue",
    async (job) => {
      const { param1, param2 } = job.data;

      console.log(`[MiWorker] Processing job: ${job.id}`);

      // Lógica del worker
      const result = await procesarAlgo(param1, param2);

      return result;
    },
    {
      connection: getRedisConnection(),
      concurrency: 5,
    }
  );

  worker.on("completed", (job) => {
    console.log(`[MiWorker] Job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[MiWorker] Job ${job?.id} failed:`, err);
  });

  return worker;
}
```

### 2. Registrar la cola

```typescript
// packages/workers/src/queues.ts
export const QUEUE_NAMES = {
  // ... otras colas
  MI_QUEUE: "mi-queue",
};

// Si necesita cron
export const CRON_SCHEDULES = {
  // ... otros crons
  MI_PROCESO: "0 */6 * * *", // Cada 6 horas
};
```

### 3. Iniciar el worker

```typescript
// packages/workers/src/index.ts
import { createMiWorker } from "./mi-worker/worker.js";

// En el inicio
const miWorker = createMiWorker();
```

---

## Patrones de Código

### Verificación de Permisos Admin

```typescript
function requireAdmin(role: string) {
  if (role !== "ADMIN") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Solo administradores pueden realizar esta acción",
    });
  }
}

// Uso en mutation
create: protectedProcedure
  .input(...)
  .mutation(async ({ input, ctx }) => {
    requireAdmin(ctx.user.role);
    // ...
  }),
```

### Super Admin Procedure

Para endpoints que solo debe usar el Super Admin (gestión de organizaciones, notificaciones globales):

```typescript
const superAdminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!ctx.user.isSuperAdmin) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Solo Super Admin puede realizar esta acción",
    });
  }
  return next({ ctx });
});
```

### Importaciones Web-Local (evitar BullMQ en client components)

`@mediabot/shared` re-exporta `queue-client.ts` que importa BullMQ (módulos de Node.js). Los client components (`"use client"`) no pueden importar desde `@mediabot/shared` si la cadena de imports incluye BullMQ.

**Solución:** Crear copias web-local en `packages/web/src/lib/` para constantes que necesiten client components:

```typescript
// packages/web/src/lib/telegram-notification-types.ts
// Copia de packages/shared/src/telegram-notification-types.ts
// para evitar importar BullMQ via barrel export en client components
export const TELEGRAM_NOTIFICATION_TYPES = { ... } as const;
```

### Despacho de Notificaciones Telegram

Para enviar notificaciones Telegram desde routers tRPC (que corren en Next.js):

```typescript
import { getQueue, QUEUE_NAMES } from "@mediabot/shared";

// Encolar notificación genérica
const queue = getQueue(QUEUE_NAMES.NOTIFY_TELEGRAM);
await queue.add("notify", {
  clientId: client.id,
  type: "CRISIS_STATUS",
  message: `Crisis actualizada: ${crisis.title}`,
});
```

### Paginación por Cursor

```typescript
list: protectedProcedure
  .input(z.object({
    cursor: z.string().optional(),
    limit: z.number().min(1).max(50).default(20),
  }))
  .query(async ({ input }) => {
    const { cursor, limit } = input;

    const items = await prisma.modelo.findMany({
      take: limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      orderBy: { createdAt: "desc" },
    });

    let nextCursor: string | undefined;
    if (items.length > limit) {
      const next = items.pop();
      nextCursor = next!.id;
    }

    return { items, nextCursor };
  }),
```

### Manejo de Errores

```typescript
import { TRPCError } from "@trpc/server";

// En un procedure
const item = await prisma.modelo.findFirst({
  where: { id: input.id, orgId: ctx.user.orgId },
});

if (!item) {
  throw new TRPCError({
    code: "NOT_FOUND",
    message: "Elemento no encontrado",
  });
}
```

---

## Proceso de Deploy

### Deploy a Producción

```bash
# Desde la máquina local
bash deploy/remote-deploy.sh

# Forzar rebuild completo
FORCE_DEPLOY=1 bash deploy/remote-deploy.sh
```

### Ver Logs en Producción

```bash
ssh -i ~/.ssh/newsaibot-telegram-ssh root@159.65.97.78 \
  "cd /opt/mediabot && docker compose -f docker-compose.prod.yml logs -f"
```

### Acceso a Base de Datos Producción

```bash
# Ejecutar query
ssh -i ~/.ssh/newsaibot-telegram-ssh root@159.65.97.78 \
  "cd /opt/mediabot && docker compose -f docker-compose.prod.yml exec -T postgres psql -U mediabot -c 'SELECT COUNT(*) FROM \"Mention\"'"
```

---

## Testing

### Ejecutar Tests

```bash
# Todos los tests
pnpm test

# Con cobertura
pnpm test -- --coverage

# Test específico
pnpm test -- grounding-service.test.ts
```

### Test E2E

```bash
# Ejecutar test E2E completo
python3 tests/e2e/test_mediabot_full.py

# Tests por sprint
python3 tests/e2e/test_sprint14.py            # Action Pipeline
python3 tests/e2e/test_sprint14_social.py      # Social mention detail
python3 tests/e2e/test_sprint15.py              # AI Media Brief
python3 tests/e2e/test_sprint16.py             # Campaign Tracking
python3 tests/e2e/test_sprint17.py             # Executive Dashboard
python3 tests/e2e/test_sprint19.py             # Topic Threads
python3 tests/e2e/test_telegram_notifs.py      # Telegram notifications
```

---

## Temporal Queries Pattern

Al trabajar con filtros temporales en MediaBot, es crítico usar el campo correcto para evitar falsos positivos (por ejemplo, crisis falsas disparadas por artículos viejos recolectados en batch).

### Campos correctos por modelo

| Modelo | Campo temporal correcto | NO usar |
|--------|------------------------|---------|
| `Mention` | `publishedAt` | `createdAt` para filtros temporales |
| `SocialMention` | `postedAt` | `createdAt` para filtros temporales |

### En queries de Prisma

```typescript
// CORRECTO — filtrar menciones de las últimas 24 horas
const recentMentions = await prisma.mention.findMany({
  where: {
    publishedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
  },
});

// INCORRECTO — esto incluye artículos viejos recolectados recientemente
const recentMentions = await prisma.mention.findMany({
  where: {
    createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
  },
});
```

### En raw SQL

Usar `COALESCE` para manejar registros antiguos que no tengan el campo poblado:

```sql
-- Para Mention
WHERE COALESCE(m."publishedAt", m."createdAt") >= NOW() - INTERVAL '24 hours'

-- Para SocialMention
WHERE COALESCE(sm."postedAt", sm."createdAt") >= NOW() - INTERVAL '24 hours'
```

### Cuándo SÍ usar `createdAt`

- Para ordenar resultados en la UI (mostrar los más recientes primero por fecha de ingreso)
- Para mostrar timestamps de "agregado al sistema" en la interfaz
- Para lógica no temporal (paginación por cursor, auditoría, etc.)

### Al crear menciones

Siempre establecer `publishedAt` desde la fecha de publicación del artículo fuente:

```typescript
await prisma.mention.create({
  data: {
    // ... otros campos
    publishedAt: article.publishedAt || null,
  },
});
```

Si `publishedAt` es `null`, las queries con `COALESCE` caerán automáticamente a `createdAt` como fallback.

---

## Real-time Events Pattern

### Publicar eventos desde workers

```typescript
// packages/workers/src/collectors/ingest.ts (ejemplo)
import { publishRealtimeEvent } from "../../shared/src/realtime-publisher.js";

// Después de crear una mención
await publishRealtimeEvent("mention:new", {
  id: mention.id,
  clientId: mention.clientId,
  orgId: client.orgId,  // IMPORTANTE: necesario para filtrar por org
  title: article.title,
  source: article.sourceName,
  createdAt: mention.createdAt.toISOString(),
});
```

**IMPORTANTE:** Siempre incluir `orgId` en el payload — el SSE endpoint filtra por organización.

### Suscribirse a eventos en el frontend

```typescript
// En un componente "use client"
import { useRealtime } from "@/hooks/use-realtime";
import type { RealtimeChannel } from "@/lib/realtime-types";

function MiComponente() {
  const { subscribe } = useRealtime();

  useEffect(() => {
    const unsubscribe = subscribe("mention:analyzed" as RealtimeChannel, (event) => {
      // event.data contiene el payload publicado
      console.log("Nueva mención analizada:", event.data);
    });
    return unsubscribe;
  }, [subscribe]);
}
```

### Restricciones de importación realtime

| Archivo | Puede importar desde `@mediabot/shared`? | Razón |
|---------|------------------------------------------|-------|
| Workers (Node.js) | Sí | Entorno server-side |
| tRPC routers (server) | Sí | Ejecutan en Node.js |
| Client components (`"use client"`) | **NO** | Barrel export incluye BullMQ → Node.js modules |

**Solución para client components:** Usar copias locales en `packages/web/src/lib/`:
- `realtime-types.ts` (copia de `shared/src/realtime-types.ts`)
- `telegram-notification-types.ts` (copia de `shared/src/telegram-notification-types.ts`)

---

## Skeleton Loading Pattern

Usar componentes skeleton de `@/components/skeletons` en lugar de spinners:

```typescript
import { TableSkeleton, CardGridSkeleton, FilterBarSkeleton } from "@/components/skeletons";

function MiPagina() {
  const { data, isLoading } = trpc.miRouter.list.useQuery();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <FilterBarSkeleton />
        <TableSkeleton rows={10} cols={5} />
      </div>
    );
  }

  return <MiTabla data={data} />;
}
```

**Componentes disponibles:** `SkeletonLine`, `SkeletonBlock`, `TableSkeleton`, `ChartSkeleton`, `CardGridSkeleton`, `FilterBarSkeleton`.

---

## Topic Threading Pattern

Las menciones se agrupan automáticamente en TopicThreads por tema y cliente. El topic-thread-manager asigna cada mención (Mention o SocialMention) a un thread existente o crea uno nuevo.

### Asignar mención a thread (desde workers)

```typescript
// packages/workers/src/analysis/topic-thread-manager.ts
import { assignMentionToThread } from "./topic-thread-manager.js";

// Después de que el topic-extractor asigna un topic
await assignMentionToThread(mentionId, "mention");

// Para social mentions
await assignMentionToThread(socialMentionId, "social");
```

### Lógica de asignación

1. Si la mención no tiene `topic` → return null (se mantiene NOTIFY_ALERT individual como fallback)
2. Normalizar: `topic.toLowerCase().trim()`
3. Buscar TopicThread ACTIVE con `clientId + normalizedName`
4. Si existe → vincular, actualizar stats, crear evento MENTION_ADDED
5. Si no existe → buscar CLOSED reciente (<72h) para reabrir, o crear nuevo

### Notificaciones condicionales (NOTIFY_ALERT vs NOTIFY_TOPIC)

```typescript
// packages/workers/src/analysis/worker.ts (Step 6)
// Si la mención tiene topicThreadId → la notificación se maneja por NOTIFY_TOPIC
// Si NO tiene topic → fallback a NOTIFY_ALERT individual
if (!mention.topicThreadId) {
  await notifyQueue.add("alert", { mentionId });
}
// Crisis siempre se evalúa (independiente de topics)
```

### Eventos notificables por tema

| Evento | Condición | Límite |
|--------|-----------|--------|
| TOPIC_NEW | Thread alcanza 2 menciones | Máx 10/cliente/día |
| THRESHOLD_REACHED | mentionCount cruza [5, 10, 20, 50] | Una vez por umbral |
| SENTIMENT_SHIFT | dominantSentiment cambia | Máx 1/thread/4h |

---

## Convenciones

### Nombres de Archivos
- Componentes: `PascalCase.tsx`
- Utilidades: `kebab-case.ts`
- Tests: `*.test.ts`

### Commits
```
feat: Agregar nueva funcionalidad
fix: Corregir bug
docs: Actualizar documentación
refactor: Refactorizar código
test: Agregar tests
chore: Tareas de mantenimiento
```

### Branches
```
feature/nombre-feature
fix/descripcion-bug
refactor/descripcion
docs/que-se-documenta
```
