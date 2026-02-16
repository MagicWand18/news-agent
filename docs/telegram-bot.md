# Telegram Bot - Comandos

Documentación de los comandos del bot de Telegram de MediaBot.

**Ubicación del código:** `packages/bot/src/commands/`

## Resumen de Comandos

| Comando | Requiere Auth | Tipo | Descripción |
|---------|---------------|------|-------------|
| `/start` | No | Simple | Bienvenida e información de registro |
| `/help` | No | Simple | Lista de comandos disponibles |
| `/status` | Sí | Simple | Estado del sistema |
| `/cliente` | Sí | Conversación | Crear nuevo cliente con IA |
| `/clientes` | Sí | Simple | Listar clientes activos |
| `/keywords` | Sí | Simple | Ver/gestionar keywords de un cliente |
| `/vincular` | Sí | Simple | Vincular grupo/chat a un cliente |
| `/vincular_org` | Sí | Simple | Vincular grupo/chat a una organización (recibe TODO) |
| `/desvincular` | Sí | Simple | Desvincular chat actual de un cliente |
| `/destinatarios` | Sí | Simple | Ver destinatarios de un cliente |
| `/tarea` | Sí | Conversación | Crear nueva tarea |
| `/mistareas` | Sí | Simple | Ver tareas asignadas al usuario |
| `/pendientes` | Sí | Simple | Ver todas las tareas pendientes |
| `/resumen` | Sí | Simple | Resumen diario por cliente |

---

## Comandos de Bienvenida

### /start

Inicia la conversación con el bot y muestra información de registro.

**Archivo:** `commands/start.ts`

**Comportamiento:**
- Si el usuario está registrado: Mensaje de bienvenida
- Si no está registrado: Muestra su ID de Telegram para que un admin lo agregue

**Ejemplo:**
```
Usuario: /start
Bot: 👋 Hola! Soy MediaBot, tu asistente de monitoreo de medios.

Parece que aun no estas registrado. Pide a un administrador que te agregue al sistema.

Tu ID de Telegram es: 123456789
```

---

### /help

Muestra la lista de comandos disponibles organizada por categoría.

**Archivo:** `commands/help.ts`

**Categorías mostradas:**
- Clientes
- Telegram
- Tareas
- General

---

### /status

Muestra estadísticas generales del sistema.

**Archivo:** `commands/status.ts`

**Requiere:** Usuario registrado (sesión con orgId)

**Información mostrada:**
- Clientes activos
- Menciones últimas 24h
- Tareas pendientes
- Estado del sistema

**Ejemplo:**
```
Bot: 📊 Estado del sistema

Clientes activos: 5
Menciones (24h): 127
Tareas pendientes: 8
Sistema: ✅ Operativo
```

---

## Comandos de Clientes

### /cliente

Inicia conversación guiada para crear un nuevo cliente con IA.

**Archivo:** `commands/index.ts` (usa conversación)

**Requiere:** Usuario registrado

**Flujo:**
1. Bot solicita nombre del cliente
2. Bot solicita descripción/industria
3. IA genera keywords sugeridos
4. Usuario confirma o edita
5. Cliente creado con keywords

---

### /clientes

Lista todos los clientes activos de la organización.

**Archivo:** `commands/clientes.ts`

**Requiere:** Usuario registrado

**Muestra para cada cliente:**
- Nombre
- Cantidad de keywords
- Cantidad de menciones
- Estado de grupo interno (vinculado o no)

**Incluye:** Botones inline para ver detalle de cada cliente

---

### /keywords <cliente>

Muestra y permite gestionar keywords de un cliente.

**Archivo:** `commands/keywords.ts`

**Requiere:** Usuario registrado

**Uso:** `/keywords Coca Cola`

**Muestra keywords agrupados por tipo:**
- 📛 Nombres (NAME)
- 🏷️ Marcas (BRAND)
- ⚔️ Competidores (COMPETITOR)
- 📌 Temas (TOPIC)
- 🔄 Alias (ALIAS)

**Botones inline:**
- ➕ Agregar keyword
- 🗑️ Eliminar keyword

---

## Comandos de Telegram

### /vincular <cliente> [tipo]

Vincula el chat/grupo actual a un cliente para recibir alertas.

**Archivo:** `commands/vincular.ts`

**Requiere:** Usuario registrado

**Uso:**
```
/vincular Coca Cola           # Tipo interno por defecto en grupos
/vincular Coca Cola cliente   # Grupo del cliente
/vincular Coca Cola individual # Solo en chat privado
```

**Tipos de destinatario:**
| Tipo | Contexto | Descripción |
|------|----------|-------------|
| `interno` | Grupos | Grupo interno de la agencia (default) |
| `cliente` | Grupos | Grupo compartido con el cliente |
| `individual` | Privado | Contacto individual del cliente |

**Errores comunes:**
- Cliente no encontrado
- Chat ya vinculado

---

### /vincular_org <nombre_organizacion>

Vincula el chat/grupo actual a una organización para recibir TODAS las notificaciones de todos los clientes de esa org.

**Archivo:** `commands/vincular-org.ts`

**Requiere:** Usuario registrado

**Uso:** `/vincular_org Crisalida`

**Comportamiento:**
1. Busca la organización por nombre (case-insensitive, búsqueda parcial)
2. Crea o reactiva un `OrgTelegramRecipient` con `chatId = ctx.chat.id`
3. Preferencias iniciales: `null` (todos los tipos de notificación activados)
4. Confirma con nombre de la org y conteo de clientes

**Ejemplo:**
```
Usuario: /vincular_org Crisalida
Bot: ✅ Grupo vinculado a la organización Crisalida.

Recibirás TODAS las notificaciones de los 5 clientes de esta organización.

💡 Puedes ajustar qué tipos de notificación recibir desde el dashboard.
```

**Errores:**
- "No estas registrado en el sistema" — usuario sin sesión
- "No se encontro una organización con el nombre X" — nombre no coincide
- Sin argumentos: muestra uso y ejemplo

---

### /desvincular <cliente>

Desvincula el chat/grupo actual de un cliente.

**Archivo:** `commands/destinatarios.ts`

**Requiere:** Usuario registrado

**Uso:** `/desvincular Coca Cola`

**Resultado:** El chat deja de recibir alertas de ese cliente

---

### /destinatarios <cliente>

Lista los destinatarios de Telegram configurados para un cliente.

**Archivo:** `commands/destinatarios.ts`

**Requiere:** Usuario registrado

**Uso:** `/destinatarios Coca Cola`

**Muestra agrupado por tipo:**
```
📬 Destinatarios de Coca Cola
━━━━━━━━━━━━━━━━━━━━

🏢 Interno
  • Equipo PR Coca (123456...)

👥 Cliente (Grupo)
  • Marketing Coca (789012...)

📊 Total: 2 destinatarios
```

---

## Comandos de Tareas

### /tarea

Inicia conversación guiada para crear una nueva tarea.

**Archivo:** `commands/index.ts` (usa conversación)

**Requiere:** Usuario registrado

**Flujo:**
1. Bot solicita título
2. Bot solicita cliente relacionado (opcional)
3. Bot solicita prioridad
4. Bot solicita asignado (opcional)
5. Tarea creada

---

### /mistareas

Muestra las tareas asignadas al usuario actual.

**Archivo:** `commands/mis-tareas.ts`

**Requiere:** Usuario registrado (userId en sesión)

**Muestra:**
- Solo tareas PENDING e IN_PROGRESS
- Ordenadas por prioridad y deadline

**Formato:**
```
📋 Mis tareas (3):

🔴 🔄 Responder nota negativa [Coca Cola] | 📅 15/01/2024
🟠 ⏳ Preparar reporte mensual [Pepsi]
🟢 ⏳ Actualizar keywords [Fanta]
```

**Íconos de prioridad:**
- 🔴 URGENT
- 🟠 HIGH
- 🟡 MEDIUM
- 🟢 LOW

**Íconos de estado:**
- ⏳ PENDING
- 🔄 IN_PROGRESS

---

### /pendientes

Muestra todas las tareas pendientes de la organización.

**Archivo:** `commands/pendientes.ts`

**Requiere:** Usuario registrado

**Comportamiento:**
- Si se ejecuta en grupo vinculado a cliente: Solo tareas de ese cliente
- Si se ejecuta en otro contexto: Todas las tareas de la org

**Muestra:** Máximo 20 tareas

**Formato:**
```
📋 Tareas pendientes (5):

🔴 Urgente: Crisis de reputación [Coca Cola] → Juan | 📅 15/01
🟠 Preparar comunicado [Pepsi] → María
🟡 Análisis competencia [Fanta] → sin asignar
```

---

## Comandos de Reportes

### /resumen

Genera resumen del día (últimas 24h) para todos los clientes.

**Archivo:** `commands/resumen.ts`

**Requiere:** Usuario registrado

**Muestra para cada cliente:**
- Total de menciones
- Top 3 menciones más relevantes con:
  - Indicador de sentimiento (🟢/🔴/⚪)
  - Título truncado
  - Relevancia (/10)

**Ejemplo:**
```
📊 Resumen del dia (ultimas 24h):
━━━━━━━━━━━━━━━━━━━━

📌 Coca Cola: 12 menciones
  🟢 Coca-Cola anuncia inversión millonaria en...
     Relevancia: 9/10
  🔴 Críticas a campaña publicitaria de Coca-Cola...
     Relevancia: 8/10
  ⚪ Coca-Cola presente en evento de sustentabilidad...
     Relevancia: 7/10

📌 Pepsi: 5 menciones
  Sin menciones recientes
```

---

## Sesión del Bot

El bot mantiene una sesión para cada usuario con:

```typescript
interface SessionData {
  userId?: string;      // ID del usuario en la DB
  orgId?: string;       // ID de la organización
}
```

La sesión se crea cuando el usuario ejecuta `/start` y está registrado en el sistema (tiene `telegramUserId` vinculado).

---

## Callbacks (Botones Inline)

El bot maneja callbacks de botones inline en `commands/callbacks.ts`:

| Callback | Descripción |
|----------|-------------|
| `client_detail:{id}` | Ver detalle de cliente |
| `kw_add:{clientId}` | Agregar keyword |
| `kw_remove:{clientId}` | Eliminar keyword |

---

## Conversaciones

Las conversaciones de múltiples pasos se definen por separado y se registran con Grammy:

- `newClientConversation`: Wizard de creación de cliente
- `newTaskConversation`: Wizard de creación de tarea

Las conversaciones permiten un flujo interactivo donde el bot guía al usuario paso a paso.
