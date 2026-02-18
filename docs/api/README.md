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
    isSuperAdmin: boolean;
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
| `intelligence` | Share of Voice, temas, KPIs y action items | [intelligence.md](./intelligence.md) |
| `dashboard` | Estadísticas y analíticas | [dashboard.md](./dashboard.md) |
| `tasks` | Gestión de tareas (media + social) | [tasks.md](./tasks.md) |
| `team` | Gestión de usuarios | [team.md](./team.md) |
| `notifications` | Notificaciones in-app | [notifications.md](./notifications.md) |
| `settings` | Configuración del sistema | [settings.md](./settings.md) |
| `social` | Monitoreo de redes sociales | [social.md](./social.md) |
| `organizations` | Gestión de organizaciones (Super Admin) | [organizations.md](./organizations.md) |
| `onboarding` | Tour de onboarding de usuarios | [onboarding.md](./onboarding.md) |
| `crisis` | Gestión de alertas de crisis | [crisis.md](./crisis.md) |
| `responses` | Workflow de borradores de comunicados | [responses.md](./responses.md) |
| `alertRules` | Reglas de alerta configurables (CRUD + toggle) | [alertRules.md](./alertRules.md) |
| `briefs` | AI Media Briefs diarios (list, getById, getLatest) | [briefs.md](./briefs.md) |
| `campaigns` | Tracking de campañas de PR (13 endpoints) | [campaigns.md](./campaigns.md) |
| `executive` | Dashboard ejecutivo multi-org (Super Admin, 5 endpoints) | [executive.md](./executive.md) |
| `reports` | Generación PDF + links compartidos (5 endpoints) | [reports.md](./reports.md) |
| `search` | Búsqueda global para command palette (1 endpoint) | [search.md](./search.md) |

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
type Urgency = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

// Prioridad de tarea
type Priority = "URGENT" | "HIGH" | "MEDIUM" | "LOW";

// Estado de tarea
type TaskStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

// Rol de usuario
type Role = "ADMIN" | "SUPERVISOR" | "ANALYST";

// Tipo de keyword
type KeywordType = "NAME" | "BRAND" | "COMPETITOR" | "TOPIC" | "ALIAS";

// Tipo de fuente
type SourceType = "NATIONAL" | "STATE" | "MUNICIPAL" | "SPECIALIZED";

// Tipo de destinatario Telegram
type RecipientType = "AGENCY_INTERNAL" | "CLIENT_GROUP" | "CLIENT_INDIVIDUAL";

// Plataforma social
type SocialPlatform = "TWITTER" | "INSTAGRAM" | "TIKTOK" | "YOUTUBE";

// Tipo de fuente social
type SocialSourceType = "HANDLE" | "HASHTAG" | "KEYWORD";

// Tipo de notificación
type NotificationType = "MENTION_CRITICAL" | "MENTION_HIGH" | "CRISIS_ALERT" | "WEEKLY_REPORT" | "EMERGING_TOPIC" | "SYSTEM";

// Estado de onboarding
type OnboardingStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "SKIPPED";

// Estado de borrador de respuesta (Sprint 13)
type ResponseStatus = "DRAFT" | "IN_REVIEW" | "APPROVED" | "PUBLISHED" | "DISCARDED";

// Estado de action item (Sprint 13)
type ActionStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "NOT_APPLICABLE";

// Severidad de crisis
type CrisisSeverity = "CRITICAL" | "HIGH" | "MEDIUM";

// Estado de crisis
type CrisisStatus = "ACTIVE" | "MONITORING" | "RESOLVED" | "DISMISSED";

// Trigger de crisis
type CrisisTriggerType = "NEGATIVE_SPIKE" | "HIGH_VOLUME" | "CRITICAL_SOURCE" | "MANUAL";

// Tipo de regla de alerta (Sprint 13)
type AlertRuleType = "NEGATIVE_SPIKE" | "SOV_DROP" | "VOLUME_SURGE" | "COMPETITOR_SPIKE" | "SENTIMENT_SHIFT" | "NO_MENTIONS";

// Estado de campaña (Sprint 16)
type CampaignStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED";

// Tipo de nota de campaña (Sprint 16)
type CampaignNoteType = "UPDATE" | "MILESTONE" | "ISSUE" | "RESULT";

// Tipo de notificación Telegram
type TelegramNotifType = "MENTION_ALERT" | "CRISIS_ALERT" | "EMERGING_TOPIC" | "DAILY_DIGEST" | "ALERT_RULE" | "CRISIS_STATUS" | "RESPONSE_DRAFT" | "BRIEF_READY" | "CAMPAIGN_REPORT" | "WEEKLY_REPORT";

// Tipo de reporte compartido (Sprint 17)
type ReportType = "CAMPAIGN" | "BRIEF" | "CLIENT_SUMMARY";
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
