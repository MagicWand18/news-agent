import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Create organization - Crisalida (agencia de marketing)
  const org = await prisma.organization.create({
    data: { name: "Crisalida" },
  });

  // Create admin user for Crisalida
  const crisalidaPasswordHash = await bcrypt.hash("Cris4lid402", 12);
  await prisma.user.create({
    data: {
      name: "Admin Crisalida",
      email: "admin@crisalida.com",
      passwordHash: crisalidaPasswordHash,
      role: "ADMIN",
      orgId: org.id,
      isSuperAdmin: false,
    },
  });

  // Create super admin (ve todas las organizaciones)
  const superAdminPasswordHash = await bcrypt.hash("6lB5/A1NOVFOkOWG", 12);
  await prisma.user.create({
    data: {
      name: "Super Admin",
      email: "admin@example.com",
      passwordHash: superAdminPasswordHash,
      role: "ADMIN",
      isSuperAdmin: true,
      // Sin orgId - puede ver todas las organizaciones
    },
  });

  // Create sample client
  const client = await prisma.client.create({
    data: {
      name: "Empresa Demo",
      description: "Empresa de tecnologia para demostración",
      industry: "Tecnologia",
      orgId: org.id,
    },
  });

  // Add sample keywords
  await prisma.keyword.createMany({
    data: [
      { word: "Empresa Demo", type: "NAME", clientId: client.id },
      { word: "empresa demo", type: "ALIAS", clientId: client.id },
    ],
  });

  console.log("Seed completado!");
  console.log(`  Org: ${org.name} (${org.id})`);
  console.log(`  Admin Crisalida: admin@crisalida.com`);
  console.log(`  Super Admin: admin@example.com (isSuperAdmin: true)`);
  console.log(`  Cliente: ${client.name}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
