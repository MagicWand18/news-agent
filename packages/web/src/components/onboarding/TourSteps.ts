/**
 * Definición de los 15 pasos del tour de onboarding
 * Cada paso apunta a un elemento con data-tour-id específico
 */
export interface TourStep {
  target: string;
  title: string;
  content: string;
  placement?: "top" | "right" | "bottom" | "left";
}

export const tourSteps: TourStep[] = [
  {
    target: '[data-tour-id="sidebar"]',
    title: "Navegación principal",
    content:
      "Esta es la barra lateral de navegación. Desde aquí puedes acceder a todas las secciones de MediaBot.",
    placement: "right",
  },
  {
    target: '[data-tour-id="nav-dashboard"]',
    title: "Dashboard",
    content:
      "El Dashboard te muestra un resumen general con las métricas más importantes de tu monitoreo de medios.",
    placement: "right",
  },
  {
    target: '[data-tour-id="kpi-cards"]',
    title: "Indicadores clave (KPIs)",
    content:
      "Aquí ves las métricas principales: clientes activos, menciones en las últimas 24 horas y 7 días, actividad social y tareas pendientes.",
    placement: "bottom",
  },
  {
    target: '[data-tour-id="mentions-chart"]',
    title: "Evolución de menciones",
    content:
      "Este gráfico muestra la tendencia de menciones detectadas en los últimos 7 días. Identifica picos de actividad fácilmente.",
    placement: "top",
  },
  {
    target: '[data-tour-id="sentiment-chart"]',
    title: "Análisis de sentimiento",
    content:
      "Visualiza la distribución del sentimiento (positivo, negativo, neutral, mixto) de todas las menciones recientes.",
    placement: "left",
  },
  {
    target: '[data-tour-id="recent-mentions"]',
    title: "Menciones recientes",
    content:
      "Timeline de las últimas menciones detectadas. Haz clic en cualquiera para ver más detalles.",
    placement: "top",
  },
  {
    target: '[data-tour-id="nav-clients"]',
    title: "Gestión de clientes",
    content:
      "Administra tus cuentas de clientes, configura keywords de monitoreo y gestiona alertas de Telegram.",
    placement: "right",
  },
  {
    target: '[data-tour-id="nav-mentions"]',
    title: "Explorar menciones",
    content:
      "Filtra y busca menciones por cliente, sentimiento, fecha o fuente. Exporta reportes cuando lo necesites.",
    placement: "right",
  },
  {
    target: '[data-tour-id="nav-social"]',
    title: "Redes sociales",
    content:
      "Monitorea menciones en Twitter/X, Instagram y TikTok. Configura cuentas y hashtags a seguir.",
    placement: "right",
  },
  {
    target: '[data-tour-id="nav-analytics"]',
    title: "Analytics avanzado",
    content:
      "Accede a reportes detallados, comparativas entre clientes y análisis de tendencias a largo plazo.",
    placement: "right",
  },
  {
    target: '[data-tour-id="nav-intelligence"]',
    title: "Media Intelligence",
    content:
      "Obtén insights generados con IA: temas emergentes, recomendaciones estratégicas y alertas predictivas.",
    placement: "right",
  },
  {
    target: '[data-tour-id="nav-sources"]',
    title: "Fuentes de medios",
    content:
      "Administra las fuentes RSS, solicita nuevos medios y configura el alcance de tu monitoreo.",
    placement: "right",
  },
  {
    target: '[data-tour-id="nav-tasks"]',
    title: "Gestión de tareas",
    content:
      "Crea y asigna tareas de seguimiento para tu equipo. Vincula tareas a menciones específicas.",
    placement: "right",
  },
  {
    target: '[data-tour-id="nav-team"]',
    title: "Equipo",
    content:
      "Administra usuarios, asigna roles y permisos. Configura quién puede acceder a qué información.",
    placement: "right",
  },
  {
    target: '[data-tour-id="theme-toggle"]',
    title: "¡Listo para empezar!",
    content:
      "Cambia entre modo claro y oscuro según tu preferencia. Si necesitas ver este tour de nuevo, usa el botón 'Ver tutorial' en la barra lateral.",
    placement: "left",
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
