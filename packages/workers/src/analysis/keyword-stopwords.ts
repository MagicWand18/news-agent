/**
 * Stopwords para filtrar keywords genéricos del onboarding.
 * Estas palabras son demasiado amplias para ser útiles como keywords de monitoreo.
 */

const GEOGRAPHIC_STOPWORDS = [
  "mexico", "méxico", "monterrey", "guadalajara", "cdmx",
  "ciudad de mexico", "ciudad de méxico", "nuevo leon", "nuevo león",
  "jalisco", "puebla", "queretaro", "querétaro", "tijuana",
  "cancun", "cancún", "merida", "mérida", "chihuahua",
  "sonora", "sinaloa", "tabasco", "veracruz", "oaxaca",
  "estados unidos", "latinoamerica", "latinoamérica",
];

const POLITICAL_STOPWORDS = [
  "gobierno", "gobierno federal", "gobierno estatal", "gobierno municipal",
  "elecciones", "congreso", "senado", "diputados", "camara",
  "partido", "politica", "política", "democracia", "legislatura",
  "presidente", "gobernador", "alcalde", "funcionario",
  "reforma", "ley", "decreto",
];

const INDUSTRY_STOPWORDS = [
  "economia", "economía", "mercado", "finanzas", "empresas",
  "negocio", "negocios", "industria", "sector", "comercio",
  "tecnologia", "tecnología", "innovacion", "innovación",
  "educacion", "educación", "salud", "seguridad", "turismo",
  "energia", "energía", "medio ambiente", "infraestructura",
  "desarrollo", "inversion", "inversión",
];

const CONNECTOR_STOPWORDS = [
  "noticias", "actualidad", "mexico hoy", "hoy", "ayer",
  "ultimo", "última", "reciente", "importante", "nacional",
  "internacional", "local", "regional", "federal", "estatal",
  "publico", "público", "privado", "social",
];

const ALL_STOPWORDS = new Set([
  ...GEOGRAPHIC_STOPWORDS,
  ...POLITICAL_STOPWORDS,
  ...INDUSTRY_STOPWORDS,
  ...CONNECTOR_STOPWORDS,
].map((w) => w.toLowerCase().trim()));

/**
 * Determina si un keyword es demasiado genérico para monitoreo.
 * Retorna true si debe ser descartado.
 */
export function isGenericKeyword(word: string): boolean {
  const normalized = word.toLowerCase().trim();
  if (normalized.length < 3) return true;
  return ALL_STOPWORDS.has(normalized);
}
