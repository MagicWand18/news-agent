# Plan de Desarrollo - MediaBot

## Vision del Producto

MediaBot es un sistema de monitoreo de medios que permite a agencias de comunicacion rastrear menciones de sus clientes en noticias, analizar el sentimiento con IA, y generar alertas y reportes automaticos.

## Estado Actual

### Implementado

| Feature | Estado | Notas |
|---------|--------|-------|
| Coleccion RSS | OK | 9 feeds configurados |
| Coleccion NewsData | OK | API funcionando |
| Coleccion GDELT | OK | Parser funcionando |
| Coleccion Google CSE | OK | Requiere API key |
| Deduplicacion | OK | Por URL y hash de contenido |
| Matching de keywords | OK | Case-insensitive, sin acentos |
| Analisis AI | OK | Claude 3.5 Haiku (singleton) |
| Dashboard web | OK | Next.js 15 + tRPC |
| Autenticacion | OK | NextAuth |
| Bot Telegram | OK | Grammy |
| Alertas Telegram | OK | Por urgencia |
| Digest diario | OK | 8:00 AM |
| Onboarding AI | OK | Genera keywords automaticas |
| Sistema de tareas | OK | CRUD basico |
| **Pre-filtrado AI** | OK | Reduce falsos positivos (Fase 2A) |
| **Deteccion de Crisis** | OK | Alertas automaticas (Fase 2B) |
| **Settings Dinamicos** | OK | Configuracion sin redeploy |
| **Clustering de Menciones** | OK | Agrupa menciones del mismo evento (Fase 2C) |
| **Respuesta On-Demand** | OK | Genera borradores de comunicado (Fase 2D) |
| **Exportar CSV** | OK | Descarga menciones filtradas |
| **Dashboard Analytics** | OK | Graficas de tendencias (Sprint 4) |
| **Reportes PDF** | OK | Generacion semanal automatica (Sprint 4) |
| **Analisis Competidores** | OK | Comparacion de menciones (Sprint 4) |
| **Timeline Menciones** | OK | Vista tipo red social (Sprint 5) |
| **Sistema de Filtros** | OK | Componentes reutilizables (Sprint 5) |
| **Animaciones UI** | OK | CountUp en KPIs (Sprint 5) |
| **Share of Voice** | OK | Calculo SOV vs competidores (Sprint 6) |
| **Deteccion de Temas** | OK | Extraccion automatica con IA (Sprint 6) |
| **Scoring de Fuentes** | OK | Tiers 1/2/3 con ponderacion (Sprint 6) |
| **Recomendaciones IA** | OK | Insights semanales automaticos (Sprint 6) |
| **Pagina Intelligence** | OK | Dashboard de inteligencia (Sprint 6) |
| **Dark Mode** | OK | Toggle tema oscuro con persistencia (Sprint 7) |
| **Dark Mode Completo** | OK | UI/UX corregida en todas las páginas (Sprint 9.1) |
| **Aurora Background** | OK | Efecto visual animado en login (Sprint 7) |
| **Filtros Modernos Tareas** | OK | FilterBar/FilterChips en tareas (Sprint 7) |
| **Alertas Temas Emergentes** | OK | Notificaciones Telegram automaticas (Sprint 7) |
| **Fuentes RSS Expandidas** | OK | 300+ medios mexicanos en DB (Sprint 8) |
| **Gestion de Fuentes** | OK | CRUD y solicitudes de fuentes (Sprint 8) |
| **Onboarding Magico** | OK | Wizard de 4 pasos con IA (Sprint 8) |
| **Busqueda de Noticias** | OK | Importar menciones historicas (Sprint 8) |
| **Grounding Avanzado** | OK | Búsqueda automática configurable por cliente (Sprint 9.2) |
| **Grounding Semanal** | OK | Ejecución programada semanal por cliente (Sprint 9.2) |
| **Singleton Anthropic** | OK | Cliente AI centralizado con validación (Sprint 9.3) |
| **Cache con límite** | OK | Clustering cache limitado a 1000 entradas (Sprint 9.3) |
| **Notificaciones In-App** | OK | Bell icon, dropdown, centro de notificaciones (Sprint 10) |
| **Monitoreo Social** | OK | Instagram, TikTok, YouTube via EnsembleData (Sprint 10) |
| **Multi-Tenant** | OK | Organizaciones, Super Admin, filtro por org (Sprint 11) |
| **Pipeline de Acción** | OK | Crisis, Respuestas, AlertRules, ActionItems (Sprint 13) |
| **Action Pipeline Completo** | OK | Generar comunicado social, AlertRule CRUD, evaluaciones avanzadas, Insights Timeline (Sprint 14) |
| **Bugfix Raw SQL** | OK | Eliminado Prisma.empty, usar $queryRawUnsafe (2026-02-15) |

### Funciones de IA

| Funcion | Tipo | Trigger | Archivo |
|---------|------|---------|---------|
| `getAnthropicClient` | Singleton | Todas las funciones AI | `shared/ai-client.ts` |
| `analyzeMention` | Automatico | Nueva mencion | `analysis/ai.ts` |
| `preFilterArticle` | Automatico | Antes de crear mencion | `analysis/ai.ts:94` |
| `runOnboarding` | Automatico | Nuevo cliente | `analysis/ai.ts:156` |
| `generateResponse` | On-demand | Boton en UI | `analysis/ai.ts:156` / `mentions.ts` |
| `generateDigestSummary` | Automatico | Cron 8:00 AM | `analysis/ai.ts:225` |
| `checkForCrisis` | Automatico | Mencion NEGATIVE | `analysis/crisis-detector.ts` |
| `findClusterParent` | Automatico | Post-analisis (relevance >= 5) | `analysis/clustering.ts` |
| `extractTopic` | Automatico | Post-analisis | `analysis/ai.ts:347` |
| `generateWeeklyInsights` | Cron semanal | Lunes 6:00 AM | `analysis/ai.ts:407` |
| `detectEmergingTopics` | Cron cada 4h | Automatico | `analysis/topic-extractor.ts:118` |
| `runEnhancedOnboarding` | On-demand | Wizard nuevo cliente | `analysis/ai.ts` |
| `executeGroundingSearch` | On-demand/Auto | Búsqueda de noticias con Gemini | `grounding/grounding-service.ts` |
| `checkLowMentions` | Cron diario | Verificación de menciones bajas | `grounding/grounding-service.ts` |

### Pendiente / En Progreso

| Feature | Prioridad | Descripcion |
|---------|-----------|-------------|
| ~~Integracion Twitter/X~~ | ~~Media~~ | ✅ Implementado via EnsembleData (Sprint 10) |
| Integracion YouTube | Baja | Deteccion de menciones en videos |
| ~~Mas fuentes RSS~~ | ~~Baja~~ | ✅ 300+ feeds mexicanos (Sprint 8) |

## Problemas Conocidos

### Resueltos

- [x] **Cron jobs no repiten**: BullMQ v5.1.0 tenia bugs con `upsertJobScheduler`. Solucion: actualizar a v5.56+ y usar cron patterns.
- [x] **Falsos positivos en menciones**: Palabras comunes como "presidencia" generaban menciones irrelevantes. Solucion: Pre-filtrado con AI.
- [x] **Onboarding no se dispara**: Conectado trigger al crear cliente.

### Pendientes

- [ ] **Otros clientes sin menciones**: Keywords muy especificas que no aparecen en noticias actuales

## Roadmap

### Fase 1: Estabilizacion - COMPLETADA

- [x] Documentar arquitectura
- [x] Arreglar cron jobs de BullMQ
- [x] Conectar onboarding a creacion de cliente
- [x] Crear script de onboarding manual
- [x] Verificar TypeScript compila

### Fase 2: Funciones de IA Avanzadas - COMPLETADA

#### Fase 2A: Pre-filtrado Inteligente - COMPLETADA

- [x] Nueva funcion `preFilterArticle()` en ai.ts
- [x] Integrar en flujo de ingest antes de crear menciones
- [x] Threshold de confianza configurable (0.6)
- [x] Fail-open en caso de error
- [x] Tests unitarios completos

#### Fase 2B: Deteccion de Crisis - COMPLETADA

- [x] Modelo `CrisisAlert` en Prisma (con enums CrisisTriggerType, CrisisSeverity, CrisisStatus)
- [x] Funcion `checkForCrisis()` en crisis-detector.ts
- [x] Funcion `createCrisisAlert()` para crear alertas
- [x] Trigger automatico al analizar mencion NEGATIVE
- [x] Notificacion especial en Telegram con emoji de alerta
- [x] Sistema de settings dinamicos para umbrales de crisis

#### Fase 2C: Clustering de Noticias - COMPLETADA

- [x] Campos `parentMentionId`, `clusterScore` en Mention
- [x] Modulo `clustering.ts` con `findClusterParent()`
- [x] Algoritmo hibrido: Jaccard similarity + AI comparison
- [x] Cache en memoria para evitar comparaciones repetidas
- [x] Integracion en analysis worker post-analisis
- [x] Digest agrupado ("X fuentes reportaron sobre...")

#### Fase 2D: Respuesta On-Demand - COMPLETADA

- [x] Funcion `generateResponse()` en ai.ts
- [x] Endpoint tRPC `mentions.generateResponse` con seleccion de tono
- [x] UI modal con selector de tono (Professional, Defensive, Clarification, Celebratory)
- [x] Funcionalidad de copiar y regenerar

#### Fase 2E: Analisis de Competidores - COMPLETADA (Sprint 4)

- [x] Keywords con tipo COMPETITOR
- [x] Seccion de competidores en detalle de cliente
- [x] Grafica comparativa de menciones

### Fase 3: Reportes y Analytics - COMPLETADA

- [x] Exportar menciones a CSV (con filtros aplicados)
- [x] Dashboard de Analytics con graficas (Sprint 4)
  - [x] Menciones por dia
  - [x] Tendencia de sentimiento por semana
  - [x] Distribucion de urgencia (pie chart)
  - [x] Top fuentes y keywords (bar charts)
- [x] Reporte PDF semanal automatico (Sprint 4)
  - [x] Generador con PDFKit
  - [x] Envio via Telegram domingos 8pm
  - [x] Resumen ejecutivo con metricas

### Fase 4: UI/UX Moderno - COMPLETADA (Sprint 5)

- [x] Timeline de menciones estilo red social
  - [x] Linea vertical conectora
  - [x] Cards con borde por sentimiento
  - [x] Animacion fadeInUp escalonada
- [x] Sistema de filtros global reutilizable
  - [x] FilterBar, FilterSelect, FilterDateRange, FilterChips
  - [x] Aplicado en Menciones, Analytics, Clientes
- [x] Animaciones modernas
  - [x] CountUp en KPIs con easeOutExpo
  - [x] Soporte prefers-reduced-motion

### Fase 5: Polish y Escala - EN PROGRESO

- [x] Dark mode toggle (Sprint 7)
- [x] Aurora background en login (Sprint 7)
- [x] Filtros avanzados en Tareas (Sprint 7)
- [x] Alertas de temas emergentes (Sprint 7)
- [ ] Transiciones de pagina completas
- [ ] Agregar mas fuentes RSS
- [ ] Integrar Twitter/X API
- [ ] Integrar YouTube mentions

## Sprints Completados

### Sprint 4 (Completado)
- Analytics Dashboard (`/dashboard/analytics`)
- Reportes PDF semanales (workers + cron)
- Analisis de competidores (detalle cliente)

### Sprint 5 (Completado - 2025-01-28)
- Timeline de menciones (dashboard principal)
- Sistema de filtros global (4 componentes)
- Animaciones CountUp (KPIs)
- Filtros mejorados en Menciones, Analytics, Clientes

### Sprint 6 (Completado - 2026-01-28)
- **Share of Voice**: Calculo SOV con ponderacion por tier de fuente
- **Deteccion de Temas**: Extraccion automatica con Claude API y clustering
- **Scoring de Fuentes**: 76+ fuentes clasificadas en Tier 1/2/3
- **Recomendaciones IA**: Insights semanales generados automaticamente
- **Pagina Intelligence**: Dashboard con KPIs, SOV trend, temas, insights
- **SOV en Cliente**: Seccion con donut chart y tendencia historica
- **Temas en Analytics**: Tag cloud y temas emergentes
- **PDF mejorado**: Incluye SOV, temas e insights

### Sprint 7 (Completado - 2026-01-28)
- **Dark Mode**: Toggle de tema con persistencia en localStorage
- **Aurora Background**: Efecto visual animado en pagina de login
- **Filtros Modernos Tareas**: FilterBar, FilterSelect, FilterChips
- **Alertas Temas Emergentes**: Deteccion automatica cada 4h con notificaciones Telegram
- **Modelo EmergingTopicNotification**: Tracking de notificaciones enviadas
- **Dark Mode en Componentes**: StatCard, MentionTimeline, FilterBar, etc.

### Sprint 9.1 (Completado - 2026-01-28)
- **Dark Mode Completo**: Correcciones UI/UX en todas las páginas
  - Página Fuentes: modales, tabs, solicitudes, badges de status
  - Página Intelligence: TopicRow, InsightCard, TierCard, EmptyState
  - Detalle Cliente: SOVSection, CompetitorComparison, Recent Mentions
  - Menciones: sentimentConfig y urgencyConfig con dark variants
- **Ubicación Nacional**: Medios tipo NATIONAL muestran "Nacional" en columna ubicación
- **Renombrar Estado → Estatus**: Evita confusión con ubicación geográfica

### Sprint 9.2: Grounding Avanzado por Cliente (Completado - 2026-01-29)
- **Configuración granular de grounding**: Cada cliente puede configurar umbrales individuales
  - `groundingEnabled`: Habilitar/deshabilitar grounding automático
  - `minDailyMentions`: Mínimo de menciones diarias esperadas (1-20)
  - `consecutiveDaysThreshold`: Días consecutivos bajo umbral para disparar (1-10)
  - `groundingArticleCount`: Artículos a buscar en cada grounding (5-30)
  - `weeklyGroundingEnabled`: Habilitar grounding semanal programado
  - `weeklyGroundingDay`: Día de la semana para grounding semanal (0-6)
- **Worker de verificación de menciones bajas**: Cron diario (7:00 AM) que verifica clientes con pocas menciones
- **Worker de grounding semanal**: Cron diario (6:00 AM) que ejecuta grounding para clientes configurados
- **Worker de ejecución**: Procesa jobs de grounding con rate limiting (5/min, concurrencia 2)
- **UI de configuración**: Sección en detalle de cliente para gestionar grounding
- **Búsqueda manual**: Botón para ejecutar grounding on-demand

### Sprint 9.3: Correcciones Post Dev-Check (Completado - 2026-01-29)
- **Seguridad**: Actualización de Next.js 14.2.35 → 15.0.0 (vulnerabilidad DoS)
- **Singleton Anthropic**: Cliente AI centralizado en `@mediabot/shared`
  - Validación de API key antes de crear instancia
  - Función `getAnthropicClient()` exportada
  - `resetAnthropicClient()` marcada como @internal para tests
- **Cache con límite**: Clustering cache limitado a 1000 entradas
  - Función `addToCache()` con limpieza automática
  - Elimina 20% de entradas más antiguas al exceder límite
- **Limpieza de código**: Eliminado import dinámico redundante en `clients.ts`

## Metricas de Exito

| Metrica | Target | Actual |
|---------|--------|--------|
| Articulos/dia | 500+ | ~100 |
| Latencia coleccion->alerta | < 5 min | ~2 min |
| Precision de matching | > 90% | ~95% (con pre-filtro) |
| Uptime | 99.9% | No medido |

## Costos AI (Claude Haiku)

| Funcion | Frecuencia | Costo/unidad | Costo/dia estimado |
|---------|------------|--------------|-------------------|
| analyzeMention | ~50/dia | $0.001 | $0.05 |
| preFilterArticle | ~100/dia | $0.0005 | $0.05 |
| generateDigestSummary | 1/dia | $0.001 | $0.001 |
| runOnboarding | ~1/semana | $0.002 | ~$0 |
| **TOTAL** | | | **~$0.10/dia** |

## Decisiones Tecnicas

### Modelo de AI

**Seleccion**: Claude 3.5 Haiku (`claude-3-5-haiku-20241022`)

**Razon**: Balance entre costo y calidad. Haiku es ~20x mas barato que Opus y suficiente para analisis de sentimiento y extraccion de informacion.

### Pre-filtrado AI

**Umbral de confianza**: 0.6

**Razon**: Valores menores dejan pasar demasiados falsos positivos. Valores mayores pueden filtrar menciones legitimas. 0.6 balancea precision y recall.

**Comportamiento fail-open**: Si el pre-filtro falla (error de API, timeout), la mencion se crea igualmente para no perder cobertura.

### Cron vs Interval

**Seleccion**: Cron patterns (`pattern: "*/10 * * * *"`) en lugar de intervals (`every: 600000`)

**Razon**: BullMQ v5.1.0 tenia bugs con `every` que causaban que los jobs dejaran de repetirse. Los cron patterns son mas confiables.

### Monorepo

**Seleccion**: npm workspaces con packages separados

**Razon**: Permite compartir tipos y configuracion entre web, workers y bot, mientras mantiene deployments independientes.

### Sistema de Filtros (Sprint 5)

**Seleccion**: Componentes reutilizables sin dependencias externas

**Razon**: Mantiene bundle size minimo, usa CSS puro + React hooks para animaciones, filtrado client-side donde es posible.

## Sprint 8: Fuentes Expandidas + Onboarding Magico - COMPLETADO

### Implementado

| Feature | Estado | Archivo(s) |
|---------|--------|------------|
| Modelo RssSource | OK | `prisma/schema.prisma` |
| Modelo SourceRequest | OK | `prisma/schema.prisma` |
| Seed 300+ fuentes | OK | `prisma/seed-rss-sources.ts` |
| Colector RSS desde DB | OK | `packages/workers/src/collectors/rss.ts` |
| API tRPC de fuentes | OK | `packages/web/src/server/routers/sources.ts` |
| Pagina /dashboard/sources | OK | `packages/web/src/app/dashboard/sources/page.tsx` |
| Wizard de onboarding | OK | `packages/web/src/app/dashboard/clients/new/page.tsx` |
| Componentes magic-effects | OK | `packages/web/src/components/client-wizard/` |
| runEnhancedOnboarding | OK | `packages/workers/src/analysis/ai.ts` |

### Cobertura de Medios

- **Nacionales (Tier 1)**: 26 fuentes
- **Estatales (Tier 2)**: 136 fuentes (4+ por estado)
- **Municipales (Tier 3)**: 75+ fuentes
- **Especializados**: 28 fuentes (tech, deportes, negocios)
- **Total**: 300+ medios mexicanos

### Wizard de Onboarding

1. **Info**: Nombre, descripcion, industria
2. **Buscar**: Busca noticias del ultimo mes en la DB
3. **Revisar**: Muestra keywords sugeridos y articulos encontrados
4. **Completo**: Crea cliente, keywords y menciones en un solo paso

### Sistema de Solicitud de Fuentes

- Usuarios pueden solicitar nuevas fuentes
- Admins aprueban/rechazan/integran
- Workflow: PENDING → APPROVED → INTEGRATED

## Sprint 9: Notificaciones In-App + E2E Testing

### Objetivo

1. Sistema de notificaciones in-app con centro de notificaciones
2. Suite completa de tests E2E con Playwright
3. Seed de fuentes RSS en produccion
4. Mejoras de UX menores

---

### Parte 1: Centro de Notificaciones In-App

#### 1.1 Modelo de Datos

```prisma
model Notification {
  id        String             @id @default(cuid())
  userId    String
  user      User               @relation(fields: [userId], references: [id])
  type      NotificationType
  title     String
  message   String
  data      Json?              // Metadata adicional (mentionId, clientId, etc.)
  read      Boolean            @default(false)
  readAt    DateTime?
  createdAt DateTime           @default(now())

  @@index([userId, read])
  @@index([createdAt])
}

enum NotificationType {
  MENTION_CRITICAL    // Mencion critica
  MENTION_HIGH        // Mencion alta prioridad
  CRISIS_ALERT        // Alerta de crisis
  WEEKLY_REPORT       // Reporte semanal listo
  EMERGING_TOPIC      // Tema emergente detectado
  SYSTEM              // Notificaciones del sistema
}
```

#### 1.2 Componentes UI

| Componente | Descripcion |
|------------|-------------|
| `NotificationBell` | Icono campana con badge contador |
| `NotificationDropdown` | Dropdown con lista de notificaciones |
| `NotificationItem` | Card individual con icono por tipo |
| `NotificationCenter` | Pagina `/dashboard/notifications` |

#### 1.3 Funcionalidades

- Badge con contador de no leidas
- Dropdown con ultimas 10 notificaciones
- Marcar como leida al hacer click
- Marcar todas como leidas
- Pagina completa con filtros y paginacion
- Notificaciones en tiempo real (polling cada 30s)

#### 1.4 Integracion con Sistema Existente

Crear notificaciones automaticamente cuando:
- Nueva mencion CRITICAL o HIGH
- Crisis detectada
- Tema emergente detectado
- Reporte semanal generado

---

### Parte 2: Tests E2E con Playwright

#### 2.1 Estructura de Tests

```
tests/
└── e2e/
    ├── playwright.config.ts
    ├── fixtures/
    │   └── auth.ts           # Login fixture
    ├── pages/
    │   ├── login.spec.ts
    │   ├── dashboard.spec.ts
    │   ├── clients.spec.ts
    │   ├── mentions.spec.ts
    │   ├── sources.spec.ts
    │   ├── analytics.spec.ts
    │   └── intelligence.spec.ts
    └── flows/
        ├── onboarding.spec.ts
        ├── source-request.spec.ts
        └── mention-response.spec.ts
```

#### 2.2 Casos de Prueba

| Test | Descripcion |
|------|-------------|
| Login Flow | Login valido, credenciales incorrectas, redirect |
| Dashboard | KPIs cargan, navegacion funciona |
| Clients CRUD | Crear, editar, eliminar cliente |
| Onboarding Wizard | Flujo completo de 4 pasos |
| Sources Management | CRUD fuentes, solicitudes |
| Mentions | Filtros, exportar CSV, generar comunicado |
| Analytics | Graficas renderizan, filtros funcionan |
| Intelligence | SOV, temas, insights cargan |

#### 2.3 Scripts npm

```json
{
  "test:e2e": "playwright test",
  "test:e2e:ui": "playwright test --ui",
  "test:e2e:headed": "playwright test --headed",
  "test:e2e:report": "playwright show-report"
}
```

---

### Parte 3: Seed Produccion

#### 3.1 Script de Seed Remoto

Crear script para ejecutar seed en produccion:

```bash
# deploy/seed-production.sh
ssh -i ~/.ssh/newsaibot-telegram-ssh root@159.65.97.78 \
  "cd /opt/mediabot && docker compose -f docker-compose.prod.yml exec -T web npx prisma db seed"
```

#### 3.2 Seed de Fuentes RSS

Ejecutar `prisma/seed-rss-sources.ts` para poblar las 300+ fuentes mexicanas.

---

### Parte 4: Mejoras UX

#### 4.1 Sidebar Colapsable

- Toggle para colapsar sidebar a iconos
- Persistencia en localStorage
- Animacion suave de colapso

#### 4.2 Loading Skeletons

Agregar skeletons en:
- Lista de menciones
- Dashboard KPIs
- Tabla de fuentes
- Lista de clientes

#### 4.3 Empty States

Mejorar estados vacios con:
- Ilustraciones SVG
- Texto explicativo
- CTA para crear contenido

---

### Orden de Implementacion

1. **Dia 1-2**: Modelo Notification + API tRPC
2. **Dia 3-4**: UI de notificaciones (bell, dropdown, page)
3. **Dia 5**: Integracion con workers existentes
4. **Dia 6-7**: Setup Playwright + tests basicos
5. **Dia 8-9**: Tests de flujos completos
6. **Dia 10**: Seed produccion + mejoras UX

---

### Criterios de Aceptacion

#### Notificaciones
- [ ] Modelo Notification en Prisma
- [ ] API: list, markAsRead, markAllAsRead
- [ ] NotificationBell con badge en sidebar
- [ ] Dropdown funcional con ultimas 10
- [ ] Pagina /dashboard/notifications
- [ ] Notificaciones automaticas en eventos clave

#### Tests E2E
- [ ] Playwright configurado en monorepo
- [ ] Tests de login/logout
- [ ] Tests de navegacion principal
- [ ] Tests de CRUD clientes
- [ ] Tests de wizard onboarding
- [ ] Tests de fuentes RSS
- [ ] CI pipeline con tests (opcional)

#### Produccion
- [ ] 300+ fuentes RSS seeded
- [ ] Colector RSS funcionando con fuentes de DB
- [ ] Loading skeletons en paginas principales

---

### Archivos Principales

| Archivo | Proposito |
|---------|-----------|
| `prisma/schema.prisma` | Modelo Notification |
| `packages/web/src/server/routers/notifications.ts` | API tRPC |
| `packages/web/src/components/notifications/` | Componentes UI |
| `packages/web/src/app/dashboard/notifications/` | Pagina centro |
| `packages/workers/src/notification-creator.ts` | Crear notifs |
| `tests/e2e/` | Suite Playwright |
| `playwright.config.ts` | Config Playwright |

---

## Sprint 10: Notificaciones In-App + Mejoras UX (Completado)

### Objetivo
Sistema de notificaciones en tiempo real dentro del dashboard, sin depender de Telegram.

### Modelo de Datos
```prisma
model Notification {
  id        String             @id @default(cuid())
  userId    String
  user      User               @relation(fields: [userId], references: [id])
  type      NotificationType
  title     String
  message   String
  data      Json?              // Metadata (mentionId, clientId, etc.)
  read      Boolean            @default(false)
  readAt    DateTime?
  createdAt DateTime           @default(now())

  @@index([userId, read])
  @@index([createdAt])
}

enum NotificationType {
  MENTION_CRITICAL
  MENTION_HIGH
  CRISIS_ALERT
  WEEKLY_REPORT
  EMERGING_TOPIC
  SYSTEM
}
```

### Componentes UI
| Componente | Descripción |
|------------|-------------|
| `NotificationBell` | Ícono campana con badge contador en sidebar |
| `NotificationDropdown` | Dropdown con últimas 10 notificaciones |
| `NotificationItem` | Card individual con ícono por tipo |
| `/dashboard/notifications` | Página completa con filtros |

### Funcionalidades
- [x] Badge con contador de no leídas
- [x] Dropdown con últimas 10 notificaciones
- [x] Marcar como leída al hacer click
- [x] Marcar todas como leídas
- [x] Página completa con filtros y paginación (`/dashboard/notifications`)
- [x] Polling cada 30s para actualizaciones

### Integraciones Automáticas
Crear notificación cuando:
- Nueva mención CRITICAL o HIGH
- Crisis detectada
- Tema emergente detectado
- Reporte semanal generado

### Mejoras UX Adicionales
- [ ] Loading skeletons en tablas principales
- [ ] Empty states mejorados con ilustraciones
- [ ] Sidebar colapsable con persistencia

### Archivos a Crear/Modificar
| Archivo | Propósito |
|---------|-----------|
| `prisma/schema.prisma` | Modelo Notification |
| `packages/web/src/server/routers/notifications.ts` | API tRPC |
| `packages/web/src/components/notifications/` | Componentes UI |
| `packages/web/src/app/dashboard/notifications/` | Página centro |
| `packages/workers/src/notification-creator.ts` | Crear notificaciones |

---

## Sprint 10: Social Media Monitoring (Completado - 2026-01-30)

Sistema completo de monitoreo de redes sociales:

### Implementado
| Feature | Estado | Archivo(s) |
|---------|--------|------------|
| Modelos SocialAccount/SocialMention | OK | `prisma/schema.prisma` |
| Colector Social (EnsembleData) | OK | `packages/workers/src/collectors/social.ts` |
| Social Worker (análisis AI) | OK | `packages/workers/src/analysis/social-worker.ts` |
| API tRPC social | OK | `packages/web/src/server/routers/social.ts` |
| Página /dashboard/social-mentions | OK | `packages/web/src/app/dashboard/social-mentions/page.tsx` |
| Detalle de mención social | OK | `packages/web/src/app/dashboard/social-mentions/[id]/page.tsx` |
| Configuración por cliente | OK | Sección en detalle de cliente |

### Plataformas Soportadas
- **Twitter/X**: Búsqueda por handle, hashtag, keywords
- **Instagram**: Monitoreo de cuentas y hashtags
- **TikTok**: Detección de menciones en videos

### Métricas Capturadas
- Likes, comentarios, shares, views
- Seguidores del autor
- Engagement rate calculado

---

## Sprint 11: Gestión de Agencias (En progreso)

Sistema multi-tenant para gestionar múltiples agencias:

### Implementado
| Feature | Estado | Archivo(s) |
|---------|--------|------------|
| Página /dashboard/agencies | OK | `packages/web/src/app/dashboard/agencies/page.tsx` |
| Detalle de agencia | OK | `packages/web/src/app/dashboard/agencies/[id]/page.tsx` |
| Router organizations | OK | `packages/web/src/server/routers/organizations.ts` |
| Super Admin role | OK | Campo `isSuperAdmin` en User |
| Límites por agencia | OK | Campo `maxClients` en Organization |
| Auto-archivado menciones viejas | OK | Menciones >30 días marcadas como `isLegacy` |
| isLegacy basado en edad del artículo | OK | Solo basado en edad del artículo, no en `client.createdAt` |
| Tabs Recientes/Historial en detalle cliente | OK | Página detalle de cliente con tabs para separar menciones |
| Correcciones Prisma engine Next.js | OK | Copiar engine a todas las ubicaciones que Next.js busca |

### Pendiente
- [ ] Dashboard ejecutivo para Super Admin
- [ ] Métricas agregadas multi-agencia
- [ ] Billing y facturación

---

## Sprint 12+ (Backlog)

1. **YouTube Data API**: Cuota gratuita de 10,000 units/día
2. **Google Alerts RSS**: Alternativa sin costo a Google CSE
3. **View Transitions API**: Animaciones entre páginas
4. **API pública**: Endpoints REST + webhooks
5. **App móvil**: Notificaciones push nativas (React Native)
6. **White-label**: Dashboard personalizable por cliente
7. **Multi-idioma**: i18n para expansión internacional

**Nota**: Twitter/X ahora soportado via EnsembleData API (costo razonable vs $5000+/mes de API oficial).

---

## Sprint 13: Pipeline de Acción (COMPLETADO - 2026-02-15)

### Objetivo
Cerrar el ciclo dato → insight → tarea → acción → medición

### Implementado

| Feature | Estado | Archivos |
|---------|--------|----------|
| Modelos Prisma (ResponseDraft, CrisisNote, ActionItem, AlertRule) | ✅ OK | `prisma/schema.prisma` |
| Router responses.ts (list, getById, create, update, updateStatus, regenerate) | ✅ OK | `packages/web/src/server/routers/responses.ts` |
| Router crisis.ts (list, getById, updateStatus, addNote, assignResponsible, getActiveCrisisCount) | ✅ OK | `packages/web/src/server/routers/crisis.ts` |
| Página /dashboard/responses (KPIs, tabs status, workflow completo) | ✅ OK | `packages/web/src/app/dashboard/responses/` |
| Página /dashboard/crisis (KPIs, tabla, filtros severidad/status) | ✅ OK | `packages/web/src/app/dashboard/crisis/` |
| Página /dashboard/crisis/[id] (timeline, notas, asignación, menciones relacionadas) | ✅ OK | `packages/web/src/app/dashboard/crisis/[id]/` |
| Sidebar: "Crisis" con badge activas + "Respuestas" | ✅ OK | `packages/web/src/components/sidebar.tsx` |
| Tasks: acepta socialMentionId | ✅ OK | `packages/web/src/server/routers/tasks.ts` |
| Mentions/[id]: botón "Crear tarea" + "Generar Comunicado" + guardar borrador | ✅ OK | `packages/web/src/app/dashboard/mentions/[id]/` |
| Intelligence: sección "Acciones Recomendadas" con status updates | ✅ OK | `packages/web/src/app/dashboard/intelligence/` |
| alert-rules-worker (evaluación NEGATIVE_SPIKE, VOLUME_SURGE, NO_MENTIONS) | ✅ OK | `packages/workers/src/workers/alert-rules-worker.ts` |
| insights-worker: crea ActionItems desde recommendedActions | ✅ OK | `packages/workers/src/analysis/insights-worker.ts` |
| crisis-detector: auto-creación de CrisisAlert en spike negativo | ✅ OK | `packages/workers/src/analysis/crisis-detector.ts` |

### Completado en Sprint 14

Todos los gaps restantes de Sprint 13 fueron cerrados en Sprint 14: Generar Comunicado en social-mentions, AlertRule CRUD UI, evaluaciones avanzadas del worker, Insights Timeline con infinite scroll.

---

## Sprint 14: Completar Action Pipeline (COMPLETADO - 2026-02-15)

### Objetivo
Cerrar gaps del Sprint 13 para tener el pipeline de acción completo y funcional.

### Implementado

| Feature | Estado | Archivos |
|---------|--------|----------|
| Generar Comunicado en social-mentions/[id] | ✅ OK | `social.ts` (endpoint generateResponse), `social-mentions/[id]/page.tsx` (botón + modal + drafts section) |
| AlertRule CRUD UI | ✅ OK | `alertRules.ts` (router 6 endpoints), `alert-rules/page.tsx` (tabla + modal create/edit + toggle + delete) |
| AlertRule evaluaciones avanzadas | ✅ OK | `alert-rules-worker.ts` (SOV_DROP, COMPETITOR_SPIKE, SENTIMENT_SHIFT implementados) |
| Insights Timeline | ✅ OK | `intelligence.ts` (cursor pagination + getInsightActionItems), `intelligence/page.tsx` (timeline con cards expandibles + infinite scroll) |
| Sidebar: Reglas de Alerta | ✅ OK | `sidebar.tsx` (item con icono Bell) |
| Router alertRules registrado | ✅ OK | `_app.ts` (16 routers totales) |

### Detalles técnicos

**Generar Comunicado**: Endpoint `social.generateResponse` llama Gemini AI con contexto de la mención social, crea `ResponseDraft` vinculado vía `socialMentionId`. UI muestra botón azul, modal de éxito con link a borradores, sección "Borradores de comunicado" con status badges.

**AlertRule CRUD**: Página completa con tabla, modal dinámico por tipo (6 tipos con diferentes campos de condición), multi-select de canales (dashboard/telegram/email), select de cliente filtrado por org. Toggle de activar/desactivar inline.

**Evaluaciones avanzadas**:
- `SOV_DROP`: Compara Share of Voice actual vs período anterior, trigger si caída >= dropThreshold%
- `COMPETITOR_SPIKE`: Busca competidores vía `ClientCompetitor`, compara menciones entre períodos, trigger si spike >= spikeThreshold%
- `SENTIMENT_SHIFT`: Compara ratio de menciones negativas entre períodos, trigger si incremento >= shiftThreshold puntos porcentuales

**Insights Timeline**: `useInfiniteQuery` con cursor pagination, cards colapsables que muestran SOV trend, recomendaciones, top topics (pill badges), y action items vinculados (lazy-loaded). Botón "Cargar más insights" con loading state.

### E2E Tests
- `tests/e2e/test_sprint14.py` — 11/11 tests passing
- `tests/e2e/test_sprint14_social.py` — 4/4 tests passing (super admin)

---

## Sprint 15: Email Reports + AI Media Brief

### Objetivo
Diversificar canales de notificación (más allá de Telegram) y generar briefings diarios inteligentes que un ejecutivo de PR pueda leer en 2 minutos.

### Parte 1: Reportes por Email

| Feature | Prioridad | Descripción |
|---------|-----------|-------------|
| Servicio de email (Resend/SMTP) | Alta | Integración con Resend para envío transaccional |
| Template HTML de reporte | Alta | Email responsive con KPIs, top menciones, sentimiento, SOV |
| Digest diario por email | Alta | Cron 8:00 AM similar a Telegram pero vía email |
| Reporte semanal por email | Media | Versión email del reporte PDF semanal (HTML inline) |
| Configuración por usuario | Media | Cada usuario elige: Telegram, Email, Ambos, Ninguno |
| Unsubscribe link | Baja | Link para desactivar emails sin login |

### Parte 2: AI Media Brief (Daily Intelligence)

Briefing diario generado por IA que resume todo lo relevante del día anterior en un formato ejecutivo.

| Feature | Prioridad | Descripción |
|---------|-----------|-------------|
| Generador de brief | Alta | Claude genera resumen ejecutivo de 5-10 bullet points por cliente |
| Contexto enriquecido | Alta | Incluye: menciones clave, cambios de sentimiento, temas emergentes, acciones pendientes |
| Comparativa día anterior | Media | "Ayer vs. anteayer": delta de menciones, sentimiento, SOV |
| Sección "Qué vigilar hoy" | Media | IA sugiere 2-3 cosas a las que prestar atención |
| Delivery multi-canal | Media | Brief enviado por Telegram + Email + disponible en dashboard |
| Página /dashboard/briefs | Baja | Historial de briefs con búsqueda |

### Archivos a crear/modificar

| Archivo | Propósito |
|---------|-----------|
| `packages/shared/src/email-client.ts` | Cliente de email (Resend SDK) |
| `packages/workers/src/notifications/email.ts` | Templates y envío de emails |
| `packages/workers/src/analysis/daily-brief.ts` | Generador de AI Media Brief |
| `packages/web/src/app/dashboard/briefs/page.tsx` | Historial de briefs |
| `prisma/schema.prisma` | Modelo DailyBrief, preferencias de notificación en User |

---

## Sprint 16: Campaign Tracking + Media Contacts

### Objetivo
Permitir que las agencias tracken campañas de PR con métricas de impacto, y mantengan un CRM ligero de contactos en medios.

### Parte 1: Tracking de Campañas

| Feature | Prioridad | Descripción |
|---------|-----------|-------------|
| Modelo Campaign | Alta | Nombre, descripción, cliente, fechas inicio/fin, objetivos, status |
| Vincular menciones a campaña | Alta | Tag manual o automático (por keywords/periodo) de menciones a una campaña |
| Dashboard de campaña | Alta | KPIs específicos: menciones generadas, alcance, sentimiento, SOV durante campaña |
| Comparativa pre/post campaña | Media | Métricas del periodo antes vs durante la campaña |
| ROI estimado (AVE) | Media | Advertising Value Equivalency basado en tier de fuente y alcance |
| Timeline de campaña | Baja | Vista cronológica de eventos y menciones de la campaña |

### Parte 2: CRM de Medios (Media Contacts)

| Feature | Prioridad | Descripción |
|---------|-----------|-------------|
| Modelo MediaContact | Alta | Nombre, medio, beat/sección, email, teléfono, notas |
| Vinculación automática | Media | Detectar autor de artículo y sugerir vinculación con contacto existente |
| Historial de cobertura | Media | Ver artículos publicados por cada contacto que mencionan a clientes |
| Scoring de contacto | Baja | Puntuación basada en frecuencia de cobertura y sentimiento promedio |
| Exportar lista de prensa | Baja | CSV/Excel de contactos filtrados por beat, medio, scoring |

### Archivos a crear/modificar

| Archivo | Propósito |
|---------|-----------|
| `prisma/schema.prisma` | Modelos Campaign, CampaignMention, MediaContact |
| `packages/web/src/server/routers/campaigns.ts` | CRUD + analytics de campañas |
| `packages/web/src/server/routers/media-contacts.ts` | CRUD de contactos |
| `packages/web/src/app/dashboard/campaigns/` | Páginas de campañas |
| `packages/web/src/app/dashboard/media-contacts/` | Páginas de contactos |

---

## Sprint 17: Dashboard Ejecutivo + Métricas Avanzadas

### Objetivo
Dashboard de alto nivel para Super Admins y directores de agencia con métricas agregadas multi-cliente, benchmarking e indicadores de negocio.

### Implementar

| Feature | Prioridad | Descripción |
|---------|-----------|-------------|
| Dashboard ejecutivo multi-org | Alta | Vista agregada de todas las organizaciones (Super Admin) |
| Métricas por organización | Alta | Clientes activos, menciones totales, sentiment distribution, crisis activas |
| Health Score por cliente | Alta | Puntuación 0-100 basada en: volumen de menciones, sentiment ratio, SOV, crisis, response time |
| Alertas de inactividad | Media | Detectar clientes sin menciones recientes o con drops significativos |
| Benchmark por industria | Media | Comparar métricas de un cliente contra promedio de su industria |
| Heatmap de actividad | Media | Mapa de calor por hora/día de la semana mostrando cuándo llegan menciones |
| Informe de uso de plataforma | Baja | Métricas de uso del sistema: usuarios activos, tareas completadas, briefs leídos |

### Archivos a crear/modificar

| Archivo | Propósito |
|---------|-----------|
| `packages/web/src/app/dashboard/executive/page.tsx` | Dashboard ejecutivo |
| `packages/web/src/server/routers/executive.ts` | Queries agregadas multi-org |
| `packages/workers/src/analysis/health-score.ts` | Cálculo de health score por cliente |

---

## Sprint 18: Real-time + Integraciones Externas

### Objetivo
Llevar el sistema a tiempo real y abrir integraciones con herramientas externas que las agencias ya usan.

### Parte 1: Real-time Dashboard

| Feature | Prioridad | Descripción |
|---------|-----------|-------------|
| Server-Sent Events (SSE) | Alta | Stream de menciones nuevas en tiempo real al dashboard |
| Live mention feed | Alta | Feed tipo Twitter con menciones apareciendo en vivo |
| Contador en vivo | Media | KPIs que se actualizan sin reload (menciones hoy, sentiment) |
| Sonido de notificación | Baja | Audio alert configurable para menciones CRITICAL |

### Parte 2: Integraciones

| Feature | Prioridad | Descripción |
|---------|-----------|-------------|
| Webhook outbound | Alta | Enviar eventos (nueva mención, crisis, insight) a URLs configurables |
| Slack integration | Media | Bot de Slack como alternativa a Telegram |
| Google Sheets export | Media | Sync automático de menciones a Google Sheets |
| Zapier/Make trigger | Baja | Webhook compatible con Zapier para integraciones sin código |
| API REST pública | Baja | Endpoints documentados con API key para integraciones custom |

### Parte 3: Mejoras UX

| Feature | Prioridad | Descripción |
|---------|-----------|-------------|
| View Transitions API | Media | Animaciones fluidas entre páginas del dashboard |
| Loading skeletons | Media | Skeletons en todas las tablas y listas principales |
| Keyboard shortcuts | Baja | Atajos de teclado para navegación y acciones rápidas (j/k navegar, r responder) |
| Command palette (⌘K) | Baja | Búsqueda global rápida de clientes, menciones, tareas |

---

## Backlog (Sin priorizar)

| Feature | Descripción | Complejidad |
|---------|-------------|-------------|
| App móvil (React Native) | Push notifications nativas, vista resumida | Alta |
| Multi-idioma (i18n) | Internacionalización para expansión | Media |
| White-label | Dashboard personalizable por agencia (logo, colores, dominio) | Alta |
| YouTube Data API directa | Cuota gratuita de 10,000 units/día (complementar EnsembleData) | Media |
| Google Alerts RSS | Alternativa sin costo a Google CSE | Baja |
| AI Sentiment Fine-tuning | Entrenar modelo específico para PR mexicano | Alta |
| Análisis de imágenes | OCR + análisis visual de posts sociales con imágenes | Media |
| Detección de bots | Identificar menciones generadas por bots en redes sociales | Media |
| Predicción de tendencias | ML para predecir picos de menciones o cambios de sentimiento | Alta |
| Integración con CRMs | Sync bidireccional con HubSpot/Salesforce | Media |

---

## Orden de Prioridad Sugerido

```
Sprint 13 ✅ → Sprint 14 ✅ → Sprint 15 → Sprint 16 → Sprint 17 → Sprint 18
     ↓              ↓              ↓            ↓            ↓           ↓
  Action         Pipeline       Email +      Campañas +   Executive   Real-time +
  Pipeline       Completo      AI Brief     Contactos    Dashboard   Webhooks
```

**Impacto estimado por sprint:**

| Sprint | Valor para agencia | Esfuerzo | Estado |
|--------|-------------------|----------|--------|
| 13 | Alto — completa ciclo de acción | Bajo | ✅ Completado |
| 14 | Muy alto — pipeline completo con evaluaciones | Medio | ✅ Completado |
| 15 | Alto — email es el canal #1 en PR corporativo | Medio | **SIGUIENTE** |
| 16 | Muy alto — tracking de campañas es core de PR | Alto | Pendiente |
| 17 | Medio — útil para escala multi-agencia | Medio | Pendiente |
| 18 | Alto — real-time y webhooks modernizan el producto | Alto | Pendiente |

## Contacto

Para preguntas sobre el proyecto, contactar al equipo de desarrollo.
