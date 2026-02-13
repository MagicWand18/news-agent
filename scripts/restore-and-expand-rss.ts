/**
 * Script de Restauración y Expansión de Fuentes RSS México
 *
 * Tras el reset accidental de la DB de producción, este script:
 * 1. Inserta/reactiva fuentes RSS nacionales y estatales con URLs verificadas
 * 2. Configura NoRssSource para medios sin RSS nativo (Google News fallback)
 * 3. Sincroniza SourceTier para weighting de menciones
 * 4. Genera reporte de cobertura final
 *
 * Uso:
 *   npx tsx scripts/restore-and-expand-rss.ts
 *   npx tsx scripts/restore-and-expand-rss.ts --dry-run
 *   npx tsx scripts/restore-and-expand-rss.ts --state="Chihuahua"
 *   npx tsx scripts/restore-and-expand-rss.ts --skip-validation
 */

import * as dotenv from "dotenv";
import { PrismaClient, SourceType } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

dotenv.config();

const prisma = new PrismaClient();

// ─── Configuración ───────────────────────────────────────────────────────────

const CONFIG = {
  timeout: 10000,
  concurrency: 8,
  userAgent: "Mozilla/5.0 (compatible; MediaBot/1.0; RSS Restore)",
  rssContentTypes: [
    "application/rss+xml",
    "application/xml",
    "text/xml",
    "application/atom+xml",
    "application/rdf+xml",
  ],
};

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface RssSourceData {
  name: string;
  url: string;
  tier: number;
  type: SourceType;
  state: string | null;
}

interface NoRssSourceData {
  name: string;
  domain: string;
  tier: number;
  type: SourceType;
  state: string | null;
}

interface SourceTierData {
  name: string;
  domain: string;
  tier: number;
  reach?: number;
}

interface ValidationResult {
  url: string;
  valid: boolean;
  error?: string;
  httpCode?: number;
}

interface PhaseResult {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  details: Array<{ name: string; action: string; error?: string }>;
}

// ─── Fuentes Nacionales con RSS ──────────────────────────────────────────────

const NATIONAL_RSS_SOURCES: RssSourceData[] = [
  // Tier 1 - Grandes nacionales con RSS verificado
  { name: "La Jornada", url: "https://www.jornada.com.mx/rss/edicion.xml", tier: 1, type: "NATIONAL", state: null },
  { name: "La Jornada - Política", url: "https://www.jornada.com.mx/rss/politica.xml", tier: 1, type: "NATIONAL", state: null },
  { name: "Milenio", url: "https://www.milenio.com/rss", tier: 1, type: "NATIONAL", state: null },
  { name: "Milenio - Política", url: "https://www.milenio.com/rss/politica", tier: 1, type: "NATIONAL", state: null },
  { name: "Milenio - Negocios", url: "https://www.milenio.com/rss/negocios", tier: 1, type: "NATIONAL", state: null },
  { name: "Sin Embargo", url: "https://www.sinembargo.mx/feed", tier: 1, type: "NATIONAL", state: null },
  { name: "López Dóriga Digital", url: "https://lopezdoriga.com/feed/", tier: 1, type: "NATIONAL", state: null },
  { name: "El Financiero", url: "https://www.elfinanciero.com.mx/arc/outboundfeeds/rss/?outputType=xml", tier: 1, type: "NATIONAL", state: null },
  { name: "El Economista", url: "https://www.eleconomista.com.mx/rss/", tier: 1, type: "NATIONAL", state: null },
  { name: "Forbes México", url: "https://www.forbes.com.mx/feed/", tier: 1, type: "NATIONAL", state: null },
  { name: "Expansión", url: "https://expansion.mx/rss", tier: 1, type: "NATIONAL", state: null },
  { name: "La Razón", url: "https://www.razon.com.mx/feed/", tier: 1, type: "NATIONAL", state: null },
  { name: "Reporte Índigo", url: "https://www.reporteindigo.com/feed/", tier: 1, type: "NATIONAL", state: null },
  { name: "Crónica", url: "https://www.cronica.com.mx/feed", tier: 1, type: "NATIONAL", state: null },
  { name: "24 Horas", url: "https://www.24-horas.mx/feed/", tier: 1, type: "NATIONAL", state: null },

  // Tier 1 - Internacionales con cobertura México
  { name: "BBC Mundo", url: "https://feeds.bbci.co.uk/mundo/rss.xml", tier: 1, type: "NATIONAL", state: null },
  { name: "CNN en Español", url: "https://cnnespanol.cnn.com/feed/", tier: 1, type: "NATIONAL", state: null },

  // Tier 1 - Especializados nacionales
  { name: "Alto Nivel", url: "https://www.altonivel.com.mx/feed/", tier: 1, type: "SPECIALIZED", state: null },
  { name: "El CEO", url: "https://elceo.com/feed/", tier: 1, type: "SPECIALIZED", state: null },
  { name: "Político MX", url: "https://politico.mx/feed/", tier: 1, type: "SPECIALIZED", state: null },
];

// ─── Fuentes Estatales con RSS ───────────────────────────────────────────────

const STATE_RSS_SOURCES: RssSourceData[] = [
  // === CHIHUAHUA (prioridad: zero coverage) ===
  { name: "El Heraldo de Chihuahua", url: "https://www.elheraldodechihuahua.com.mx/rss.xml", tier: 2, type: "STATE", state: "Chihuahua" },
  { name: "El Diario de Chihuahua", url: "https://eldiariodechihuahua.mx/feed/", tier: 2, type: "STATE", state: "Chihuahua" },
  { name: "Norte Digital", url: "https://nortedigital.mx/feed/", tier: 2, type: "STATE", state: "Chihuahua" },
  { name: "El Pueblo de Chihuahua", url: "https://elpueblo.com/feed/", tier: 2, type: "STATE", state: "Chihuahua" },
  { name: "Net Noticias Chihuahua", url: "https://netnoticias.mx/feed/", tier: 2, type: "STATE", state: "Chihuahua" },

  // === COAHUILA (prioridad: zero coverage) ===
  { name: "Vanguardia", url: "https://vanguardia.com.mx/rss.xml", tier: 2, type: "STATE", state: "Coahuila" },
  { name: "El Siglo de Torreón", url: "https://www.elsiglodetorreon.com.mx/feed/", tier: 2, type: "STATE", state: "Coahuila" },
  { name: "Zócalo Saltillo", url: "https://www.zocalo.com.mx/feed/", tier: 2, type: "STATE", state: "Coahuila" },
  { name: "Milenio Laguna", url: "https://www.milenio.com/rss/region/laguna", tier: 2, type: "STATE", state: "Coahuila" },

  // === DURANGO (prioridad: zero coverage) ===
  { name: "El Sol de Durango", url: "https://www.elsoldedurango.com.mx/rss.xml", tier: 2, type: "STATE", state: "Durango" },
  { name: "El Siglo de Durango", url: "https://www.elsiglodedurango.com.mx/feed/", tier: 2, type: "STATE", state: "Durango" },
  { name: "Contacto Hoy Durango", url: "https://contactohoy.com.mx/feed/", tier: 2, type: "STATE", state: "Durango" },

  // === MORELOS (prioridad: zero coverage) ===
  { name: "El Sol de Cuernavaca", url: "https://www.elsoldecuernavaca.com.mx/rss.xml", tier: 2, type: "STATE", state: "Morelos" },
  { name: "Diario de Morelos", url: "https://www.diariodemorelos.com/feed", tier: 2, type: "STATE", state: "Morelos" },
  { name: "La Unión de Morelos", url: "https://www.launion.com.mx/feed", tier: 2, type: "STATE", state: "Morelos" },
  { name: "Zona Centro Noticias Morelos", url: "https://zonacentronoticias.com/feed/", tier: 2, type: "STATE", state: "Morelos" },

  // === SAN LUIS POTOSÍ (prioridad: zero coverage) ===
  { name: "Pulso SLP", url: "https://pulsoslp.com.mx/feed", tier: 2, type: "STATE", state: "San Luis Potosí" },
  { name: "El Sol de San Luis", url: "https://www.elsoldesanluis.com.mx/rss.xml", tier: 2, type: "STATE", state: "San Luis Potosí" },
  { name: "Plano Informativo", url: "https://planoinformativo.com/feed", tier: 2, type: "STATE", state: "San Luis Potosí" },
  { name: "Código San Luis", url: "https://codigosanluis.com/feed/", tier: 2, type: "STATE", state: "San Luis Potosí" },

  // === SINALOA (prioridad: zero coverage) ===
  { name: "Noroeste", url: "https://www.noroeste.com.mx/rss", tier: 2, type: "STATE", state: "Sinaloa" },
  { name: "El Debate", url: "https://www.debate.com.mx/rss/feed.xml", tier: 2, type: "STATE", state: "Sinaloa" },
  { name: "Línea Directa", url: "https://lineadirectaportal.com/feed/", tier: 2, type: "STATE", state: "Sinaloa" },
  { name: "El Sol de Sinaloa", url: "https://www.elsoldesinaloa.com.mx/rss.xml", tier: 2, type: "STATE", state: "Sinaloa" },
  { name: "Ríodoce", url: "https://riodoce.mx/feed/", tier: 2, type: "STATE", state: "Sinaloa" },

  // === VERACRUZ (prioridad: zero coverage) ===
  { name: "Al Calor Político", url: "https://www.alcalorpolitico.com/feed/", tier: 2, type: "STATE", state: "Veracruz" },
  { name: "Diario de Xalapa", url: "https://www.diariodexalapa.com.mx/rss.xml", tier: 2, type: "STATE", state: "Veracruz" },
  { name: "Imagen del Golfo", url: "https://imagendelgolfo.mx/feed", tier: 2, type: "STATE", state: "Veracruz" },
  { name: "E-Consulta Veracruz", url: "https://www.e-veracruz.mx/feed", tier: 2, type: "STATE", state: "Veracruz" },
  { name: "La Política Online Veracruz", url: "https://noticias.olvera.com.mx/feed/", tier: 2, type: "STATE", state: "Veracruz" },

  // === AGUASCALIENTES ===
  { name: "El Sol del Centro", url: "https://www.elsoldelcentro.com.mx/rss.xml", tier: 2, type: "STATE", state: "Aguascalientes" },
  { name: "Hidrocálido", url: "https://www.hidrocalidodigital.com/feed/", tier: 2, type: "STATE", state: "Aguascalientes" },
  { name: "LJA.mx", url: "https://www.lja.mx/feed/", tier: 2, type: "STATE", state: "Aguascalientes" },

  // === BAJA CALIFORNIA ===
  { name: "El Sol de Tijuana", url: "https://www.elsoldetijuana.com.mx/rss.xml", tier: 2, type: "STATE", state: "Baja California" },
  { name: "Frontera", url: "https://www.frontera.info/rss.xml", tier: 2, type: "STATE", state: "Baja California" },
  { name: "La Voz de la Frontera", url: "https://www.lavozdelafrontera.com.mx/rss.xml", tier: 2, type: "STATE", state: "Baja California" },
  { name: "Uniradio Noticias", url: "https://www.uniradionoticias.com/feed/", tier: 2, type: "STATE", state: "Baja California" },

  // === BAJA CALIFORNIA SUR ===
  { name: "El Sudcaliforniano", url: "https://www.elsudcaliforniano.com.mx/rss.xml", tier: 2, type: "STATE", state: "Baja California Sur" },
  { name: "BCS Noticias", url: "https://www.bcsnoticias.mx/feed/", tier: 2, type: "STATE", state: "Baja California Sur" },
  { name: "Diario El Independiente", url: "https://www.diarioelindependiente.mx/feed", tier: 2, type: "STATE", state: "Baja California Sur" },

  // === CAMPECHE ===
  { name: "Tribuna Campeche", url: "https://tribunacampeche.com/feed/", tier: 2, type: "STATE", state: "Campeche" },
  { name: "Crónica de Campeche", url: "https://cronicacampeche.com/feed/", tier: 2, type: "STATE", state: "Campeche" },
  { name: "Por Esto Campeche", url: "https://www.poresto.net/campeche/feed/", tier: 2, type: "STATE", state: "Campeche" },

  // === CHIAPAS ===
  { name: "El Heraldo de Chiapas", url: "https://www.elheraldodechiapas.com.mx/rss.xml", tier: 2, type: "STATE", state: "Chiapas" },
  { name: "Diario de Chiapas", url: "https://www.diariodechiapas.com/feed/", tier: 2, type: "STATE", state: "Chiapas" },
  { name: "Aquí Noticias Chiapas", url: "https://aquinoticias.mx/feed/", tier: 2, type: "STATE", state: "Chiapas" },
  { name: "Chiapas Paralelo", url: "https://www.chiapasparalelo.com/feed/", tier: 2, type: "STATE", state: "Chiapas" },

  // === CIUDAD DE MÉXICO ===
  { name: "Chilango", url: "https://www.chilango.com/feed/", tier: 2, type: "STATE", state: "Ciudad de México" },
  { name: "Capital CDMX", url: "https://www.capitalcdmx.org/feed/", tier: 2, type: "STATE", state: "Ciudad de México" },
  { name: "La Lista", url: "https://la-lista.com/feed", tier: 2, type: "STATE", state: "Ciudad de México" },

  // === COLIMA ===
  { name: "Diario de Colima", url: "https://www.diariodecolima.com/feed/", tier: 2, type: "STATE", state: "Colima" },
  { name: "El Comentario", url: "https://elcomentario.ucol.mx/feed/", tier: 2, type: "STATE", state: "Colima" },
  { name: "AF Medios Colima", url: "https://www.afmedios.com/feed/", tier: 2, type: "STATE", state: "Colima" },

  // === ESTADO DE MÉXICO ===
  { name: "El Sol de Toluca", url: "https://www.elsoldetoluca.com.mx/rss.xml", tier: 2, type: "STATE", state: "Estado de México" },
  { name: "Milenio Edomex", url: "https://www.milenio.com/rss/estados/estado-de-mexico", tier: 2, type: "STATE", state: "Estado de México" },
  { name: "Hoy Estado de México", url: "https://www.hoyestado.com/feed/", tier: 2, type: "STATE", state: "Estado de México" },
  { name: "8 Columnas", url: "https://8columnas.com.mx/feed/", tier: 2, type: "STATE", state: "Estado de México" },

  // === GUANAJUATO ===
  { name: "AM León", url: "https://www.am.com.mx/feed", tier: 2, type: "STATE", state: "Guanajuato" },
  { name: "Zona Franca", url: "https://zonafranca.mx/feed/", tier: 2, type: "STATE", state: "Guanajuato" },
  { name: "El Sol del Bajío", url: "https://www.elsoldelbajio.com.mx/rss.xml", tier: 2, type: "STATE", state: "Guanajuato" },
  { name: "Periódico Correo", url: "https://periodicocorreo.com.mx/feed/", tier: 2, type: "STATE", state: "Guanajuato" },

  // === GUERRERO ===
  { name: "El Sur de Acapulco", url: "https://suracapulco.mx/feed/", tier: 2, type: "STATE", state: "Guerrero" },
  { name: "Quadratín Guerrero", url: "https://guerrero.quadratin.com.mx/feed/", tier: 2, type: "STATE", state: "Guerrero" },
  { name: "Novedades Acapulco", url: "https://novedadesacapulco.mx/feed/", tier: 2, type: "STATE", state: "Guerrero" },

  // === HIDALGO ===
  { name: "Quadratín Hidalgo", url: "https://hidalgo.quadratin.com.mx/feed/", tier: 2, type: "STATE", state: "Hidalgo" },
  { name: "Criterio Hidalgo", url: "https://www.criteriohidalgo.com/feed", tier: 2, type: "STATE", state: "Hidalgo" },
  { name: "Milenio Hidalgo", url: "https://www.milenio.com/rss/estados/hidalgo", tier: 2, type: "STATE", state: "Hidalgo" },
  { name: "Plaza Juárez Hidalgo", url: "https://plazajuarez.mx/feed/", tier: 2, type: "STATE", state: "Hidalgo" },

  // === JALISCO ===
  { name: "Informador", url: "https://www.informador.mx/rss/ultimas-noticias.xml", tier: 2, type: "STATE", state: "Jalisco" },
  { name: "El Occidental", url: "https://www.eloccidental.com.mx/rss.xml", tier: 2, type: "STATE", state: "Jalisco" },
  { name: "NTR Guadalajara", url: "https://www.ntrguadalajara.com/feed/", tier: 2, type: "STATE", state: "Jalisco" },
  { name: "Milenio Jalisco", url: "https://www.milenio.com/rss/estados/jalisco", tier: 2, type: "STATE", state: "Jalisco" },
  { name: "Quadratín Jalisco", url: "https://jalisco.quadratin.com.mx/feed/", tier: 2, type: "STATE", state: "Jalisco" },

  // === MICHOACÁN ===
  { name: "La Voz de Michoacán", url: "https://www.lavozdemichoacan.com.mx/feed/", tier: 2, type: "STATE", state: "Michoacán" },
  { name: "Quadratín Michoacán", url: "https://www.quadratin.com.mx/feed/", tier: 2, type: "STATE", state: "Michoacán" },
  { name: "Cambio de Michoacán", url: "https://www.cambiodemichoacan.com.mx/feed", tier: 2, type: "STATE", state: "Michoacán" },

  // === NAYARIT ===
  { name: "Meridiano Nayarit", url: "https://www.meridiano.mx/feed/", tier: 2, type: "STATE", state: "Nayarit" },
  { name: "NTV Nayarit", url: "https://www.ntv.com.mx/feed/", tier: 2, type: "STATE", state: "Nayarit" },
  { name: "Nayarit en Línea", url: "https://nayaritenlinea.mx/feed/", tier: 2, type: "STATE", state: "Nayarit" },

  // === NUEVO LEÓN ===
  { name: "ABC Noticias", url: "https://abcnoticias.mx/feed/", tier: 2, type: "STATE", state: "Nuevo León" },
  { name: "Telediario", url: "https://www.telediario.mx/feed", tier: 2, type: "STATE", state: "Nuevo León" },
  { name: "Info7", url: "https://www.info7.mx/feed/", tier: 2, type: "STATE", state: "Nuevo León" },
  { name: "Milenio Monterrey", url: "https://www.milenio.com/rss/region/monterrey", tier: 2, type: "STATE", state: "Nuevo León" },
  { name: "El Horizonte", url: "https://www.elhorizonte.mx/feed/", tier: 2, type: "STATE", state: "Nuevo León" },

  // === OAXACA ===
  { name: "Quadratín Oaxaca", url: "https://oaxaca.quadratin.com.mx/feed/", tier: 2, type: "STATE", state: "Oaxaca" },
  { name: "El Imparcial Oaxaca", url: "https://imparcialoaxaca.mx/feed/", tier: 2, type: "STATE", state: "Oaxaca" },
  { name: "NVI Noticias Oaxaca", url: "https://www.nvinoticias.com/feed", tier: 2, type: "STATE", state: "Oaxaca" },

  // === PUEBLA ===
  { name: "E-Consulta Puebla", url: "https://www.e-consulta.com/feed", tier: 2, type: "STATE", state: "Puebla" },
  { name: "El Sol de Puebla", url: "https://www.elsoldepuebla.com.mx/rss.xml", tier: 2, type: "STATE", state: "Puebla" },
  { name: "Municipios Puebla", url: "https://municipiospuebla.mx/feed", tier: 2, type: "STATE", state: "Puebla" },
  { name: "Milenio Puebla", url: "https://www.milenio.com/rss/estados/puebla", tier: 2, type: "STATE", state: "Puebla" },

  // === QUERÉTARO ===
  { name: "Diario de Querétaro", url: "https://www.diariodequeretaro.com.mx/rss.xml", tier: 2, type: "STATE", state: "Querétaro" },
  { name: "AM Querétaro", url: "https://amqueretaro.com/feed/", tier: 2, type: "STATE", state: "Querétaro" },
  { name: "Plaza de Armas Querétaro", url: "https://plazadearmas.com.mx/feed/", tier: 2, type: "STATE", state: "Querétaro" },

  // === QUINTANA ROO ===
  { name: "Novedades Quintana Roo", url: "https://sipse.com/novedades/feed/", tier: 2, type: "STATE", state: "Quintana Roo" },
  { name: "Luces del Siglo", url: "https://lucesdelsiglo.com/feed/", tier: 2, type: "STATE", state: "Quintana Roo" },
  { name: "Por Esto QRoo", url: "https://www.poresto.net/quintana-roo/feed/", tier: 2, type: "STATE", state: "Quintana Roo" },
  { name: "Noticaribe", url: "https://noticaribe.com.mx/feed/", tier: 2, type: "STATE", state: "Quintana Roo" },

  // === SONORA ===
  { name: "Proyecto Puente", url: "https://proyectopuente.com.mx/feed/", tier: 2, type: "STATE", state: "Sonora" },
  { name: "Expreso", url: "https://www.expreso.com.mx/feed/", tier: 2, type: "STATE", state: "Sonora" },
  { name: "El Imparcial Sonora", url: "https://www.elimparcial.com/feed/", tier: 2, type: "STATE", state: "Sonora" },
  { name: "Dossier Político Sonora", url: "https://dossierpolitico.com/feed/", tier: 2, type: "STATE", state: "Sonora" },

  // === TABASCO ===
  { name: "Tabasco Hoy", url: "https://www.tabascohoy.com/feed/", tier: 2, type: "STATE", state: "Tabasco" },
  { name: "Presente Diario", url: "https://www.diariopresente.mx/feed", tier: 2, type: "STATE", state: "Tabasco" },
  { name: "Rumbo Nuevo Tabasco", url: "https://www.rumbonuevo.com.mx/feed/", tier: 2, type: "STATE", state: "Tabasco" },

  // === TAMAULIPAS ===
  { name: "El Mañana", url: "https://www.elmanana.com/feed/", tier: 2, type: "STATE", state: "Tamaulipas" },
  { name: "Hora Cero", url: "https://www.horacero.com.mx/feed/", tier: 2, type: "STATE", state: "Tamaulipas" },
  { name: "Milenio Tamaulipas", url: "https://www.milenio.com/rss/estados/tamaulipas", tier: 2, type: "STATE", state: "Tamaulipas" },
  { name: "Expreso de Victoria", url: "https://expresodevictoria.com/feed/", tier: 2, type: "STATE", state: "Tamaulipas" },

  // === TLAXCALA ===
  { name: "El Sol de Tlaxcala", url: "https://www.elsoldetlaxcala.com.mx/rss.xml", tier: 2, type: "STATE", state: "Tlaxcala" },
  { name: "Quadratín Tlaxcala", url: "https://tlaxcala.quadratin.com.mx/feed/", tier: 2, type: "STATE", state: "Tlaxcala" },
  { name: "E-Consulta Tlaxcala", url: "https://e-tlaxcala.mx/feed", tier: 2, type: "STATE", state: "Tlaxcala" },

  // === YUCATÁN ===
  { name: "Diario de Yucatán", url: "https://www.yucatan.com.mx/feed/", tier: 2, type: "STATE", state: "Yucatán" },
  { name: "Reporteros Hoy", url: "https://reporteroshoy.mx/feed/", tier: 2, type: "STATE", state: "Yucatán" },
  { name: "Por Esto Yucatán", url: "https://www.poresto.net/yucatan/feed/", tier: 2, type: "STATE", state: "Yucatán" },
  { name: "La Verdad Yucatán", url: "https://laverdadnoticias.com/feed/", tier: 2, type: "STATE", state: "Yucatán" },

  // === ZACATECAS ===
  { name: "NTR Zacatecas", url: "https://ntrzacatecas.com/feed/", tier: 2, type: "STATE", state: "Zacatecas" },
  { name: "Imagen Zacatecas", url: "https://www.imagenzac.com.mx/feed", tier: 2, type: "STATE", state: "Zacatecas" },
  { name: "Página 24 Zacatecas", url: "https://pagina24zacatecas.com.mx/feed/", tier: 2, type: "STATE", state: "Zacatecas" },
];

// ─── Fuentes sin RSS (Google News fallback) ──────────────────────────────────

const NO_RSS_SOURCES: NoRssSourceData[] = [
  // Nacionales sin RSS funcional
  { name: "El Universal", domain: "eluniversal.com.mx", tier: 1, type: "NATIONAL", state: null },
  { name: "Excélsior", domain: "excelsior.com.mx", tier: 1, type: "NATIONAL", state: null },
  { name: "Proceso", domain: "proceso.com.mx", tier: 1, type: "NATIONAL", state: null },
  { name: "Reforma", domain: "reforma.com", tier: 1, type: "NATIONAL", state: null },
  { name: "Animal Político", domain: "animalpolitico.com", tier: 1, type: "NATIONAL", state: null },
  { name: "SDP Noticias", domain: "sdpnoticias.com", tier: 1, type: "NATIONAL", state: null },
  { name: "Infobae México", domain: "infobae.com", tier: 1, type: "NATIONAL", state: null },
  { name: "Aristegui Noticias", domain: "aristeguinoticias.com", tier: 1, type: "NATIONAL", state: null },
  { name: "UnoTV", domain: "unotv.com", tier: 1, type: "NATIONAL", state: null },
  { name: "La Silla Rota", domain: "lasillarota.com", tier: 1, type: "NATIONAL", state: null },
  { name: "El Heraldo de México", domain: "heraldodemexico.com.mx", tier: 1, type: "NATIONAL", state: null },
  { name: "MVS Noticias", domain: "mvsnoticias.com", tier: 1, type: "NATIONAL", state: null },

  // Estatales sin RSS funcional
  { name: "Mural", domain: "mural.com", tier: 2, type: "STATE", state: "Jalisco" },
  { name: "El Norte", domain: "elnorte.com", tier: 2, type: "STATE", state: "Nuevo León" },
  { name: "Multimedios", domain: "multimedios.com", tier: 2, type: "STATE", state: "Nuevo León" },
  { name: "El Dictamen", domain: "eldictamen.mx", tier: 2, type: "STATE", state: "Veracruz" },
  { name: "El Imparcial Tijuana", domain: "elimparcial.com", tier: 2, type: "STATE", state: "Baja California" },
  { name: "Publimetro Guadalajara", domain: "publimetro.com.mx", tier: 2, type: "STATE", state: "Jalisco" },
  { name: "Portal Edomex", domain: "portaledomex.com", tier: 2, type: "STATE", state: "Estado de México" },
  { name: "Victoria de Durango", domain: "victoriadedurango.com", tier: 2, type: "STATE", state: "Durango" },
];

// ─── SourceTier data ─────────────────────────────────────────────────────────

const SOURCE_TIERS: SourceTierData[] = [
  // Tier 1 - Nacionales (peso 3x)
  { name: "El Universal", domain: "eluniversal.com.mx", tier: 1, reach: 15000000 },
  { name: "Excélsior", domain: "excelsior.com.mx", tier: 1, reach: 8000000 },
  { name: "Milenio", domain: "milenio.com", tier: 1, reach: 10000000 },
  { name: "La Jornada", domain: "jornada.com.mx", tier: 1, reach: 7000000 },
  { name: "Reforma", domain: "reforma.com", tier: 1, reach: 5000000 },
  { name: "Proceso", domain: "proceso.com.mx", tier: 1, reach: 4000000 },
  { name: "Animal Político", domain: "animalpolitico.com", tier: 1, reach: 3000000 },
  { name: "Sin Embargo", domain: "sinembargo.mx", tier: 1, reach: 3500000 },
  { name: "SDP Noticias", domain: "sdpnoticias.com", tier: 1, reach: 8000000 },
  { name: "Infobae México", domain: "infobae.com", tier: 1, reach: 12000000 },
  { name: "El Financiero", domain: "elfinanciero.com.mx", tier: 1, reach: 4000000 },
  { name: "El Economista", domain: "eleconomista.com.mx", tier: 1, reach: 2500000 },
  { name: "Forbes México", domain: "forbes.com.mx", tier: 1, reach: 3000000 },
  { name: "Expansión", domain: "expansion.mx", tier: 1, reach: 2000000 },
  { name: "López Dóriga Digital", domain: "lopezdoriga.com", tier: 1, reach: 5000000 },
  { name: "Aristegui Noticias", domain: "aristeguinoticias.com", tier: 1, reach: 4000000 },
  { name: "La Razón", domain: "razon.com.mx", tier: 1, reach: 2000000 },
  { name: "Reporte Índigo", domain: "reporteindigo.com", tier: 1, reach: 1500000 },
  { name: "Crónica", domain: "cronica.com.mx", tier: 1, reach: 1500000 },
  { name: "BBC Mundo", domain: "bbc.com", tier: 1, reach: 50000000 },
  { name: "CNN en Español", domain: "cnnespanol.cnn.com", tier: 1, reach: 20000000 },
  { name: "UnoTV", domain: "unotv.com", tier: 1, reach: 3000000 },
  { name: "El Heraldo de México", domain: "heraldodemexico.com.mx", tier: 1, reach: 2500000 },

  // Tier 2 - Regionales principales
  { name: "Informador", domain: "informador.mx", tier: 2, reach: 1000000 },
  { name: "El Debate", domain: "debate.com.mx", tier: 2, reach: 800000 },
  { name: "Vanguardia", domain: "vanguardia.com.mx", tier: 2, reach: 600000 },
  { name: "El Siglo de Torreón", domain: "elsiglodetorreon.com.mx", tier: 2, reach: 500000 },
  { name: "Noroeste", domain: "noroeste.com.mx", tier: 2, reach: 500000 },
  { name: "Diario de Yucatán", domain: "yucatan.com.mx", tier: 2, reach: 400000 },
  { name: "Proyecto Puente", domain: "proyectopuente.com.mx", tier: 2, reach: 300000 },
  { name: "El Imparcial Sonora", domain: "elimparcial.com", tier: 2, reach: 400000 },
  { name: "Telediario", domain: "telediario.mx", tier: 2, reach: 600000 },
];

// ─── Funciones de validación ─────────────────────────────────────────────────

function isRssContentType(contentType: string | null): boolean {
  if (!contentType) return false;
  const ct = contentType.toLowerCase();
  return CONFIG.rssContentTypes.some((t) => ct.includes(t));
}

function looksLikeRss(content: string): boolean {
  const trimmed = content.trim().substring(0, 500).toLowerCase();
  return (
    trimmed.includes("<?xml") ||
    trimmed.includes("<rss") ||
    trimmed.includes("<feed") ||
    trimmed.includes("<rdf")
  );
}

async function validateFeed(url: string): Promise<ValidationResult> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.timeout);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": CONFIG.userAgent,
        Accept: "application/rss+xml, application/xml, text/xml, */*",
      },
      redirect: "follow",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return { url, valid: false, httpCode: response.status, error: `HTTP ${response.status}` };
    }

    const contentType = response.headers.get("content-type");
    const content = await response.text();
    const valid = isRssContentType(contentType) || looksLikeRss(content);

    return { url, valid, httpCode: response.status, error: valid ? undefined : "Not RSS content" };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { url, valid: false, error: msg };
  }
}

// ─── Procesamiento en lotes ──────────────────────────────────────────────────

async function processInBatches<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  async function worker(): Promise<void> {
    while (index < items.length) {
      const currentIndex = index++;
      results[currentIndex] = await processor(items[currentIndex]);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, worker);
  await Promise.all(workers);
  return results;
}

// ─── Fases de ejecución ──────────────────────────────────────────────────────

async function phase0LoadCurrentState(): Promise<{
  rssCount: number;
  noRssCount: number;
  tierCount: number;
  activeRss: number;
  byState: Record<string, number>;
}> {
  const [rssCount, noRssCount, tierCount, activeRss, stateStats] = await Promise.all([
    prisma.rssSource.count(),
    prisma.noRssSource.count(),
    prisma.sourceTier.count(),
    prisma.rssSource.count({ where: { active: true } }),
    prisma.rssSource.groupBy({
      by: ["state"],
      where: { active: true },
      _count: { id: true },
    }),
  ]);

  const byState: Record<string, number> = {};
  for (const stat of stateStats) {
    byState[stat.state || "Nacional"] = stat._count.id;
  }

  return { rssCount, noRssCount, tierCount, activeRss, byState };
}

async function phase1UpsertRssSources(
  sources: RssSourceData[],
  dryRun: boolean,
  skipValidation: boolean
): Promise<PhaseResult> {
  const result: PhaseResult = { created: 0, updated: 0, skipped: 0, failed: 0, details: [] };

  // Validar feeds si no se salta
  let validationResults: Map<string, ValidationResult> | null = null;
  if (!skipValidation) {
    console.log(`    Validando ${sources.length} feeds...`);
    const validations = await processInBatches(
      sources,
      (s) => validateFeed(s.url),
      CONFIG.concurrency
    );
    validationResults = new Map(validations.map((v) => [v.url, v]));
  }

  for (const source of sources) {
    const validation = validationResults?.get(source.url);
    const isValid = skipValidation || validation?.valid;

    if (!isValid) {
      result.skipped++;
      result.details.push({
        name: source.name,
        action: "SKIP",
        error: validation?.error || "Validation failed",
      });
      console.log(`    ⏭️  ${source.name} - no válido: ${validation?.error || "unknown"}`);
      continue;
    }

    try {
      const existing = await prisma.rssSource.findUnique({ where: { url: source.url } });

      if (existing) {
        if (!dryRun) {
          await prisma.rssSource.update({
            where: { url: source.url },
            data: {
              active: true,
              errorCount: 0,
              name: source.name,
              tier: source.tier,
              type: source.type,
              state: source.state,
            },
          });
        }
        result.updated++;
        result.details.push({ name: source.name, action: "UPDATE" });
        console.log(`    🔄 ${source.name} - actualizada/reactivada`);
      } else {
        if (!dryRun) {
          await prisma.rssSource.create({
            data: {
              name: source.name,
              url: source.url,
              tier: source.tier,
              type: source.type,
              state: source.state,
              active: true,
            },
          });
        }
        result.created++;
        result.details.push({ name: source.name, action: "CREATE" });
        console.log(`    ✅ ${source.name} - creada`);
      }
    } catch (error) {
      result.failed++;
      const msg = error instanceof Error ? error.message : String(error);
      result.details.push({ name: source.name, action: "ERROR", error: msg });
      console.log(`    ❌ ${source.name} - error: ${msg}`);
    }
  }

  return result;
}

async function phase3UpsertNoRssSources(
  sources: NoRssSourceData[],
  dryRun: boolean
): Promise<PhaseResult> {
  const result: PhaseResult = { created: 0, updated: 0, skipped: 0, failed: 0, details: [] };

  for (const source of sources) {
    try {
      if (!dryRun) {
        await prisma.noRssSource.upsert({
          where: { domain: source.domain },
          create: {
            name: source.name,
            domain: source.domain,
            tier: source.tier,
            type: source.type,
            state: source.state,
            active: true,
          },
          update: {
            name: source.name,
            tier: source.tier,
            type: source.type,
            state: source.state,
            active: true,
            errorCount: 0,
          },
        });
      }

      const existing = await prisma.noRssSource.findUnique({ where: { domain: source.domain } });
      if (existing) {
        result.updated++;
        result.details.push({ name: source.name, action: "UPDATE" });
      } else {
        result.created++;
        result.details.push({ name: source.name, action: "CREATE" });
      }
      console.log(`    ✅ ${source.name} (${source.domain})`);
    } catch (error) {
      result.failed++;
      const msg = error instanceof Error ? error.message : String(error);
      result.details.push({ name: source.name, action: "ERROR", error: msg });
      console.log(`    ❌ ${source.name} - error: ${msg}`);
    }
  }

  return result;
}

async function phase4SyncSourceTiers(
  tiers: SourceTierData[],
  dryRun: boolean
): Promise<PhaseResult> {
  const result: PhaseResult = { created: 0, updated: 0, skipped: 0, failed: 0, details: [] };

  for (const tier of tiers) {
    try {
      if (!dryRun) {
        await prisma.sourceTier.upsert({
          where: { domain: tier.domain },
          create: {
            name: tier.name,
            domain: tier.domain,
            tier: tier.tier,
            reach: tier.reach,
          },
          update: {
            name: tier.name,
            tier: tier.tier,
            reach: tier.reach,
          },
        });
      }

      const existing = await prisma.sourceTier.findUnique({ where: { domain: tier.domain } });
      if (existing) {
        result.updated++;
      } else {
        result.created++;
      }
      result.details.push({ name: tier.name, action: existing ? "UPDATE" : "CREATE" });
    } catch (error) {
      result.failed++;
      const msg = error instanceof Error ? error.message : String(error);
      result.details.push({ name: tier.name, action: "ERROR", error: msg });
    }
  }

  return result;
}

async function phase5GenerateReport(
  initialState: Awaited<ReturnType<typeof phase0LoadCurrentState>>,
  nationalResult: PhaseResult,
  stateResult: PhaseResult,
  noRssResult: PhaseResult,
  tierResult: PhaseResult
): Promise<void> {
  // Obtener estado final
  const finalState = await phase0LoadCurrentState();

  const report = {
    timestamp: new Date().toISOString(),
    initialState,
    finalState,
    phases: {
      nationalRss: {
        created: nationalResult.created,
        updated: nationalResult.updated,
        skipped: nationalResult.skipped,
        failed: nationalResult.failed,
      },
      stateRss: {
        created: stateResult.created,
        updated: stateResult.updated,
        skipped: stateResult.skipped,
        failed: stateResult.failed,
      },
      noRssSources: {
        created: noRssResult.created,
        updated: noRssResult.updated,
        failed: noRssResult.failed,
      },
      sourceTiers: {
        created: tierResult.created,
        updated: tierResult.updated,
        failed: tierResult.failed,
      },
    },
    coverage: {
      totalActiveRss: finalState.activeRss,
      totalNoRss: finalState.noRssCount,
      totalTiers: finalState.tierCount,
      byState: finalState.byState,
      zeroCoverageStates: Object.keys(getAllStates()).filter(
        (s) => !finalState.byState[s] || finalState.byState[s] === 0
      ),
    },
  };

  const dateStr = new Date().toISOString().split("T")[0];
  const outputDir = path.join(__dirname, "..", "docs", "reports");

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const reportPath = path.join(outputDir, `rss-restore-${dateStr}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📁 Reporte guardado: ${reportPath}`);

  // Resumen de cobertura
  console.log("\n┌──────────────────────────────┬─────────┐");
  console.log("│ Estado                       │ Fuentes │");
  console.log("├──────────────────────────────┼─────────┤");

  const allStates = getAllStates();
  for (const state of Object.keys(allStates).sort()) {
    const count = finalState.byState[state] || 0;
    const icon = count >= 3 ? "✅" : count > 0 ? "⚠️" : "❌";
    console.log(`│ ${icon} ${state.padEnd(26)} │ ${count.toString().padStart(7)} │`);
  }
  console.log("└──────────────────────────────┴─────────┘");

  if (report.coverage.zeroCoverageStates.length > 0) {
    console.log(`\n⚠️  Estados sin cobertura: ${report.coverage.zeroCoverageStates.join(", ")}`);
  }
}

function getAllStates(): Record<string, boolean> {
  return {
    Aguascalientes: true,
    "Baja California": true,
    "Baja California Sur": true,
    Campeche: true,
    Chiapas: true,
    Chihuahua: true,
    "Ciudad de México": true,
    Coahuila: true,
    Colima: true,
    Durango: true,
    "Estado de México": true,
    Guanajuato: true,
    Guerrero: true,
    Hidalgo: true,
    Jalisco: true,
    Michoacán: true,
    Morelos: true,
    Nayarit: true,
    "Nuevo León": true,
    Oaxaca: true,
    Puebla: true,
    Querétaro: true,
    "Quintana Roo": true,
    "San Luis Potosí": true,
    Sinaloa: true,
    Sonora: true,
    Tabasco: true,
    Tamaulipas: true,
    Tlaxcala: true,
    Veracruz: true,
    Yucatán: true,
    Zacatecas: true,
  };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const skipValidation = args.includes("--skip-validation");
  const filterState = args.find((a) => a.startsWith("--state="))?.split("=")[1];

  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║   Restauración y Expansión de Fuentes RSS - MediaBot      ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  if (dryRun) {
    console.log("⚠️  MODO DRY RUN - No se aplicarán cambios en la base de datos\n");
  }
  if (skipValidation) {
    console.log("⚡ Validación de feeds deshabilitada\n");
  }

  // Phase 0: Estado actual
  console.log("═══ Phase 0: Estado Actual de la DB ═══\n");
  const initialState = await phase0LoadCurrentState();
  console.log(`  RssSource total: ${initialState.rssCount} (${initialState.activeRss} activas)`);
  console.log(`  NoRssSource: ${initialState.noRssCount}`);
  console.log(`  SourceTier: ${initialState.tierCount}`);
  console.log(`  Estados con cobertura: ${Object.keys(initialState.byState).length}/32\n`);

  // Filtrar fuentes por estado si se especificó
  let nationalSources = NATIONAL_RSS_SOURCES;
  let stateSources = STATE_RSS_SOURCES;
  let noRssSources = NO_RSS_SOURCES;

  if (filterState) {
    console.log(`🔍 Filtro aplicado: state = "${filterState}"\n`);
    stateSources = stateSources.filter((s) => s.state === filterState);
    noRssSources = noRssSources.filter((s) => s.state === filterState || s.state === null);
    // Solo incluir nacionales si no hay filtro estatal
    if (filterState !== "Nacional") {
      nationalSources = [];
    }
  }

  // Phase 1: Fuentes nacionales RSS
  console.log("═══ Phase 1: Fuentes Nacionales RSS ═══\n");
  console.log(`  Procesando ${nationalSources.length} fuentes nacionales...\n`);
  const nationalResult = await phase1UpsertRssSources(nationalSources, dryRun, skipValidation);
  console.log(`\n  Resultado: ${nationalResult.created} creadas, ${nationalResult.updated} actualizadas, ${nationalResult.skipped} omitidas, ${nationalResult.failed} errores\n`);

  // Phase 2: Fuentes estatales RSS
  console.log("═══ Phase 2: Fuentes Estatales RSS ═══\n");
  console.log(`  Procesando ${stateSources.length} fuentes estatales...\n`);
  const stateResult = await phase1UpsertRssSources(stateSources, dryRun, skipValidation);
  console.log(`\n  Resultado: ${stateResult.created} creadas, ${stateResult.updated} actualizadas, ${stateResult.skipped} omitidas, ${stateResult.failed} errores\n`);

  // Phase 3: NoRssSource para medios sin RSS
  console.log("═══ Phase 3: NoRssSource (Google News Fallback) ═══\n");
  console.log(`  Procesando ${noRssSources.length} fuentes sin RSS...\n`);
  const noRssResult = await phase3UpsertNoRssSources(noRssSources, dryRun);
  console.log(`\n  Resultado: ${noRssResult.created} creadas, ${noRssResult.updated} actualizadas, ${noRssResult.failed} errores\n`);

  // Phase 4: Sync SourceTier
  console.log("═══ Phase 4: Sincronizar SourceTier ═══\n");
  const tierResult = await phase4SyncSourceTiers(SOURCE_TIERS, dryRun);
  console.log(`  Resultado: ${tierResult.created} creados, ${tierResult.updated} actualizados, ${tierResult.failed} errores\n`);

  // Phase 5: Reporte final
  console.log("═══ Phase 5: Reporte de Cobertura ═══");
  if (!dryRun) {
    await phase5GenerateReport(initialState, nationalResult, stateResult, noRssResult, tierResult);
  } else {
    console.log("\n  [DRY RUN] Reporte no generado (no hubo cambios en DB)");

    // Mostrar resumen de lo que se habría hecho
    const totalRss = nationalResult.created + stateResult.created;
    const totalUpdated = nationalResult.updated + stateResult.updated;
    const totalSkipped = nationalResult.skipped + stateResult.skipped;
    console.log(`\n  Se habrían creado: ${totalRss} fuentes RSS nuevas`);
    console.log(`  Se habrían actualizado: ${totalUpdated} fuentes RSS`);
    console.log(`  Omitidas (no válidas): ${totalSkipped}`);
    console.log(`  NoRssSource: ${noRssResult.created + noRssResult.updated} fuentes`);
    console.log(`  SourceTier: ${tierResult.created + tierResult.updated} registros`);
  }

  // Resumen general
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║                    RESUMEN GENERAL                        ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  const totalCreated = nationalResult.created + stateResult.created;
  const totalUpdated = nationalResult.updated + stateResult.updated;
  const totalSkipped = nationalResult.skipped + stateResult.skipped;
  const totalFailed = nationalResult.failed + stateResult.failed;

  console.log(`  RSS Sources:    ${totalCreated} creadas + ${totalUpdated} actualizadas (${totalSkipped} omitidas, ${totalFailed} errores)`);
  console.log(`  NoRssSource:    ${noRssResult.created + noRssResult.updated} procesadas (${noRssResult.failed} errores)`);
  console.log(`  SourceTier:     ${tierResult.created + tierResult.updated} procesados (${tierResult.failed} errores)`);

  await prisma.$disconnect();

  console.log("\n✅ Restauración completada");

  if (dryRun) {
    console.log("\n💡 Para aplicar los cambios:");
    console.log("   npx tsx scripts/restore-and-expand-rss.ts");
    console.log("   npx tsx scripts/restore-and-expand-rss.ts --skip-validation  (sin validar URLs)");
  } else {
    console.log("\n💡 Verificar cobertura:");
    console.log("   npx tsx scripts/diagnose-rss-sources.ts");
  }
}

main().catch((error) => {
  console.error("❌ Error:", error);
  prisma.$disconnect();
  process.exit(1);
});
