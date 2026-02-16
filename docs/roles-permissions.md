# Roles y Permisos - MediaBot

Documentación de la matriz de roles y permisos del sistema.

## Roles Disponibles

| Rol | Descripción |
|-----|-------------|
| **SUPER_ADMIN** | Administrador global con acceso a TODAS las organizaciones y configuración del sistema |
| **ADMIN** | Administrador de organización con acceso completo dentro de su org |
| **SUPERVISOR** | Supervisor con acceso a todos los datos pero sin permisos de administración |
| **ANALYST** | Analista con acceso limitado a datos asignados |

> **Nota:** Super Admin es un flag (`isSuperAdmin: true`) en el modelo User, no un rol separado. Un usuario puede ser ADMIN + Super Admin.

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

### Destinatarios de Telegram (Nivel Cliente)

| Acción | ADMIN | SUPERVISOR | ANALYST |
|--------|:-----:|:----------:|:-------:|
| Ver destinatarios | ✅ | ✅ | ✅ |
| Agregar destinatarios | ✅ | ✅ | ✅ |
| Editar destinatarios | ✅ | ✅ | ✅ |
| Eliminar destinatarios | ✅ | ✅ | ✅ |

### Destinatarios de Telegram (Nivel Organización)

| Acción | SUPER_ADMIN | ADMIN | SUPERVISOR | ANALYST |
|--------|:-----------:|:-----:|:----------:|:-------:|
| Ver recipients de org | ✅ | ❌ | ❌ | ❌ |
| Agregar recipient de org | ✅ | ❌ | ❌ | ❌ |
| Actualizar preferencias de org recipient | ✅ | ❌ | ❌ | ❌ |
| Eliminar recipient de org | ✅ | ❌ | ❌ | ❌ |

### Notificaciones Telegram (SuperAdmin)

| Acción | SUPER_ADMIN | ADMIN | SUPERVISOR | ANALYST |
|--------|:-----------:|:-----:|:----------:|:-------:|
| Ver/editar Telegram ID propio | ✅ | ❌ | ❌ | ❌ |
| Configurar preferencias de notificación | ✅ | ❌ | ❌ | ❌ |

### Gestión de Crisis

| Acción | ADMIN | SUPERVISOR | ANALYST |
|--------|:-----:|:----------:|:-------:|
| Ver lista de crisis | ✅ | ✅ | ✅ |
| Ver detalle de crisis | ✅ | ✅ | ✅ |
| Cambiar estado de crisis | ✅ | ✅ | ❌ |
| Agregar notas a crisis | ✅ | ✅ | ✅ |
| Asignar responsable | ✅ | ✅ | ❌ |

### Borradores de Comunicados

| Acción | ADMIN | SUPERVISOR | ANALYST |
|--------|:-----:|:----------:|:-------:|
| Ver borradores | ✅ | ✅ | ✅ |
| Crear borrador | ✅ | ✅ | ✅ |
| Aprobar borrador | ✅ | ✅ | ❌ |
| Publicar borrador | ✅ | ✅ | ❌ |
| Descartar borrador | ✅ | ✅ | ❌ |

### Reglas de Alerta

| Acción | ADMIN | SUPERVISOR | ANALYST |
|--------|:-----:|:----------:|:-------:|
| Ver reglas | ✅ | ✅ | ✅ |
| Crear regla | ✅ | ✅ | ❌ |
| Editar regla | ✅ | ✅ | ❌ |
| Activar/Desactivar regla | ✅ | ✅ | ❌ |
| Eliminar regla | ✅ | ❌ | ❌ |

### AI Media Briefs

| Acción | ADMIN | SUPERVISOR | ANALYST |
|--------|:-----:|:----------:|:-------:|
| Ver briefs | ✅ | ✅ | ✅ |
| Ver detalle de brief | ✅ | ✅ | ✅ |
| Ver ultimo brief | ✅ | ✅ | ✅ |

### Campañas

| Acción | ADMIN | SUPERVISOR | ANALYST |
|--------|:-----:|:----------:|:-------:|
| Ver campañas | ✅ | ✅ | ✅ |
| Crear campaña | ✅ | ✅ | ❌ |
| Editar campaña | ✅ | ✅ | ❌ |
| Eliminar campaña | ✅ | ❌ | ❌ |
| Vincular menciones | ✅ | ✅ | ✅ |
| Auto-vincular menciones | ✅ | ✅ | ❌ |
| Agregar notas | ✅ | ✅ | ✅ |

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

### SUPER_ADMIN
- Gestionar todas las organizaciones (crear, editar, eliminar)
- Reasignar clientes entre organizaciones
- Crear usuarios en cualquier organización
- Ver estadísticas globales del sistema
- Configurar notificaciones Telegram personales (10 tipos)
- Gestionar destinatarios Telegram a nivel de organización
- Recibir notificaciones de TODOS los clientes del sistema

### ADMIN
- Configurar el sistema inicialmente
- Gestionar fuentes RSS
- Crear y administrar usuarios
- Aprobar solicitudes de fuentes
- Modificar configuraciones del sistema
- Gestionar crisis y aprobar comunicados
- Crear y administrar reglas de alerta
- Crear y gestionar campañas

### SUPERVISOR
- Supervisar todos los clientes y menciones
- Gestionar tareas del equipo
- Ver reportes y analíticas completos
- Crear clientes y configurarlos
- Gestionar crisis y aprobar comunicados
- Crear reglas de alerta
- Crear y gestionar campañas

### ANALYST
- Trabajar en tareas asignadas
- Ver clientes y sus menciones
- Generar comunicados para menciones
- Solicitar nuevas fuentes
- Ver crisis, briefs y campañas (solo lectura)
