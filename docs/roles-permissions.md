# Roles y Permisos - MediaBot

Documentación de la matriz de roles y permisos del sistema.

## Roles Disponibles

| Rol | Descripción |
|-----|-------------|
| **ADMIN** | Administrador con acceso completo |
| **SUPERVISOR** | Supervisor con acceso a todos los datos pero sin permisos de administración |
| **ANALYST** | Analista con acceso limitado a datos asignados |

---

## Matriz de Permisos

### Gestión de Clientes

| Acción | ADMIN | SUPERVISOR | ANALYST |
|--------|:-----:|:----------:|:-------:|
| Ver lista de clientes | ✅ | ✅ | ✅ |
| Ver detalle de cliente | ✅ | ✅ | ✅ |
| Crear cliente | ✅ | ✅ | ✅ |
| Editar cliente | ✅ | ✅ | ✅ |
| Eliminar cliente | ✅ | ❌ | ❌ |
| Agregar keywords | ✅ | ✅ | ✅ |
| Eliminar keywords | ✅ | ✅ | ✅ |
| Configurar grounding | ✅ | ✅ | ✅ |
| Ejecutar grounding manual | ✅ | ✅ | ✅ |

### Gestión de Menciones

| Acción | ADMIN | SUPERVISOR | ANALYST |
|--------|:-----:|:----------:|:-------:|
| Ver menciones | ✅ | ✅ | ✅ |
| Ver detalle de mención | ✅ | ✅ | ✅ |
| Generar comunicado IA | ✅ | ✅ | ✅ |

### Gestión de Fuentes RSS

| Acción | ADMIN | SUPERVISOR | ANALYST |
|--------|:-----:|:----------:|:-------:|
| Ver lista de fuentes | ✅ | ✅ | ✅ |
| Ver estadísticas de fuentes | ✅ | ✅ | ✅ |
| **Crear fuente** | ✅ | ❌ | ❌ |
| **Editar fuente** | ✅ | ❌ | ❌ |
| **Eliminar fuente** | ✅ | ❌ | ❌ |
| **Activar/Desactivar fuente** | ✅ | ❌ | ❌ |
| **Resetear errores** | ✅ | ❌ | ❌ |
| Solicitar nueva fuente | ✅ | ✅ | ✅ |
| Ver solicitudes propias | ✅ | ✅ | ✅ |
| **Ver todas las solicitudes** | ✅ | ❌ | ❌ |
| **Aprobar solicitudes** | ✅ | ❌ | ❌ |
| **Rechazar solicitudes** | ✅ | ❌ | ❌ |
| **Integrar solicitudes** | ✅ | ❌ | ❌ |

### Gestión de Tareas

| Acción | ADMIN | SUPERVISOR | ANALYST |
|--------|:-----:|:----------:|:-------:|
| Ver todas las tareas | ✅ | ✅ | ⚠️ Solo asignadas |
| Crear tarea | ✅ | ✅ | ✅ |
| Editar tarea | ✅ | ✅ | ⚠️ Solo asignadas |
| Asignar tareas a otros | ✅ | ✅ | ❌ |

### Gestión de Equipo

| Acción | ADMIN | SUPERVISOR | ANALYST |
|--------|:-----:|:----------:|:-------:|
| Ver lista de usuarios | ✅ | ✅ | ✅ |
| Crear usuario | ✅ | ❌ | ❌ |
| Editar usuario | ✅ | ❌ | ❌ |
| Cambiar rol de usuario | ✅ | ❌ | ❌ |
| Vincular Telegram | ✅ | ❌ | ❌ |

### Configuración del Sistema

| Acción | ADMIN | SUPERVISOR | ANALYST |
|--------|:-----:|:----------:|:-------:|
| Ver configuraciones | ✅ | ✅ | ✅ |
| **Modificar configuraciones** | ✅ | ❌ | ❌ |
| **Resetear a defaults** | ✅ | ❌ | ❌ |
| **Seed de configuraciones** | ✅ | ❌ | ❌ |

### Intelligence y Analytics

| Acción | ADMIN | SUPERVISOR | ANALYST |
|--------|:-----:|:----------:|:-------:|
| Ver Share of Voice | ✅ | ✅ | ✅ |
| Ver temas detectados | ✅ | ✅ | ✅ |
| Ver insights semanales | ✅ | ✅ | ✅ |
| Ver KPIs | ✅ | ✅ | ✅ |
| Ver tiers de fuentes | ✅ | ✅ | ✅ |

### Dashboard y Reportes

| Acción | ADMIN | SUPERVISOR | ANALYST |
|--------|:-----:|:----------:|:-------:|
| Ver estadísticas generales | ✅ | ✅ | ✅ |
| Ver menciones recientes | ✅ | ✅ | ✅ |
| Ver analíticas | ✅ | ✅ | ✅ |

### Notificaciones

| Acción | ADMIN | SUPERVISOR | ANALYST |
|--------|:-----:|:----------:|:-------:|
| Ver notificaciones propias | ✅ | ✅ | ✅ |
| Marcar como leídas | ✅ | ✅ | ✅ |
| Eliminar notificaciones | ✅ | ✅ | ✅ |

### Destinatarios de Telegram

| Acción | ADMIN | SUPERVISOR | ANALYST |
|--------|:-----:|:----------:|:-------:|
| Ver destinatarios | ✅ | ✅ | ✅ |
| Agregar destinatarios | ✅ | ✅ | ✅ |
| Editar destinatarios | ✅ | ✅ | ✅ |
| Eliminar destinatarios | ✅ | ✅ | ✅ |

---

## Implementación

### Verificación de Admin

```typescript
// packages/web/src/server/routers/sources.ts
function requireAdmin(role: string) {
  if (role !== "ADMIN") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Solo administradores pueden realizar esta acción",
    });
  }
}
```

### Middleware Admin

```typescript
// packages/web/src/server/routers/settings.ts
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "ADMIN") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Solo administradores pueden modificar configuraciones",
    });
  }
  return next({ ctx });
});
```

---

## Filtrado por Organización

Todos los datos están aislados por organización (`orgId`). Los usuarios solo pueden ver y modificar datos de su propia organización.

```typescript
// Ejemplo: Listar clientes
return prisma.client.findMany({
  where: { orgId: ctx.user.orgId },  // Filtro automático
});
```

---

## Notas de Seguridad

1. **Autenticación**: Todos los endpoints (excepto login) requieren autenticación
2. **Autorización por Org**: Los datos se filtran automáticamente por organización
3. **Autorización por Rol**: Las acciones administrativas verifican el rol ADMIN
4. **Sin Escalación**: Un usuario no puede cambiar su propio rol
5. **Soft Deletes**: Los keywords y destinatarios usan soft delete para auditoría

---

## Casos de Uso por Rol

### ADMIN
- Configurar el sistema inicialmente
- Gestionar fuentes RSS
- Crear y administrar usuarios
- Aprobar solicitudes de fuentes
- Modificar configuraciones del sistema

### SUPERVISOR
- Supervisar todos los clientes y menciones
- Gestionar tareas del equipo
- Ver reportes y analíticas completos
- Crear clientes y configurarlos

### ANALYST
- Trabajar en tareas asignadas
- Ver clientes y sus menciones
- Generar comunicados para menciones
- Solicitar nuevas fuentes
