# Action Pipeline

Documentacion del pipeline de datos accionables generados por MediaBot: desde la deteccion hasta la accion del equipo de PR.

## 1. Datos generados por el sistema

| Dato | Fuente | Trigger | Almacenamiento |
|------|--------|---------|----------------|
| `suggestedAction` | `analyzeMention()` en `packages/workers/src/analysis/ai.ts` | Cada mencion analizada | `Mention.aiAction` (campo del modelo) |
| `generateResponse` | `generateResponse()` en `packages/web/src/server/routers/mentions.ts` | Usuario hace clic en "Generar Comunicado" | No persistido (retornado al frontend en tiempo real) |
| `CrisisAlert` | `checkForCrisis()` en `packages/workers/src/analysis/crisis-detector.ts` | Spike de menciones negativas | Tabla `CrisisAlert` |
| `WeeklyInsights` | `generateWeeklyInsights()` en `packages/workers/src/analysis/ai.ts` | Cron semanal (lunes 6 AM) | Tabla `WeeklyInsight` (campo `insights` JSON) |
| `EmergingTopics` | `detectEmergingTopics()` en `packages/workers/src/analysis/topic-extractor.ts` | Cron cada 4 horas | Tabla `EmergingTopicNotification` |
| `DailyBrief` | `generateDailyBrief()` en `packages/workers/src/analysis/ai.ts` | Cron diario (digest 8 AM) | Tabla `DailyBrief` (campos `content` y `stats` JSON) |

### Detalle de cada dato

**suggestedAction (Mention.aiAction)**
- Generado automaticamente por Gemini al analizar cada mencion
- Ejemplo: "Enviar comunicado de prensa aclarando la posicion de la empresa"
- Almacenado como string en el campo `aiAction` de la tabla `Mention`
- Prompt incluye contexto del cliente, industria, articulo y keyword

**generateResponse (Comunicado de prensa)**
- Generado on-demand cuando el usuario solicita un comunicado
- Usa Claude (Anthropic) para generar titulo, cuerpo, tono, audiencia, call-to-action y mensajes clave
- Soporta 4 tonos: PROFESSIONAL, DEFENSIVE, CLARIFICATION, CELEBRATORY
- Retorna JSON estructurado al frontend, no se guarda en BD

**CrisisAlert**
- Se evalua cada vez que se analiza una mencion con sentimiento NEGATIVE
- Threshold configurable: `CRISIS_NEGATIVE_MENTION_THRESHOLD` (default 3) menciones negativas en `CRISIS_WINDOW_MINUTES` (default 60) minutos
- Severidad calculada automaticamente: MEDIUM (>=threshold), HIGH (>=2x), CRITICAL (>=3x)
- Status: ACTIVE -> MONITORING -> RESOLVED
- Campos: `triggerType`, `severity`, `mentionCount`, `resolvedAt`, `resolvedBy`, `notes`
- Envia notificacion por Telegram al crear la alerta

**WeeklyInsights**
- Se genera semanalmente para cada cliente activo con menciones
- Incluye: breakdown de sentimiento, SOV (Share of Voice), topics frecuentes, comparacion con semana anterior
- Almacena `insights` (JSON array de recomendaciones), `sovData`, `topTopics`
- Deduplicacion: unique constraint en `[clientId, weekStart]`

**EmergingTopicNotification**
- Detecta temas que aparecen con frecuencia creciente
- Ejecutado por el emerging topics worker cada 4 horas
- Almacena: `topic`, `mentionCount`, `clientId`

---

## 2. Como se accionan (estado actual — Sprint 14+)

### generateResponse (Comunicados) ✅ COMPLETADO
- El usuario abre el detalle de una mencion (media o social)
- Hace clic en "Generar Comunicado" y selecciona un tono
- Se crea un `ResponseDraft` persistido en BD con workflow: DRAFT → IN_REVIEW → APPROVED → PUBLISHED
- Solo ADMIN/SUPERVISOR pueden aprobar
- Pagina dedicada: `/dashboard/responses`

### CrisisAlert (Alertas de crisis) ✅ COMPLETADO
- Se crea automaticamente en la BD con status `ACTIVE`
- Se envia notificacion por Telegram (multi-nivel: cliente, org, SuperAdmin)
- UI completa en `/dashboard/crisis` y `/dashboard/crisis/[id]`
- Cambiar status, agregar notas, asignar responsable, ver timeline
- Badge en sidebar con conteo de crisis activas

### WeeklyInsights (Insights semanales) ✅ COMPLETADO
- Se generan y almacenan automaticamente cada semana
- El campo `insights` contiene `recommendedActions` como array de strings
- ActionItems se crean automaticamente desde `recommendedActions`
- Timeline con paginacion infinita en `/dashboard/intelligence`
- Cada ActionItem se puede trackear: PENDING → IN_PROGRESS → COMPLETED

### suggestedAction (Acciones sugeridas) ✅ COMPLETADO
- Se muestra en la pagina de detalle de mencion como texto
- Se puede crear un `ActionItem` desde la accion sugerida
- Se puede crear una `Task` vinculada a la mencion

### AlertRules (Reglas de alerta) ✅ COMPLETADO
- 6 tipos: NEGATIVE_SPIKE, VOLUME_SURGE, NO_MENTIONS, SOV_DROP, COMPETITOR_SPIKE, SENTIMENT_SHIFT
- Worker evalua cada 30 min con cooldown de 1 hora
- UI de gestion en `/dashboard/alert-rules` con CRUD completo
- Notificaciones Telegram multi-nivel cuando se activa una regla

### DailyBrief (Brief ejecutivo IA) ✅ COMPLETADO
- Generado automaticamente en el digest diario (8 AM)
- Contenido: highlights, comparativa, watchList, temas emergentes, acciones
- Dashboard en `/dashboard/briefs`
- Notificacion Telegram `BRIEF_READY`

### Campaign Tracking ✅ COMPLETADO
- CRUD de campanas con estados y comparativa pre/post
- Auto-vinculacion de menciones por rango de fechas
- Crisis linkage para medir respuesta a crisis
- Dashboard en `/dashboard/campaigns` y `/dashboard/campaigns/[id]`

---

## 3. Pipeline propuesto (Sprint 13)

### ResponseDraft - Workflow de comunicados

Nuevo modelo para persistir y gestionar borradores de comunicado:

```
ResponseDraft
  id, mentionId, socialMentionId (nullable ambos)
  title, body, tone
  status: DRAFT -> IN_REVIEW -> APPROVED -> PUBLISHED
  createdBy, reviewedBy, approvedBy
  createdAt, reviewedAt, approvedAt, publishedAt
  notes (texto libre para feedback)
```

**Workflow:**
1. Usuario genera comunicado desde mencion (media o social)
2. Se guarda como `ResponseDraft` con status `DRAFT`
3. Supervisor revisa y cambia a `IN_REVIEW` con notas
4. Admin aprueba (`APPROVED`) o solicita cambios (vuelve a `DRAFT`)
5. Se publica/envia (`PUBLISHED`) con registro de quien y cuando

### Crisis Management UI

Interfaz para gestionar alertas de crisis:

- Lista de crisis activas con filtros por severidad y cliente
- Detalle con timeline de eventos (creacion, cambios de status, notas)
- Cambiar status: ACTIVE -> MONITORING -> RESOLVED
- Agregar notas y asignar responsable
- Ver menciones negativas relacionadas

### ActionItem - Seguimiento de acciones

Nuevo modelo para trackear acciones recomendadas:

```
ActionItem
  id, clientId
  source: CRISIS | INSIGHT | MENTION | SOCIAL_MENTION | MANUAL
  sourceId (referencia al origen)
  title, description
  status: PENDING -> IN_PROGRESS -> COMPLETED -> CANCELLED
  assignedTo (userId)
  priority: HIGH | MEDIUM | LOW
  dueDate
  completedAt, completedBy
  createdAt
```

**Origenes de ActionItems:**
- `suggestedAction` de menciones analizadas
- `recommendedActions` de weekly insights
- Acciones manuales creadas por el equipo
- Resoluciones de crisis

### AlertRule - Reglas de alerta configurables

Nuevo modelo para alertas personalizadas por cliente:

```
AlertRule
  id, clientId
  name, description
  conditions: JSON (sentiment, source, keyword, platform, threshold)
  actions: JSON (telegram, email, webhook)
  active: boolean
  createdBy
```

Permite configurar reglas como:
- "Alertar si aparece mencion negativa en fuente tier 1"
- "Notificar cuando se superen 10 menciones en 1 hora"
- "Alerta si competidor X es mencionado junto con el cliente"

### Task Creation desde menciones

Crear tareas (modelo `Task` existente) directamente desde:
- Detalle de mencion media (ya existe parcialmente)
- Detalle de mencion social (nuevo)
- Crisis alert (nuevo)
- Weekly insights (nuevo)

---

## 4. Metricas de accion

Metricas clave para medir la efectividad del pipeline de acciones:

### Response Time (Tiempo de respuesta)
- **Definicion:** Tiempo desde que se detecta una mencion hasta que se toma una accion
- **Calculo:** `ResponseDraft.createdAt - Mention.createdAt`
- **Objetivo:** < 2 horas para menciones de alta urgencia
- **Disponible hoy:** No (no hay persistencia de acciones)

### Action Rate (Tasa de accion)
- **Definicion:** Porcentaje de menciones que generaron alguna accion de follow-up
- **Calculo:** `ActionItems creados / Total menciones` por periodo
- **Objetivo:** > 80% para menciones de alta relevancia (>=7)
- **Disponible hoy:** No (no hay tracking de acciones)

### Crisis Resolution Time (Tiempo de resolucion de crisis)
- **Definicion:** Tiempo desde que se activa una crisis hasta que se resuelve
- **Calculo:** `CrisisAlert.resolvedAt - CrisisAlert.createdAt`
- **Objetivo:** < 4 horas para severidad CRITICAL
- **Disponible hoy:** Parcial (campos `resolvedAt` existen pero no hay UI para gestionarlos)

### Insight Action Completion Rate (Tasa de completar insights)
- **Definicion:** Porcentaje de recomendaciones semanales que se completaron
- **Calculo:** `ActionItems completados con source=INSIGHT / Total ActionItems de insights`
- **Objetivo:** > 60% de recomendaciones completadas en la semana siguiente
- **Disponible hoy:** No (no hay tracking de acciones sobre insights)

### Metricas adicionales propuestas
- **Draft Approval Rate:** Porcentaje de comunicados aprobados sin revision (eficiencia del equipo)
- **Average Review Cycles:** Promedio de veces que un draft vuelve de IN_REVIEW a DRAFT
- **Social Response Rate:** Porcentaje de menciones sociales que generaron respuesta
- **Alert Rule Effectiveness:** Tasa de alertas que resultan en accion vs. descartadas (evitar fatiga de alertas)

---

## 5. Executive Dashboard + Reportes Exportables (Sprint 17)

### Executive Dashboard

Dashboard exclusivo para Super Admin con vista agregada multi-organizacion:

- **KPIs globales**: Total menciones, menciones sociales, crisis activas, clientes activos — con deltas % vs periodo anterior
- **Org Cards**: Tarjetas resumen por organizacion (clientes, menciones, social, sentiment, top client)
- **Health Score**: Puntuacion 0-100 por cliente con 6 componentes ponderados:
  - Volume (20%): Normaliza menciones vs promedio
  - Sentiment (25%): Ratio de menciones positivas
  - SOV (15%): Share of Voice del cliente
  - CrisisFree (20%): Dias sin crisis / 30
  - ResponseRate (10%): Menciones con ResponseDraft / total criticas
  - Engagement (10%): Menciones sociales con alto engagement
- **Inactivity Alerts**: Clientes sin actividad reciente (configurable)
- **Activity Heatmap**: Grid 7x24 con intensidad de menciones por hora/dia

### Reportes PDF

Generacion de reportes PDF con PDFKit (server-side):

| Tipo | Endpoint | Contenido |
|------|----------|-----------|
| Campaign | `reports.generateCampaignPDF` | Portada, KPIs, comparativa pre-campana, top fuentes, notas |
| Brief | `reports.generateBriefPDF` | Portada, KPIs, highlights, comparativa, watchList, temas, acciones |
| Client | `reports.generateClientPDF` | Portada, KPIs periodo, tendencia semanal, top fuentes, crisis, campanas |

### Links compartidos

- `reports.createSharedLink`: Crea SharedReport con snapshot JSON de datos, URL publica, expiracion 7 dias
- `reports.getSharedReport`: publicProcedure sin auth, busca por publicId, verifica expiracion
- Pagina `/shared/[id]`: Renderiza reporte segun tipo (campaign/brief/client), sin sidebar/auth
- ExportButton: Componente reutilizable con dropdown "Descargar PDF" + "Compartir link"
