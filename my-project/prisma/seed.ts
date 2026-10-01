import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEV_PASSWORD = "password123";

const seedUsers = [
  {
    name: "Alex Vance",
    email: "organiser@eventops.com",
    role: "organiser" as const,
    volunteerSubRole: null,
  },
  {
    name: "Jamie Rivera",
    email: "volunteer@eventops.com",
    role: "volunteer" as const,
    volunteerSubRole: "team_lead" as const,
  },
  {
    name: "Sam Patel",
    email: "attendee@eventops.com",
    role: "participant" as const,
    volunteerSubRole: null,
  },
];

async function main() {
  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 10);

  for (const u of seedUsers) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {
        name: u.name,
        role: u.role,
        volunteerSubRole: u.volunteerSubRole,
      },
      create: {
        name: u.name,
        email: u.email,
        passwordHash,
        role: u.role,
        volunteerSubRole: u.volunteerSubRole,
      },
    });
    console.log(`✓ seeded ${u.email} (${u.role}${u.volunteerSubRole ? ` / ${u.volunteerSubRole}` : ""})`);
  }
  console.log(`\nDev password for all seed users: ${DEV_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
