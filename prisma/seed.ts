import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Create organization
  const org = await prisma.organization.create({
    data: { name: "Agencia PR Demo" },
  });

  // Create admin user
  const passwordHash = await bcrypt.hash("admin123", 12);
  await prisma.user.create({
    data: {
      name: "Admin",
      email: "admin@mediabot.local",
      passwordHash,
      role: "ADMIN",
      orgId: org.id,
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
  console.log(`  Login: admin@mediabot.local / admin123`);
  console.log(`  Cliente: ${client.name}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
