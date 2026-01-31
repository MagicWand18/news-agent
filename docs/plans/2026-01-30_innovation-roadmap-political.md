# Plan: MediaBot Innovation Roadmap - Sector Político

**Estado:** 🟡 Propuesta - Pendiente Aprobación
**Fecha:** 2026-01-30
**Contexto:** Clientes son políticos, gobiernos, entidades públicas, partidos políticos

---

## Resumen Ejecutivo

Roadmap de innovación adaptado al **sector político mexicano**:
- Políticos y candidatos
- Gobiernos (federal, estatal, municipal)
- Partidos políticos (MORENA, PAN, PRI, MC, PT, PVEM, etc.)
- Entidades públicas y organismos autónomos

---

## Estado Actual

| Capacidad | Estado | Notas |
|-----------|--------|-------|
| Monitoreo de medios | ✅ | 300+ fuentes mexicanas |
| Sentiment analysis | ✅ | POSITIVE/NEGATIVE/NEUTRAL/MIXED |
| Crisis detection | ✅ | Spike de menciones negativas |
| Competitor tracking | ✅ | Keywords tipo COMPETITOR |
| Share of Voice | ✅ | Comparativo con competidores |
| **Monitoreo de redes sociales** | ❌ | Solo noticias, no Twitter/X |
| **Análisis de agenda política** | ❌ | No existe |
| **Tracking legislativo** | ❌ | No existe |
| **Métricas electorales** | ❌ | No existe |
| **Compliance electoral** | ❌ | No existe |

---

## FASE 1: Fundamentos Políticos (Q1 2026)

### 1.1 🏛️ Tipos de Cliente Político

**Problema:** El modelo actual es genérico. Necesitamos categorización específica.

**Solución:** Agregar `clientType` y campos específicos para política.

```prisma
// Modificar modelo Client
model Client {
  // ... campos existentes
  clientType      ClientType  @default(CORPORATE)
  politicalLevel  PoliticalLevel?  // FEDERAL | ESTATAL | MUNICIPAL
  politicalParty  String?          // Partido si aplica
  electoralDistrict String?        // Distrito o circunscripción
  electionDate    DateTime?        // Próxima elección relevante
}

enum ClientType {
  CORPORATE       // Empresas tradicionales
  POLITICIAN      // Político individual
  POLITICAL_PARTY // Partido político
  GOVERNMENT      // Entidad de gobierno
  PUBLIC_ENTITY   // Organismo autónomo (INE, CNDH, etc.)
  CAMPAIGN        // Campaña electoral específica
}

enum PoliticalLevel {
  FEDERAL
  ESTATAL
  MUNICIPAL
  LEGISLATIVO    // Diputados, Senadores
}
```

**Archivos a modificar:**
- `prisma/schema.prisma`
- `packages/web/src/app/dashboard/clients/new/page.tsx`
- `packages/web/src/server/routers/clients.ts`

---

### 1.2 📊 Dashboard Político

**Problema:** El dashboard actual es genérico. Políticos necesitan métricas específicas.

**Solución:** Vista de dashboard adaptada para clientes políticos.

```
Métricas políticas:
├── Presencia mediática (menciones/día)
├── Sentiment trend (gráfica de evolución)
├── Share of Voice vs oponentes
├── Temas de agenda (word cloud político)
├── Medios aliados vs críticos
├── Alertas de crisis activas
└── Countdown a próxima elección
```

**Nuevo componente:** `PoliticalDashboard.tsx`
- Se activa cuando `client.clientType` es político
- Muestra métricas relevantes para campaña/gobierno
- Incluye comparativo con competidores políticos

**Archivos a crear:**
- `packages/web/src/components/dashboard/PoliticalDashboard.tsx`
- `packages/web/src/components/dashboard/PoliticalKPIs.tsx`
- `packages/web/src/components/dashboard/OpponentComparison.tsx`

---

### 1.3 ⚔️ Análisis de Oponentes Políticos

**Problema:** El tracking de competidores actual es básico. Política requiere análisis profundo.

**Solución:** Módulo dedicado de inteligencia competitiva política.

```
Funcionalidades:
├── Perfiles de oponentes con historial
├── Comparativo de cobertura mediática
├── Análisis de narrativas/discurso
├── Detección de ataques directos
├── Alertas cuando oponente tiene momentum
└── Timeline de eventos por oponente
```

**Nuevo modelo:**
```prisma
model PoliticalOpponent {
  id            String   @id @default(cuid())
  clientId      String   // Cliente que monitorea
  name          String
  party         String?
  position      String?  // "Candidato a Gobernador", "Senador"
  keywords      String[] // Keywords para tracking
  sentiment     Float?   // Sentiment promedio detectado
  mentionCount  Int      @default(0)
  lastMention   DateTime?

  client        Client   @relation(fields: [clientId], references: [id])
}
```

**Archivos a crear:**
- `packages/web/src/app/dashboard/opponents/page.tsx`
- `packages/web/src/server/routers/opponents.ts`
- `packages/workers/src/analysis/opponent-analyzer.ts`

---

### 1.4 🚨 Crisis Política Mejorada

**Problema:** Crisis políticas son diferentes a crisis corporativas. Requieren detección más sofisticada.

**Solución:** Tipos de crisis específicos para política.

```prisma
enum PoliticalCrisisType {
  SCANDAL           // Escándalo personal/corrupción
  ATTACK            // Ataque de oponente
  MISINFORMATION    // Desinformación/fake news
  GAFFE             // Error en declaraciones
  POLICY_BACKLASH   // Rechazo a política/propuesta
  LEGAL_ISSUE       // Problema legal/investigación
  COALITION_BREAK   // Ruptura de alianzas
  PROTEST           // Protestas/movilizaciones
}

model PoliticalCrisis {
  id              String   @id @default(cuid())
  clientId        String
  crisisType      PoliticalCrisisType
  severity        CrisisSeverity
  status          CrisisStatus

  // Campos específicos políticos
  attackSource    String?  // Quién atacó (si aplica)
  mediaOrigin     String?  // Medio que publicó primero
  viralPotential  Int?     // 1-10 potencial de viralización
  responseStatus  ResponseStatus?

  mentions        Mention[]
  timeline        CrisisEvent[]
}

enum ResponseStatus {
  PENDING         // Sin respuesta
  DRAFTED         // Borrador preparado
  APPROVED        // Aprobado por cliente
  PUBLISHED       // Publicado
  MONITORING      // En seguimiento post-respuesta
}
```

**Detección automática de tipo de crisis:**
- Analizar contenido con Claude para clasificar tipo
- Identificar fuente del ataque si existe
- Calcular potencial viral basado en medio y velocidad

---

## FASE 2: Inteligencia Electoral (Q2 2026)

### 2.1 📈 Tracking de Agenda Política

**Problema:** No sabemos qué temas dominan la conversación pública.

**Solución:** Módulo de análisis de agenda (Agenda Setting).

```
Funcionalidades:
├── Top temas de la semana (ranking)
├── Evolución de temas en el tiempo
├── Ownership de temas: ¿Quién "dueño" de qué tema?
├── Temas emergentes (detección temprana)
├── Correlación tema ↔ candidato
└── Recomendaciones de posicionamiento
```

**Nuevo modelo:**
```prisma
model PoliticalTopic {
  id            String   @id @default(cuid())
  name          String   @unique  // "Seguridad", "Corrupción", "Economía"
  category      TopicCategory
  mentionCount  Int      @default(0)
  avgSentiment  Float?
  trendScore    Float?   // Qué tan trending está

  // Asociaciones
  topCandidates Json?    // [{clientId, mentions, sentiment}]
  relatedKeywords String[]

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

enum TopicCategory {
  SECURITY        // Seguridad, crimen
  ECONOMY         // Economía, empleo
  HEALTH          // Salud, pandemia
  EDUCATION       // Educación
  CORRUPTION      // Corrupción, transparencia
  INFRASTRUCTURE  // Obras, infraestructura
  ENVIRONMENT     // Medio ambiente
  SOCIAL          // Programas sociales
  FOREIGN         // Relaciones exteriores
  ELECTORAL       // Proceso electoral
  OTHER
}
```

**Archivos a crear:**
- `packages/web/src/app/dashboard/agenda/page.tsx`
- `packages/workers/src/analysis/agenda-tracker.ts`
- `packages/web/src/server/routers/agenda.ts`

---

### 2.2 🗳️ Módulo Electoral

**Problema:** En periodos electorales, los clientes necesitan métricas específicas.

**Solución:** Dashboard de campaña electoral.

```
Métricas electorales:
├── Días para la elección (countdown)
├── Share of Voice semanal vs oponentes
├── Sentiment trend por candidato
├── Cobertura por tema de campaña
├── Momentum score (quién está ganando narrativa)
├── Mapa de cobertura geográfica
└── Alertas de competencia
```

**Nuevo modelo:**
```prisma
model Election {
  id            String   @id @default(cuid())
  name          String   // "Elección Gobernador Jalisco 2027"
  type          ElectionType
  level         PoliticalLevel
  date          DateTime
  state         String?  // Si es estatal
  district      String?  // Si es distrital

  candidates    ElectionCandidate[]

  createdAt     DateTime @default(now())
}

model ElectionCandidate {
  id            String   @id @default(cuid())
  electionId    String
  clientId      String?  // Si el candidato es nuestro cliente
  name          String
  party         String
  isIncumbent   Boolean  @default(false)

  // Métricas calculadas
  sovScore      Float?
  sentimentScore Float?
  momentumScore Float?

  election      Election @relation(fields: [electionId], references: [id])
  client        Client?  @relation(fields: [clientId], references: [id])
}

enum ElectionType {
  PRESIDENTIAL
  GUBERNATORIAL
  MAYORAL
  CONGRESSIONAL
  SENATORIAL
  LOCAL
}
```

---

### 2.3 📱 Monitoreo de Redes Sociales (Multi-plataforma)

**Problema:** En política mexicana, las redes sociales son cruciales. Twitter/X, Facebook, Instagram y TikTok son donde se construye opinión pública.

**Solución:** Monitoreo multi-plataforma de redes sociales.

```
Plataformas a monitorear:
├── Twitter/X - Opinión pública, periodistas, trending
├── Facebook - Grupos políticos, páginas de gobierno
├── Instagram - Imagen personal del político
├── TikTok - Viralización, público joven
└── Web general - Foros, blogs, sitios de opinión
```

**Opciones de implementación:**

| Opción | Costo/mes | Cobertura | Recomendación |
|--------|-----------|-----------|---------------|
| **APIs Directas** | $5,100+ | Completa | ❌ Muy caro |
| **Agregador (Brandwatch/Sprinklr)** | $800-2000 | Completa | ⚠️ Caro pero completo |
| **Social Searcher API** | $49-299 | Buena | ✅ Económico |
| **Apify Scrapers** | $49 + uso | Variable | ✅ Flexible |
| **CrowdTangle (Meta)** | Gratis* | FB/IG | ✅ Solo FB/IG |

*CrowdTangle: Solo para investigadores/periodistas verificados

**Recomendación: Enfoque híbrido económico**

```
Fase 1 - Económico ($100-200/mes):
├── Social Searcher API ($49/mes) - Twitter, FB, YouTube
├── Google Custom Search API (ya lo tenemos) - Web general
├── Apify TikTok Scraper ($49 base + uso) - TikTok
└── RSS de Nitter - Twitter backup gratuito
```

**Nuevo modelo:**
```prisma
model SocialMention {
  id            String   @id @default(cuid())
  clientId      String
  platform      SocialPlatform
  postUrl       String   @unique
  authorHandle  String?
  authorName    String?
  content       String   @db.Text
  sentiment     Sentiment?
  engagement    Json?    // {likes, shares, comments, views}
  isVerified    Boolean  @default(false)  // Cuenta verificada
  reachEstimate Int?     // Alcance estimado
  viralScore    Int?     // 1-100 potencial viral
  publishedAt   DateTime
  collectedAt   DateTime @default(now())

  client        Client   @relation(fields: [clientId], references: [id])
}

enum SocialPlatform {
  TWITTER
  FACEBOOK
  INSTAGRAM
  TIKTOK
  YOUTUBE
  LINKEDIN
  WEB       // Blogs, foros, sitios de opinión
}
```

**Archivos a crear:**
- `packages/workers/src/collectors/social-collector.ts`
- `packages/workers/src/collectors/platforms/twitter.ts`
- `packages/workers/src/collectors/platforms/facebook.ts`
- `packages/workers/src/collectors/platforms/tiktok.ts`
- `packages/web/src/app/dashboard/social/page.tsx`

**Dashboard de Redes Sociales:**
```
├── Timeline unificado (todas las plataformas)
├── Filtro por plataforma
├── Métricas de engagement por red
├── Top posts virales
├── Influencers que mencionan al cliente
└── Alertas de viralización
```

---

## FASE 3: Análisis Avanzado (Q3 2026)

### 3.1 🎯 Análisis de Narrativas

**Problema:** Los políticos necesitan entender qué narrativas se construyen sobre ellos.

**Solución:** Módulo de análisis de narrativa/framing.

```
Análisis por mención:
├── Frame detectado: "Héroe" | "Villano" | "Víctima" | "Experto"
├── Narrativa dominante: "Corrupto" | "Trabajador" | "Populista"
├── Asociaciones: Palabras que aparecen junto al nombre
├── Evolución de narrativa en el tiempo
└── Comparativo de narrativa vs oponentes
```

**Prompt para Claude:**
```
Analiza esta mención del político [NOMBRE]:

Título: [título]
Contenido: [contenido]

Extrae:
1. Frame narrativo: ¿Cómo se presenta al político?
   - HERO (logros, soluciones)
   - VILLAIN (acusaciones, críticas)
   - VICTIM (ataques injustos)
   - EXPERT (conocimiento, experiencia)
   - NEUTRAL (solo informativo)

2. Narrativa dominante (1-3 palabras): ¿Con qué concepto se asocia?
   Ejemplos: "corrupción", "transformación", "inseguridad", "trabajo"

3. Palabras asociadas: Lista de adjetivos/sustantivos usados

Responde en JSON: { "frame": "...", "narrative": "...", "associations": [...] }
```

---

### 3.2 📍 Análisis Geográfico

**Problema:** Los políticos necesitan saber dónde tienen buena/mala cobertura.

**Solución:** Mapa de cobertura mediática por estado/región.

```
Funcionalidades:
├── Mapa de México con cobertura por estado
├── Sentiment promedio por región
├── Medios dominantes por estado
├── Alertas de bajo rendimiento regional
└── Comparativo geográfico vs oponentes
```

**Implementación:**
- Usar campo `state` de `RssSource` para geolocalizar menciones
- Crear agregaciones por estado
- Visualizar con mapa interactivo (react-simple-maps)

**Archivos a crear:**
- `packages/web/src/components/maps/MexicoMap.tsx`
- `packages/web/src/app/dashboard/geographic/page.tsx`

---

### 3.3 🔮 Predicción de Tendencias

**Problema:** Los políticos quieren anticipar, no solo reaccionar.

**Solución:** Modelo predictivo de tendencias mediáticas.

```
Predicciones:
├── Temas que ganarán relevancia (próximos 7 días)
├── Riesgo de crisis por cliente (scoring predictivo)
├── Ventanas de oportunidad (momentos para comunicar)
├── Predicción de cobertura post-evento
└── Early warning de ataques coordinados
```

**Algoritmo de Risk Score Político:**
```typescript
function calculatePoliticalRiskScore(clientId: string): number {
  const scores = {
    negativeVelocity: 0-25,    // Aceleración de menciones negativas
    attackPatterns: 0-25,       // Menciones de oponentes aumentando
    mediaEscalation: 0-25,      // Tier 1 sources reportando
    socialAmplification: 0-25,  // Viralización en redes (si disponible)
  };

  return sum(scores); // 0-100
}
```

---

## FASE 4: Compliance y Reportes (Q4 2026)

### 4.1 📋 Reportes de Transparencia Electoral

**Problema:** Las campañas necesitan documentar su monitoreo para compliance.

**Solución:** Generador de reportes de transparencia.

```
Contenido del reporte:
├── Resumen de cobertura mediática del periodo
├── Listado de medios que cubrieron al candidato
├── Análisis de sentiment (sin manipulación)
├── Menciones de propuestas de campaña
├── Comparativo objetivo vs oponentes
└── Metodología de monitoreo
```

**Formato:** PDF exportable, firmado digitalmente

---

### 4.2 📊 Analytics Avanzados

**Problema:** Los clientes políticos necesitan reportes ejecutivos sofisticados.

**Solución:** Dashboard de analytics político.

```
Métricas avanzadas:
├── Media Impact Value (MIV) político
├── Reach estimado por mención
├── Effectiveness Score (mensaje ↔ cobertura)
├── Brand Lift mediático
├── Comparativo histórico (vs mes/año anterior)
└── Benchmark vs sector político
```

---

### 4.3 🤖 Asistente de Comunicación Política

**Problema:** Los equipos de comunicación necesitan ayuda para responder rápido.

**Solución:** AI assistant especializado en comunicación política.

```
Capacidades:
├── Generar posicionamiento sobre tema trending
├── Redactar respuesta a ataque de oponente
├── Crear talking points para entrevista
├── Sugerir momento óptimo para comunicar
├── Analizar discurso de oponente
└── Preparar Q&A anticipado
```

**Prompt de sistema:**
```
Eres un experto en comunicación política mexicana.
Ayudas a equipos de campaña y comunicación de gobierno.
Conoces el contexto político de México, los partidos, y las dinámicas mediáticas.
Tus respuestas son estratégicas, medidas, y consideran las implicaciones políticas.
```

---

## Priorización y Roadmap (Ajustado)

**Prioridades del cliente:**
1. ✅ Crisis política + Tracking de oponentes
2. ✅ Agenda + Narrativas
3. ✅ Monitoreo de redes sociales (Twitter, FB, IG, TikTok)

### Q1 2026 (Enero - Marzo) - FUNDAMENTOS + CRISIS
| Feature | Semanas | Impacto | Esfuerzo | Prioridad |
|---------|---------|---------|----------|-----------|
| Tipos de cliente político | 1 | Alto | Bajo | 🔴 |
| **Crisis política mejorada** | 2 | Muy Alto | Medio | 🔴 |
| **Análisis de oponentes** | 2 | Alto | Medio | 🔴 |
| Dashboard político | 2 | Alto | Medio | 🟡 |

### Q2 2026 (Abril - Junio) - AGENDA + NARRATIVAS
| Feature | Semanas | Impacto | Esfuerzo | Prioridad |
|---------|---------|---------|----------|-----------|
| **Tracking de agenda** | 3 | Muy Alto | Medio | 🔴 |
| **Análisis de narrativas** | 3 | Alto | Medio | 🔴 |
| Monitoreo redes sociales (básico) | 3 | Alto | Medio | 🟡 |

### Q3 2026 (Julio - Septiembre) - ELECTORAL + SOCIAL
| Feature | Semanas | Impacto | Esfuerzo | Prioridad |
|---------|---------|---------|----------|-----------|
| Módulo electoral completo | 3 | Muy Alto | Alto | 🟡 |
| Redes sociales avanzadas | 3 | Alto | Alto | 🟡 |
| Análisis geográfico | 2 | Medio | Bajo | 🟢 |

### Q4 2026 (Octubre - Diciembre) - MADUREZ
| Feature | Semanas | Impacto | Esfuerzo | Prioridad |
|---------|---------|---------|----------|-----------|
| Predicción de tendencias | 4 | Muy Alto | Alto | 🟡 |
| Analytics avanzados | 3 | Alto | Medio | 🟢 |
| Asistente de comunicación | 3 | Alto | Medio | 🟢 |

**Leyenda:** 🔴 Crítico | 🟡 Importante | 🟢 Deseable

---

## Costos Estimados

### Opción Recomendada: Monitoreo Social Económico
| Servicio | Cobertura | Costo mensual |
|----------|-----------|---------------|
| Social Searcher API | Twitter, FB, YouTube | $49-99 |
| Apify (TikTok scraper) | TikTok | $49 + uso |
| Google CSE (ya tenemos) | Web general | $0 |
| **Total redes sociales** | Multi-plataforma | **~$100-150/mes** |

### Opción Premium: Agregador Completo
| Servicio | Cobertura | Costo mensual |
|----------|-----------|---------------|
| Brandwatch/Sprinklr | Todo incluido | $800-2000 |

### Sin costo adicional (usa Claude existente)
- Análisis de narrativas
- Análisis de oponentes
- Crisis política mejorada
- Tracking de agenda
- Dashboard político

### Costo total estimado (opción económica)
| Concepto | Costo/mes |
|----------|-----------|
| Infra actual | $24 |
| Redes sociales | $100-150 |
| **Total** | **~$125-175/mes** |

---

## Archivos Críticos a Modificar/Crear

### Modificaciones a Prisma
```
prisma/schema.prisma
├── Client (agregar clientType, politicalLevel, etc.)
├── PoliticalOpponent (nuevo)
├── PoliticalCrisis (nuevo)
├── PoliticalTopic (nuevo)
├── Election (nuevo)
└── ElectionCandidate (nuevo)
```

### Nuevos Routers
```
packages/web/src/server/routers/
├── opponents.ts
├── agenda.ts
├── elections.ts
└── political-analytics.ts
```

### Nuevas Páginas
```
packages/web/src/app/dashboard/
├── opponents/page.tsx
├── agenda/page.tsx
├── elections/page.tsx
├── geographic/page.tsx
└── political-analytics/page.tsx
```

### Nuevos Workers
```
packages/workers/src/
├── analysis/opponent-analyzer.ts
├── analysis/agenda-tracker.ts
├── analysis/narrative-analyzer.ts
├── analysis/political-risk.ts
└── collectors/twitter-collector.ts (opcional)
```

---

## Verificación

```bash
# Verificar build después de cambios
npm run build

# Ejecutar tests
npm test

# Verificar migración de BD
npx prisma db push

# Deploy a staging
FORCE_DEPLOY=1 bash deploy/remote-deploy.sh

# Verificar en producción
# 1. Crear cliente político de prueba
# 2. Verificar dashboard político
# 3. Probar detección de crisis política
# 4. Verificar análisis de oponentes
```

---

## Decisiones Confirmadas

| Pregunta | Respuesta |
|----------|-----------|
| Redes sociales | ✅ Importante - incluir Twitter, FB, IG, TikTok, Web |
| Compliance INE | ✅ No requerido - solo uso interno |
| Multi-campaña | ✅ Cada campaña es cliente separado |
| Prioridades | ✅ Crisis + Oponentes primero, luego Agenda + Narrativas |

## Próximos Pasos

1. **Aprobar plan** y comenzar implementación
2. **Sprint 1 (Semana 1-2):** Tipos de cliente político + Crisis política
3. **Sprint 2 (Semana 3-4):** Análisis de oponentes + Dashboard político
4. **Evaluar** resultados y ajustar roadmap Q2

---

*Generado por análisis de innovación política - 2026-01-30*
