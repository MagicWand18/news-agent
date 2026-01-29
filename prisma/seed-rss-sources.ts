import { PrismaClient, SourceType } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Sprint 8: Fuentes RSS mexicanas expandidas
 *
 * Estructura:
 * - Tier 1: Nacionales de alto alcance
 * - Tier 2: Estatales principales
 * - Tier 3: Municipales y digitales
 *
 * Tipos:
 * - NATIONAL: Cobertura nacional
 * - STATE: Cobertura estatal
 * - MUNICIPAL: Cobertura municipal/local
 * - SPECIALIZED: Negocios, tech, deportes, etc.
 */

interface RssSourceData {
  name: string;
  url: string;
  tier: number;
  type: SourceType;
  state?: string;
  city?: string;
}

// ==================== TIER 1: MEDIOS NACIONALES ====================
const nationalSources: RssSourceData[] = [
  // Periódicos principales
  { name: "El Universal", url: "https://www.eluniversal.com.mx/rss.xml", tier: 1, type: "NATIONAL" },
  { name: "Milenio", url: "https://www.milenio.com/rss", tier: 1, type: "NATIONAL" },
  { name: "Excélsior", url: "https://www.excelsior.com.mx/rss.xml", tier: 1, type: "NATIONAL" },
  { name: "La Jornada", url: "https://www.jornada.com.mx/rss/edicion.xml", tier: 1, type: "NATIONAL" },
  { name: "Reforma", url: "https://www.reforma.com/rss/portada.xml", tier: 1, type: "NATIONAL" },
  { name: "El Financiero", url: "https://www.elfinanciero.com.mx/arc/outboundfeeds/rss/", tier: 1, type: "NATIONAL" },
  { name: "El Economista", url: "https://www.eleconomista.com.mx/rss/", tier: 1, type: "NATIONAL" },
  { name: "La Razón", url: "https://www.razon.com.mx/feed/", tier: 1, type: "NATIONAL" },
  { name: "Crónica", url: "https://www.cronica.com.mx/feed", tier: 1, type: "NATIONAL" },
  { name: "El Sol de México", url: "https://www.elsoldemexico.com.mx/rss.xml", tier: 1, type: "NATIONAL" },

  // Digitales nacionales
  { name: "Animal Político", url: "https://www.animalpolitico.com/feed/", tier: 1, type: "NATIONAL" },
  { name: "Sin Embargo", url: "https://www.sinembargo.mx/feed/", tier: 1, type: "NATIONAL" },
  { name: "Aristegui Noticias", url: "https://aristeguinoticias.com/feed/", tier: 1, type: "NATIONAL" },
  { name: "Proceso", url: "https://www.proceso.com.mx/feed/", tier: 1, type: "NATIONAL" },
  { name: "SDP Noticias", url: "https://www.sdpnoticias.com/feed/", tier: 1, type: "NATIONAL" },
  { name: "López Dóriga Digital", url: "https://lopezdoriga.com/feed/", tier: 1, type: "NATIONAL" },
  { name: "UnoTV", url: "https://www.unotv.com/rss/", tier: 1, type: "NATIONAL" },
  { name: "Infobae México", url: "https://www.infobae.com/mexico/rss/", tier: 1, type: "NATIONAL" },

  // Negocios y finanzas
  { name: "Forbes México", url: "https://www.forbes.com.mx/feed/", tier: 1, type: "SPECIALIZED" },
  { name: "Expansión", url: "https://expansion.mx/rss", tier: 1, type: "SPECIALIZED" },
  { name: "Alto Nivel", url: "https://www.altonivel.com.mx/feed/", tier: 1, type: "SPECIALIZED" },
  { name: "Entrepreneur México", url: "https://www.entrepreneur.com/mx/feed", tier: 1, type: "SPECIALIZED" },

  // Internacionales con cobertura México
  { name: "BBC Mundo", url: "https://feeds.bbci.co.uk/mundo/rss.xml", tier: 1, type: "NATIONAL" },
  { name: "CNN en Español", url: "https://cnnespanol.cnn.com/feed/", tier: 1, type: "NATIONAL" },
  { name: "Reuters América Latina", url: "https://www.reuters.com/arc/outboundfeeds/v3/all/rss.xml", tier: 1, type: "NATIONAL" },
];

// ==================== TIER 2: MEDIOS ESTATALES ====================
const stateSources: RssSourceData[] = [
  // Aguascalientes
  { name: "El Heraldo de Aguascalientes", url: "https://www.heraldo.mx/feed/", tier: 2, type: "STATE", state: "Aguascalientes" },
  { name: "Hidrocálido Digital", url: "https://www.hidrocalidodigital.com/feed/", tier: 2, type: "STATE", state: "Aguascalientes" },
  { name: "LJA.MX Aguascalientes", url: "https://www.lja.mx/feed/", tier: 2, type: "STATE", state: "Aguascalientes" },

  // Baja California
  { name: "El Mexicano", url: "https://www.el-mexicano.com.mx/feed/", tier: 2, type: "STATE", state: "Baja California" },
  { name: "Frontera", url: "https://www.frontera.info/rss.xml", tier: 2, type: "STATE", state: "Baja California" },
  { name: "Semanario Zeta", url: "https://zetatijuana.com/feed/", tier: 2, type: "STATE", state: "Baja California" },
  { name: "El Imparcial BC", url: "https://www.elimparcial.com/rss.xml", tier: 2, type: "STATE", state: "Baja California" },
  { name: "Uniradio Noticias", url: "https://www.uniradionoticias.com/feed/", tier: 2, type: "STATE", state: "Baja California" },

  // Baja California Sur
  { name: "El Sudcaliforniano", url: "https://www.elsudcaliforniano.com.mx/rss.xml", tier: 2, type: "STATE", state: "Baja California Sur" },
  { name: "BCS Noticias", url: "https://www.bcsnoticias.mx/feed/", tier: 2, type: "STATE", state: "Baja California Sur" },
  { name: "Diario El Independiente", url: "https://www.diarioelindependiente.mx/feed/", tier: 2, type: "STATE", state: "Baja California Sur" },

  // Campeche
  { name: "Tribuna Campeche", url: "https://tribunacampeche.com/feed/", tier: 2, type: "STATE", state: "Campeche" },
  { name: "Campeche HOY", url: "https://campechehoy.mx/feed/", tier: 2, type: "STATE", state: "Campeche" },
  { name: "Portal Campeche", url: "https://portalcampeche.com/feed/", tier: 2, type: "STATE", state: "Campeche" },

  // Chiapas
  { name: "El Heraldo de Chiapas", url: "https://www.elheraldodechiapas.com.mx/rss.xml", tier: 2, type: "STATE", state: "Chiapas" },
  { name: "Diario de Chiapas", url: "https://www.diariodechiapas.com/feed/", tier: 2, type: "STATE", state: "Chiapas" },
  { name: "Cuarto Poder Chiapas", url: "https://www.cuartopoder.mx/feed/", tier: 2, type: "STATE", state: "Chiapas" },
  { name: "NVI Noticias Chiapas", url: "https://www.nvinoticias.com/feed/", tier: 2, type: "STATE", state: "Chiapas" },

  // Chihuahua
  { name: "El Heraldo de Chihuahua", url: "https://www.elheraldodechihuahua.com.mx/rss.xml", tier: 2, type: "STATE", state: "Chihuahua" },
  { name: "El Diario de Chihuahua", url: "https://diario.mx/feed/", tier: 2, type: "STATE", state: "Chihuahua" },
  { name: "El Pueblo", url: "https://elpueblo.com/feed/", tier: 2, type: "STATE", state: "Chihuahua" },
  { name: "Net Noticias Chihuahua", url: "https://netnoticias.mx/feed/", tier: 2, type: "STATE", state: "Chihuahua" },

  // Coahuila
  { name: "Zócalo Saltillo", url: "https://www.zocalo.com.mx/feed/", tier: 2, type: "STATE", state: "Coahuila" },
  { name: "Vanguardia", url: "https://vanguardia.com.mx/feed/", tier: 2, type: "STATE", state: "Coahuila" },
  { name: "El Siglo de Torreón", url: "https://www.elsiglodetorreon.com.mx/feed/", tier: 2, type: "STATE", state: "Coahuila" },
  { name: "Milenio Laguna", url: "https://www.milenio.com/region/laguna/rss", tier: 2, type: "STATE", state: "Coahuila" },

  // Colima
  { name: "Diario de Colima", url: "https://www.diariodecolima.com/feed/", tier: 2, type: "STATE", state: "Colima" },
  { name: "El Comentario", url: "https://elcomentario.ucol.mx/feed/", tier: 2, type: "STATE", state: "Colima" },
  { name: "AFmedios Colima", url: "https://www.afmedios.com/feed/", tier: 2, type: "STATE", state: "Colima" },

  // Ciudad de México
  { name: "La Prensa CDMX", url: "https://www.la-prensa.com.mx/feed/", tier: 2, type: "STATE", state: "Ciudad de México" },
  { name: "24 Horas", url: "https://www.24-horas.mx/feed/", tier: 2, type: "STATE", state: "Ciudad de México" },
  { name: "Chilango", url: "https://www.chilango.com/feed/", tier: 2, type: "STATE", state: "Ciudad de México" },
  { name: "Más por Más CDMX", url: "https://www.maspormas.com/feed/", tier: 2, type: "STATE", state: "Ciudad de México" },

  // Durango
  { name: "El Siglo de Durango", url: "https://www.elsiglodedurango.com.mx/feed/", tier: 2, type: "STATE", state: "Durango" },
  { name: "El Sol de Durango", url: "https://www.elsoldedurango.com.mx/rss.xml", tier: 2, type: "STATE", state: "Durango" },
  { name: "Victoria de Durango", url: "https://victoriadedurango.com/feed/", tier: 2, type: "STATE", state: "Durango" },

  // Estado de México
  { name: "El Sol de Toluca", url: "https://www.elsoldetoluca.com.mx/rss.xml", tier: 2, type: "STATE", state: "Estado de México" },
  { name: "Quadratín Estado de México", url: "https://edomex.quadratin.com.mx/feed/", tier: 2, type: "STATE", state: "Estado de México" },
  { name: "8 Columnas", url: "https://8columnas.com.mx/feed/", tier: 2, type: "STATE", state: "Estado de México" },
  { name: "Heraldo Estado de México", url: "https://heraldodemexico.com.mx/feed/", tier: 2, type: "STATE", state: "Estado de México" },

  // Guanajuato
  { name: "El Sol de León", url: "https://www.elsoldeleon.com.mx/rss.xml", tier: 2, type: "STATE", state: "Guanajuato" },
  { name: "Periódico AM", url: "https://www.am.com.mx/feed/", tier: 2, type: "STATE", state: "Guanajuato" },
  { name: "El Sol de Irapuato", url: "https://www.elsoldeirapuato.com.mx/rss.xml", tier: 2, type: "STATE", state: "Guanajuato" },
  { name: "Correo Guanajuato", url: "https://periodicocorreo.com.mx/feed/", tier: 2, type: "STATE", state: "Guanajuato" },
  { name: "Zona Franca Guanajuato", url: "https://zonafranca.mx/feed/", tier: 2, type: "STATE", state: "Guanajuato" },

  // Guerrero
  { name: "El Sol de Acapulco", url: "https://www.elsoldeacapulco.com.mx/rss.xml", tier: 2, type: "STATE", state: "Guerrero" },
  { name: "El Sur Guerrero", url: "https://suracapulco.mx/feed/", tier: 2, type: "STATE", state: "Guerrero" },
  { name: "Quadratín Guerrero", url: "https://guerrero.quadratin.com.mx/feed/", tier: 2, type: "STATE", state: "Guerrero" },
  { name: "Novedades Acapulco", url: "https://novedadesacapulco.mx/feed/", tier: 2, type: "STATE", state: "Guerrero" },

  // Hidalgo
  { name: "El Sol de Hidalgo", url: "https://www.elsoldehidalgo.com.mx/rss.xml", tier: 2, type: "STATE", state: "Hidalgo" },
  { name: "Criterio Hidalgo", url: "https://www.criteriohidalgo.com/feed/", tier: 2, type: "STATE", state: "Hidalgo" },
  { name: "Quadratín Hidalgo", url: "https://hidalgo.quadratin.com.mx/feed/", tier: 2, type: "STATE", state: "Hidalgo" },
  { name: "Plaza Juárez", url: "https://plazajuarez.mx/feed/", tier: 2, type: "STATE", state: "Hidalgo" },

  // Jalisco
  { name: "El Informador", url: "https://www.informador.mx/rss/", tier: 2, type: "STATE", state: "Jalisco" },
  { name: "Mural", url: "https://www.mural.com/rss/portada.xml", tier: 2, type: "STATE", state: "Jalisco" },
  { name: "El Occidental", url: "https://www.eloccidental.com.mx/rss.xml", tier: 2, type: "STATE", state: "Jalisco" },
  { name: "NTR Guadalajara", url: "https://www.ntrguadalajara.com/feed/", tier: 2, type: "STATE", state: "Jalisco" },
  { name: "Milenio Jalisco", url: "https://www.milenio.com/region/jalisco/rss", tier: 2, type: "STATE", state: "Jalisco" },

  // Michoacán
  { name: "La Voz de Michoacán", url: "https://www.lavozdemichoacan.com.mx/feed/", tier: 2, type: "STATE", state: "Michoacán" },
  { name: "Quadratín Michoacán", url: "https://www.quadratin.com.mx/feed/", tier: 2, type: "STATE", state: "Michoacán" },
  { name: "Cambio de Michoacán", url: "https://www.cambiodemichoacan.com.mx/feed/", tier: 2, type: "STATE", state: "Michoacán" },
  { name: "MiMorelia", url: "https://www.mimorelia.com/feed/", tier: 2, type: "STATE", state: "Michoacán" },

  // Morelos
  { name: "El Sol de Cuernavaca", url: "https://www.elsoldecuernavaca.com.mx/rss.xml", tier: 2, type: "STATE", state: "Morelos" },
  { name: "Diario de Morelos", url: "https://www.diariodemorelos.com/feed/", tier: 2, type: "STATE", state: "Morelos" },
  { name: "La Unión de Morelos", url: "https://www.launion.com.mx/feed/", tier: 2, type: "STATE", state: "Morelos" },

  // Nayarit
  { name: "Meridiano Nayarit", url: "https://www.meridiano.mx/feed/", tier: 2, type: "STATE", state: "Nayarit" },
  { name: "Express Nayarit", url: "https://www.nayaritexpress.com/feed/", tier: 2, type: "STATE", state: "Nayarit" },
  { name: "El Sol de Nayarit", url: "https://www.elsoldenayarit.mx/feed/", tier: 2, type: "STATE", state: "Nayarit" },

  // Nuevo León
  { name: "El Norte", url: "https://www.elnorte.com/rss/portada.xml", tier: 2, type: "STATE", state: "Nuevo León" },
  { name: "Info7", url: "https://www.info7.mx/feed/", tier: 2, type: "STATE", state: "Nuevo León" },
  { name: "El Horizonte", url: "https://www.elhorizonte.mx/feed/", tier: 2, type: "STATE", state: "Nuevo León" },
  { name: "Telediario", url: "https://www.telediario.mx/feed/", tier: 2, type: "STATE", state: "Nuevo León" },
  { name: "ABC Noticias", url: "https://www.abcnoticias.mx/feed/", tier: 2, type: "STATE", state: "Nuevo León" },
  { name: "Milenio Monterrey", url: "https://www.milenio.com/region/monterrey/rss", tier: 2, type: "STATE", state: "Nuevo León" },

  // Oaxaca
  { name: "El Imparcial Oaxaca", url: "https://imparcialoaxaca.mx/feed/", tier: 2, type: "STATE", state: "Oaxaca" },
  { name: "Quadratín Oaxaca", url: "https://oaxaca.quadratin.com.mx/feed/", tier: 2, type: "STATE", state: "Oaxaca" },
  { name: "NVI Noticias Oaxaca", url: "https://www.nvinoticias.com/oaxaca/feed/", tier: 2, type: "STATE", state: "Oaxaca" },
  { name: "Tiempo Oaxaca", url: "https://tiempooaxaca.com/feed/", tier: 2, type: "STATE", state: "Oaxaca" },

  // Puebla
  { name: "El Sol de Puebla", url: "https://www.elsoldepuebla.com.mx/rss.xml", tier: 2, type: "STATE", state: "Puebla" },
  { name: "Milenio Puebla", url: "https://www.milenio.com/region/puebla/rss", tier: 2, type: "STATE", state: "Puebla" },
  { name: "E-Consulta Puebla", url: "https://www.e-consulta.com/feed/", tier: 2, type: "STATE", state: "Puebla" },
  { name: "La Jornada de Oriente", url: "https://www.lajornadadeoriente.com.mx/feed/", tier: 2, type: "STATE", state: "Puebla" },
  { name: "Intolerancia Diario", url: "https://intoleranciadiario.com/feed/", tier: 2, type: "STATE", state: "Puebla" },

  // Querétaro
  { name: "Diario de Querétaro", url: "https://www.diariodequeretaro.com.mx/rss.xml", tier: 2, type: "STATE", state: "Querétaro" },
  { name: "AM Querétaro", url: "https://amqueretaro.com/feed/", tier: 2, type: "STATE", state: "Querétaro" },
  { name: "Noticias de Querétaro", url: "https://www.noticiasdequeretaro.com.mx/feed/", tier: 2, type: "STATE", state: "Querétaro" },
  { name: "El Universal Querétaro", url: "https://www.eluniversalqueretaro.mx/feed/", tier: 2, type: "STATE", state: "Querétaro" },

  // Quintana Roo
  { name: "Novedades Quintana Roo", url: "https://sipse.com/novedades/feed/", tier: 2, type: "STATE", state: "Quintana Roo" },
  { name: "Por Esto! Quintana Roo", url: "https://www.poresto.net/quintana-roo/feed/", tier: 2, type: "STATE", state: "Quintana Roo" },
  { name: "Quadratín Quintana Roo", url: "https://quintanaroo.quadratin.com.mx/feed/", tier: 2, type: "STATE", state: "Quintana Roo" },
  { name: "Riviera Maya News", url: "https://www.rivieramaya.news/feed/", tier: 2, type: "STATE", state: "Quintana Roo" },

  // San Luis Potosí
  { name: "El Sol de San Luis", url: "https://www.elsoldesanluis.com.mx/rss.xml", tier: 2, type: "STATE", state: "San Luis Potosí" },
  { name: "Plano Informativo", url: "https://planoinformativo.com/feed/", tier: 2, type: "STATE", state: "San Luis Potosí" },
  { name: "Pulso SLP", url: "https://pulsoslp.com.mx/feed/", tier: 2, type: "STATE", state: "San Luis Potosí" },
  { name: "Código San Luis", url: "https://codigosanluis.com/feed/", tier: 2, type: "STATE", state: "San Luis Potosí" },

  // Sinaloa
  { name: "El Debate", url: "https://www.debate.com.mx/feed/", tier: 2, type: "STATE", state: "Sinaloa" },
  { name: "Noroeste", url: "https://www.noroeste.com.mx/feed/", tier: 2, type: "STATE", state: "Sinaloa" },
  { name: "Línea Directa", url: "https://www.lineadirectaportal.com/feed/", tier: 2, type: "STATE", state: "Sinaloa" },
  { name: "El Sol de Sinaloa", url: "https://www.elsoldesinaloa.com.mx/rss.xml", tier: 2, type: "STATE", state: "Sinaloa" },
  { name: "Ríodoce", url: "https://riodoce.mx/feed/", tier: 2, type: "STATE", state: "Sinaloa" },

  // Sonora
  { name: "El Imparcial Sonora", url: "https://www.elimparcial.com/sonora/feed/", tier: 2, type: "STATE", state: "Sonora" },
  { name: "El Sol de Hermosillo", url: "https://www.elsoldehermosillo.com.mx/rss.xml", tier: 2, type: "STATE", state: "Sonora" },
  { name: "Proyecto Puente", url: "https://proyectopuente.com.mx/feed/", tier: 2, type: "STATE", state: "Sonora" },
  { name: "Expreso Sonora", url: "https://www.expreso.com.mx/feed/", tier: 2, type: "STATE", state: "Sonora" },

  // Tabasco
  { name: "El Heraldo de Tabasco", url: "https://www.elheraldodetabasco.com.mx/rss.xml", tier: 2, type: "STATE", state: "Tabasco" },
  { name: "Tabasco HOY", url: "https://www.tabascohoy.com/feed/", tier: 2, type: "STATE", state: "Tabasco" },
  { name: "Presente", url: "https://www.presentediario.com/feed/", tier: 2, type: "STATE", state: "Tabasco" },
  { name: "Rumbo Nuevo Tabasco", url: "https://www.rumbonuevo.com.mx/feed/", tier: 2, type: "STATE", state: "Tabasco" },

  // Tamaulipas
  { name: "El Mañana", url: "https://www.elmanana.com/feed/", tier: 2, type: "STATE", state: "Tamaulipas" },
  { name: "Hoy Tamaulipas", url: "https://www.hoytamaulipas.net/feed/", tier: 2, type: "STATE", state: "Tamaulipas" },
  { name: "Expreso Tamaulipas", url: "https://www.expresotamaulipas.com/feed/", tier: 2, type: "STATE", state: "Tamaulipas" },
  { name: "Gaceta", url: "https://www.gaceta.mx/feed/", tier: 2, type: "STATE", state: "Tamaulipas" },

  // Tlaxcala
  { name: "El Sol de Tlaxcala", url: "https://www.elsoldetlaxcala.com.mx/rss.xml", tier: 2, type: "STATE", state: "Tlaxcala" },
  { name: "E-Tlaxcala", url: "https://e-tlaxcala.mx/feed/", tier: 2, type: "STATE", state: "Tlaxcala" },
  { name: "Quadratín Tlaxcala", url: "https://tlaxcala.quadratin.com.mx/feed/", tier: 2, type: "STATE", state: "Tlaxcala" },

  // Veracruz
  { name: "Diario de Xalapa", url: "https://www.diariodexalapa.com.mx/rss.xml", tier: 2, type: "STATE", state: "Veracruz" },
  { name: "Notiver", url: "https://www.notiver.com.mx/feed/", tier: 2, type: "STATE", state: "Veracruz" },
  { name: "XEU Noticias", url: "https://www.xeu.mx/feed/", tier: 2, type: "STATE", state: "Veracruz" },
  { name: "Imagen del Golfo", url: "https://imagendelgolfo.mx/feed/", tier: 2, type: "STATE", state: "Veracruz" },
  { name: "El Sol de Orizaba", url: "https://www.elsoldeorizaba.com.mx/rss.xml", tier: 2, type: "STATE", state: "Veracruz" },
  { name: "Al Calor Político", url: "https://www.alcalorpolitico.com/feed/", tier: 2, type: "STATE", state: "Veracruz" },

  // Yucatán
  { name: "Diario de Yucatán", url: "https://www.yucatan.com.mx/feed/", tier: 2, type: "STATE", state: "Yucatán" },
  { name: "Por Esto! Yucatán", url: "https://www.poresto.net/yucatan/feed/", tier: 2, type: "STATE", state: "Yucatán" },
  { name: "La Jornada Maya", url: "https://www.lajornadamaya.mx/feed/", tier: 2, type: "STATE", state: "Yucatán" },
  { name: "Novedades Yucatán", url: "https://sipse.com/novedades-yucatan/feed/", tier: 2, type: "STATE", state: "Yucatán" },
  { name: "Milenio Novedades", url: "https://www.milenio.com/region/yucatan/rss", tier: 2, type: "STATE", state: "Yucatán" },

  // Zacatecas
  { name: "El Sol de Zacatecas", url: "https://www.elsoldezacatecas.com.mx/rss.xml", tier: 2, type: "STATE", state: "Zacatecas" },
  { name: "NTR Zacatecas", url: "https://ntrzacatecas.com/feed/", tier: 2, type: "STATE", state: "Zacatecas" },
  { name: "Imagen Zacatecas", url: "https://imagenzac.com.mx/feed/", tier: 2, type: "STATE", state: "Zacatecas" },
  { name: "Página 24 Zacatecas", url: "https://pagina24zacatecas.com.mx/feed/", tier: 2, type: "STATE", state: "Zacatecas" },
];

// ==================== TIER 3: MEDIOS MUNICIPALES ====================
const municipalSources: RssSourceData[] = [
  // Tijuana, BC
  { name: "El Sol de Tijuana", url: "https://www.elsoldetijuana.com.mx/rss.xml", tier: 3, type: "MUNICIPAL", state: "Baja California", city: "Tijuana" },
  { name: "Frontera Tijuana", url: "https://www.frontera.info/tijuana/feed/", tier: 3, type: "MUNICIPAL", state: "Baja California", city: "Tijuana" },

  // Mexicali, BC
  { name: "La Voz de la Frontera", url: "https://www.lavozdelafrontera.com.mx/rss.xml", tier: 3, type: "MUNICIPAL", state: "Baja California", city: "Mexicali" },

  // Ensenada, BC
  { name: "El Vigía Ensenada", url: "https://www.elvigia.net/feed/", tier: 3, type: "MUNICIPAL", state: "Baja California", city: "Ensenada" },

  // La Paz, BCS
  { name: "El Informante BCS", url: "https://elinformantebcs.mx/feed/", tier: 3, type: "MUNICIPAL", state: "Baja California Sur", city: "La Paz" },

  // Los Cabos, BCS
  { name: "Tribuna de Los Cabos", url: "https://www.tribunadeloscabos.com.mx/feed/", tier: 3, type: "MUNICIPAL", state: "Baja California Sur", city: "Los Cabos" },

  // Tuxtla Gutiérrez, Chiapas
  { name: "Alerta Chiapas", url: "https://alertachiapas.com/feed/", tier: 3, type: "MUNICIPAL", state: "Chiapas", city: "Tuxtla Gutiérrez" },

  // San Cristóbal de las Casas, Chiapas
  { name: "Aquí Noticias", url: "https://aquinoticias.mx/feed/", tier: 3, type: "MUNICIPAL", state: "Chiapas", city: "San Cristóbal de las Casas" },

  // Ciudad Juárez, Chihuahua
  { name: "El Diario de Juárez", url: "https://diario.mx/juarez/feed/", tier: 3, type: "MUNICIPAL", state: "Chihuahua", city: "Ciudad Juárez" },
  { name: "Net Noticias Juárez", url: "https://netnoticias.mx/juarez/feed/", tier: 3, type: "MUNICIPAL", state: "Chihuahua", city: "Ciudad Juárez" },

  // Saltillo, Coahuila
  { name: "El Diario de Coahuila Saltillo", url: "https://www.eldiariodecoahuila.com.mx/feed/", tier: 3, type: "MUNICIPAL", state: "Coahuila", city: "Saltillo" },

  // Torreón, Coahuila
  { name: "Noticias del Sol de la Laguna", url: "https://www.noticiasdelsol.com.mx/feed/", tier: 3, type: "MUNICIPAL", state: "Coahuila", city: "Torreón" },

  // Manzanillo, Colima
  { name: "Diario de Colima Manzanillo", url: "https://www.diariodecolima.com/manzanillo/feed/", tier: 3, type: "MUNICIPAL", state: "Colima", city: "Manzanillo" },

  // Ecatepec, EdoMex
  { name: "Valle de México", url: "https://www.valledemexico.mx/feed/", tier: 3, type: "MUNICIPAL", state: "Estado de México", city: "Ecatepec" },

  // Naucalpan, EdoMex
  { name: "Digital Naucalpan", url: "https://digitalnaucalpan.com.mx/feed/", tier: 3, type: "MUNICIPAL", state: "Estado de México", city: "Naucalpan" },

  // Celaya, Guanajuato
  { name: "El Sol del Bajío Celaya", url: "https://www.elsoldelbajio.com.mx/rss.xml", tier: 3, type: "MUNICIPAL", state: "Guanajuato", city: "Celaya" },

  // Salamanca, Guanajuato
  { name: "El Sol de Salamanca", url: "https://www.elsoldesalamanca.com.mx/rss.xml", tier: 3, type: "MUNICIPAL", state: "Guanajuato", city: "Salamanca" },

  // Guanajuato Capital
  { name: "Zona Franca GTO", url: "https://zonafranca.mx/gto/feed/", tier: 3, type: "MUNICIPAL", state: "Guanajuato", city: "Guanajuato" },

  // Acapulco, Guerrero
  { name: "El Sur Acapulco", url: "https://suracapulco.mx/acapulco/feed/", tier: 3, type: "MUNICIPAL", state: "Guerrero", city: "Acapulco" },

  // Chilpancingo, Guerrero
  { name: "Diario 21 Guerrero", url: "https://diario21.com.mx/feed/", tier: 3, type: "MUNICIPAL", state: "Guerrero", city: "Chilpancingo" },

  // Pachuca, Hidalgo
  { name: "Independiente de Hidalgo", url: "https://www.independientedehidalgo.com.mx/feed/", tier: 3, type: "MUNICIPAL", state: "Hidalgo", city: "Pachuca" },

  // Guadalajara, Jalisco
  { name: "Gdl Noticias", url: "https://gdlnoticias.com/feed/", tier: 3, type: "MUNICIPAL", state: "Jalisco", city: "Guadalajara" },
  { name: "Zona Guadalajara", url: "https://zonaguadalajara.com/feed/", tier: 3, type: "MUNICIPAL", state: "Jalisco", city: "Guadalajara" },

  // Puerto Vallarta, Jalisco
  { name: "Vallarta Opina", url: "https://www.vallartaopina.net/feed/", tier: 3, type: "MUNICIPAL", state: "Jalisco", city: "Puerto Vallarta" },
  { name: "Tribune de la Bahía", url: "https://www.tribunadelabahia.com.mx/feed/", tier: 3, type: "MUNICIPAL", state: "Jalisco", city: "Puerto Vallarta" },

  // Zapopan, Jalisco
  { name: "El Diario NTR Zapopan", url: "https://www.ntrguadalajara.com/zapopan/feed/", tier: 3, type: "MUNICIPAL", state: "Jalisco", city: "Zapopan" },

  // Morelia, Michoacán
  { name: "Noventa Grados Morelia", url: "https://www.noventagrados.com.mx/feed/", tier: 3, type: "MUNICIPAL", state: "Michoacán", city: "Morelia" },

  // Uruapan, Michoacán
  { name: "El Sol de Uruapan", url: "https://www.elsoldeuruapan.com.mx/rss.xml", tier: 3, type: "MUNICIPAL", state: "Michoacán", city: "Uruapan" },

  // Lázaro Cárdenas, Michoacán
  { name: "Costa Noticias", url: "https://costanoticias.com/feed/", tier: 3, type: "MUNICIPAL", state: "Michoacán", city: "Lázaro Cárdenas" },

  // Cuernavaca, Morelos
  { name: "Zona Centro Cuernavaca", url: "https://www.zonacentronoticias.com/feed/", tier: 3, type: "MUNICIPAL", state: "Morelos", city: "Cuernavaca" },

  // Monterrey, Nuevo León
  { name: "Reporte Índigo NL", url: "https://www.reporteindigo.com/regio/feed/", tier: 3, type: "MUNICIPAL", state: "Nuevo León", city: "Monterrey" },
  { name: "Milenio Monterrey", url: "https://www.milenio.com/monterrey/feed/", tier: 3, type: "MUNICIPAL", state: "Nuevo León", city: "Monterrey" },

  // San Nicolás de los Garza, NL
  { name: "San Nicolás Digital", url: "https://sannicolasdigital.mx/feed/", tier: 3, type: "MUNICIPAL", state: "Nuevo León", city: "San Nicolás de los Garza" },

  // Oaxaca de Juárez
  { name: "Oaxaca Digital", url: "https://oaxaca.digital/feed/", tier: 3, type: "MUNICIPAL", state: "Oaxaca", city: "Oaxaca de Juárez" },

  // Puebla Capital
  { name: "Ángulo 7 Puebla", url: "https://www.angulo7.com.mx/feed/", tier: 3, type: "MUNICIPAL", state: "Puebla", city: "Puebla" },
  { name: "Status Puebla", url: "https://statuspuebla.com.mx/feed/", tier: 3, type: "MUNICIPAL", state: "Puebla", city: "Puebla" },

  // Tehuacán, Puebla
  { name: "El Mundo de Tehuacán", url: "https://elmundodetehuacan.com/feed/", tier: 3, type: "MUNICIPAL", state: "Puebla", city: "Tehuacán" },

  // Santiago de Querétaro
  { name: "Plaza de Armas QRO", url: "https://www.plazadearmas.com.mx/feed/", tier: 3, type: "MUNICIPAL", state: "Querétaro", city: "Santiago de Querétaro" },

  // Cancún, Quintana Roo
  { name: "Noticaribe Cancún", url: "https://noticaribe.com.mx/feed/", tier: 3, type: "MUNICIPAL", state: "Quintana Roo", city: "Cancún" },
  { name: "Cancún Mio", url: "https://cancunmio.com/feed/", tier: 3, type: "MUNICIPAL", state: "Quintana Roo", city: "Cancún" },

  // Playa del Carmen, QRoo
  { name: "Playa News", url: "https://playanews.mx/feed/", tier: 3, type: "MUNICIPAL", state: "Quintana Roo", city: "Playa del Carmen" },

  // Chetumal, QRoo
  { name: "Noticias Chetumal", url: "https://noticiaschetumal.com/feed/", tier: 3, type: "MUNICIPAL", state: "Quintana Roo", city: "Chetumal" },

  // Ciudad Valles, SLP
  { name: "Huasteca Hoy", url: "https://huastecahoy.com/feed/", tier: 3, type: "MUNICIPAL", state: "San Luis Potosí", city: "Ciudad Valles" },

  // Culiacán, Sinaloa
  { name: "El Sol de Sinaloa Culiacán", url: "https://www.elsoldesinaloa.com.mx/culiacan/feed/", tier: 3, type: "MUNICIPAL", state: "Sinaloa", city: "Culiacán" },

  // Mazatlán, Sinaloa
  { name: "El Sol de Mazatlán", url: "https://www.elsoldemazatlan.com.mx/rss.xml", tier: 3, type: "MUNICIPAL", state: "Sinaloa", city: "Mazatlán" },
  { name: "Noroeste Mazatlán", url: "https://www.noroeste.com.mx/mazatlan/feed/", tier: 3, type: "MUNICIPAL", state: "Sinaloa", city: "Mazatlán" },

  // Los Mochis, Sinaloa
  { name: "El Debate Los Mochis", url: "https://www.debate.com.mx/losmochis/feed/", tier: 3, type: "MUNICIPAL", state: "Sinaloa", city: "Los Mochis" },

  // Hermosillo, Sonora
  { name: "Expreso Hermosillo", url: "https://www.expreso.com.mx/hermosillo/feed/", tier: 3, type: "MUNICIPAL", state: "Sonora", city: "Hermosillo" },

  // Ciudad Obregón, Sonora
  { name: "El Imparcial Obregón", url: "https://www.elimparcial.com/obregon/feed/", tier: 3, type: "MUNICIPAL", state: "Sonora", city: "Ciudad Obregón" },

  // Nogales, Sonora
  { name: "Nuevo Día Nogales", url: "https://www.nuevodia.com.mx/feed/", tier: 3, type: "MUNICIPAL", state: "Sonora", city: "Nogales" },

  // Villahermosa, Tabasco
  { name: "Diario Presente Villahermosa", url: "https://www.diariopresente.mx/feed/", tier: 3, type: "MUNICIPAL", state: "Tabasco", city: "Villahermosa" },

  // Ciudad Victoria, Tamaulipas
  { name: "Hora Cero Tamaulipas", url: "https://www.horacero.com.mx/feed/", tier: 3, type: "MUNICIPAL", state: "Tamaulipas", city: "Ciudad Victoria" },

  // Reynosa, Tamaulipas
  { name: "Conexión Total Reynosa", url: "https://conexiontotal.mx/feed/", tier: 3, type: "MUNICIPAL", state: "Tamaulipas", city: "Reynosa" },

  // Matamoros, Tamaulipas
  { name: "El Bravo Matamoros", url: "https://www.elbravo.mx/feed/", tier: 3, type: "MUNICIPAL", state: "Tamaulipas", city: "Matamoros" },

  // Nuevo Laredo, Tamaulipas
  { name: "El Mañana Nuevo Laredo", url: "https://www.elmanana.com/nuevo-laredo/feed/", tier: 3, type: "MUNICIPAL", state: "Tamaulipas", city: "Nuevo Laredo" },

  // Tampico, Tamaulipas
  { name: "El Sol de Tampico", url: "https://www.elsoldetampico.com.mx/rss.xml", tier: 3, type: "MUNICIPAL", state: "Tamaulipas", city: "Tampico" },

  // Veracruz Puerto
  { name: "Notiver Veracruz", url: "https://www.notiver.com.mx/veracruz/feed/", tier: 3, type: "MUNICIPAL", state: "Veracruz", city: "Veracruz" },
  { name: "El Dictamen", url: "https://www.eldictamen.mx/feed/", tier: 3, type: "MUNICIPAL", state: "Veracruz", city: "Veracruz" },

  // Coatzacoalcos, Veracruz
  { name: "Diario del Istmo", url: "https://www.diarioistmo.com/feed/", tier: 3, type: "MUNICIPAL", state: "Veracruz", city: "Coatzacoalcos" },

  // Córdoba, Veracruz
  { name: "El Sol de Córdoba", url: "https://www.elsoldecordoba.com.mx/rss.xml", tier: 3, type: "MUNICIPAL", state: "Veracruz", city: "Córdoba" },

  // Poza Rica, Veracruz
  { name: "La Opinión de Poza Rica", url: "https://www.laopinion.net/feed/", tier: 3, type: "MUNICIPAL", state: "Veracruz", city: "Poza Rica" },

  // Mérida, Yucatán
  { name: "El Diario de Yucatán Mérida", url: "https://www.yucatan.com.mx/merida/feed/", tier: 3, type: "MUNICIPAL", state: "Yucatán", city: "Mérida" },
  { name: "Reporteros Hoy", url: "https://reporteroshoy.mx/feed/", tier: 3, type: "MUNICIPAL", state: "Yucatán", city: "Mérida" },

  // Valladolid, Yucatán
  { name: "Punto Medio Valladolid", url: "https://puntomedio.mx/feed/", tier: 3, type: "MUNICIPAL", state: "Yucatán", city: "Valladolid" },

  // Fresnillo, Zacatecas
  { name: "Imagen Fresnillo", url: "https://imagenzac.com.mx/fresnillo/feed/", tier: 3, type: "MUNICIPAL", state: "Zacatecas", city: "Fresnillo" },
];

// ==================== FUENTES ESPECIALIZADAS ====================
const specializedSources: RssSourceData[] = [
  // Tecnología
  { name: "Xataka México", url: "https://www.xataka.com.mx/feed", tier: 2, type: "SPECIALIZED" },
  { name: "Hipertextual", url: "https://hipertextual.com/feed", tier: 2, type: "SPECIALIZED" },
  { name: "Unocero", url: "https://www.unocero.com/feed/", tier: 2, type: "SPECIALIZED" },
  { name: "FayerWayer", url: "https://www.fayerwayer.com/feed/", tier: 2, type: "SPECIALIZED" },

  // Deportes
  { name: "ESPN México", url: "https://espndeportes.espn.com/rss/news", tier: 2, type: "SPECIALIZED" },
  { name: "Récord", url: "https://www.record.com.mx/rss.xml", tier: 2, type: "SPECIALIZED" },
  { name: "Medio Tiempo", url: "https://www.mediotiempo.com/feed/", tier: 2, type: "SPECIALIZED" },
  { name: "TUDN", url: "https://www.tudn.com/rss/", tier: 2, type: "SPECIALIZED" },

  // Entretenimiento
  { name: "Quién", url: "https://www.quien.com/feed/", tier: 2, type: "SPECIALIZED" },
  { name: "TVNotas", url: "https://www.tvnotas.com.mx/feed/", tier: 3, type: "SPECIALIZED" },
  { name: "Publimetro Entretenimiento", url: "https://www.publimetro.com.mx/entretenimiento/feed/", tier: 3, type: "SPECIALIZED" },

  // Automotriz
  { name: "Autocosmos México", url: "https://noticias.autocosmos.com.mx/feed/", tier: 2, type: "SPECIALIZED" },
  { name: "Motor Pasión México", url: "https://www.motorpasion.com.mx/feed/", tier: 2, type: "SPECIALIZED" },

  // Viajes y Turismo
  { name: "México Desconocido", url: "https://www.mexicodesconocido.com.mx/feed/", tier: 2, type: "SPECIALIZED" },
  { name: "El Financiero Turismo", url: "https://www.elfinanciero.com.mx/turismo/rss/", tier: 2, type: "SPECIALIZED" },

  // Gastronomía
  { name: "Directo al Paladar México", url: "https://www.directoalpaladar.com.mx/feed/", tier: 2, type: "SPECIALIZED" },
  { name: "Animal Gourmet", url: "https://www.animalgourmet.com/feed/", tier: 2, type: "SPECIALIZED" },

  // Ciencia y Salud
  { name: "Ciencia UNAM", url: "https://ciencia.unam.mx/leer/feed/", tier: 2, type: "SPECIALIZED" },
  { name: "El Financiero Salud", url: "https://www.elfinanciero.com.mx/salud/rss/", tier: 2, type: "SPECIALIZED" },

  // Industria y Manufactura
  { name: "Manufactura MX", url: "https://manufactura.mx/feed/", tier: 2, type: "SPECIALIZED" },
  { name: "T21 Logística", url: "https://t21.com.mx/feed/", tier: 2, type: "SPECIALIZED" },
  { name: "Obras Web", url: "https://obrasweb.mx/feed/", tier: 2, type: "SPECIALIZED" },
  { name: "Energía Hoy", url: "https://energiahoy.com/feed/", tier: 2, type: "SPECIALIZED" },

  // Agricultura
  { name: "El Economista Agrícola", url: "https://www.eleconomista.com.mx/campo/rss/", tier: 2, type: "SPECIALIZED" },
  { name: "2000 Agro", url: "https://www.2000agro.com.mx/feed/", tier: 2, type: "SPECIALIZED" },

  // Inmobiliario
  { name: "Inmobiliare", url: "https://inmobiliare.com/feed/", tier: 2, type: "SPECIALIZED" },
  { name: "Real Estate Market", url: "https://realestatemarket.com.mx/feed/", tier: 2, type: "SPECIALIZED" },
];

// Combinar todas las fuentes
const allSources: RssSourceData[] = [
  ...nationalSources,
  ...stateSources,
  ...municipalSources,
  ...specializedSources,
];

async function seedRssSources() {
  console.log("Iniciando seed de fuentes RSS mexicanas...");
  console.log(`Total de fuentes a procesar: ${allSources.length}`);

  let created = 0;
  let updated = 0;
  let errors = 0;

  for (const source of allSources) {
    try {
      const existing = await prisma.rssSource.findUnique({
        where: { url: source.url },
      });

      if (existing) {
        await prisma.rssSource.update({
          where: { url: source.url },
          data: {
            name: source.name,
            tier: source.tier,
            type: source.type,
            state: source.state,
            city: source.city,
          },
        });
        updated++;
      } else {
        await prisma.rssSource.create({
          data: {
            name: source.name,
            url: source.url,
            tier: source.tier,
            type: source.type,
            state: source.state,
            city: source.city,
            active: true,
          },
        });
        created++;
      }
    } catch (error) {
      console.error(`Error con ${source.name} (${source.url}):`, error);
      errors++;
    }
  }

  console.log(`\nSeed completado:`);
  console.log(`  - Creados: ${created}`);
  console.log(`  - Actualizados: ${updated}`);
  console.log(`  - Errores: ${errors}`);
  console.log(`  - Total procesados: ${allSources.length}`);

  // Mostrar resumen por tipo
  const byType = await prisma.rssSource.groupBy({
    by: ["type"],
    _count: { id: true },
    orderBy: { type: "asc" },
  });

  console.log(`\nResumen por tipo:`);
  for (const t of byType) {
    console.log(`  - ${t.type}: ${t._count.id} fuentes`);
  }

  // Mostrar resumen por tier
  const byTier = await prisma.rssSource.groupBy({
    by: ["tier"],
    _count: { id: true },
    orderBy: { tier: "asc" },
  });

  console.log(`\nResumen por tier:`);
  for (const t of byTier) {
    const tierName = t.tier === 1 ? "Nacional" : t.tier === 2 ? "Estatal" : "Municipal/Digital";
    console.log(`  - Tier ${t.tier} (${tierName}): ${t._count.id} fuentes`);
  }

  // Mostrar cobertura por estado
  const byState = await prisma.rssSource.groupBy({
    by: ["state"],
    where: { state: { not: null } },
    _count: { id: true },
    orderBy: { state: "asc" },
  });

  console.log(`\nCobertura por estado:`);
  for (const s of byState) {
    console.log(`  - ${s.state}: ${s._count.id} fuentes`);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  seedRssSources()
    .then(() => {
      console.log("\nSeed de fuentes RSS ejecutado exitosamente");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Error en seed:", error);
      process.exit(1);
    })
    .finally(() => {
      prisma.$disconnect();
    });
}

export { seedRssSources, allSources, nationalSources, stateSources, municipalSources, specializedSources };
