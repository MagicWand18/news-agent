# Investigación: APIs de Redes Sociales para Monitoreo Político

**Fecha:** 2026-01-30
**Objetivo:** Validar disponibilidad, costos y complejidad de implementación de APIs para monitoreo de redes sociales
**Contexto:** Plan de innovación para sector político mexicano

---

## Resumen Ejecutivo

| API/Servicio | Disponible | Costo Mensual | Complejidad | Recomendación |
|--------------|------------|---------------|-------------|---------------|
| Twitter/X API | ✅ Sí | $200-$5,000+ | Alta | ⚠️ Muy caro |
| Facebook Graph API | ✅ Sí | Gratis* | Media | ⚠️ Limitado |
| Instagram Graph API | ✅ Sí | Gratis* | Media | ✅ Viable para @mentions |
| YouTube Data API | ✅ Sí | Gratis | Baja | ✅ Recomendado |
| Apify (TikTok) | ✅ Sí | $5-50+ | Baja | ✅ Recomendado |
| Social Searcher | ✅ Sí | $10-100 | Baja | ✅ Económico |
| Brandwatch | ✅ Sí | $800-3,000+ | Baja | ❌ Muy caro |
| Sprinklr | ✅ Sí | $1,000-5,000+ | Baja | ❌ Enterprise |
| CrowdTangle | ❌ Descontinuado | N/A | N/A | ❌ No disponible |
| Data365 | ✅ Sí | €300+ | Media | ⚠️ Caro pero completo |
| Nitter | ⚠️ Inestable | Gratis | Alta | ❌ No confiable |

**Conclusión:** El plan original subestimó los costos de Twitter/X API ($5,100+ es correcto para acceso completo) y sobreestimó opciones "gratuitas" como Nitter y CrowdTangle que ya no funcionan.

---

## 1. Twitter/X API

### Estado: ✅ Disponible pero muy caro

### Tiers de Precio (2026)

| Tier | Precio/mes | Posts/mes | Limitaciones |
|------|------------|-----------|--------------|
| **Free** | $0 | 1,500 posts (solo escritura) | Sin lectura, solo bots básicos |
| **Basic** | $200 | 10,000 posts | Búsqueda solo 7 días, insuficiente para monitoreo |
| **Pro** | $5,000 | 1,000,000 posts | Adecuado para monitoreo profesional |
| **Enterprise** | $50,000+ | 50,000,000+ | Grandes corporaciones |

### Problema Crítico
- **Gap enorme:** No hay opción intermedia entre $200 y $5,000
- **Basic es insuficiente:** Solo 7 días de búsqueda histórica, 10K tweets
- **Pro es el mínimo viable:** Para monitoreo político real necesitas Pro

### Nuevo: Pay-Per-Use Pilot (Beta)
- Sistema basado en créditos, sin fees fijos
- En beta cerrada desde diciembre 2025
- $500 voucher para pruebas
- Podría ser más económico si el volumen es bajo

### Complejidad de Implementación
- **Media-Alta:** Requiere OAuth 2.0, manejo de rate limits
- Documentación completa disponible
- SDKs oficiales para múltiples lenguajes

### Fuentes
- [Twitter/X API Pricing 2026](https://getlate.dev/blog/twitter-api-pricing)
- [X API Pay-Per-Use Pilot](https://devcommunity.x.com/t/announcing-the-x-api-pay-per-use-pricing-pilot/250253)
- [Twitter API Pricing Tiers](https://twitterapi.io/blog/twitter-api-pricing-2025)

---

## 2. Facebook Graph API

### Estado: ✅ Disponible pero limitado

### Precio
- **Gratis** para uso estándar
- **Premium:** Sin precios públicos (hay que contactar a Meta)
- **Rate limits:** Aplican restricciones por volumen

### Capacidades
- Acceso a páginas públicas de Facebook
- Información de páginas de negocio/gobierno
- Posts públicos de páginas

### Limitaciones Importantes
- **NO permite buscar por keywords** en contenido público general
- Solo puedes acceder a páginas que administras o que te autorizan
- Proceso de aprobación largo (semanas a meses)
- Sin acceso a grupos privados o perfiles personales

### Para Monitoreo Político
- **Útil solo para:** Monitorear páginas específicas de políticos/partidos
- **NO útil para:** Buscar menciones generales en Facebook

### Complejidad de Implementación
- **Media:** Requiere app review, permisos específicos
- Documentación completa pero proceso burocrático
- Cambios frecuentes en políticas de acceso

### Fuentes
- [Facebook Graph API Guide](https://data365.co/blog/facebook-graph-api-alternative)
- [Meta Graph API Considerations](https://data365.co/blog/meta-graph-api)

---

## 3. Instagram Graph API

### Estado: ✅ Disponible y viable para @mentions

### Precio
- **Gratis** con cuenta Business o Creator
- Rate limit: 200 requests/hora

### Capacidades Útiles
- `GET /{ig-user-id}/mentioned_media` - Posts donde te @mencionaron
- `GET /{ig-user-id}/mentioned_comment` - Comentarios con @mención
- Métricas de engagement de posts propios
- Business Discovery para cuentas públicas

### Limitaciones Importantes
- **NO soporta búsqueda por keywords o ubicación**
- Solo detecta @menciones directas (ej: @AMLO_oficial)
- No detecta menciones por nombre sin @
- Requiere cuenta Business vinculada a Facebook Page

### Para Monitoreo Político
- **Útil para:** Rastrear cuando @mencionan al político
- **NO útil para:** Encontrar conversaciones generales sobre el político

### Complejidad de Implementación
- **Media:** Requiere Business Account, Facebook Page vinculada
- OAuth con permisos específicos
- Buena documentación

### Fuentes
- [Instagram API Pricing Explained](https://www.getphyllo.com/post/instagram-api-pricing-explained-iv)
- [Instagram API Business Guide 2026](https://tagembed.com/blog/instagram-api/)

---

## 4. YouTube Data API v3

### Estado: ✅ Recomendado - Mejor relación costo/beneficio

### Precio
- **Gratis** con quota de 10,000 unidades/día
- Sin costo monetario directo

### Sistema de Quotas

| Operación | Costo en unidades |
|-----------|-------------------|
| List (videos, channels) | 1 unidad |
| Search | 100 unidades |
| Upload | 1,600 unidades |
| Write (update/delete) | 50 unidades |

### Capacidades
- Búsqueda de videos por keywords ✅
- Comentarios de videos ✅
- Estadísticas de canales ✅
- Trending videos ✅

### Para Monitoreo Político
- **Excelente para:** Buscar videos que mencionen al político
- Analizar comentarios y engagement
- Rastrear canales de medios y oponentes
- 10,000 unidades/día = ~100 búsquedas/día (suficiente para monitoreo)

### Complejidad de Implementación
- **Baja:** API bien documentada, SDKs oficiales
- OAuth simple para operaciones de lectura
- Quota aumentable con solicitud (requiere auditoría)

### Fuentes
- [YouTube Data API Quota Calculator](https://developers.google.com/youtube/v3/determine_quota_cost)
- [Is YouTube API Free?](https://www.getphyllo.com/post/is-the-youtube-api-free-costs-limits-iv)

---

## 5. Apify (TikTok Scraper)

### Estado: ✅ Recomendado para TikTok

### Opciones de Precio

| Scraper | Precio | Modelo |
|---------|--------|--------|
| TikTok Scraper (ApiDojo) | $0.30/1,000 posts | Pay-per-event |
| TikTok Scraper API | $0.006/query + $0.0003/post | Pay-per-use |
| Full TikTok API (Scraptik) | $0.002/request | Flat rate |
| TikTok Data Extractor | $0.005/resultado | Pay-per-result |

### Plan Base de Apify
- **Free:** $5 créditos/mes (= 1,000 resultados gratis)
- **Starter:** $49/mes
- **Scale:** Desde $499/mes

### Capacidades
- Hashtags y tendencias ✅
- Perfiles de usuarios ✅
- Videos y métricas ✅
- Comentarios ✅

### Para Monitoreo Político
- **Excelente para:** TikTok es clave para opinión pública joven
- Rastrear hashtags de campañas
- Detectar contenido viral sobre políticos
- Muy económico comparado con otras opciones

### Complejidad de Implementación
- **Baja:** API REST simple, respuestas JSON
- Documentación clara en Apify Store
- No requiere autenticación con TikTok

### Fuentes
- [Apify TikTok Scraper](https://apify.com/clockworks/tiktok-scraper)
- [Apify Pricing](https://apify.com/pricing)

---

## 6. Social Searcher API

### Estado: ✅ Opción económica viable

### Precio
- Desde **€8/mes** (~$10 USD)
- Planes hasta ~$100/mes para mayor volumen
- Trial gratuito disponible

### Plataformas Cubiertas
- Twitter ✅
- Facebook ✅
- YouTube ✅
- Instagram ✅
- TikTok ✅
- Telegram ✅

### Capacidades
- Monitoreo en tiempo real
- Sentiment analysis incluido
- Alertas automáticas
- Export CSV
- Dashboard incluido

### Limitaciones
- Volumen limitado en planes baratos
- Profundidad de datos menor que APIs directas
- Dependiente de sus propios límites con plataformas

### Para Monitoreo Político
- **Bueno para:** Arranque rápido con bajo presupuesto
- Vista unificada multi-plataforma
- No requiere manejar múltiples APIs

### Complejidad de Implementación
- **Muy Baja:** API REST simple
- Documentación básica pero funcional

### Fuentes
- [Social Searcher Pricing & Reviews 2026](https://www.techjockey.com/detail/social-searcher)
- [Best Social Listening Tools 2025-2026](https://www.getphyllo.com/post/best-social-media-listening-tools-sl)

---

## 7. Brandwatch

### Estado: ✅ Disponible pero Enterprise

### Precio
- **Mínimo:** $800/mes
- **Típico:** $2,000-$5,000/mes
- **Enterprise:** $15,000+/mes
- **Pago:** Solo anual (sin mensual)
- **Sin tier gratuito**

### Capacidades
- Cobertura completa multi-plataforma
- AI/ML avanzado para análisis
- Historical data
- Dashboards profesionales
- Sentiment analysis sofisticado

### Limitaciones
- Sin precios públicos (hay que contactar ventas)
- Pago anual obligatorio
- Overkill para operaciones pequeñas

### Para Monitoreo Político
- **Demasiado caro** para el presupuesto estimado ($100-200/mes)
- Diseñado para grandes marcas/agencias

### Fuentes
- [Brandwatch Pricing 2026](https://www.trustradius.com/products/brandwatch-listen/pricing)
- [Brandwatch Pricing Revealed](https://www.agorapulse.com/blog/social-media-management-tools/brandwatch-pricing-revealed/)

---

## 8. Sprinklr

### Estado: ✅ Disponible pero Enterprise

### Precio
- **Sin precios públicos**
- Estimado: $1,000-$5,000+/mes
- Pricing por módulo (Social, Marketing, Service, Insights)
- Contratos anuales largos

### Capacidades
- Suite completa de social media management
- Listening avanzado
- Customer care integrado
- AI/ML enterprise

### Para Monitoreo Político
- **Fuera de alcance** para presupuesto objetivo
- Requiere procurement enterprise, IT dedicado

### Fuentes
- [Sprinklr Pricing 2026](https://www.trustradius.com/products/sprinklr-social/pricing)
- [Sprinklr Pricing Complete Breakdown](https://www.socialchamp.com/blog/sprinklr-pricing/)

---

## 9. CrowdTangle (Meta)

### Estado: ❌ DESCONTINUADO

### Historia
- Herramienta gratuita de Meta para investigadores
- **Cerrado el 14 de agosto 2024**
- Reemplazado por Meta Content Library

### Meta Content Library (Reemplazo)
- **Solo para académicos e investigadores** de instituciones calificadas
- Requiere IRB approval, firmas institucionales
- Proceso de aplicación a través de ICPSR (U. of Michigan)
- **Desde 2026:** $371 USD/mes por equipo + $1,000 fee de inicio

### Para Monitoreo Político
- **NO disponible** para uso comercial/agencias
- Solo investigación académica sin fines de lucro

### Fuentes
- [CrowdTangle - Meta Transparency Center](https://transparency.meta.com/researchtools/other-data-catalogue/crowdtangle/)
- [Meta Shut Down CrowdTangle](https://techcrunch.com/2024/08/15/meta-shut-down-crowdtangle-a-tool-for-tracking-disinformation-heres-how-its-replacement-compares/)

---

## 10. Nitter (RSS de Twitter)

### Estado: ❌ NO CONFIABLE

### Historia
- Frontend alternativo para Twitter sin tracking
- **"Muerto" en febrero 2024** cuando Twitter removió guest accounts
- **Revivido en febrero 2025** pero con cambios importantes

### Situación Actual
- Requiere cuentas reales de Twitter (ya no funciona anónimamente)
- Solo ~3 instancias funcionando
- Inestable y bajo presión legal de X
- Puede dejar de funcionar en cualquier momento

### Alternativas Mencionadas
- **xcancel.com** - Funciona parcialmente
- **Squawker** - App open source para Android
- **Fritter** - App de Twitter sin tracking

### Para Monitoreo Político
- **NO recomendado** - Demasiado inestable para producción
- Riesgo de que deje de funcionar sin aviso
- No es una alternativa viable a la API oficial

### Fuentes
- [Nitter GitHub](https://github.com/zedeus/nitter)
- [Why Nitter Shut Down](https://www.cogipas.com/nitter-shut-down-x-twitter-alternatives/)

---

## 11. Data365

### Estado: ✅ Alternativa completa pero cara

### Precio
- **Basic:** €300/mes (~$325 USD) con 500,000 créditos
- **Custom:** Pricing según volumen
- **Trial:** 14 días gratis

### Plataformas Cubiertas
- Instagram ✅
- TikTok ✅
- YouTube ✅
- LinkedIn ✅
- Twitter/X ✅

### Capacidades
- API unificada para 5+ redes
- JSON normalizado
- 99.9% uptime
- 8 años de experiencia en social APIs

### Para Monitoreo Político
- **Viable si el presupuesto aumenta**
- Simplifica desarrollo (1 API vs múltiples)
- Pero ~$325/mes solo por la API (sin incluir desarrollo)

### Fuentes
- [Data365 Pricing](https://data365.co/pricing)
- [Data365 Social Media API](https://data365.co/)

---

## Recomendación Final

### Escenario 1: Presupuesto Mínimo (~$60-100/mes)

| Plataforma | Solución | Costo | Cobertura |
|------------|----------|-------|-----------|
| Twitter/X | Social Searcher | $10-50/mes | Limitada |
| TikTok | Apify Free Tier | $0-5/mes | 1,000 resultados |
| YouTube | YouTube Data API | $0 | Completa |
| Facebook/IG | Graph API + @mentions | $0 | Solo @mentions |
| **Total** | | **~$60-100/mes** | Básica |

**Limitaciones:** Twitter muy limitado, sin búsqueda general de FB/IG

---

### Escenario 2: Presupuesto Moderado (~$200-300/mes)

| Plataforma | Solución | Costo | Cobertura |
|------------|----------|-------|-----------|
| Twitter/X | X API Basic + Social Searcher | $200 + $50 | Moderada |
| TikTok | Apify Starter | $49/mes | Completa |
| YouTube | YouTube Data API | $0 | Completa |
| Facebook/IG | Graph API | $0 | Solo páginas propias |
| **Total** | | **~$250-300/mes** | Buena |

**Nota:** Twitter Basic solo tiene 7 días de histórico

---

### Escenario 3: Monitoreo Profesional (~$5,200+/mes)

| Plataforma | Solución | Costo | Cobertura |
|------------|----------|-------|-----------|
| Twitter/X | X API Pro | $5,000/mes | Completa |
| TikTok | Apify | ~$50/mes | Completa |
| YouTube | YouTube Data API | $0 | Completa |
| FB/IG | Data365 o Graph API | $0-325/mes | Completa |
| **Total** | | **~$5,200-5,400/mes** | Profesional |

---

### Escenario Recomendado: Híbrido Inteligente (~$150-200/mes)

```
Prioridad 1 - Implementar primero:
├── YouTube Data API (gratis) - Completo
├── Instagram Graph API (gratis) - @mentions
└── Apify TikTok ($49/mes) - Completo

Prioridad 2 - Agregar después:
├── Social Searcher ($50/mes) - Twitter + FB backup
└── Evaluar X API Pay-Per-Use cuando salga de beta

Total: ~$100-150/mes inicial
```

### Conclusiones Clave

1. **Twitter/X es el problema principal:** El gap $200 → $5,000 hace inviable el monitoreo profesional de Twitter a bajo costo

2. **CrowdTangle no existe:** El plan original lo mencionaba como opción gratuita, pero fue descontinuado en 2024

3. **Nitter no es viable:** Muy inestable para producción

4. **YouTube es la mejor opción:** Gratis, buen límite de quota, búsqueda por keywords funcional

5. **TikTok vía Apify es excelente:** Económico y con buena cobertura

6. **Facebook/Instagram son limitados:** Sin búsqueda por keywords, solo @mentions y páginas propias

7. **Social Searcher es el mejor "all-in-one" económico:** Pero con limitaciones de volumen

---

## ANEXO: Análisis Detallado de Apify y Plataformas Unificadas

### Apify - Todos los Scrapers Disponibles por Red Social

#### TikTok Scrapers en Apify

**El que preguntaste:** `apify.com/clockworks/tiktok-scraper`

| Scraper | Precio | Modelo |
|---------|--------|--------|
| **🎵 TikTok Scraper (clockworks)** | **$5 / 1,000 resultados** | Pay-per-result |
| TikTok Data Extractor (clockworks) | $5 / 1,000 resultados | Pay-per-result |
| TikTok Hashtag Scraper | $5 / 1,000 resultados | Pay-per-result |
| TikTok Profile Scraper | $5 / 1,000 resultados | Pay-per-result |
| TikTok API (alternativo) | $0.03/start + $0.004/item | Pay-per-event |
| TikTok Scraper (ApiDojo) | $0.30 / 1,000 posts | Pay-per-event |

**Free tier:** $5 créditos gratis/mes = 1,000 resultados TikTok gratis

---

#### Twitter/X Scrapers en Apify

| Scraper | Precio por 1,000 tweets | Notas |
|---------|------------------------|-------|
| Tweet Scraper Pay-Per-Result v2 | **$0.20** | Más económico |
| Twitter Scraper Unlimited | $0.25 | Buena opción |
| Twitter/X Scraper (open-source) | $0.30 | |
| Twitter List Scraper | $0.35 | |
| Tweet Scraper V2 (ApiDojo) | $0.40 | Popular |
| X.com Twitter API Scraper | $0.50 | |
| Twitter Data Scraper Pro | $24.99/mes + uso | Subscription |

**User scraping:** $0.30 / 1,000 usuarios

---

#### Instagram Scrapers en Apify

| Scraper | Precio por 1,000 items | Tipo |
|---------|------------------------|------|
| Instagram Posts Scraper Lowcost | **$0.25** | Posts |
| Instagram Posts Scraper | $0.40 - $0.50 | Posts |
| Instagram Comments Scraper | $2.30 | Comentarios |
| Instagram Profile Scraper | $2.60 | Perfiles |
| Instagram Reel Scraper | $2.60 | Reels |
| Instagram Search Scraper | $2.60 | Búsqueda |

**Free tier:** $5 créditos = ~2,000 comentarios o ~20,000 posts gratis/mes

---

#### Facebook Scrapers en Apify

| Scraper | Precio | Tipo |
|---------|--------|------|
| Facebook Groups Scraper | **$5 / 1,000 posts** | Grupos |
| Facebook Pages Scraper | $10 / 1,000 páginas | Páginas |
| Facebook Posts Scraper | $5 / 1,000 posts | Posts |
| Facebook Ads Scraper | $5.80 / 1,000 ads (Free), $3.40 (Business) | Anuncios |

---

#### YouTube Scrapers en Apify

| Scraper | Precio | Tipo |
|---------|--------|------|
| YouTube Video Stats Fetcher | Compute units | Stats |
| YouTube Scraper | Compute units | General |

**Nota:** YouTube Data API oficial es gratis y mejor opción.

---

### Planes de Apify (Plataforma)

| Plan | Precio/mes | Créditos | Recomendado para |
|------|------------|----------|------------------|
| **Free** | $0 | $5 | Testing |
| **Starter** | $39 | Incluidos | Proyectos pequeños |
| **Scale** | $199 | Mayor volumen | Producción |
| **Business** | $999 | Alto volumen | Enterprise |

---

## Plataformas Unificadas - Mayor Cobertura Multi-Red

### 1. EnsembleData ⭐ Mejor cobertura

**Plataformas:** TikTok, Instagram, YouTube, Threads, Reddit, Twitch, Twitter, Snapchat

| Plan | Unidades/día | Precio/mes |
|------|--------------|------------|
| Free | 50 | $0 |
| Starter | 1,500 | $100 |
| Basic | 5,000 | $200 |
| Standard | 11,000 | $400 |
| Pro | 25,000 | $800 |
| Enterprise | 50,000 | $1,400 |

**Ventajas:**
- 8 plataformas en una API
- Sin rate limits
- Real-time data
- Custom plans disponibles

**Fuente:** [EnsembleData Pricing](https://ensembledata.com/pricing)

---

### 2. Data365

**Plataformas:** Instagram, TikTok, YouTube, LinkedIn, Twitter

| Plan | Créditos | Precio/mes |
|------|----------|------------|
| Basic | 500,000 | €300 (~$325) |
| Custom | Variable | Negociable |

**Ventajas:**
- JSON normalizado
- 99.9% uptime
- 14 días trial

**Fuente:** [Data365 Pricing](https://data365.co/pricing)

---

### 3. SocialKit (socialkit.dev)

**Plataformas:** YouTube, TikTok, Instagram (incluyendo Shorts)

| Plan | Créditos | Precio/mes |
|------|----------|------------|
| Free | 20 | $0 |
| Basic | 2,000 | $13 |
| Pro | 10,000 | $27 |
| Growth | 20,000 | $39 |
| Ultimate | 50,000 | $79 |

**Ventajas:**
- Muy económico
- Integración Zapier/Make/n8n
- Video summaries con AI

**Limitación:** Enfocado en video content, no posts de texto

**Fuente:** [SocialKit](https://www.socialkit.dev/)

---

### 4. Phyllo

**Plataformas:** YouTube, Instagram, TikTok, Facebook, Twitter, Twitch, +20 más

**Pricing:** Custom, ~$20,000/año para high-scale

**Ventajas:**
- 20+ plataformas
- Data normalizada
- User-permissioned data

**Limitación:** Enterprise pricing, no apto para bajo presupuesto

**Fuente:** [Phyllo](https://www.getphyllo.com/)

---

## Comparativa: ¿Cuál Tiene Mayor Cobertura?

| Plataforma | Redes Cubiertas | Precio Mínimo | Mejor Para |
|------------|-----------------|---------------|------------|
| **EnsembleData** | 8 redes | $100/mes | ⭐ Mejor balance cobertura/precio |
| **Phyllo** | 20+ redes | ~$1,700/mes | Enterprise con presupuesto alto |
| **Data365** | 5 redes | €300/mes | Proyectos medianos |
| **SocialKit** | 3 redes (video) | $13/mes | Solo video content |
| **Apify (combinado)** | 5+ redes | $39/mes | Flexibilidad, pay-per-use |

---

## Recomendación Actualizada

### Opción A: Máxima Cobertura con Budget Limitado (~$150-200/mes)

```
├── Apify Starter ($39/mes)
│   ├── Twitter: $0.20-0.40 / 1K tweets
│   ├── TikTok: $5 / 1K resultados
│   ├── Instagram: $0.25-0.50 / 1K posts
│   └── Facebook: $5 / 1K posts
│
├── YouTube Data API (gratis)
│
└── Total estimado: ~$100-150/mes
    (depende del volumen)
```

### Opción B: API Unificada Simple (~$200-400/mes)

```
├── EnsembleData Basic/Standard ($200-400/mes)
│   └── Todo incluido: TikTok, IG, YT, Twitter, Reddit, etc.
│
├── YouTube Data API (gratis) - backup
│
└── Ventaja: Una sola integración, menos código
```

### Opción C: Mínimo Viable (~$50-100/mes)

```
├── Apify Free ($0) + pagos por uso
│   ├── TikTok: 1,000 gratis/mes
│   └── Instagram: ~2,000 gratis/mes
│
├── YouTube Data API (gratis)
│
├── Social Searcher ($50/mes) - Twitter/FB
│
└── Total: ~$50-70/mes
```

---

## Respuesta Directa a tus Preguntas

### 1. ¿Es este el TikTok scraper correcto?

**Sí**, `https://apify.com/clockworks/tiktok-scraper` es una opción válida.

**Precio:** $5 / 1,000 resultados (PPR model)
**Free:** 1,000 resultados gratis/mes con Apify Free

También existe `apify.com/apidojo/tiktok-scraper` a $0.30 / 1,000 posts que es más barato.

### 2. ¿Otras APIs de Apify útiles?

**Sí, Apify tiene scrapers para todas las redes:**
- Twitter: desde $0.20/1K tweets
- Instagram: desde $0.25/1K posts
- Facebook: desde $5/1K posts
- YouTube: compute units (mejor usar API oficial gratis)

### 3. ¿Qué plataforma cubre más redes?

| Ranking | Plataforma | Redes | Precio entrada |
|---------|------------|-------|----------------|
| 🥇 | **Phyllo** | 20+ | ~$1,700/mes |
| 🥈 | **EnsembleData** | 8 | $100/mes |
| 🥉 | **Apify (combinado)** | 6+ | $39/mes |
| 4 | **Data365** | 5 | €300/mes |

**Para tu presupuesto (~$100-200/mes): EnsembleData o Apify combinado**

---

*Investigación actualizada: 2026-01-30*
