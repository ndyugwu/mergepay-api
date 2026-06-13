/**
 * Background worker — reconciles on-chain state and anchor sessions.
 *
 *  - every 20s: settlements & treasury txs in "submitted" -> poll Horizon -> confirmed/failed
 *  - every 60s: poll active anchor sessions; expire stale invites
 *
 * Run with `npm run worker`. Designed to be safe to run alongside the API.
 */

import { config } from "../config";
import { prisma } from "../db";
import { stellar } from "../services/stellar";
import { anchorService, mapAnchorStatus } from "../services/anchor";

const log = (...args: unknown[]) =>
  // eslint-disable-next-line no-console
  console.log(`[worker ${new Date().toISOString()}]`, ...args);

export async function reconcilePending(): Promise<void> {
  const settlements = await prisma.settlement.findMany({
    where: { status: "submitted", stellarTxHash: { not: null } },
  });
  for (const s of settlements) {
    if (!s.stellarTxHash) continue;
    const tx = await stellar.getTransaction(s.stellarTxHash);
    if (!tx) continue;
    if (tx.successful) {
      await prisma.$transaction(async (db) => {
        await db.settlement.update({
          where: { id: s.id },
          data: { status: "confirmed" },
        });
        if (s.expenseShareId) {
          await db.expenseShare.update({
            where: { id: s.expenseShareId },
            data: { status: "settled" },
          });
        }
      });
      log("settlement confirmed", s.id);
    } else {
      await prisma.settlement.update({
        where: { id: s.id },
        data: { status: "failed" },
      });
    }
  }

  const treasuryTxs = await prisma.treasuryTransaction.findMany({
    where: { status: "submitted", stellarTxHash: { not: null } },
  });
  for (const t of treasuryTxs) {
    if (!t.stellarTxHash) continue;
    const tx = await stellar.getTransaction(t.stellarTxHash);
    if (!tx) continue;
    await prisma.treasuryTransaction.update({
      where: { id: t.id },
      data: { status: tx.successful ? "confirmed" : "failed" },
    });
  }
}

export async function reconcileAnchors(): Promise<void> {
  const sessions = await prisma.anchorSession.findMany({
    where: {
      anchorToken: { not: null },
      externalTransactionId: { not: null },
      status: { notIn: ["completed", "error", "refunded"] },
    },
    take: 50,
  });
  if (sessions.length === 0) return;

  let toml;
  try {
    toml = await anchorService.getToml(config.ANCHOR_HOME_DOMAIN);
  } catch {
    return;
  }

  for (const s of sessions) {
    try {
      const status = await anchorService.getTransactionStatus({
        transferServer: toml.transferServerSep24,
        token: s.anchorToken!,
        id: s.externalTransactionId!,
      });
      if (status) {
        await prisma.anchorSession.update({
          where: { id: s.id },
          data: { status: mapAnchorStatus(status) },
        });
      }
    } catch {
      // skip this session this round
    }
  }
}

export async function expireInvites(): Promise<void> {
  await prisma.invite.deleteMany({
    where: { expiresAt: { not: null, lt: new Date() } },
  });
}

export function startWorker(opts?: {
  fastMs?: number;
  slowMs?: number;
}): () => void {
  const fastMs = opts?.fastMs ?? 20_000;
  const slowMs = opts?.slowMs ?? 60_000;

  const fast = setInterval(() => {
    reconcilePending().catch((e) => log("reconcilePending error", e));
  }, fastMs);

  const slow = setInterval(() => {
    reconcileAnchors().catch((e) => log("reconcileAnchors error", e));
    expireInvites().catch((e) => log("expireInvites error", e));
  }, slowMs);

  log(`worker started (fast=${fastMs}ms slow=${slowMs}ms)`);

  return () => {
    clearInterval(fast);
    clearInterval(slow);
  };
}

// Run standalone.
if (require.main === module) {
  const stop = startWorker();
  const shutdown = async () => {
    log("shutting down");
    stop();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
