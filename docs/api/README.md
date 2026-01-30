# API Reference - MediaBot

MediaBot utiliza **tRPC** para su API, proporcionando una interfaz type-safe entre el frontend y el backend.

## Autenticación

Todos los endpoints requieren autenticación excepto donde se indique lo contrario. La autenticación se realiza mediante sesión de cookie JWT.

### Headers de Autenticación

```typescript
// La autenticación se maneja automáticamente por tRPC
// Las cookies de sesión se envían con cada request
```

### Contexto de Usuario

Cada procedimiento protegido tiene acceso al contexto del usuario:

```typescript
interface UserContext {
  user: {
    id: string;
    email: string;
    name: string;
    role: "ADMIN" | "SUPERVISOR" | "ANALYST";
    orgId: string;
  };
}
```

## Estructura de Respuestas

### Éxito

```typescript
// Las respuestas exitosas retornan directamente el tipo definido
const clients = await trpc.clients.list.query();
// clients: Client[]
```

### Errores

```typescript
// Los errores se manejan con TRPCError
import { TRPCError } from "@trpc/server";

throw new TRPCError({
  code: "NOT_FOUND",
  message: "Cliente no encontrado",
});
```

#### Códigos de Error Comunes

| Código | HTTP | Descripción |
|--------|------|-------------|
| `UNAUTHORIZED` | 401 | No autenticado |
| `FORBIDDEN` | 403 | Sin permisos |
| `NOT_FOUND` | 404 | Recurso no encontrado |
| `BAD_REQUEST` | 400 | Datos inválidos |
| `CONFLICT` | 409 | Conflicto (duplicado) |
| `INTERNAL_SERVER_ERROR` | 500 | Error interno |

## Routers Disponibles

| Router | Descripción | Documentación |
|--------|-------------|---------------|
| `clients` | Gestión de clientes, keywords y configuración | [clients.md](./clients.md) |
| `mentions` | Menciones y generación de respuestas | [mentions.md](./mentions.md) |
| `sources` | Fuentes RSS y solicitudes | [sources.md](./sources.md) |
| `intelligence` | Share of Voice, temas y KPIs | [intelligence.md](./intelligence.md) |
| `dashboard` | Estadísticas y analíticas | [dashboard.md](./dashboard.md) |
| `tasks` | Gestión de tareas | [tasks.md](./tasks.md) |
| `team` | Gestión de usuarios | [team.md](./team.md) |
| `notifications` | Notificaciones in-app | [notifications.md](./notifications.md) |
| `settings` | Configuración del sistema | [settings.md](./settings.md) |

## Uso con React Query

```typescript
import { trpc } from "@/lib/trpc";

// Query
const { data: clients } = trpc.clients.list.useQuery();

// Mutation
const createClient = trpc.clients.create.useMutation();
await createClient.mutateAsync({ name: "Nuevo Cliente" });

// Infinite Query (paginación cursor)
const { data, fetchNextPage } = trpc.mentions.list.useInfiniteQuery(
  { limit: 20 },
  { getNextPageParam: (lastPage) => lastPage.nextCursor }
);
```

## Tipos Comunes

### Enums

```typescript
// Sentimiento
type Sentiment = "POSITIVE" | "NEGATIVE" | "NEUTRAL" | "MIXED";

// Urgencia
type Urgency = "HIGH" | "MEDIUM" | "LOW";

// Prioridad de tarea
type Priority = "URGENT" | "HIGH" | "MEDIUM" | "LOW";

// Estado de tarea
type TaskStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

// Rol de usuario
type Role = "ADMIN" | "SUPERVISOR" | "ANALYST";

// Tipo de keyword
type KeywordType = "NAME" | "BRAND" | "COMPETITOR" | "TOPIC" | "ALIAS";

// Tipo de fuente
type SourceType = "NATIONAL" | "STATE" | "MUNICIPAL" | "INTERNATIONAL";

// Tipo de destinatario Telegram
type RecipientType = "AGENCY_INTERNAL" | "CLIENT_GROUP" | "CLIENT_INDIVIDUAL";
```

### Paginación por Cursor

```typescript
// Input
interface CursorPaginationInput {
  cursor?: string;  // ID del último elemento
  limit?: number;   // Elementos por página (default: 20)
}

// Output
interface CursorPaginationOutput<T> {
  items: T[];
  nextCursor?: string;  // undefined si no hay más páginas
}
```

### Paginación Numérica

```typescript
// Input
interface NumericPaginationInput {
  page?: number;   // Página actual (default: 1)
  limit?: number;  // Elementos por página (default: 50)
}

// Output
interface NumericPaginationOutput<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
```

## Validación con Zod

Todos los inputs se validan con Zod. Ejemplo:

```typescript
import { z } from "zod";

const createClientInput = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  industry: z.string().optional(),
});
```

## Rate Limiting

Actualmente no hay rate limiting implementado a nivel de API. Los límites son impuestos por:
- Servicios externos (Anthropic, Google)
- Base de datos (connection pool)

## Versionado

La API no está versionada actualmente. Los cambios se manejan con:
- Campos opcionales para nuevas funcionalidades
- Deprecación gradual de campos antiguos
