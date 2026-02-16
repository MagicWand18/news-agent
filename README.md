# MediaBot

Sistema de monitoreo de medios con inteligencia artificial para clientes corporativos.

## Stack Tecnologico

- **Frontend**: Next.js 15, React, TailwindCSS, tRPC
- **Backend Workers**: BullMQ, Node.js
- **Bot**: Grammy (Telegram)
- **Database**: PostgreSQL + Prisma ORM
- **Cache/Queue**: Redis
- **AI**: Anthropic Claude (claude-3-5-haiku)

## Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│                         MEDIABOT                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │  packages/  │    │  packages/  │    │  packages/  │         │
│  │    web      │    │   workers   │    │     bot     │         │
│  │  (Next.js)  │    │  (BullMQ)   │    │  (Grammy)   │         │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘         │
│         │                  │                  │                 │
│         └─────────┬────────┴─────────┬────────┘                 │
│                   │                  │                          │
│            ┌──────▼──────┐    ┌──────▼──────┐                   │
│            │  PostgreSQL │    │    Redis    │                   │
│            │   (Prisma)  │    │   (BullMQ)  │                   │
│            └─────────────┘    └─────────────┘                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Packages

| Package | Descripcion |
|---------|-------------|
| `packages/shared` | Tipos, config, cliente Prisma compartido |
| `packages/web` | Dashboard web con Next.js y tRPC |
| `packages/workers` | Colectores y workers de BullMQ |
| `packages/bot` | Bot de Telegram con Grammy |

## Setup Local

### 1. Prerequisitos

- Node.js >= 18
- Docker y Docker Compose

### 2. Iniciar servicios

```bash
# Iniciar PostgreSQL y Redis
docker-compose up -d
```

### 3. Configurar variables de entorno

```bash
cp .env.example .env
# Editar .env con tus credenciales
```

### 4. Instalar dependencias y configurar DB

```bash
pnpm install
pnpm exec prisma generate
pnpm exec prisma db push
```

### 5. Ejecutar en desarrollo

```bash
# Todos los packages en paralelo
pnpm dev

# O individualmente:
pnpm dev:workers    # Workers
pnpm dev:web        # Web Dashboard
pnpm dev:bot        # Telegram Bot (opcional)
```

## Variables de Entorno

### Requeridas

| Variable | Descripcion |
|----------|-------------|
| `DATABASE_URL` | URL de conexion PostgreSQL |
| `REDIS_URL` | URL de conexion Redis |
| `TELEGRAM_BOT_TOKEN` | Token del bot de Telegram |
| `ANTHROPIC_API_KEY` | API key de Anthropic (Claude) |
| `NEXTAUTH_SECRET` | Secret para NextAuth |
| `NEXTAUTH_URL` | URL base de la app web |

### Opcionales - APIs Externas

| Variable | Default | Descripcion |
|----------|---------|-------------|
| `GOOGLE_CSE_API_KEY` | - | API key de Google Custom Search |
| `GOOGLE_CSE_CX` | - | ID del Custom Search Engine |
| `NEWSDATA_API_KEY` | - | API key de NewsData.io |
| `GOOGLE_API_KEY` | - | API key de Google Gemini (grounding) |
| `ENSEMBLEDATA_TOKEN` | - | Token de EnsembleData (social media) |

### Opcionales - Configuracion de Crons

| Variable | Default | Descripcion |
|----------|---------|-------------|
| `COLLECTOR_GDELT_CRON` | `*/15 * * * *` | Cron para colector GDELT |
| `COLLECTOR_NEWSDATA_CRON` | `*/30 * * * *` | Cron para colector NewsData |
| `COLLECTOR_RSS_CRON` | `*/10 * * * *` | Cron para colector RSS |
| `COLLECTOR_GOOGLE_CRON` | `0 */2 * * *` | Cron para colector Google CSE |
| `DIGEST_CRON` | `0 8 * * *` | Cron para digest diario |
| `EMERGING_TOPICS_CRON` | `0 */4 * * *` | Cron para alertas de temas emergentes |
| `GROUNDING_CHECK_CRON` | `0 7 * * *` | Cron para verificación de menciones bajas |
| `GROUNDING_WEEKLY_CRON` | `0 6 * * *` | Cron para grounding semanal |

### Opcionales - Workers

| Variable | Default | Descripcion |
|----------|---------|-------------|
| `ANALYSIS_WORKER_CONCURRENCY` | `3` | Concurrencia del worker de analisis |
| `ANALYSIS_RATE_LIMIT_MAX` | `20` | Max requests por ventana de tiempo |
| `ANALYSIS_RATE_LIMIT_WINDOW_MS` | `60000` | Ventana de rate limit (ms) |
| `NOTIFICATION_WORKER_CONCURRENCY` | `5` | Concurrencia del worker de notificaciones |
| `CLAUDE_MODEL` | `claude-3-5-haiku-20241022` | Modelo de Claude a usar |

### Opcionales - Jobs

| Variable | Default | Descripcion |
|----------|---------|-------------|
| `JOB_RETRY_ATTEMPTS` | `3` | Intentos de retry en jobs fallidos |
| `JOB_BACKOFF_DELAY_MS` | `5000` | Delay inicial de backoff (ms) |

### Opcionales - Crisis Detection

| Variable | Default | Descripcion |
|----------|---------|-------------|
| `CRISIS_NEGATIVE_MENTION_THRESHOLD` | `3` | Menciones negativas para activar crisis |
| `CRISIS_WINDOW_MINUTES` | `60` | Ventana de tiempo para crisis (min) |

## Comandos Utiles

```bash
# Database
pnpm exec prisma studio     # Abrir Prisma Studio
pnpm exec prisma generate   # Generar cliente Prisma
pnpm exec prisma db push    # Push schema a DB

# Build
pnpm build                  # Build todos los packages

# Desarrollo
pnpm dev                    # Todos los packages
pnpm dev:web                # Solo dashboard
pnpm dev:workers            # Solo workers
pnpm dev:bot                # Solo bot
```

## Flujo de Datos

1. **Coleccion**: Workers recolectan articulos de RSS, GDELT, NewsData, Google
2. **Ingestion**: Articulos se guardan en DB con deduplicacion por URL
3. **Pre-filtrado**: AI valida si el keyword match es relevante para el cliente
4. **Matching**: Se buscan keywords de clientes activos en cada articulo
5. **Mencion**: Si hay match, se crea una mencion vinculada al cliente
6. **Analisis**: AI analiza el contexto y genera: sentimiento, relevancia, resumen, acciones sugeridas
7. **Clustering**: Menciones similares se agrupan automaticamente (mismo evento en multiples fuentes)
8. **Notificacion**: Alertas se envian via Telegram segun urgencia
9. **Digest**: Resumen diario se envia a las 8:00 AM con menciones agrupadas
10. **Topic Extraction**: AI extrae tema principal de cada mencion
11. **Weekly Insights**: Lunes 6:00 AM se generan insights accionables
12. **Emerging Topics**: Cada 4h se detectan y notifican temas nuevos con traccion

## Colectores

| Colector | Intervalo | Descripcion |
|----------|-----------|-------------|
| RSS | 10 min | 300+ feeds de medios mexicanos (desde DB) |
| NewsData | 30 min | API de noticias con filtro por pais |
| GDELT | 15 min | Base de datos global de eventos |
| Google CSE | 2 horas | Busqueda personalizada de Google |
| Social Media | 30 min | Instagram, TikTok, YouTube via EnsembleData API |

## Gestion de Fuentes RSS (Sprint 8)

El sistema ahora permite gestionar fuentes RSS desde la base de datos:

### Cobertura de Medios Mexicanos
- **Tier 1 (Nacional)**: 26 fuentes - El Universal, Milenio, Reforma, etc.
- **Tier 2 (Estatal)**: 136 fuentes - 4+ por cada estado de Mexico
- **Tier 3 (Municipal)**: 75+ fuentes - Ciudades principales
- **Especializados**: 28 fuentes - Tecnologia, deportes, negocios

### Pagina de Gestion (/dashboard/sources)
- Lista de fuentes con filtros (tipo, estado, tier, activo)
- CRUD completo para administradores
- Sistema de solicitud de nuevas fuentes
- Estadisticas de cobertura

### Sistema de Solicitudes
Los usuarios pueden solicitar nuevas fuentes. Workflow:
1. Usuario envia solicitud (nombre, URL, ubicacion)
2. Admin revisa y aprueba/rechaza
3. Si aprobada, se integra automaticamente al sistema

## Onboarding Magico (Sprint 8)

Nuevo wizard de 4 pasos para crear clientes en `/dashboard/clients/new`:

### Paso 1: Informacion Basica
- Nombre de la empresa/persona
- Descripcion opcional
- Industria

### Paso 2: Busqueda de Noticias
- Busca automaticamente noticias del ultimo mes
- Muestra progreso con animaciones
- Encuentra articulos relevantes en la base de datos

### Paso 3: Revision y Configuracion
- IA genera keywords sugeridos basados en noticias reales
- Usuario puede seleccionar/deseleccionar keywords
- Muestra competidores identificados
- Permite agregar keywords manualmente

### Paso 4: Completado
- Crea cliente con keywords configurados
- Importa menciones de articulos seleccionados
- Muestra resumen con confetti de celebracion

## Sistema de Configuracion

MediaBot tiene dos niveles de configuracion:

### 1. Variables de Entorno (requiere redeploy)

Configuraciones que afectan la inicializacion del sistema:
- Cron patterns de colectores
- Concurrencia de workers
- Rate limits
- Modelo de AI

### 2. Settings Dinamicos (sin redeploy)

Configuraciones que se pueden cambiar desde el dashboard `/dashboard/settings`:
- Umbrales de urgencia (CRITICAL, HIGH, MEDIUM)
- Threshold de pre-filtro AI
- Parametros de deteccion de crisis
- Limites de paginacion

Los settings dinamicos se cachean en memoria con TTL de 1 minuto para performance.

## Deteccion de Crisis

El sistema detecta automaticamente situaciones de crisis cuando:
- Se acumulan 3+ menciones negativas de un cliente en 60 minutos

Al detectar una crisis:
1. Se crea un `CrisisAlert` en la base de datos
2. Se envia notificacion especial via Telegram con emoji de alerta
3. El equipo puede marcar la crisis como resuelta, monitorear o descartar

## Clustering de Menciones

El sistema agrupa automaticamente menciones que tratan del mismo evento:
- Usa similaridad de keywords (Jaccard) para candidatos iniciales
- Valida con AI si dos articulos tratan del mismo evento
- Cache en memoria para evitar comparaciones repetidas
- El digest diario muestra "X fuentes reportaron sobre..." para eventos agrupados

## Generacion de Comunicados

Desde el detalle de una mencion, se puede generar un borrador de comunicado de prensa:
- Seleccionar tono: Profesional, Defensivo, Aclaratorio, Celebratorio
- Incluye titulo, cuerpo, mensajes clave, audiencia objetivo
- Funcionalidad de copiar y regenerar

## Exportar Menciones

Desde la lista de menciones se puede exportar a CSV:
- Aplica filtros activos (cliente, sentimiento)
- Incluye todos los campos: titulo, fuente, sentimiento, relevancia, resumen AI
- Compatible con Excel (UTF-8 con BOM)

## Media Intelligence (Sprint 6)

Dashboard avanzado de inteligencia de medios en `/dashboard/intelligence`:

### Share of Voice (SOV)
- Calcula porcentaje de menciones vs competidores
- Ponderado por tier de fuente (Tier 1 = 3x, Tier 2 = 2x, Tier 3 = 1x)
- Historico semanal de tendencia

### Deteccion de Temas
- Extraccion automatica de tema principal por IA
- Clustering de temas similares
- Deteccion de temas emergentes (>3 menciones en 24h)

### Scoring de Fuentes
- 76+ fuentes clasificadas en 3 tiers:
  - **Tier 1**: Medios nacionales (El Pais, CNN, BBC, etc.)
  - **Tier 2**: Regionales y especializados (Xataka, TechCrunch, etc.)
  - **Tier 3**: Digitales y blogs

### Recomendaciones IA Semanales
- Generadas automaticamente cada lunes
- Insights accionables basados en tendencias
- Incluidos en reporte PDF semanal

## UI/UX (Sprint 7)

### Dark Mode
- Toggle en sidebar para cambiar entre modo claro/oscuro/sistema
- Persistencia en localStorage
- Respeta preferencia del sistema (`prefers-color-scheme`)
- Sin flash de tema incorrecto al cargar

### Alertas de Temas Emergentes
- Deteccion automatica cada 4 horas de temas nuevos
- Notificacion via Telegram cuando un tema nuevo tiene >= 3 menciones en 24h
- No duplica notificaciones del mismo tema en 24h

### Dark Mode Completo (Sprint 9.1)
- Soporte completo en todas las páginas del dashboard
- Modales de edición y solicitud de fuentes con dark mode
- Badges de status, tier y sentimiento adaptados
- Tablas y formularios con colores consistentes

### Grounding Avanzado por Cliente (Sprint 9.2)
- Configuración granular de búsqueda automática con Gemini
- Worker de verificación de menciones bajas (cron diario 7:00 AM)
- Worker de grounding semanal programado (cron diario 6:00 AM)
- UI de configuración en detalle de cliente
- Búsqueda manual on-demand
- Rate limiting para proteger API de Gemini (5 jobs/min)

## Social Media Monitoring (Sprint 10)

Sistema completo de monitoreo de redes sociales integrado al dashboard.

### Plataformas Soportadas
- **Instagram**: Monitoreo de cuentas y hashtags
- **TikTok**: Detección de menciones en videos y búsqueda por keywords
- **YouTube**: Monitoreo de canales, búsqueda de videos y comentarios

> **Nota:** Twitter/X se mantiene en el schema para backward compatibility con datos existentes pero está oculto del UI.

### Funcionalidades
- **Colector Social**: Recolecta menciones cada 30 minutos via EnsembleData API
- **Análisis AI**: Sentimiento y relevancia de menciones sociales
- **Dashboard dedicado**: `/dashboard/social-mentions` con filtros avanzados, bulk select/delete/export
- **Métricas de engagement**: Likes, comentarios, shares, views
- **Detalle de mención**: Vista completa con métricas, contexto, generación de comunicados y borradores vinculados

### Configuración por Cliente
- Cuentas a monitorear (propias y competidores)
- Hashtags relevantes
- Keywords de búsqueda

## Gestión de Agencias (Sprint 11)

Sistema multi-tenant completo para gestionar múltiples agencias.

### Funcionalidades
- **Dashboard de agencias**: `/dashboard/agencies` con lista y estadísticas
- **Detalle de agencia**: `/dashboard/agencies/[id]` con clientes y usuarios
- **Super Admin**: Puede ver y gestionar todas las organizaciones
- **Límites configurables**: Máximo de clientes por agencia
- **Roles diferenciados**: ADMIN, SUPERVISOR, ANALYST por organización

## Troubleshooting

### Workers no inician
1. Verificar que Redis este corriendo: `docker-compose ps`
2. Verificar `REDIS_URL` en `.env`
3. Revisar logs: `pnpm dev:workers`

### Menciones no aparecen
1. Verificar que hay clientes activos con keywords
2. Revisar logs de colectores para ver articulos entrantes
3. Verificar threshold de pre-filtro (default: 0.6)

### Notificaciones no llegan
1. Verificar que el cliente tiene destinatarios Telegram configurados (nivel cliente, org o SuperAdmin)
2. Verificar que el bot esta en el grupo de Telegram
3. Verificar preferencias de notificacion (Settings > Notificaciones Telegram para SuperAdmin)
4. Revisar logs del notification worker

### Crisis no se detectan
1. Verificar settings de crisis en `/dashboard/settings`
2. Revisar logs: `docker logs mediabot-workers | grep Crisis`

## Testing

```bash
# Ejecutar todos los tests
pnpm test

# Tests con coverage
pnpm test -- --coverage

# Tests de un package especifico
pnpm --filter @mediabot/workers test
```

## Pipeline de Accion (Sprint 13)

El sistema cierra el ciclo completo: dato → insight → tarea → accion → medicion.

### Workflow de Respuestas

Borradores de comunicados de prensa con workflow de aprobacion:
- Generar comunicado desde detalle de mencion (media o social)
- Estados: `DRAFT → IN_REVIEW → APPROVED → PUBLISHED`
- 4 tonos: Profesional, Defensivo, Aclaratorio, Celebratorio
- Solo ADMIN/SUPERVISOR pueden aprobar
- Pagina dedicada: `/dashboard/responses`

### Gestion de Crisis

UI completa para gestionar alertas de crisis mediaticas:
- Lista con filtros por severidad (CRITICAL, HIGH, MEDIUM) y estado
- Detalle con timeline de eventos, notas y menciones negativas relacionadas
- Asignacion de responsable y cambio de estado
- Badge en sidebar con conteo de crisis activas
- Paginas: `/dashboard/crisis`, `/dashboard/crisis/[id]`

### Action Items

Seguimiento de acciones recomendadas por la IA:
- Creados automaticamente desde weekly insights
- Status tracking: PENDING → IN_PROGRESS → COMPLETED
- Seccion "Acciones Recomendadas" en pagina Intelligence

### Reglas de Alerta Configurables

Worker que evalua reglas personalizadas cada 30 minutos:
- 6 tipos: NEGATIVE_SPIKE, VOLUME_SURGE, NO_MENTIONS, SOV_DROP, COMPETITOR_SPIKE, SENTIMENT_SHIFT
- SOV_DROP compara SOV actual vs periodo anterior
- COMPETITOR_SPIKE detecta spikes via ClientCompetitor
- SENTIMENT_SHIFT detecta ratio de menciones negativas elevado
- Genera notificaciones in-app y Telegram cuando se cumplen condiciones
- Cooldown de 1 hora para evitar duplicados
- Pagina de gestion: `/dashboard/alert-rules` con CRUD completo, toggles y modal dinamico por tipo

## Sprint 14: Action Pipeline Completo

- Generacion de comunicados desde menciones sociales (boton "Generar comunicado" en social-mentions/[id])
- Secciones de borradores vinculados en detalle de mencion social
- Intelligence timeline con paginacion infinita, cards expandibles, action items y temas principales
- Insights semanales con recomendaciones accionables

## AI Media Brief (Sprint 15)

Sistema de resumen ejecutivo diario generado con IA.

### Funcionalidades
- **Generacion automatica**: Brief diario integrado al digest (cron 8:00 AM)
- **Contenido AI**: Highlights, comparativa vs dia anterior, watchList, temas emergentes, acciones pendientes
- **Modelo**: `DailyBrief` con unique constraint `[clientId, date]`
- **Dashboard**: `/dashboard/briefs` con card destacada del ultimo brief + timeline colapsable con infinite scroll
- **Intelligence**: Seccion "Ultimo Brief" con highlights, watchList y link a briefs
- **Telegram**: Seccion de brief incluida en el digest diario

## Campaign Tracking (Sprint 16)

Sistema de seguimiento de campanas para agencias de PR.

### Funcionalidades
- **CRUD completo**: Crear, editar, eliminar campanas con nombre, descripcion, fechas y presupuesto
- **Auto-vinculacion**: Vincula automaticamente menciones del cliente dentro del rango de fechas de la campana
- **Comparativa pre-campana**: Calcula metricas del mismo periodo antes del inicio vs durante (delta %)
- **Crisis linkage**: Campo opcional `crisisAlertId` para vincular campanas de defensa con crisis
- **Notas**: Timeline de notas por campana con tipos configurables
- **Estados**: DRAFT, ACTIVE, PAUSED, COMPLETED, CANCELLED

### Paginas
- `/dashboard/campaigns` — Lista con filtros por cliente y status, modal de crear/editar
- `/dashboard/campaigns/[id]` — Detalle con stats, comparativa, menciones vinculadas, notas

## Sistema de Notificaciones Telegram

Sistema multi-nivel de notificaciones con 10 tipos y preferencias configurables.

### 3 Niveles de Destinatarios
1. **Nivel cliente**: `TelegramRecipient` — recibe notificaciones solo del cliente vinculado
2. **Nivel organizacion**: `OrgTelegramRecipient` — recibe notificaciones de TODOS los clientes de la org
3. **Nivel SuperAdmin**: Via `User.telegramUserId` — recibe notificaciones de TODO el sistema

### 10 Tipos de Notificacion
Alertas de menciones, Alertas de crisis, Temas emergentes, Digest diario, Reglas de alerta, Cambio de estado de crisis, Borrador de comunicado, Brief diario listo, Reporte de campana, Reporte semanal

### Preferencias
- Cada tipo puede activarse/desactivarse individualmente por destinatario
- SuperAdmin configura desde `/dashboard/settings` (seccion "Notificaciones Telegram")
- Recipients de org se gestionan desde `/dashboard/agencies/[id]`
- Bot command `/vincular_org <nombre_org>` para vincular grupo a organizacion
- Deduplicacion por chatId (cliente > org > superadmin)

## Documentacion Adicional

- [ARCHITECTURE.md](docs/ARCHITECTURE.md) - Arquitectura detallada
- [PLAN.md](docs/PLAN.md) - Roadmap y decisiones tecnicas
- [API Reference](docs/api/README.md) - Documentacion de 18 routers tRPC
- [Action Pipeline](docs/action-pipeline.md) - Pipeline de datos accionables
- [Environment Reference](docs/env-reference.md) - Variables de entorno
- [Troubleshooting](docs/troubleshooting.md) - Guia de resolucion de problemas
- [Development Guide](docs/development-guide.md) - Guia para desarrolladores

## Licencia

Privado - Todos los derechos reservados.
