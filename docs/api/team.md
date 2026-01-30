# Team Router

Router para gestión de usuarios del equipo.

**Ubicación:** `packages/web/src/server/routers/team.ts`

## Endpoints

### list

Lista todos los usuarios de la organización.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Query |
| Auth | Requerido |
| Permisos | Todos |

**Input:** Ninguno

**Output:**
```typescript
Array<{
  id: string;
  name: string;
  email: string;
  role: Role;
  telegramUserId: string | null;
  createdAt: Date;
  _count: {
    assignedTasks: number;  // Solo PENDING/IN_PROGRESS
  };
}>
```

**Ordenamiento:** Por nombre ascendente

---

### create

Crea un nuevo usuario en la organización.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Mutation |
| Auth | Requerido |
| Permisos | Todos (típicamente solo ADMIN debería crear) |

**Input:**
| Campo | Tipo | Requerido | Default | Descripción |
|-------|------|-----------|---------|-------------|
| `name` | `string` | Sí | - | Nombre completo |
| `email` | `string` | Sí | - | Email (debe ser único) |
| `password` | `string` | Sí | - | Contraseña (ver requisitos) |
| `role` | `Role` | No | ANALYST | Rol del usuario |
| `telegramUserId` | `string` | No | - | ID de Telegram para vincular |

**Requisitos de contraseña:**
- Mínimo 8 caracteres
- Al menos una letra mayúscula
- Al menos una letra minúscula
- Al menos un dígito

**Output:** `User` (sin passwordHash)

**Errores:**
- Validación de email fallida
- Validación de contraseña fallida
- Email duplicado (manejado por Prisma)

**Notas:**
- La contraseña se hashea con bcrypt (cost factor 12)
- El usuario se crea en la misma organización del creador

---

### update

Actualiza datos de un usuario.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Mutation |
| Auth | Requerido |
| Permisos | Todos |

**Input:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `id` | `string` | Sí | ID del usuario |
| `name` | `string` | No | Nuevo nombre |
| `role` | `Role` | No | Nuevo rol |
| `telegramUserId` | `string \| null` | No | Nuevo ID de Telegram |

**Output:** `User`

**Errores:**
- `NOT_FOUND`: Usuario no encontrado o no pertenece a la org

**Notas:**
- No permite cambiar email o contraseña (requiere flujo separado)
- Solo usuarios de la misma organización pueden ser actualizados

---

## Roles

| Rol | Descripción |
|-----|-------------|
| `ADMIN` | Acceso completo a todas las funciones |
| `SUPERVISOR` | Puede ver todas las tareas y clientes |
| `ANALYST` | Acceso limitado a clientes y tareas asignadas |

## Vinculación con Telegram

El campo `telegramUserId` permite vincular un usuario con su cuenta de Telegram para:
- Recibir notificaciones personales
- Usar comandos del bot autenticado
- Crear tareas desde Telegram

**Flujo de vinculación:**
1. Usuario inicia chat con el bot: `/start`
2. Bot muestra el ID de Telegram del usuario
3. Admin agrega el ID al usuario en el sistema
4. Usuario puede usar comandos autenticados

---

## Ejemplo de Uso

```typescript
// Listar equipo
const { data: team } = trpc.team.list.useQuery();

// Crear nuevo analista
const newUser = await trpc.team.create.mutate({
  name: "Juan Pérez",
  email: "juan@agencia.com",
  password: "SecurePass123",
  role: "ANALYST",
});

// Vincular con Telegram
await trpc.team.update.mutate({
  id: newUser.id,
  telegramUserId: "123456789",
});

// Promover a supervisor
await trpc.team.update.mutate({
  id: newUser.id,
  role: "SUPERVISOR",
});
```
