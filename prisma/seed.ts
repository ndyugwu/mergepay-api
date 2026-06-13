/**
 * Demo seed: a few users and a sample group with an expense + shares.
 * Public keys are example testnet accounts — fund them via friendbot if you
 * want to exercise real settlement.
 */

import { PrismaClient } from "@prisma/client";
import { Keypair } from "@stellar/stellar-sdk";

const prisma = new PrismaClient();

async function main() {
  const people = ["Ada", "Kola", "Zo"].map((name) => ({
    name,
    keypair: Keypair.random(),
  }));

  const users = await Promise.all(
    people.map((p) =>
      prisma.user.upsert({
        where: { stellarPublicKey: p.keypair.publicKey() },
        update: {},
        create: {
          stellarPublicKey: p.keypair.publicKey(),
          displayName: p.name,
        },
      })
    )
  );

  const group = await prisma.group.create({
    data: {
      name: "Lagos Trip",
      description: "Weekend getaway expenses",
      createdByUserId: users[0].id,
      members: {
        create: users.map((u, i) => ({
          userId: u.id,
          role: i === 0 ? "admin" : "member",
        })),
      },
    },
  });

  const total = "30";
  await prisma.expense.create({
    data: {
      groupId: group.id,
      payerUserId: users[0].id,
      title: "Dinner",
      amount: total,
      assetCode: "XLM",
      splitType: "equal",
      memo: "dinner",
      shares: {
        create: users.map((u) => ({
          userId: u.id,
          shareAmount: "10",
          status: u.id === users[0].id ? "settled" : "pending",
        })),
      },
    },
  });

  // eslint-disable-next-line no-console
  console.log(`Seeded group "${group.name}" with ${users.length} members.`);
  // eslint-disable-next-line no-console
  console.log("Demo accounts (fund via friendbot to settle on testnet):");
  for (const p of people) {
    // eslint-disable-next-line no-console
    console.log(`  ${p.name}: ${p.keypair.publicKey()}`);
  }
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
