# Settings Router

Router para configuración del sistema.

**Ubicación:** `packages/web/src/server/routers/settings.ts`

## Endpoints

### list

Lista todas las configuraciones del sistema.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Query |
| Auth | Requerido |
| Permisos | Todos (lectura) |

**Input:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `category` | `string` | No | Filtrar por categoría |

**Output:**
```typescript
{
  settings: Array<{
    key: string;
    value: string;
    type: SettingType;
    category: string;
    label: string;
    description: string | null;
  }>;
  grouped: Record<string, Setting[]>;  // Agrupado por categoría
  categories: string[];                 // Lista de categorías ordenadas
}
```

---

### get

Obtiene una configuración específica.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Query |
| Auth | Requerido |
| Permisos | Todos (lectura) |

**Input:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `key` | `string` | Sí | Clave de la configuración |

**Output:**
```typescript
{
  key: string;
  value: string;
  type: SettingType;
  category: string;
  label: string;
  description: string | null;
  isDefault: boolean;  // true si es valor por defecto
} | null
```

---

### update

Actualiza una configuración.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Mutation |
| Auth | Requerido |
| Permisos | **ADMIN** |

**Input:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `key` | `string` | Sí | Clave de la configuración |
| `value` | `string` | Sí | Nuevo valor |

**Output:**
```typescript
{
  success: true;
  key: string;
  value: string;
}
```

**Errores:**
- `FORBIDDEN`: Usuario no es admin
- `BAD_REQUEST`: Valor inválido para el tipo

**Validación por tipo:**
- `NUMBER`: Debe ser un número válido
- `BOOLEAN`: Debe ser "true" o "false"
- `JSON`: Debe ser JSON válido

---

### reset

Resetea una configuración a su valor por defecto.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Mutation |
| Auth | Requerido |
| Permisos | **ADMIN** |

**Input:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `key` | `string` | Sí | Clave de la configuración |

**Output:**
```typescript
{
  success: true;
  key: string;
  value: string;  // Valor por defecto
}
```

**Errores:**
- `NOT_FOUND`: No existe valor por defecto para esta clave

---

### seedDefaults

Crea todas las configuraciones por defecto.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Mutation |
| Auth | Requerido |
| Permisos | **ADMIN** |

**Input:** Ninguno

**Output:**
```typescript
{
  success: true;
  message: "Configuraciones por defecto creadas";
}
```

---

### categories

Lista categorías con conteo de configuraciones.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Query |
| Auth | Requerido |
| Permisos | Todos |

**Input:** Ninguno

**Output:**
```typescript
Array<{
  name: string;
  count: number;
  label: string;  // Etiqueta en español
}>
```

---

## Tipos de Configuración

| Tipo | Descripción | Ejemplo de valor |
|------|-------------|------------------|
| `STRING` | Texto libre | "valor cualquiera" |
| `NUMBER` | Número | "42" |
| `BOOLEAN` | true/false | "true" |
| `JSON` | Objeto JSON | '{"key": "value"}' |

---

## Categorías

| Categoría | Etiqueta | Descripción |
|-----------|----------|-------------|
| `general` | General | Configuraciones generales |
| `analysis` | Análisis AI | Parámetros de análisis con IA |
| `notifications` | Notificaciones | Configuración de alertas |
| `ui` | Interfaz | Preferencias de UI |
| `crisis` | Detección de Crisis | Umbrales de detección |

---

## Configuraciones por Defecto Comunes

| Key | Tipo | Categoría | Descripción |
|-----|------|-----------|-------------|
| `crisis.negative_spike_threshold` | NUMBER | crisis | Umbral de menciones negativas para crisis |
| `crisis.window_minutes` | NUMBER | crisis | Ventana de tiempo para detección |
| `analysis.min_relevance` | NUMBER | analysis | Relevancia mínima para procesar |
| `notifications.telegram_enabled` | BOOLEAN | notifications | Habilitar Telegram |
| `ui.mentions_per_page` | NUMBER | ui | Menciones por página |

---

## Ejemplo de Uso

```typescript
// Obtener todas las configuraciones agrupadas
const { data } = trpc.settings.list.useQuery();
// data.grouped.crisis -> configuraciones de crisis

// Actualizar umbral de crisis
await trpc.settings.update.mutate({
  key: "crisis.negative_spike_threshold",
  value: "10",
});

// Resetear a valor por defecto
await trpc.settings.reset.mutate({
  key: "crisis.negative_spike_threshold",
});
```

---

## Notas de Implementación

- Las configuraciones se cachean en memoria para mejor rendimiento
- `invalidateSettingsCache()` se llama automáticamente al actualizar
- Los valores por defecto se definen en `DEFAULT_SETTINGS`
