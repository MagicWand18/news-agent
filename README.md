# MediaBot

Sistema de monitoreo de medios con inteligencia artificial para clientes corporativos.

## Stack Tecnologico

- **Frontend**: Next.js 14, React, TailwindCSS, tRPC
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
npm install
npm run db:generate
npm run db:push
```

### 5. Ejecutar en desarrollo

```bash
# Terminal 1: Workers
npm run dev:workers

# Terminal 2: Web Dashboard
npm run dev:web

# Terminal 3: Telegram Bot (opcional)
npm run dev:bot
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

### Opcionales - Configuracion de Crons

| Variable | Default | Descripcion |
|----------|---------|-------------|
| `COLLECTOR_GDELT_CRON` | `*/15 * * * *` | Cron para colector GDELT |
| `COLLECTOR_NEWSDATA_CRON` | `*/30 * * * *` | Cron para colector NewsData |
| `COLLECTOR_RSS_CRON` | `*/10 * * * *` | Cron para colector RSS |
| `COLLECTOR_GOOGLE_CRON` | `0 */2 * * *` | Cron para colector Google CSE |
| `DIGEST_CRON` | `0 8 * * *` | Cron para digest diario |
| `EMERGING_TOPICS_CRON` | `0 */4 * * *` | Cron para alertas de temas emergentes |

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
npm run db:studio      # Abrir Prisma Studio
npm run db:migrate     # Crear migracion
npm run db:push        # Push schema a DB

# Build
npm run build          # Build todos los packages

# Desarrollo
npm run dev:web        # Solo dashboard
npm run dev:workers    # Solo workers
npm run dev:bot        # Solo bot
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

## Troubleshooting

### Workers no inician
1. Verificar que Redis este corriendo: `docker-compose ps`
2. Verificar `REDIS_URL` en `.env`
3. Revisar logs: `npm run dev:workers`

### Menciones no aparecen
1. Verificar que hay clientes activos con keywords
2. Revisar logs de colectores para ver articulos entrantes
3. Verificar threshold de pre-filtro (default: 0.6)

### Notificaciones no llegan
1. Verificar que el cliente tiene `telegramGroupId` configurado
2. Verificar que el bot esta en el grupo de Telegram
3. Revisar logs del notification worker

### Crisis no se detectan
1. Verificar settings de crisis en `/dashboard/settings`
2. Revisar logs: `docker logs mediabot-workers | grep Crisis`

## Testing

```bash
# Ejecutar todos los tests
npm test

# Tests con coverage
npm test -- --coverage

# Tests de un package especifico
npm test -w packages/workers
```

## Documentacion Adicional

- [ARCHITECTURE.md](docs/ARCHITECTURE.md) - Arquitectura detallada
- [PLAN.md](docs/PLAN.md) - Roadmap y decisiones tecnicas

## Licencia

Privado - Todos los derechos reservados.
