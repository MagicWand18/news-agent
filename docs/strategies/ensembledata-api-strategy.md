# Estrategia de Consumo de API - EnsembleData

**Fecha:** 2026-02-04
**Estado:** Activo
**Última actualización:** 2026-02-04

---

## 1. Justificación de Elección

EnsembleData fue seleccionado como proveedor de API para redes sociales por:

- **Cobertura multi-plataforma:** TikTok, Instagram, YouTube, Threads, Reddit, Twitch, Twitter, Snapchat
- **Datos en tiempo real:** Sin scraping local, respuestas en <5 segundos
- **Endpoints de comentarios:** Permite obtener texto real de comentarios (crítico para análisis de sentimiento público)
- **Precio competitivo:** Mejor relación costo/beneficio vs alternativas evaluadas

Ver análisis completo: [`docs/reports/2026-01-30_api-social-media-research.md`](../reports/2026-01-30_api-social-media-research.md)

---

## 2. Planes de Precios

| Plan | Units/día | Precio/mes | Clientes soportados | Caso de uso |
|------|-----------|------------|---------------------|-------------|
| **Free Trial** | 50 | $0 | 1 (pruebas) | Desarrollo/testing |
| **Wood** | 1,500 | $100 | 2-5 | Startup, MVP |
| **Bronze** | 5,000 | $200 | 5-15 | Agencia pequeña |
| **Silver** | 11,000 | $400 | 15-30 | Agencia mediana |
| **Gold** | 25,000 | $800 | 30-60 | Agencia grande |
| **Platinum** | 50,000 | $1,400 | 60+ | Enterprise |

**Plan actual:** Free Trial (50 units/día)
**Plan recomendado para producción:** Wood ($100/mes - 1,500 units/día)

---

## 3. Costos por Endpoint

### TikTok (Más económico)

| Endpoint | Costo | Datos retornados |
|----------|-------|------------------|
| User Info | 1 unit | Info completa del usuario |
| User Posts | 1 unit | 10 posts |
| **Post Comments** | **1 unit** | **30 comentarios** |
| Search Hashtag | 1 unit | 20 posts |
| Search Keyword | 1 unit | 20 posts |
| Post Information | 2 units | Info completa del post |

**Costo por comentario TikTok:** ~0.033 units

### Instagram (Más costoso)

| Endpoint | Costo | Datos retornados |
|----------|-------|------------------|
| User Info | 3 units | ID, nombre, verificado, privado |
| User Posts | #posts | 1 unit por post |
| **Post Comments** | **4 units** | **10 comentarios** |
| Post Info | 2 units | Info completa del post |
| Search Hashtag | #posts | 1 unit por post |
| User Detailed Info | 10 units | Info + 12 posts recientes |

**Costo por comentario Instagram:** ~0.40 units (12x más caro que TikTok)

### Twitter/X

| Endpoint | Costo | Datos retornados |
|----------|-------|------------------|
| User Info | 1 unit | Info del usuario |
| User Tweets | 1 unit | Tweets recientes |
| Post Info | 2 units | Info del tweet |
| **Post Comments** | **N/A** | **No disponible** |

**Nota:** EnsembleData NO ofrece endpoint de comentarios/replies para Twitter.

---

## 4. Límites de Consumo (Configurables)

### Variables de Entorno

```bash
# Límites globales
ENSEMBLEDATA_DAILY_BUDGET=1500          # Máximo units por día
ENSEMBLEDATA_ALERT_THRESHOLD=0.8        # Alertar al 80% del budget

# Límites por post (para evitar gastos excesivos en posts virales)
SOCIAL_MAX_COMMENTS_TIKTOK=60           # Máximo 60 comentarios (2 units)
SOCIAL_MAX_COMMENTS_INSTAGRAM=30        # Máximo 30 comentarios (12 units)

# Límites por cuenta
SOCIAL_MAX_POSTS_PER_ACCOUNT=5          # Posts a analizar por cuenta
SOCIAL_MAX_COMMENTS_PER_RUN=100         # Total comentarios por ejecución

# Priorización
SOCIAL_PRIORITIZE_VIRAL=true            # Priorizar posts con alto engagement
SOCIAL_VIRAL_THRESHOLD_LIKES=1000       # Umbral para considerar "viral"
SOCIAL_VIRAL_THRESHOLD_COMMENTS=100     # Umbral de comentarios para viral
```

### Estrategia de Priorización

**Los posts virales son los MÁS importantes de analizar** porque:
1. Mayor impacto en reputación del cliente
2. Mayor alcance = más personas viendo el contenido
3. Los comentarios reflejan mejor el sentimiento público

**Orden de prioridad:**
1. Posts virales (>1000 likes o >100 comentarios) - **Siempre extraer comentarios**
2. Posts recientes (últimas 24h) - Extraer comentarios si hay budget
3. Posts normales - Solo métricas básicas

### Límites de Seguridad

Para evitar gastos excesivos en posts muy virales:

| Escenario | Post con 50 comentarios | Post con 2,000 comentarios |
|-----------|-------------------------|----------------------------|
| **TikTok** | 2 units (2 requests) | **2 units** (limitado a 60) |
| **Instagram** | 20 units (5 requests) | **12 units** (limitado a 30) |

**Lógica:** Extraer máximo N comentarios, suficientes para análisis de sentimiento representativo.

---

## 5. Estimación de Consumo

### Escenario: 2 Clientes (Adrian de la Garza + Paco Cienfuegos)

**Configuración actual:**
- 6 cuentas Instagram (4 + 2)
- 4 cuentas TikTok (2 + 2)
- 4 cuentas Twitter (3 + 1)

**Consumo por ejecución (cada 4 horas):**

| Operación | Cuentas | Costo | Total |
|-----------|---------|-------|-------|
| Instagram User Info | 6 | 3 units | 18 units |
| Instagram Posts (5/cuenta) | 6 | 5 units | 30 units |
| Instagram Comments (3 posts/cuenta) | 18 posts | 4 units | 72 units |
| TikTok User Info | 4 | 1 unit | 4 units |
| TikTok Posts | 4 | 1 unit | 4 units |
| TikTok Comments (3 posts/cuenta) | 12 posts | 1 unit | 12 units |
| Twitter User Info | 4 | 1 unit | 4 units |
| Twitter Posts | 4 | 1 unit | 4 units |
| **TOTAL por ejecución** | | | **~148 units** |

**Consumo diario (6 ejecuciones):** ~888 units/día

**Con plan Wood (1,500 units/día):** Margen del 40% para crecimiento

### Escalabilidad

| Clientes | Units/día estimado | Plan recomendado |
|----------|-------------------|------------------|
| 2 | ~900 | Wood ($100) |
| 5 | ~2,250 | Bronze ($200) |
| 10 | ~4,500 | Bronze ($200) |
| 15 | ~6,750 | Silver ($400) |
| 30 | ~13,500 | Gold ($800) |

---

## 6. Monitoreo de Costos

### Métricas a Trackear

1. **Units consumidos hoy** vs budget diario
2. **Units por cliente** para facturación interna
3. **Units por plataforma** para optimización
4. **Tasa de éxito** de requests (evitar reintentos costosos)

### Alertas

| Nivel | Condición | Acción |
|-------|-----------|--------|
| Info | 50% del budget diario | Log informativo |
| Warning | 80% del budget diario | Notificar admin |
| Critical | 95% del budget diario | Pausar recolección de comentarios |
| Emergency | 100% del budget | Solo recolectar posts, no comentarios |

### Dashboard Propuesto

Agregar sección en `/dashboard/settings` o `/dashboard/analytics`:
- Gráfica de consumo diario (últimos 7 días)
- Breakdown por plataforma
- Proyección de consumo mensual
- Alertas de umbral

---

## 7. Optimizaciones Futuras

### Corto plazo
- [ ] Implementar cache de user IDs (evitar llamadas repetidas a User Info)
- [ ] Batch processing de comentarios
- [ ] Priorización inteligente basada en engagement

### Mediano plazo
- [ ] Análisis de sentimiento en batch (reducir llamadas a Gemini)
- [ ] Detección de posts ya analizados (evitar re-análisis)
- [ ] Rate limiting adaptativo

### Largo plazo
- [ ] Multi-proveedor (fallback a Apify si EnsembleData falla)
- [ ] Cache distribuido para posts frecuentes
- [ ] ML para predecir qué posts necesitan comentarios

---

## 8. Configuración en Producción

### Variables de Entorno Requeridas

```bash
# .env.production

# EnsembleData
ENSEMBLEDATA_TOKEN="tu-token-aqui"

# Límites (ajustar según plan contratado)
ENSEMBLEDATA_DAILY_BUDGET=1500
SOCIAL_MAX_COMMENTS_TIKTOK=60
SOCIAL_MAX_COMMENTS_INSTAGRAM=30
SOCIAL_MAX_POSTS_PER_ACCOUNT=5
```

### Verificación

```bash
# Verificar configuración
ssh root@159.65.97.78 "cd /opt/mediabot && cat .env | grep ENSEMBLE"

# Ver consumo actual (requiere implementar endpoint)
curl http://159.65.97.78:3000/api/admin/ensemble-usage
```

---

## 9. Decisiones Tomadas

| Decisión | Alternativas | Justificación |
|----------|--------------|---------------|
| EnsembleData como proveedor | Apify, RapidAPI, scraping propio | Mejor cobertura multi-plataforma + endpoints de comentarios |
| Límite 60 comentarios TikTok | Sin límite, 30, 100 | Balance entre representatividad y costo (2 units) |
| Límite 30 comentarios Instagram | Sin límite, 10, 50 | 12 units es costoso, 30 suficiente para sentimiento |
| Priorizar posts virales | Ignorar virales, todos igual | Virales tienen mayor impacto reputacional |
| Plan Wood inicial | Free, Bronze | 1,500 units suficiente para 2-5 clientes con margen |

---

*Documento generado: 2026-02-04*
*Próxima revisión: Al contratar plan de pago o agregar >5 clientes*
