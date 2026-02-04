/**
 * Script para poblar la tabla NoRssSource con fuentes de noticias mexicanas
 * que no tienen RSS funcional pero pueden monitorearse via Google News RSS.
 *
 * Solo incluye medios de noticias generales (nacionales y regionales).
 * Excluye: deportes, espectáculos, tecnología, autos, etc.
 *
 * Uso: npx tsx scripts/seed-gnews-sources.ts
 */

import { PrismaClient, SourceType } from "@prisma/client";

const prisma = new PrismaClient();

interface GNewsSource {
  name: string;
  domain: string;
  tier: number;
  type: SourceType;
  state?: string;
}

// Fuentes de noticias generales sin RSS funcional
const GNEWS_SOURCES: GNewsSource[] = [
  // === NACIONALES (Tier 1) - Noticias Generales ===
  { name: "El Universal", domain: "eluniversal.com.mx", tier: 1, type: "NATIONAL" },
  { name: "Excélsior", domain: "excelsior.com.mx", tier: 1, type: "NATIONAL" },
  { name: "Proceso", domain: "proceso.com.mx", tier: 1, type: "NATIONAL" },
  { name: "Animal Político", domain: "animalpolitico.com", tier: 1, type: "NATIONAL" },
  { name: "SDP Noticias", domain: "sdpnoticias.com", tier: 1, type: "NATIONAL" },
  { name: "Infobae México", domain: "infobae.com", tier: 1, type: "NATIONAL" },
  { name: "Crónica", domain: "cronica.com.mx", tier: 1, type: "NATIONAL" },
  { name: "UnoTV", domain: "unotv.com", tier: 1, type: "NATIONAL" },
  { name: "Aristegui Noticias", domain: "aristeguinoticias.com", tier: 1, type: "NATIONAL" },
  { name: "La Silla Rota", domain: "lasillarota.com", tier: 1, type: "NATIONAL" },
  { name: "El Financiero", domain: "elfinanciero.com.mx", tier: 1, type: "NATIONAL" },
  { name: "24 Horas", domain: "24-horas.mx", tier: 1, type: "NATIONAL" },
  { name: "Reporte Índigo", domain: "reporteindigo.com", tier: 1, type: "NATIONAL" },
  { name: "MVS Noticias", domain: "mvsnoticias.com", tier: 1, type: "NATIONAL" },
  { name: "El Heraldo de México", domain: "heraldodemexico.com.mx", tier: 1, type: "NATIONAL" },

  // === JALISCO (Tier 2) ===
  { name: "Mural", domain: "mural.com", tier: 2, type: "STATE", state: "Jalisco" },
  { name: "NTR Guadalajara", domain: "ntrguadalajara.com", tier: 2, type: "STATE", state: "Jalisco" },
  { name: "El Occidental", domain: "eloccidental.com.mx", tier: 2, type: "STATE", state: "Jalisco" },
  { name: "Informador", domain: "informador.mx", tier: 2, type: "STATE", state: "Jalisco" },
  { name: "Publimetro Guadalajara", domain: "publimetro.com.mx", tier: 2, type: "STATE", state: "Jalisco" },

  // === NUEVO LEÓN (Tier 2) ===
  { name: "ABC Noticias", domain: "abcnoticias.mx", tier: 2, type: "STATE", state: "Nuevo León" },
  { name: "Telediario", domain: "telediario.mx", tier: 2, type: "STATE", state: "Nuevo León" },
  { name: "El Horizonte", domain: "elhorizonte.mx", tier: 2, type: "STATE", state: "Nuevo León" },
  { name: "Info7", domain: "info7.mx", tier: 2, type: "STATE", state: "Nuevo León" },
  { name: "El Norte", domain: "elnorte.com", tier: 2, type: "STATE", state: "Nuevo León" },
  { name: "Multimedios", domain: "multimedios.com", tier: 2, type: "STATE", state: "Nuevo León" },

  // === COAHUILA (Tier 2) ===
  { name: "Vanguardia", domain: "vanguardia.com.mx", tier: 2, type: "STATE", state: "Coahuila" },
  { name: "Zócalo Saltillo", domain: "zocalo.com.mx", tier: 2, type: "STATE", state: "Coahuila" },
  { name: "El Siglo de Torreón", domain: "elsiglodetorreon.com.mx", tier: 2, type: "STATE", state: "Coahuila" },

  // === VERACRUZ (Tier 2) ===
  { name: "Al Calor Político", domain: "alcalorpolitico.com", tier: 2, type: "STATE", state: "Veracruz" },
  { name: "El Dictamen", domain: "eldictamen.mx", tier: 2, type: "STATE", state: "Veracruz" },
  { name: "Diario de Xalapa", domain: "diariodexalapa.com.mx", tier: 2, type: "STATE", state: "Veracruz" },
  { name: "Imagen del Golfo", domain: "imagendelgolfo.mx", tier: 2, type: "STATE", state: "Veracruz" },

  // === PUEBLA (Tier 2) ===
  { name: "E-Consulta Puebla", domain: "e-consulta.com", tier: 2, type: "STATE", state: "Puebla" },
  { name: "El Sol de Puebla", domain: "elsoldepuebla.com.mx", tier: 2, type: "STATE", state: "Puebla" },
  { name: "Milenio Puebla", domain: "milenio.com", tier: 2, type: "STATE", state: "Puebla" },
  { name: "Municipios Puebla", domain: "municipiospuebla.mx", tier: 2, type: "STATE", state: "Puebla" },

  // === ESTADO DE MÉXICO (Tier 2) ===
  { name: "El Sol de Toluca", domain: "elsoldetoluca.com.mx", tier: 2, type: "STATE", state: "Estado de México" },
  { name: "Portal Edomex", domain: "portaledomex.com", tier: 2, type: "STATE", state: "Estado de México" },

  // === SINALOA (Tier 2) ===
  { name: "Noroeste", domain: "noroeste.com.mx", tier: 2, type: "STATE", state: "Sinaloa" },
  { name: "El Debate", domain: "debate.com.mx", tier: 2, type: "STATE", state: "Sinaloa" },
  { name: "El Sol de Sinaloa", domain: "elsoldesinaloa.com.mx", tier: 2, type: "STATE", state: "Sinaloa" },
  { name: "Línea Directa", domain: "lineadirectaportal.com", tier: 2, type: "STATE", state: "Sinaloa" },

  // === CHIHUAHUA (Tier 2) ===
  { name: "El Diario de Chihuahua", domain: "eldiariodechihuahua.mx", tier: 2, type: "STATE", state: "Chihuahua" },
  { name: "El Heraldo de Chihuahua", domain: "elheraldodechihuahua.com.mx", tier: 2, type: "STATE", state: "Chihuahua" },
  { name: "Norte Digital", domain: "nortedigital.mx", tier: 2, type: "STATE", state: "Chihuahua" },

  // === BAJA CALIFORNIA (Tier 2) ===
  { name: "El Imparcial Tijuana", domain: "elimparcial.com", tier: 2, type: "STATE", state: "Baja California" },
  { name: "Frontera", domain: "frontera.info", tier: 2, type: "STATE", state: "Baja California" },
  { name: "La Voz de la Frontera", domain: "lavozdelafrontera.com.mx", tier: 2, type: "STATE", state: "Baja California" },

  // === SONORA (Tier 2) ===
  { name: "El Imparcial Sonora", domain: "elimparcial.com", tier: 2, type: "STATE", state: "Sonora" },
  { name: "Proyecto Puente", domain: "proyectopuente.com.mx", tier: 2, type: "STATE", state: "Sonora" },
  { name: "Expreso", domain: "expreso.com.mx", tier: 2, type: "STATE", state: "Sonora" },

  // === YUCATÁN (Tier 2) ===
  { name: "Diario de Yucatán", domain: "yucatan.com.mx", tier: 2, type: "STATE", state: "Yucatán" },
  { name: "La Verdad Yucatán", domain: "laverdadnoticias.com", tier: 2, type: "STATE", state: "Yucatán" },
  { name: "Reporteros Hoy", domain: "reporteroshoy.mx", tier: 2, type: "STATE", state: "Yucatán" },

  // === QUINTANA ROO (Tier 2) ===
  { name: "Novedades Quintana Roo", domain: "sipse.com", tier: 2, type: "STATE", state: "Quintana Roo" },
  { name: "Luces del Siglo", domain: "lucesdelsiglo.com", tier: 2, type: "STATE", state: "Quintana Roo" },

  // === GUERRERO (Tier 2) ===
  { name: "El Sur de Acapulco", domain: "suracapulco.mx", tier: 2, type: "STATE", state: "Guerrero" },
  { name: "Quadratín Guerrero", domain: "guerrero.quadratin.com.mx", tier: 2, type: "STATE", state: "Guerrero" },

  // === MICHOACÁN (Tier 2) ===
  { name: "La Voz de Michoacán", domain: "lavozdemichoacan.com.mx", tier: 2, type: "STATE", state: "Michoacán" },
  { name: "Quadratín Michoacán", domain: "michoacan.quadratin.com.mx", tier: 2, type: "STATE", state: "Michoacán" },

  // === GUANAJUATO (Tier 2) ===
  { name: "AM León", domain: "am.com.mx", tier: 2, type: "STATE", state: "Guanajuato" },
  { name: "Zona Franca", domain: "zonafranca.mx", tier: 2, type: "STATE", state: "Guanajuato" },
  { name: "El Sol del Bajío", domain: "elsoldelbajio.com.mx", tier: 2, type: "STATE", state: "Guanajuato" },

  // === SAN LUIS POTOSÍ (Tier 2) ===
  { name: "Pulso SLP", domain: "pulsoslp.com.mx", tier: 2, type: "STATE", state: "San Luis Potosí" },
  { name: "El Sol de San Luis", domain: "elsoldesanluis.com.mx", tier: 2, type: "STATE", state: "San Luis Potosí" },

  // === OAXACA (Tier 2) ===
  { name: "Quadratín Oaxaca", domain: "oaxaca.quadratin.com.mx", tier: 2, type: "STATE", state: "Oaxaca" },
  { name: "El Imparcial Oaxaca", domain: "imparcialoaxaca.mx", tier: 2, type: "STATE", state: "Oaxaca" },

  // === TABASCO (Tier 2) ===
  { name: "Tabasco Hoy", domain: "tabascohoy.com", tier: 2, type: "STATE", state: "Tabasco" },
  { name: "Presente", domain: "diariopresente.mx", tier: 2, type: "STATE", state: "Tabasco" },

  // === TAMAULIPAS (Tier 2) ===
  { name: "El Mañana", domain: "elmanana.com", tier: 2, type: "STATE", state: "Tamaulipas" },
  { name: "Hora Cero", domain: "horacero.com.mx", tier: 2, type: "STATE", state: "Tamaulipas" },

  // === CHIAPAS (Tier 2) ===
  { name: "El Heraldo de Chiapas", domain: "elheraldodechiapas.com.mx", tier: 2, type: "STATE", state: "Chiapas" },
  { name: "Diario de Chiapas", domain: "diariodechiapas.com", tier: 2, type: "STATE", state: "Chiapas" },

  // === AGUASCALIENTES (Tier 2) ===
  { name: "El Sol del Centro", domain: "elsoldelcentro.com.mx", tier: 2, type: "STATE", state: "Aguascalientes" },
  { name: "Hidrocálido", domain: "hidrocalidodigital.com", tier: 2, type: "STATE", state: "Aguascalientes" },

  // === MORELOS (Tier 2) ===
  { name: "El Sol de Cuernavaca", domain: "elsoldecuernavaca.com.mx", tier: 2, type: "STATE", state: "Morelos" },
  { name: "Diario de Morelos", domain: "diariodemorelos.com", tier: 2, type: "STATE", state: "Morelos" },

  // === QUERÉTARO (Tier 2) ===
  { name: "Diario de Querétaro", domain: "diariodequeretaro.com.mx", tier: 2, type: "STATE", state: "Querétaro" },
  { name: "AM Querétaro", domain: "amqueretaro.com", tier: 2, type: "STATE", state: "Querétaro" },

  // === DURANGO (Tier 2) ===
  { name: "El Sol de Durango", domain: "elsoldedurango.com.mx", tier: 2, type: "STATE", state: "Durango" },
  { name: "Victoria de Durango", domain: "victoriadedurango.com", tier: 2, type: "STATE", state: "Durango" },

  // === HIDALGO (Tier 2) ===
  { name: "Quadratín Hidalgo", domain: "hidalgo.quadratin.com.mx", tier: 2, type: "STATE", state: "Hidalgo" },
  { name: "Criterio Hidalgo", domain: "criteriohidalgo.com", tier: 2, type: "STATE", state: "Hidalgo" },

  // === ZACATECAS (Tier 2) ===
  { name: "NTR Zacatecas", domain: "ntrzacatecas.com", tier: 2, type: "STATE", state: "Zacatecas" },
  { name: "Imagen Zacatecas", domain: "imagenzac.com.mx", tier: 2, type: "STATE", state: "Zacatecas" },

  // === TLAXCALA (Tier 2) ===
  { name: "El Sol de Tlaxcala", domain: "elsoldetlaxcala.com.mx", tier: 2, type: "STATE", state: "Tlaxcala" },
  { name: "Quadratín Tlaxcala", domain: "tlaxcala.quadratin.com.mx", tier: 2, type: "STATE", state: "Tlaxcala" },

  // === NAYARIT (Tier 2) ===
  { name: "Meridiano Nayarit", domain: "meridiano.mx", tier: 2, type: "STATE", state: "Nayarit" },

  // === COLIMA (Tier 2) ===
  { name: "Diario de Colima", domain: "diariodecolima.com", tier: 2, type: "STATE", state: "Colima" },

  // === CAMPECHE (Tier 2) ===
  { name: "Tribuna Campeche", domain: "tribunacampeche.com", tier: 2, type: "STATE", state: "Campeche" },

  // === BAJA CALIFORNIA SUR (Tier 2) ===
  { name: "El Sudcaliforniano", domain: "elsudcaliforniano.com.mx", tier: 2, type: "STATE", state: "Baja California Sur" },
];

async function main() {
  console.log("🌐 Poblando fuentes de Google News RSS...\n");

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const source of GNEWS_SOURCES) {
    try {
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
        },
      });
      created++;
      console.log(`  ✅ ${source.name} (${source.domain})`);
    } catch (error) {
      if ((error as { code?: string }).code === "P2002") {
        skipped++;
        console.log(`  ⏭️ ${source.name} - ya existe`);
      } else {
        errors++;
        console.error(`  ❌ ${source.name}: ${(error as Error).message}`);
      }
    }
  }

  console.log("\n📊 Resumen:");
  console.log(`  Total fuentes: ${GNEWS_SOURCES.length}`);
  console.log(`  Creadas/actualizadas: ${created}`);
  console.log(`  Omitidas (duplicadas): ${skipped}`);
  console.log(`  Errores: ${errors}`);

  // Mostrar estadísticas por tipo y estado
  const stats = await prisma.noRssSource.groupBy({
    by: ["type", "state"],
    _count: { id: true },
    where: { active: true },
    orderBy: { _count: { id: "desc" } },
  });

  console.log("\n📈 Estadísticas por tipo:");
  const byType: Record<string, number> = {};
  for (const stat of stats) {
    byType[stat.type] = (byType[stat.type] || 0) + stat._count.id;
  }
  for (const [type, count] of Object.entries(byType)) {
    console.log(`  ${type}: ${count}`);
  }

  console.log("\n📍 Estadísticas por estado:");
  for (const stat of stats) {
    if (stat.state) {
      console.log(`  ${stat.state}: ${stat._count.id}`);
    }
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
