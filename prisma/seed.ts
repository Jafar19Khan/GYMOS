import { PrismaClient, Role, UserStatus } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

function makeSlug(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

async function ensureAccount(input: {
  email: string;
  password: string;
  name: string;
  role: Role;
  gymId?: string;
  isGymOwner?: boolean;
}) {
  const email = input.email.trim().toLowerCase();
  const passwordBytes = Buffer.byteLength(input.password, "utf8");

  if (input.password.length < 12 || passwordBytes > 72) {
    throw new Error(
      `Bootstrap password for ${email} must be at least 12 characters and no more than 72 UTF-8 bytes.`,
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    if (existing.role !== input.role || existing.gymId !== (input.gymId ?? null)) {
      throw new Error(
        `The existing account ${email} does not match the requested bootstrap role or gym. No account was modified.`,
      );
    }
    await prisma.user.update({ where: { id: existing.id }, data: { isGymOwner: input.isGymOwner ?? false } });
    console.info(`Bootstrap account already exists: ${email}`);
    return;
  }

  const passwordHash = await hash(input.password, 12);
  await prisma.user.create({
    data: {
      email,
      name: input.name.trim(),
      passwordHash,
      role: input.role,
      status: UserStatus.ACTIVE,
      gymId: input.gymId,
      isGymOwner: input.isGymOwner ?? false,
    },
  });

  console.info(`Created bootstrap account: ${email} (${input.role})`);
}

async function main() {
  const ownerEmail = process.env.BOOTSTRAP_OWNER_EMAIL?.trim();
  const ownerPassword = process.env.BOOTSTRAP_OWNER_PASSWORD;
  const adminEmail = process.env.BOOTSTRAP_SUPER_ADMIN_EMAIL?.trim();
  const adminPassword = process.env.BOOTSTRAP_SUPER_ADMIN_PASSWORD;

  if (ownerEmail && ownerPassword) {
    const gymName = process.env.BOOTSTRAP_GYM_NAME?.trim() || "GYMOS Gym";
    const slug = makeSlug(gymName) || "gymos-gym";
    const gym = await prisma.gym.upsert({
      where: { slug },
      update: { name: gymName },
      create: { name: gymName, slug },
    });

    await ensureAccount({
      email: ownerEmail,
      password: ownerPassword,
      name: process.env.BOOTSTRAP_OWNER_NAME?.trim() || "Gym Owner",
      role: Role.OWNER,
      gymId: gym.id,
      isGymOwner: true,
    });
  } else if (ownerEmail || ownerPassword) {
    throw new Error("Set both BOOTSTRAP_OWNER_EMAIL and BOOTSTRAP_OWNER_PASSWORD.");
  } else {
    console.info("Owner bootstrap skipped: no owner credentials were supplied.");
  }

  if (adminEmail && adminPassword) {
    await ensureAccount({
      email: adminEmail,
      password: adminPassword,
      name: process.env.BOOTSTRAP_SUPER_ADMIN_NAME?.trim() || "Platform Admin",
      role: Role.SUPER_ADMIN,
    });
  } else if (adminEmail || adminPassword) {
    throw new Error(
      "Set both BOOTSTRAP_SUPER_ADMIN_EMAIL and BOOTSTRAP_SUPER_ADMIN_PASSWORD.",
    );
  } else {
    console.info("Super-admin bootstrap skipped: no platform admin credentials were supplied.");
  }
}

main()
  .catch((error: unknown) => {
    console.error("GYMOS seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
