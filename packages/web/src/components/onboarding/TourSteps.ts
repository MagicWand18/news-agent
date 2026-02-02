/**
 * Definición de los pasos del tour de onboarding
 * Cada paso apunta a un elemento con data-tour-id específico
 */
export interface TourStep {
  target: string;
  title: string;
  content: string;
  placement?: "top" | "right" | "bottom" | "left";
}

export const tourSteps: TourStep[] = [
  // ==================== DASHBOARD ====================
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

  // ==================== NAVEGACIÓN PRINCIPAL ====================
  {
    target: '[data-tour-id="nav-clients"]',
    title: "Gestión de clientes",
    content:
      "Administra tus cuentas de clientes, configura keywords de monitoreo y gestiona alertas de Telegram. ¡Vamos a explorar un cliente!",
    placement: "right",
  },

  // ==================== PÁGINA DE CLIENTE (cuando está visible) ====================
  {
    target: '[data-tour-id="client-stats"]',
    title: "Estadísticas del cliente",
    content:
      "Resumen rápido: total de menciones detectadas, tareas pendientes, keywords configurados y si tiene Telegram vinculado.",
    placement: "bottom",
  },
  {
    target: '[data-tour-id="client-sov"]',
    title: "Share of Voice",
    content:
      "Mide qué porcentaje de la conversación en medios corresponde a tu cliente vs sus competidores. El SOV ponderado considera el alcance de cada medio.",
    placement: "top",
  },
  {
    target: '[data-tour-id="client-keywords"]',
    title: "Keywords de monitoreo",
    content:
      "Aquí defines qué términos monitorear: nombre del cliente, marcas, competidores, temas relevantes y alias. El sistema buscará estos términos en todas las fuentes.",
    placement: "top",
  },
  {
    target: '[data-tour-id="client-grounding"]',
    title: "Búsqueda automática",
    content:
      "Si hay pocos resultados en RSS, el sistema puede buscar noticias automáticamente con IA. Configura umbrales y frecuencia de búsqueda.",
    placement: "top",
  },
  {
    target: '[data-tour-id="client-telegram"]',
    title: "🔔 Alertas de Telegram",
    content:
      "¡MUY IMPORTANTE! Configura aquí los grupos o usuarios que recibirán alertas de menciones importantes. Agrega el bot @NewsAiBot_bot a tu grupo y usa /start para obtener el Chat ID.",
    placement: "top",
  },
  {
    target: '[data-tour-id="client-social"]',
    title: "Monitoreo de redes sociales",
    content:
      "Configura cuentas de Twitter/X, Instagram y TikTok para monitorear. Puedes agregar cuentas propias, de competidores o influencers.",
    placement: "top",
  },

  // ==================== MÁS NAVEGACIÓN ====================
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

  // ==================== ANALYTICS ====================
  {
    target: '[data-tour-id="nav-analytics"]',
    title: "Analytics avanzado",
    content:
      "Accede a reportes detallados, comparativas entre clientes y análisis de tendencias. ¡Veamos qué hay aquí!",
    placement: "right",
  },
  {
    target: '[data-tour-id="analytics-filters"]',
    title: "Filtros de Analytics",
    content:
      "Filtra por cliente, período, sentimientos y urgencias. Los gráficos se actualizan automáticamente según tu selección.",
    placement: "bottom",
  },
  {
    target: '[data-tour-id="analytics-mentions-day"]',
    title: "Menciones por día",
    content:
      "Gráfico de tendencia diaria de menciones. Identifica picos de actividad mediática y correlaciona con eventos.",
    placement: "bottom",
  },
  {
    target: '[data-tour-id="analytics-sentiment"]',
    title: "Tendencia de sentimiento",
    content:
      "Evolución semanal del sentimiento. Detecta cambios en la percepción de tu marca a lo largo del tiempo.",
    placement: "top",
  },
  {
    target: '[data-tour-id="analytics-sources"]',
    title: "Top fuentes y keywords",
    content:
      "Identifica qué medios hablan más de ti y qué términos generan más menciones. Útil para estrategia de PR.",
    placement: "top",
  },
  {
    target: '[data-tour-id="analytics-topics"]',
    title: "Temas detectados",
    content:
      "La IA extrae automáticamente los temas principales de las menciones. Los emergentes (⚡) son temas con alto volumen en 24h.",
    placement: "top",
  },
  {
    target: '[data-tour-id="analytics-social"]',
    title: "Analytics de redes sociales",
    content:
      "Métricas de Twitter, Instagram y TikTok: distribución por plataforma, tendencias y top autores.",
    placement: "top",
  },

  // ==================== INTELLIGENCE ====================
  {
    target: '[data-tour-id="nav-intelligence"]',
    title: "Media Intelligence",
    content:
      "Insights generados con IA: Share of Voice, temas emergentes y recomendaciones estratégicas. ¡Exploremos!",
    placement: "right",
  },
  {
    target: '[data-tour-id="intelligence-kpis"]',
    title: "KPIs de Intelligence",
    content:
      "SOV promedio, temas activos, temas emergentes y menciones ponderadas (según el alcance de cada medio).",
    placement: "bottom",
  },
  {
    target: '[data-tour-id="intelligence-sov"]',
    title: "Share of Voice competitivo",
    content:
      "Compara tu presencia mediática vs competidores. La tendencia te muestra si estás ganando o perdiendo relevancia.",
    placement: "top",
  },
  {
    target: '[data-tour-id="intelligence-topics"]',
    title: "Temas e insights IA",
    content:
      "Temas principales con su sentimiento y recomendaciones estratégicas generadas por IA cada semana.",
    placement: "top",
  },
  {
    target: '[data-tour-id="intelligence-tiers"]',
    title: "Fuentes por Tier",
    content:
      "Clasificación de medios por alcance: Tier 1 (nacionales, 3x peso), Tier 2 (regionales, 2x), Tier 3 (digitales, 1x).",
    placement: "top",
  },

  // ==================== RESTO DE NAVEGACIÓN ====================
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

  // ==================== CIERRE ====================
  {
    target: '[data-tour-id="theme-toggle"]',
    title: "¡Listo para empezar!",
    content:
      "Cambia entre modo claro y oscuro según tu preferencia. Si necesitas ver este tour de nuevo, usa el botón 'Ver tutorial' en la barra lateral. ¡Mucho éxito con tu monitoreo!",
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
