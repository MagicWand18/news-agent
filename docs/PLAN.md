# Plan de Desarrollo - MediaBot

## Vision del Producto

MediaBot es un sistema de monitoreo de medios que permite a agencias de comunicacion rastrear menciones de sus clientes en noticias, analizar el sentimiento con IA, y generar alertas y reportes automaticos.

## Estado Actual

### Implementado

| Feature | Estado | Notas |
|---------|--------|-------|
| Coleccion RSS | OK | 9 feeds configurados |
| Coleccion NewsData | OK | API funcionando |
| Coleccion GDELT | OK | Parser funcionando |
| Coleccion Google CSE | OK | Requiere API key |
| Deduplicacion | OK | Por URL y hash de contenido |
| Matching de keywords | OK | Case-insensitive, sin acentos |
| Analisis AI | OK | Claude 3.5 Haiku |
| Dashboard web | OK | Next.js + tRPC |
| Autenticacion | OK | NextAuth |
| Bot Telegram | OK | Grammy |
| Alertas Telegram | OK | Por urgencia |
| Digest diario | OK | 8:00 AM |
| Onboarding AI | OK | Genera keywords automaticas |
| Sistema de tareas | OK | CRUD basico |

### Pendiente / En Progreso

| Feature | Prioridad | Descripcion |
|---------|-----------|-------------|
| Trigger de onboarding | Alta | Conectar creacion de cliente con worker |
| Filtrado por relevancia | Media | Descartar menciones con relevance < 3 |
| Reportes exportables | Media | PDF/Excel de menciones |
| Analisis de tendencias | Baja | Graficos de sentiment over time |
| Multi-idioma | Baja | Soporte para ingles/portugues |

## Problemas Conocidos

### Resueltos

- [x] **Cron jobs no repiten**: BullMQ v5.1.0 tenia bugs con `upsertJobScheduler`. Solucion: actualizar a v5.56+ y usar cron patterns.

### Pendientes

- [ ] **API Anthropic sin creditos**: Requiere recargar creditos en console.anthropic.com
- [ ] **Onboarding no se dispara**: El worker existe pero no se encola al crear cliente
- [ ] **Otros clientes sin menciones**: Keywords muy especificas que no aparecen en noticias actuales

## Roadmap

### Fase 1: Estabilizacion (Actual)

- [x] Documentar arquitectura
- [x] Arreglar cron jobs de BullMQ
- [ ] Conectar onboarding a creacion de cliente
- [ ] Crear script de onboarding manual
- [ ] Verificar TypeScript compila

### Fase 2: Mejoras de Relevancia

- [ ] Implementar filtrado por relevancia minima
- [ ] Mejorar precision de matching (word boundaries)
- [ ] Agregar scoring de fuentes (tier 1, tier 2, etc)

### Fase 3: Reportes

- [ ] Exportar menciones a CSV
- [ ] Generar reporte PDF semanal
- [ ] Dashboard de estadisticas

### Fase 4: Escala

- [ ] Agregar mas fuentes RSS
- [ ] Integrar Twitter/X API
- [ ] Integrar YouTube mentions

## Metricas de Exito

| Metrica | Target | Actual |
|---------|--------|--------|
| Articulos/dia | 500+ | ~50 (cron roto) |
| Latencia coleccion->alerta | < 5 min | ~10 min |
| Precision de matching | > 90% | No medido |
| Uptime | 99.9% | No medido |

## Decisiones Tecnicas

### Modelo de AI

**Seleccion**: Claude 3.5 Haiku (`claude-3-5-haiku-20241022`)

**Razon**: Balance entre costo y calidad. Haiku es ~20x mas barato que Opus y suficiente para analisis de sentimiento y extraccion de informacion.

**Costo estimado**: ~$0.001 por mencion analizada

### Cron vs Interval

**Seleccion**: Cron patterns (`pattern: "*/10 * * * *"`) en lugar de intervals (`every: 600000`)

**Razon**: BullMQ v5.1.0 tenia bugs con `every` que causaban que los jobs dejaran de repetirse. Los cron patterns son mas confiables.

### Monorepo

**Seleccion**: npm workspaces con packages separados

**Razon**: Permite compartir tipos y configuracion entre web, workers y bot, mientras mantiene deployments independientes.

## Contacto

Para preguntas sobre el proyecto, contactar al equipo de desarrollo.
