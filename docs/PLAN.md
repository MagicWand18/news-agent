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
| Integracion Twitter/X | Media | API de Twitter para menciones |
| Integracion YouTube | Media | Deteccion de menciones en videos |
| Mas fuentes RSS | Baja | Agregar mas feeds de noticias |

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

## Sprint 10: Notificaciones In-App + Mejoras UX

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
- [ ] Badge con contador de no leídas
- [ ] Dropdown con últimas 10 notificaciones
- [ ] Marcar como leída al hacer click
- [ ] Marcar todas como leídas
- [ ] Página completa con filtros y paginación
- [ ] Polling cada 30s para actualizaciones

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

## Sprint 11+ (Backlog)

1. **YouTube Data API**: Cuota gratuita de 10,000 units/día
2. **Google Alerts RSS**: Alternativa sin costo a Google CSE
3. **View Transitions API**: Animaciones entre páginas
4. **API pública**: Endpoints REST + webhooks
5. **App móvil**: Notificaciones push nativas (React Native)
6. **White-label**: Dashboard personalizable por cliente
7. **Multi-idioma**: i18n para expansión internacional

**Nota**: Twitter/X API descartada por costo prohibitivo ($5000+/mes Enterprise tier).

## Contacto

Para preguntas sobre el proyecto, contactar al equipo de desarrollo.
