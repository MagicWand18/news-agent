import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Fuentes clasificadas por tier
// Tier 1: Medios nacionales de alto alcance
// Tier 2: Medios regionales y especializados
// Tier 3: Blogs y medios digitales menores

const sourceTiers = [
  // ==================== TIER 1: MEDIOS NACIONALES ====================
  // México
  { domain: "elpais.com", name: "El País", tier: 1, reach: 50000000 },
  { domain: "eluniversal.com.mx", name: "El Universal", tier: 1, reach: 20000000 },
  { domain: "milenio.com", name: "Milenio", tier: 1, reach: 15000000 },
  { domain: "reforma.com", name: "Reforma", tier: 1, reach: 10000000 },
  { domain: "excelsior.com.mx", name: "Excélsior", tier: 1, reach: 8000000 },
  { domain: "jornada.com.mx", name: "La Jornada", tier: 1, reach: 7000000 },
  { domain: "elfinanciero.com.mx", name: "El Financiero", tier: 1, reach: 5000000 },
  { domain: "eleconomista.com.mx", name: "El Economista", tier: 1, reach: 4000000 },
  { domain: "forbes.com.mx", name: "Forbes México", tier: 1, reach: 3000000 },
  { domain: "expansion.mx", name: "Expansión", tier: 1, reach: 3000000 },

  // España
  { domain: "elmundo.es", name: "El Mundo", tier: 1, reach: 40000000 },
  { domain: "abc.es", name: "ABC", tier: 1, reach: 25000000 },
  { domain: "lavanguardia.com", name: "La Vanguardia", tier: 1, reach: 20000000 },
  { domain: "elperiodico.com", name: "El Periódico", tier: 1, reach: 15000000 },
  { domain: "20minutos.es", name: "20 Minutos", tier: 1, reach: 30000000 },

  // Latinoamérica
  { domain: "clarin.com", name: "Clarín (Argentina)", tier: 1, reach: 20000000 },
  { domain: "lanacion.com.ar", name: "La Nación (Argentina)", tier: 1, reach: 15000000 },
  { domain: "emol.com", name: "EMOL (Chile)", tier: 1, reach: 10000000 },
  { domain: "elmercurio.com", name: "El Mercurio (Chile)", tier: 1, reach: 8000000 },
  { domain: "eltiempo.com", name: "El Tiempo (Colombia)", tier: 1, reach: 15000000 },
  { domain: "elcomercio.pe", name: "El Comercio (Perú)", tier: 1, reach: 8000000 },

  // Internacional
  { domain: "bbc.com", name: "BBC", tier: 1, reach: 100000000 },
  { domain: "cnn.com", name: "CNN", tier: 1, reach: 80000000 },
  { domain: "nytimes.com", name: "New York Times", tier: 1, reach: 70000000 },
  { domain: "reuters.com", name: "Reuters", tier: 1, reach: 60000000 },
  { domain: "theguardian.com", name: "The Guardian", tier: 1, reach: 50000000 },
  { domain: "bloomberg.com", name: "Bloomberg", tier: 1, reach: 40000000 },
  { domain: "wsj.com", name: "Wall Street Journal", tier: 1, reach: 35000000 },
  { domain: "ft.com", name: "Financial Times", tier: 1, reach: 25000000 },
  { domain: "washingtonpost.com", name: "Washington Post", tier: 1, reach: 30000000 },
  { domain: "apnews.com", name: "Associated Press", tier: 1, reach: 50000000 },
  { domain: "afp.com", name: "AFP", tier: 1, reach: 40000000 },
  { domain: "efe.com", name: "EFE", tier: 1, reach: 30000000 },

  // ==================== TIER 2: MEDIOS REGIONALES/ESPECIALIZADOS ====================
  // México - Regionales
  { domain: "elsiglodetorreon.com.mx", name: "El Siglo de Torreón", tier: 2, reach: 500000 },
  { domain: "elheraldodechihuahua.com.mx", name: "El Heraldo de Chihuahua", tier: 2, reach: 300000 },
  { domain: "elnorte.com", name: "El Norte", tier: 2, reach: 2000000 },
  { domain: "eldiariodechihuahua.mx", name: "El Diario de Chihuahua", tier: 2, reach: 200000 },
  { domain: "elimparcial.com", name: "El Imparcial", tier: 2, reach: 400000 },
  { domain: "diariodemorelos.com", name: "Diario de Morelos", tier: 2, reach: 150000 },

  // Especializados - Tecnología
  { domain: "xataka.com", name: "Xataka", tier: 2, reach: 5000000 },
  { domain: "hipertextual.com", name: "Hipertextual", tier: 2, reach: 2000000 },
  { domain: "genbeta.com", name: "Genbeta", tier: 2, reach: 1500000 },
  { domain: "techcrunch.com", name: "TechCrunch", tier: 2, reach: 15000000 },
  { domain: "wired.com", name: "Wired", tier: 2, reach: 10000000 },
  { domain: "theverge.com", name: "The Verge", tier: 2, reach: 12000000 },
  { domain: "engadget.com", name: "Engadget", tier: 2, reach: 8000000 },
  { domain: "arstechnica.com", name: "Ars Technica", tier: 2, reach: 5000000 },

  // Especializados - Negocios
  { domain: "entrepreneur.com", name: "Entrepreneur", tier: 2, reach: 8000000 },
  { domain: "inc.com", name: "Inc.", tier: 2, reach: 6000000 },
  { domain: "businessinsider.com", name: "Business Insider", tier: 2, reach: 20000000 },
  { domain: "fastcompany.com", name: "Fast Company", tier: 2, reach: 5000000 },
  { domain: "fortune.com", name: "Fortune", tier: 2, reach: 7000000 },

  // Especializados - Industrias
  { domain: "obrasweb.mx", name: "Obras Web (Construcción)", tier: 2, reach: 200000 },
  { domain: "manufactura.mx", name: "Manufactura MX", tier: 2, reach: 150000 },
  { domain: "t21.com.mx", name: "T21 (Logística)", tier: 2, reach: 100000 },
  { domain: "energiaadebate.com", name: "Energía a Debate", tier: 2, reach: 80000 },
  { domain: "foodandbeverages.com.mx", name: "Food & Beverages MX", tier: 2, reach: 50000 },

  // ==================== TIER 3: DIGITALES Y BLOGS ====================
  { domain: "infobae.com", name: "Infobae", tier: 3, reach: 30000000 },
  { domain: "sdpnoticias.com", name: "SDP Noticias", tier: 3, reach: 5000000 },
  { domain: "sinembargo.mx", name: "Sin Embargo", tier: 3, reach: 3000000 },
  { domain: "animalpolitico.com", name: "Animal Político", tier: 3, reach: 2000000 },
  { domain: "aristeguinoticias.com", name: "Aristegui Noticias", tier: 3, reach: 4000000 },
  { domain: "proceso.com.mx", name: "Proceso", tier: 3, reach: 2000000 },
  { domain: "sopitas.com", name: "Sopitas", tier: 3, reach: 3000000 },
  { domain: "unotv.com", name: "Uno TV", tier: 3, reach: 2000000 },
  { domain: "debate.com.mx", name: "El Debate", tier: 3, reach: 1500000 },
  { domain: "elheraldo.hn", name: "El Heraldo (Honduras)", tier: 3, reach: 1000000 },

  // Portales de noticias
  { domain: "terra.com.mx", name: "Terra México", tier: 3, reach: 2000000 },
  { domain: "msn.com", name: "MSN", tier: 3, reach: 10000000 },
  { domain: "yahoo.com", name: "Yahoo Noticias", tier: 3, reach: 15000000 },

  // Digitales especializados
  { domain: "pulsoslp.com.mx", name: "Pulso SLP", tier: 3, reach: 200000 },
  { domain: "zocalo.com.mx", name: "Zócalo", tier: 3, reach: 300000 },
  { domain: "vanguardia.com.mx", name: "Vanguardia MX", tier: 3, reach: 400000 },
  { domain: "informador.mx", name: "El Informador", tier: 3, reach: 500000 },
  { domain: "elsoldemexico.com.mx", name: "El Sol de México", tier: 3, reach: 1000000 },
  { domain: "razon.com.mx", name: "La Razón", tier: 3, reach: 800000 },
];

async function seedSources() {
  console.log("Iniciando seed de fuentes con tiers...");

  let created = 0;
  let updated = 0;
  let errors = 0;

  for (const source of sourceTiers) {
    try {
      const existing = await prisma.sourceTier.findUnique({
        where: { domain: source.domain },
      });

      if (existing) {
        await prisma.sourceTier.update({
          where: { domain: source.domain },
          data: {
            name: source.name,
            tier: source.tier,
            reach: source.reach,
          },
        });
        updated++;
      } else {
        await prisma.sourceTier.create({
          data: source,
        });
        created++;
      }
    } catch (error) {
      console.error(`Error con ${source.domain}:`, error);
      errors++;
    }
  }

  console.log(`\nSeed completado:`);
  console.log(`  - Creados: ${created}`);
  console.log(`  - Actualizados: ${updated}`);
  console.log(`  - Errores: ${errors}`);
  console.log(`  - Total: ${sourceTiers.length}`);

  // Mostrar resumen por tier
  const summary = await prisma.sourceTier.groupBy({
    by: ["tier"],
    _count: { id: true },
    orderBy: { tier: "asc" },
  });

  console.log(`\nResumen por tier:`);
  for (const s of summary) {
    const tierName =
      s.tier === 1 ? "Nacionales" : s.tier === 2 ? "Regionales/Especializados" : "Digitales/Blogs";
    console.log(`  - Tier ${s.tier} (${tierName}): ${s._count.id} fuentes`);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  seedSources()
    .then(() => {
      console.log("\nSeed ejecutado exitosamente");
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

export { seedSources, sourceTiers };
