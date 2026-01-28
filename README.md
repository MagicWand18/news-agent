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

| Variable | Requerida | Descripcion |
|----------|-----------|-------------|
| `DATABASE_URL` | Si | URL de conexion PostgreSQL |
| `REDIS_URL` | Si | URL de conexion Redis |
| `TELEGRAM_BOT_TOKEN` | Si | Token del bot de Telegram |
| `ANTHROPIC_API_KEY` | Si | API key de Anthropic (Claude) |
| `NEXTAUTH_SECRET` | Si | Secret para NextAuth |
| `NEXTAUTH_URL` | Si | URL base de la app web |
| `GOOGLE_CSE_API_KEY` | No | API key de Google Custom Search |
| `GOOGLE_CSE_CX` | No | ID del Custom Search Engine |
| `NEWSDATA_API_KEY` | No | API key de NewsData.io |

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
3. **Matching**: Se buscan keywords de clientes activos en cada articulo
4. **Mencion**: Si hay match, se crea una mencion vinculada al cliente
5. **Analisis**: AI analiza el contexto y genera: sentimiento, relevancia, resumen, acciones sugeridas
6. **Notificacion**: Alertas se envian via Telegram segun urgencia
7. **Digest**: Resumen diario se envia a las 8:00 AM

## Colectores

| Colector | Intervalo | Descripcion |
|----------|-----------|-------------|
| RSS | 10 min | 9 feeds de medios mexicanos e internacionales |
| NewsData | 30 min | API de noticias con filtro por pais |
| GDELT | 15 min | Base de datos global de eventos |
| Google CSE | 2 horas | Busqueda personalizada de Google |

## Licencia

Privado - Todos los derechos reservados.
