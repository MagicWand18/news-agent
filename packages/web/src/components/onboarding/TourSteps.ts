/**
 * Definición de los pasos del tour de onboarding
 * Cada paso apunta a un elemento con data-tour-id específico
 * Incluye metadata para navegación automática entre páginas
 */
export interface TourStep {
  target: string;
  title: string;
  content: string;
  placement?: "top" | "right" | "bottom" | "left";
  /** Ruta a la que navegar antes de mostrar este paso */
  route?: string;
  /** Acción especial a ejecutar antes del paso */
  action?: "openNotifications" | "scrollToElement";
  /** ID para agrupar pasos de la misma sección */
  section?: string;
}

export const tourSteps: TourStep[] = [
  // ==================== DASHBOARD ====================
  {
    target: '[data-tour-id="sidebar"]',
    title: "Navegación principal",
    content:
      "Esta es la barra lateral de navegación. Desde aquí puedes acceder a todas las secciones de MediaBot.",
    placement: "right",
    route: "/dashboard",
    section: "dashboard",
  },
  {
    target: '[data-tour-id="nav-dashboard"]',
    title: "Dashboard",
    content:
      "El Dashboard te muestra un resumen general con las métricas más importantes de tu monitoreo de medios.",
    placement: "right",
    route: "/dashboard",
    section: "dashboard",
  },
  {
    target: '[data-tour-id="kpi-cards"]',
    title: "Indicadores clave (KPIs)",
    content:
      "Aquí ves las métricas principales: clientes activos, menciones en las últimas 24 horas y 7 días, actividad social y tareas pendientes.",
    placement: "bottom",
    route: "/dashboard",
    section: "dashboard",
  },
  {
    target: '[data-tour-id="mentions-chart"]',
    title: "Evolución de menciones",
    content:
      "Este gráfico muestra la tendencia de menciones detectadas en los últimos 7 días. Identifica picos de actividad fácilmente.",
    placement: "top",
    route: "/dashboard",
    section: "dashboard",
  },
  {
    target: '[data-tour-id="sentiment-chart"]',
    title: "Análisis de sentimiento",
    content:
      "Visualiza la distribución del sentimiento (positivo, negativo, neutral, mixto) de todas las menciones recientes.",
    placement: "left",
    route: "/dashboard",
    section: "dashboard",
  },
  {
    target: '[data-tour-id="recent-mentions"]',
    title: "Menciones recientes",
    content:
      "Timeline de las últimas menciones detectadas. Haz clic en cualquiera para ver más detalles.",
    placement: "top",
    route: "/dashboard",
    section: "dashboard",
  },

  // ==================== CLIENTES (desde sidebar) ====================
  {
    target: '[data-tour-id="nav-clients"]',
    title: "Gestión de clientes",
    content:
      "Administra tus cuentas de clientes. Vamos a ver la página de clientes y luego explorar la configuración de un cliente.",
    placement: "right",
    route: "/dashboard",
    section: "clients-nav",
  },

  // ==================== PÁGINA DE CLIENTES ====================
  {
    target: '[data-tour-id="clients-list"]',
    title: "Lista de clientes",
    content:
      "Aquí ves todos tus clientes con su estado, menciones recientes y configuración. Haz clic en uno para configurarlo.",
    placement: "bottom",
    route: "/dashboard/clients",
    section: "clients",
  },

  // ==================== ANALYTICS ====================
  {
    target: '[data-tour-id="nav-analytics"]',
    title: "Analytics avanzado",
    content:
      "Accede a reportes detallados, comparativas entre clientes y análisis de tendencias. ¡Vamos a explorarlo!",
    placement: "right",
    route: "/dashboard/clients",
    section: "analytics-nav",
  },
  {
    target: '[data-tour-id="analytics-filters"]',
    title: "Filtros de Analytics",
    content:
      "Filtra por cliente, período, sentimientos y urgencias. Los gráficos se actualizan automáticamente según tu selección.",
    placement: "bottom",
    route: "/dashboard/analytics",
    section: "analytics",
  },
  {
    target: '[data-tour-id="analytics-mentions-day"]',
    title: "Menciones por día",
    content:
      "Gráfico de tendencia diaria de menciones. Identifica picos de actividad mediática y correlaciona con eventos.",
    placement: "bottom",
    route: "/dashboard/analytics",
    section: "analytics",
    action: "scrollToElement",
  },
  {
    target: '[data-tour-id="analytics-sentiment"]',
    title: "Tendencia de sentimiento",
    content:
      "Evolución semanal del sentimiento. Detecta cambios en la percepción de tu marca a lo largo del tiempo.",
    placement: "top",
    route: "/dashboard/analytics",
    section: "analytics",
    action: "scrollToElement",
  },
  {
    target: '[data-tour-id="analytics-sources"]',
    title: "Top fuentes y keywords",
    content:
      "Identifica qué medios hablan más de ti y qué términos generan más menciones. Útil para estrategia de PR.",
    placement: "top",
    route: "/dashboard/analytics",
    section: "analytics",
    action: "scrollToElement",
  },
  {
    target: '[data-tour-id="analytics-topics"]',
    title: "Temas detectados",
    content:
      "La IA extrae automáticamente los temas principales de las menciones. Los emergentes (⚡) son temas con alto volumen en 24h.",
    placement: "top",
    route: "/dashboard/analytics",
    section: "analytics",
    action: "scrollToElement",
  },
  {
    target: '[data-tour-id="analytics-social"]',
    title: "Analytics de redes sociales",
    content:
      "Métricas de Twitter, Instagram y TikTok: distribución por plataforma, tendencias y top autores.",
    placement: "top",
    route: "/dashboard/analytics",
    section: "analytics",
    action: "scrollToElement",
  },

  // ==================== INTELLIGENCE ====================
  {
    target: '[data-tour-id="nav-intelligence"]',
    title: "Media Intelligence",
    content:
      "Insights generados con IA: Share of Voice, temas emergentes y recomendaciones estratégicas. ¡Vamos a verlo!",
    placement: "right",
    route: "/dashboard/analytics",
    section: "intelligence-nav",
  },
  {
    target: '[data-tour-id="intelligence-kpis"]',
    title: "KPIs de Intelligence",
    content:
      "SOV promedio, temas activos, temas emergentes y menciones ponderadas (según el alcance de cada medio).",
    placement: "bottom",
    route: "/dashboard/intelligence",
    section: "intelligence",
  },
  {
    target: '[data-tour-id="intelligence-sov"]',
    title: "Share of Voice competitivo",
    content:
      "Compara tu presencia mediática vs competidores. La tendencia te muestra si estás ganando o perdiendo relevancia.",
    placement: "top",
    route: "/dashboard/intelligence",
    section: "intelligence",
    action: "scrollToElement",
  },
  {
    target: '[data-tour-id="intelligence-topics"]',
    title: "Temas e insights IA",
    content:
      "Temas principales con su sentimiento y recomendaciones estratégicas generadas por IA cada semana.",
    placement: "top",
    route: "/dashboard/intelligence",
    section: "intelligence",
    action: "scrollToElement",
  },
  {
    target: '[data-tour-id="intelligence-tiers"]',
    title: "Fuentes por Tier",
    content:
      "Clasificación de medios por alcance: Tier 1 (nacionales, 3x peso), Tier 2 (regionales, 2x), Tier 3 (digitales, 1x).",
    placement: "top",
    route: "/dashboard/intelligence",
    section: "intelligence",
    action: "scrollToElement",
  },

  // ==================== MENCIONES ====================
  {
    target: '[data-tour-id="nav-mentions"]',
    title: "Explorar menciones",
    content:
      "Filtra y busca menciones por cliente, sentimiento, fecha o fuente. Exporta reportes cuando lo necesites.",
    placement: "right",
    route: "/dashboard/intelligence",
    section: "mentions-nav",
  },

  // ==================== REDES SOCIALES ====================
  {
    target: '[data-tour-id="nav-social"]',
    title: "Redes sociales",
    content:
      "Monitorea menciones en Twitter/X, Instagram y TikTok. Configura cuentas y hashtags a seguir.",
    placement: "right",
    route: "/dashboard/intelligence",
    section: "social-nav",
  },

  // ==================== FUENTES ====================
  {
    target: '[data-tour-id="nav-sources"]',
    title: "Fuentes de medios",
    content:
      "Ve las fuentes RSS disponibles y solicita nuevos medios para agregar al monitoreo.",
    placement: "right",
    route: "/dashboard/intelligence",
    section: "sources-nav",
  },

  // ==================== TAREAS ====================
  {
    target: '[data-tour-id="nav-tasks"]',
    title: "Gestión de tareas",
    content:
      "Crea y asigna tareas de seguimiento para tu equipo. Vincula tareas a menciones específicas.",
    placement: "right",
    route: "/dashboard/intelligence",
    section: "tasks-nav",
  },

  // ==================== EQUIPO ====================
  {
    target: '[data-tour-id="nav-team"]',
    title: "Equipo",
    content:
      "Administra usuarios de tu agencia, asigna roles y permisos.",
    placement: "right",
    route: "/dashboard/intelligence",
    section: "team-nav",
  },

  // ==================== NOTIFICACIONES ====================
  {
    target: '[data-tour-id="notification-bell"]',
    title: "Centro de notificaciones",
    content:
      "Aquí llegarán las alertas importantes: menciones urgentes, tareas asignadas y novedades del sistema. ¡Haz clic para ver las notificaciones!",
    placement: "left",
    route: "/dashboard",
    section: "notifications",
  },

  // ==================== CIERRE ====================
  {
    target: '[data-tour-id="theme-toggle"]',
    title: "¡Listo para empezar!",
    content:
      "Cambia entre modo claro y oscuro según tu preferencia. Si necesitas ver este tour de nuevo, usa el botón 'Ver tutorial' en la barra lateral. ¡Mucho éxito con tu monitoreo!",
    placement: "left",
    route: "/dashboard",
    section: "finish",
  },
];

/**
 * Versión simplificada para mobile (sin items del sidebar que están ocultos)
 */
export const tourStepsMobile: TourStep[] = tourSteps.filter((step) => {
  const target = step.target;
  return (
    target.includes("kpi-cards") ||
    target.includes("mentions-chart") ||
    target.includes("sentiment-chart") ||
    target.includes("recent-mentions")
  );
});

/**
 * Obtiene la ruta requerida para un paso específico
 */
export function getStepRoute(stepIndex: number): string | undefined {
  return tourSteps[stepIndex]?.route;
}

/**
 * Obtiene la acción requerida para un paso específico
 */
export function getStepAction(stepIndex: number): TourStep["action"] {
  return tourSteps[stepIndex]?.action;
}
