# Troubleshooting

Guia de resolucion de problemas comunes en MediaBot.

## 1. Workers no arrancan

**Sintomas:**
- Los workers no procesan jobs
- Redis connection errors en logs
- `BullMQ` no puede conectar

**Posibles causas:**
- Redis no esta corriendo
- `REDIS_URL` mal configurado
- Variables de entorno faltantes (`DATABASE_URL`, `TELEGRAM_BOT_TOKEN`)

**Soluciones:**

```bash
# Verificar que Redis esta corriendo
docker compose ps
# Si no esta: docker compose up -d redis

# Verificar conexion a Redis
redis-cli -u $REDIS_URL ping
# Esperado: PONG

# Verificar variables de entorno requeridas
echo $DATABASE_URL
echo $REDIS_URL
echo $TELEGRAM_BOT_TOKEN
```

Si usas Docker Compose, verifica que los servicios `redis` y `postgres` estan healthy antes de iniciar workers.

---

## 2. Prisma engine not found

**Sintomas:**
- Error: `PrismaClientInitializationError: Query engine library not found`
- Funciona en dev pero falla en produccion/Docker

**Posibles causas:**
- `prisma generate` no se ejecuto
- El engine no se copio a las ubicaciones que Next.js busca en runtime
- Build de Docker no incluye el engine

**Soluciones:**

```bash
# Regenerar Prisma client
npx prisma generate

# Para Next.js en produccion, copiar engines a ubicaciones conocidas
# El script de deploy ya hace esto, pero si falla manualmente:
cp node_modules/.prisma/client/libquery_engine-* packages/web/.next/server/
cp node_modules/.prisma/client/libquery_engine-* packages/web/.next/server/chunks/
```

En Docker, asegurarse de que el `Dockerfile` ejecuta `prisma generate` despues de `pnpm install`.

---

## 3. Menciones no aparecen

**Sintomas:**
- Los collectors corren sin errores pero no se crean menciones
- El dashboard muestra 0 menciones

**Posibles causas:**
- No hay keywords configurados para el cliente
- El pre-filtro de IA esta descartando las menciones (baja relevancia)
- Los collectors no encuentran articulos nuevos
- El cliente no tiene monitoreo habilitado

**Soluciones:**

```bash
# Verificar keywords del cliente
ssh root@server "cd /opt/mediabot && docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U mediabot -c 'SELECT k.term FROM \"Keyword\" k JOIN \"Client\" c ON k.\"clientId\" = c.id WHERE c.name = '\''NombreCliente'\'''"

# Verificar articulos recolectados recientes
ssh root@server "cd /opt/mediabot && docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U mediabot -c 'SELECT COUNT(*) FROM \"Article\" WHERE \"createdAt\" > NOW() - INTERVAL '\''1 day'\'''"

# Ver logs del worker de analisis
ssh root@server "cd /opt/mediabot && docker compose -f docker-compose.prod.yml logs --tail=100 workers | grep -i 'pre-filter\|analysis\|mention'"
```

Si el pre-filtro rechaza muchas menciones, revisar las descripciones de los clientes para que el contexto de IA sea mas preciso.

---

## 4. Social collection falla

**Sintomas:**
- La coleccion social retorna 0 resultados
- Errores en logs de EnsembleData
- Posts no se guardan

**Posibles causas:**
- `ENSEMBLEDATA_TOKEN` no configurado o expirado
- Estructura de respuesta de la API cambio
- Handles o hashtags invalidos

**Soluciones por plataforma:**

### TikTok
- Posts de usuario: datos en `data.data[]` (doble data)
- Busqueda por keyword: respuesta envuelta en `{type, aweme_info}`
- Hashtag: estructura diferente con `authorInfos/itemInfos`
- Comentarios: paginan con `nextCursor` (no `cursor/has_more`)

### YouTube
- No existe endpoint `/youtube/channel/username-to-id`
- Usar `/youtube/search` y extraer `browseId` del resultado
- Videos en `richItemRenderer.content.videoRenderer`
- Comentarios en `commentThreadRenderer.comment.{properties,author,toolbar}`
- Fechas son relativas ("3 days ago"), counts formateados ("176K")

### Instagram
- Comentarios en `data.comments[].node`
- Paginacion con `nextCursor`
- El parametro `cursor` debe enviarse como string vacio (`cursor=`) en la primera request

```bash
# Verificar que EnsembleData esta configurado
echo $ENSEMBLEDATA_TOKEN

# Probar un endpoint manualmente
curl "https://ensembledata.com/apis/instagram/user/info?username=testuser&token=$ENSEMBLEDATA_TOKEN"
```

---

## 5. Notificaciones no llegan

**Sintomas:**
- Menciones se analizan pero no se envian alertas por Telegram
- El bot no responde

**Posibles causas:**
- `TELEGRAM_BOT_TOKEN` invalido
- El grupo de Telegram no tiene el `telegramGroupId` configurado en el cliente
- El bot no esta agregado al grupo
- El worker de notificaciones no esta corriendo

**Soluciones:**

```bash
# Verificar que el bot es valido
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getMe"

# Verificar que el cliente tiene grupo configurado
ssh root@server "cd /opt/mediabot && docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U mediabot -c 'SELECT name, \"telegramGroupId\" FROM \"Client\" WHERE active = true'"

# Verificar logs del worker de notificaciones
ssh root@server "cd /opt/mediabot && docker compose -f docker-compose.prod.yml logs --tail=50 workers | grep -i 'notification\|telegram'"
```

Para obtener el `telegramGroupId`: agregar el bot al grupo, enviar un mensaje, y usar `getUpdates` del bot para ver el `chat.id`.

---

## 6. Crisis no se detectan

**Sintomas:**
- Hay multiples menciones negativas pero no se crea CrisisAlert
- No llegan alertas de crisis

**Posibles causas:**
- El threshold es mas alto que la cantidad de menciones negativas
- La ventana de tiempo es muy corta
- Ya existe una crisis activa para ese cliente (no se duplica)

**Soluciones:**

Verificar la configuracion actual:

```bash
# Defaults: 3 menciones negativas en 60 minutos
echo "CRISIS_NEGATIVE_MENTION_THRESHOLD: ${CRISIS_NEGATIVE_MENTION_THRESHOLD:-3}"
echo "CRISIS_WINDOW_MINUTES: ${CRISIS_WINDOW_MINUTES:-60}"
```

La deteccion funciona asi:
1. Cada vez que se analiza una mencion NEGATIVE, se ejecuta `checkForCrisis(clientId)`
2. Cuenta menciones negativas en los ultimos `CRISIS_WINDOW_MINUTES` minutos
3. Si el conteo >= `CRISIS_NEGATIVE_MENTION_THRESHOLD`, crea alerta
4. Si ya existe una crisis ACTIVE o MONITORING, solo actualiza el conteo

Para ajustar en la base de datos (tabla `Setting`):
- `crisis.negative_spike_threshold` - Override del threshold
- `crisis.window_minutes` - Override de la ventana

---

## 7. Grounding retorna 0 resultados

**Sintomas:**
- El onboarding o analisis no encuentra articulos recientes
- Gemini grounding no retorna URLs

**Posibles causas:**
- Google no tiene resultados para las keywords del cliente
- El parsing de `groundingMetadata` cambio de formato
- La API de Gemini esta rechazando requests de grounding

**Soluciones:**

Verificar que `GOOGLE_API_KEY` es valido y tiene acceso a Gemini:

```bash
# Probar Gemini directamente
curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=$GOOGLE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"contents":[{"parts":[{"text":"test"}]}]}'
```

Si el grounding retorna `groundingMetadata` pero sin `webSearchQueries` o `groundingChunks`, la estructura puede haber cambiado. Revisar la respuesta raw en los logs.

---

## 8. Build falla

**Sintomas:**
- `pnpm build` falla con errores de TypeScript
- Errores de Prisma en tiempo de compilacion

**Posibles causas:**
- `prisma generate` no se ejecuto antes del build
- Tipos de Prisma desactualizados despues de cambiar el schema
- Errores de TypeScript strict mode

**Soluciones:**

```bash
# Paso 1: Regenerar Prisma client
npx prisma generate

# Paso 2: Verificar tipos
npx tsc --noEmit -p packages/web/tsconfig.json

# Paso 3: Build
pnpm build
```

Si el error es sobre `@prisma/client` types, asegurarse de que `prisma generate` se ejecuta en el workspace root (donde esta `prisma/schema.prisma`).

Para errores de strict mode, verificar que no haya `any` implicitos en parametros de funciones.

---

## 9. Deploy falla

**Sintomas:**
- `deploy/remote-deploy.sh` falla
- Docker build timeout
- Health check no pasa

**Posibles causas:**
- El servidor no tiene suficiente memoria para el build
- Puerto 3000 ya esta en uso
- El health check endpoint no responde

**Soluciones:**

```bash
# Verificar espacio en disco
ssh root@server "df -h"

# Verificar memoria
ssh root@server "free -m"

# Limpiar imagenes Docker viejas
ssh root@server "docker system prune -af"

# Verificar que el puerto esta libre
ssh root@server "lsof -i :3000"

# Ver logs del container que falla
ssh root@server "cd /opt/mediabot && docker compose -f docker-compose.prod.yml logs --tail=50 web"

# Forzar rebuild
FORCE_DEPLOY=1 bash deploy/remote-deploy.sh
```

Si el build consume demasiada memoria (comun en servidores de 2GB), considerar hacer el build localmente y subir la imagen.

---

## 10. Digest no se envia

**Sintomas:**
- El resumen diario no llega por Telegram
- Los recipients no reciben notificacion

**Posibles causas:**
- El cron del digest no esta configurado correctamente
- No hay recipients configurados para el digest
- No hay menciones nuevas en el periodo
- El worker de digest no esta corriendo

**Soluciones:**

```bash
# Verificar cron del digest (default: 13:00 UTC = 7:00 AM Mexico)
echo "DIGEST_CRON: ${DIGEST_CRON:-0 13 * * *}"

# Verificar recipients configurados
ssh root@server "cd /opt/mediabot && docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U mediabot -c 'SELECT c.name, c.\"telegramGroupId\" FROM \"Client\" c WHERE c.active = true AND c.\"telegramGroupId\" IS NOT NULL'"

# Verificar logs del digest
ssh root@server "cd /opt/mediabot && docker compose -f docker-compose.prod.yml logs --tail=50 workers | grep -i 'digest'"

# Verificar que hay menciones recientes
ssh root@server "cd /opt/mediabot && docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U mediabot -c 'SELECT COUNT(*) FROM \"Mention\" WHERE \"createdAt\" > NOW() - INTERVAL '\''1 day'\'''"
```

El digest solo se envia si hay menciones nuevas en el periodo. Si no hay menciones, no se genera ni envia.

---

## 11. Crisis falsas por artículos viejos

**Síntomas:**
- Múltiples CrisisAlert ACTIVE se crean al mismo tiempo
- Las crisis se disparan cuando se recolectan artículos antiguos en batch
- Falsos positivos de "pico negativo" sin que haya noticias realmente nuevas

**Posibles causas:**
- El sistema usaba `createdAt` (fecha de registro en la base de datos) en lugar de la fecha de publicación real del artículo para la lógica temporal
- Al recolectar artículos viejos, todos obtienen un `createdAt` reciente, simulando un spike falso

**Soluciones:**

Se agregó el campo `publishedAt` al modelo Mention y se migraron todas las queries temporales para usar `publishedAt` en lugar de `createdAt` (2026-02-16).

```bash
# Verificar que publishedAt está poblado en las menciones recientes
ssh root@server "cd /opt/mediabot && docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U mediabot -c 'SELECT COUNT(*) FROM \"Mention\" WHERE \"publishedAt\" IS NULL'"
```

**Prevención:** Las notificaciones ahora omiten menciones cuyo `publishedAt` es mayor a 30 días de antigüedad, evitando alertas por artículos históricos recolectados tardíamente.

---

## 12. Error al guardar Telegram ID en Settings

**Síntomas:**
- `prisma.user.update()` falla con "No record found for an update" al guardar el Telegram ID
- El formulario de Settings muestra un error inesperado al intentar vincular el Telegram ID

**Posibles causas:**
- Cache del navegador de un deployment anterior envía un formato de request incompatible con la versión actual del API

**Soluciones:**

Hacer hard refresh del navegador para limpiar el cache:

- **Safari (macOS):** Cmd + Option + R
- **Chrome / Edge:** Ctrl + Shift + R (o Cmd + Shift + R en macOS)
- **Firefox:** Ctrl + Shift + R (o Cmd + Shift + R en macOS)

Si el problema persiste, limpiar completamente el cache del navegador o abrir en ventana de incógnito.

---

## 13. Prisma db push no aplica cambios en producción

**Síntomas:**
- Columnas nuevas no existen en la base de datos después del deploy
- Errores como `column "publishedAt" does not exist` en runtime
- El schema de Prisma tiene campos que la base de datos no reconoce

**Posibles causas:**
- El script de deploy puede no ejecutar `prisma db push` automáticamente
- El container se reconstruyó pero el schema no se aplicó a la base de datos

**Soluciones:**

Ejecutar manualmente dentro del container:

```bash
ssh root@server "cd /opt/mediabot && docker compose -f docker-compose.prod.yml exec -T web \
  npx prisma db push --schema=prisma/schema.prisma --accept-data-loss"
```

Verificar que los cambios se aplicaron:

```bash
# Listar columnas de una tabla específica
ssh root@server "cd /opt/mediabot && docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U mediabot -c '\\d \"Mention\"'"
```

**Nota:** `--accept-data-loss` es necesario si Prisma detecta cambios que podrían perder datos (por ejemplo, cambiar tipos de columna). Siempre hacer backup antes de ejecutar en producción.
