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
| Analisis AI | OK | Claude 3.5 Haiku |
| Dashboard web | OK | Next.js + tRPC |
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

### Funciones de IA

| Funcion | Tipo | Trigger | Archivo |
|---------|------|---------|---------|
| `analyzeMention` | Automatico | Nueva mencion | `analysis/ai.ts:21` |
| `preFilterArticle` | Automatico | Antes de crear mencion | `analysis/ai.ts:94` |
| `runOnboarding` | Automatico | Nuevo cliente | `analysis/ai.ts:156` |
| `generateResponse` | On-demand | Boton en UI | `analysis/ai.ts:156` / `mentions.ts` |
| `generateDigestSummary` | Automatico | Cron 8:00 AM | `analysis/ai.ts:225` |
| `checkForCrisis` | Automatico | Mencion NEGATIVE | `analysis/crisis-detector.ts` |
| `findClusterParent` | Automatico | Post-analisis (relevance >= 5) | `analysis/clustering.ts` |

### Pendiente / En Progreso

| Feature | Prioridad | Descripcion |
|---------|-----------|-------------|
| Dark Mode | Baja | Toggle de tema oscuro |
| Filtros en Tareas | Baja | Filtros avanzados en pagina de tareas |
| Aurora Background | Baja | Efecto visual en login |

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

### Fase 5: Polish y Escala - PENDIENTE

- [ ] Dark mode toggle
- [ ] Aurora background en login
- [ ] Filtros avanzados en Tareas
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

## Proximos Pasos

1. **Sprint 6**: Implementar dark mode y polish visual
2. **Escala**: Agregar mas fuentes de noticias
3. **Integraciones**: Twitter/X, YouTube mentions

## Contacto

Para preguntas sobre el proyecto, contactar al equipo de desarrollo.
