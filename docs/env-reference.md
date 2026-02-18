# Variables de Entorno

Referencia completa de todas las variables de entorno de MediaBot.

**Archivos relevantes:**
- `.env.example` - Plantilla con valores de ejemplo
- `packages/shared/src/config.ts` - Lectura y defaults en codigo

## Base de Datos

| Variable | Descripcion | Ejemplo | Requerido | Default |
|----------|-------------|---------|-----------|---------|
| `DATABASE_URL` | URL de conexion a PostgreSQL | `postgresql://mediabot:pass@localhost:5432/mediabot` | Si | - |

## Redis

| Variable | Descripcion | Ejemplo | Requerido | Default |
|----------|-------------|---------|-----------|---------|
| `REDIS_URL` | URL de conexion a Redis (BullMQ) | `redis://localhost:6379` | No | `redis://localhost:6379` |

## Telegram

| Variable | Descripcion | Ejemplo | Requerido | Default |
|----------|-------------|---------|-----------|---------|
| `TELEGRAM_BOT_TOKEN` | Token del bot de Telegram (de @BotFather) | `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11` | Si | - |

## AI - Anthropic

| Variable | Descripcion | Ejemplo | Requerido | Default |
|----------|-------------|---------|-----------|---------|
| `ANTHROPIC_API_KEY` | API key de Anthropic (Claude) | `sk-ant-xxxxx` | Si | - |

**Nota:** Se usa para generar comunicados de prensa (`generateResponse` en el router de mentions).

## AI - Google / Gemini

| Variable | Descripcion | Ejemplo | Requerido | Default |
|----------|-------------|---------|-----------|---------|
| `GOOGLE_API_KEY` | API key de Google AI (Gemini) | `AIzaSy...` | Si | - |
| `GEMINI_MODEL` | Modelo de Gemini a usar | `gemini-2.0-flash` | No | `gemini-2.0-flash` |

**Nota:** Gemini se usa para analisis de menciones (`analyzeMention`), pre-filtro de articulos (`preFilterArticle`), sugerencia de hashtags (`suggestHashtags`), generacion de insights semanales, y deteccion de temas emergentes.

## News APIs

| Variable | Descripcion | Ejemplo | Requerido | Default |
|----------|-------------|---------|-----------|---------|
| `GOOGLE_CSE_API_KEY` | API key de Google Custom Search | `AIzaSy...` | No | `""` |
| `GOOGLE_CSE_CX` | ID del Custom Search Engine | `a1b2c3d4e5f6g7h8i` | No | `""` |
| `NEWSDATA_API_KEY` | API key de NewsData.io | `pub_xxxxx` | No | `""` |

**Nota:** Si no estan configurados, los collectors de Google CSE y NewsData simplemente no se ejecutan.

**GDELT keyword batching:** El collector GDELT agrupa keywords en batches de 8 (constante hardcodeada `GDELT_BATCH_SIZE`) con rate limit de 6 segundos entre requests. La deduplicacion se hace por URL para evitar menciones duplicadas.

**NewsData timeframe:** El parametro `timeframe` fue removido del collector NewsData porque requiere plan de pago. En plan gratuito retorna automaticamente las ultimas ~48 horas de noticias.

## Social Media

| Variable | Descripcion | Ejemplo | Requerido | Default |
|----------|-------------|---------|-----------|---------|
| `ENSEMBLEDATA_TOKEN` | Token de EnsembleData API | `your-token` | No | `""` |

**Nota:** Requerido para monitoreo de redes sociales (Instagram, TikTok, YouTube). Si no esta configurado, la validacion de handles se omite y la coleccion no funcionara.

## Auth (NextAuth)

| Variable | Descripcion | Ejemplo | Requerido | Default |
|----------|-------------|---------|-----------|---------|
| `NEXTAUTH_SECRET` | Secret para firmar tokens JWT | `super-secret-random-string` | Si | - |
| `NEXTAUTH_URL` | URL base de la aplicacion | `http://localhost:3000` | Si | - |

**Nota:** `NEXTAUTH_SECRET` debe ser un string aleatorio largo. Generar con `openssl rand -base64 32`.

## Watchdog

Sistema de alerta cuando los workers dejan de generar menciones.

| Variable | Descripcion | Ejemplo | Requerido | Default |
|----------|-------------|---------|-----------|---------|
| `WATCHDOG_ENABLED` | Habilitar/deshabilitar watchdog | `true` | No | `true` |
| `WATCHDOG_ADMIN_CHAT_ID` | Chat ID de Telegram del admin | `993823557` | No | `""` |
| `WATCHDOG_THRESHOLD_HOURS` | Horas sin menciones para alertar | `12` | No | `12` |
| `WATCHDOG_CHECK_CRON` | Cron de verificacion | `0 * * * *` | No | `0 * * * *` (cada hora) |
| `WATCHDOG_ALERT_COOLDOWN_HOURS` | Horas entre alertas repetidas | `24` | No | `24` |

## App

| Variable | Descripcion | Ejemplo | Requerido | Default |
|----------|-------------|---------|-----------|---------|
| `NODE_ENV` | Entorno de ejecucion | `development`, `production`, `test` | No | - |
| `LOG_LEVEL` | Nivel de logging | `info`, `debug`, `warn`, `error` | No | `info` |

## Redis Persistence

En produccion (`docker-compose.prod.yml`), Redis esta configurado con persistencia dual para prevenir perdida de scheduler keys y datos de colas:

- **AOF (Append Only File)**: `appendonly yes` — registra cada operacion de escritura, maxima durabilidad
- **RDB (Snapshot)**: `save 60 1000` — snapshot cada 60 segundos si hay al menos 1000 cambios
- **Volumen**: Los datos se persisten en un volumen Docker (`redis_data`) que sobrevive reinicios de contenedor

**Nota:** Sin persistencia, un reinicio de Redis causa perdida de los repeatable jobs de BullMQ (cron schedulers), dejando los collectors y workers sin ejecutar hasta que se re-registren. Como medida adicional, los schedulers se re-registran automaticamente cada 30 minutos (idempotente via `upsert`).

**Total de colas BullMQ:** 28 colas registradas en `packages/workers/src/queues.ts`.

## Collectors (Cron Schedules)

Patrones cron para los collectors de noticias. Permite ajustar frecuencia sin cambiar codigo.

| Variable | Descripcion | Ejemplo | Default |
|----------|-------------|---------|---------|
| `COLLECTOR_GDELT_CRON` | Frecuencia del collector GDELT | `*/15 * * * *` | Cada 15 min |
| `COLLECTOR_NEWSDATA_CRON` | Frecuencia del collector NewsData | `*/30 * * * *` | Cada 30 min |
| `COLLECTOR_RSS_CRON` | Frecuencia del collector RSS | `*/10 * * * *` | Cada 10 min |
| `COLLECTOR_GOOGLE_CRON` | Frecuencia del collector Google CSE | `0 */2 * * *` | Cada 2 horas |
| `COLLECTOR_GNEWS_CRON` | Frecuencia del collector Google News | `0 6 * * *` | 6:00 AM diario |
| `DIGEST_CRON` | Envio del resumen diario | `0 13 * * *` | 13:00 UTC (7 AM CST) |

**Nota:** La coleccion social es solo manual (desde el dashboard), no tiene cron.

## Workers

| Variable | Descripcion | Ejemplo | Default |
|----------|-------------|---------|---------|
| `ANALYSIS_WORKER_CONCURRENCY` | Workers de analisis en paralelo | `3` | `3` |
| `ANALYSIS_RATE_LIMIT_MAX` | Max requests de analisis por ventana | `20` | `20` |
| `ANALYSIS_RATE_LIMIT_WINDOW_MS` | Ventana de rate limit (ms) | `60000` | `60000` (1 min) |
| `NOTIFICATION_WORKER_CONCURRENCY` | Workers de notificacion en paralelo | `5` | `5` |

## Jobs

| Variable | Descripcion | Ejemplo | Default |
|----------|-------------|---------|---------|
| `JOB_RETRY_ATTEMPTS` | Intentos de reintento para jobs | `3` | `3` |
| `JOB_BACKOFF_DELAY_MS` | Delay base para backoff exponencial (ms) | `5000` | `5000` |

## Crisis Detection

| Variable | Descripcion | Ejemplo | Default |
|----------|-------------|---------|---------|
| `CRISIS_NEGATIVE_MENTION_THRESHOLD` | Menciones negativas para activar crisis | `3` | `3` |
| `CRISIS_WINDOW_MINUTES` | Ventana de tiempo para detectar spike (min) | `60` | `60` |

## Articles

| Variable | Descripcion | Ejemplo | Default |
|----------|-------------|---------|---------|
| `MAX_ARTICLE_AGE_DAYS` | Edad maxima de articulos a procesar (dias) | `30` | `30` |

## Social Collection

| Variable | Descripcion | Ejemplo | Default |
|----------|-------------|---------|---------|
| `SOCIAL_MAX_AGE_DAYS` | Edad maxima de posts sociales (dias) | `7` | `7` |
| `SOCIAL_COMMENTS_ENABLED` | Habilitar extraccion de comentarios | `true` | `true` |
| `SOCIAL_TIKTOK_MAX_COMMENTS` | Max comentarios a extraer de TikTok | `60` | `60` |
| `SOCIAL_INSTAGRAM_MAX_COMMENTS` | Max comentarios a extraer de Instagram | `30` | `30` |
| `SOCIAL_YOUTUBE_MAX_COMMENTS` | Max comentarios a extraer de YouTube | `30` | `30` |
| `SOCIAL_VIRAL_LIKES_THRESHOLD` | Likes para considerar post viral | `1000` | `1000` |
| `SOCIAL_VIRAL_COMMENTS_THRESHOLD` | Comentarios para considerar post viral | `100` | `100` |

## RSS Collector

| Variable | Descripcion | Ejemplo | Default |
|----------|-------------|---------|---------|
| `RSS_TIMEOUT` | Timeout para requests RSS (ms) | `15000` | `15000` |
| `RSS_MAX_REDIRECTS` | Max redirects para RSS | `3` | `3` |
| `RSS_ERROR_THRESHOLD` | Errores consecutivos antes de desactivar feed | `10` | `10` |
| `RSS_RETRY_ATTEMPTS` | Intentos de reintento por feed | `2` | `2` |
| `RSS_RETRY_DELAY_MS` | Delay entre reintentos (ms) | `2000` | `2000` |

## Google News RSS Collector

| Variable | Descripcion | Ejemplo | Default |
|----------|-------------|---------|---------|
| `GNEWS_TIMEOUT` | Timeout para Google News RSS (ms) | `15000` | `15000` |
| `GNEWS_RATE_LIMIT_MS` | Delay entre requests (ms) | `500` | `500` |
| `GNEWS_ERROR_THRESHOLD` | Errores consecutivos para desactivar | `10` | `10` |
