# Guía de Desarrollo - MediaBot

Guía para desarrolladores que trabajan en el proyecto MediaBot.

## Setup del Entorno

### Requisitos

- Node.js 18+
- npm 9+ (usa npm workspaces)
- Docker y Docker Compose
- PostgreSQL 16 (vía Docker)
- Redis 7 (vía Docker)

### Instalación

```bash
# 1. Clonar el repositorio
git clone <repo-url>
cd news-agent

# 2. Instalar dependencias
npm install

# 3. Copiar variables de entorno
cp .env.example .env
# Editar .env con tus valores

# 4. Iniciar servicios con Docker
docker compose up -d postgres redis

# 5. Generar cliente Prisma
npx prisma generate

# 6. Aplicar migraciones
npx prisma db push

# 7. Iniciar en desarrollo
npm run dev
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
│   │   │   ├── analysis/   # Análisis AI y crisis
│   │   │   ├── collectors/ # Recolección de noticias
│   │   │   ├── grounding/  # Búsqueda con Gemini
│   │   │   ├── notifications/
│   │   │   └── queues.ts   # Definición de colas
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
│       │   ├── queue.ts
│       │   └── ai-client.ts
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
npm test

# Con cobertura
npm test -- --coverage

# Test específico
npm test -- grounding-service.test.ts
```

### Test E2E

```bash
# Ejecutar test E2E completo
python3 tests/e2e/test_mediabot_full.py
```

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
