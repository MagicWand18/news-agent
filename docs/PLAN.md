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

### Funciones de IA

| Funcion | Tipo | Trigger | Archivo |
|---------|------|---------|---------|
| `analyzeMention` | Automatico | Nueva mencion | `analysis/ai.ts:21` |
| `preFilterArticle` | Automatico | Antes de crear mencion | `analysis/ai.ts:94` |
| `runOnboarding` | Automatico | Nuevo cliente | `analysis/ai.ts:156` |
| `generateDigestSummary` | Automatico | Cron 8:00 AM | `analysis/ai.ts:225` |
| `checkForCrisis` | Automatico | Mencion NEGATIVE | `analysis/crisis-detector.ts` |

### Pendiente / En Progreso

| Feature | Prioridad | Descripcion |
|---------|-----------|-------------|
| Clustering de noticias | Media | Agrupar menciones del mismo evento |
| Sugerencia de respuesta | Media | On-demand, borrador de comunicado |
| Analisis de competidores | Baja | Comparar cobertura vs competidores |

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

### Fase 2: Funciones de IA Avanzadas

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

#### Fase 2C: Clustering de Noticias - PENDIENTE

- [ ] Campo `parentMentionId` en Mention
- [ ] Funcion `isSameEvent()` para comparar menciones
- [ ] Agrupar en digest ("X fuentes reportaron sobre...")

#### Fase 2D: Respuesta On-Demand - PENDIENTE

- [ ] Funcion `generateResponse()`
- [ ] Endpoint tRPC `mentions.generateResponse`
- [ ] UI con boton y modal en dashboard

#### Fase 2E: Analisis de Competidores - PENDIENTE

- [ ] Funcion `analyzeCompetitors()`
- [ ] Endpoint tRPC `clients.analyzeCompetitors`
- [ ] Pagina en dashboard

### Fase 3: Reportes

- [ ] Exportar menciones a CSV
- [ ] Generar reporte PDF semanal
- [ ] Dashboard de estadisticas

### Fase 4: Escala

- [ ] Agregar mas fuentes RSS
- [ ] Integrar Twitter/X API
- [ ] Integrar YouTube mentions

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

## Proximos Pasos

1. **Verificar deteccion de crisis**: Monitorear logs para ver alertas generadas
2. **Ajustar umbrales**: Usar `/dashboard/settings` para ajustar thresholds de crisis
3. **Implementar Fase 2C**: Clustering de noticias para agrupar menciones del mismo evento
4. **Implementar Fase 2D**: Respuesta on-demand con generacion de borradores de comunicado

## Contacto

Para preguntas sobre el proyecto, contactar al equipo de desarrollo.
