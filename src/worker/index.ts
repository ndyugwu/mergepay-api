/**
 * Background worker — reconciles on-chain state and anchor sessions.
 *
 * Run with `npm run worker`. Designed to be safe to run alongside the API.
 */

import { config } from "../config";
import { prisma } from "../db";
import { anchorService, mapAnchorStatus } from "../services/anchor";
import {
  reconciliationConfig,
  reconcileTransactions,
  startReconciliation,
} from "./reconciliation";

const log = (...args: unknown[]) =>
  // eslint-disable-next-line no-console
  console.log(`[worker ${new Date().toISOString()}]`, ...args);

export async function reconcilePending(): Promise<void> {
  await reconcileTransactions();
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
      // Skip this session this round.
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
  const fastMs = opts?.fastMs ?? reconciliationConfig.intervalMs;
  const slowMs = opts?.slowMs ?? 60_000;

  const stopReconciliation = startReconciliation(fastMs);

  const slow = setInterval(() => {
    reconcileAnchors().catch((e) => log("reconcileAnchors error", e));
    expireInvites().catch((e) => log("expireInvites error", e));
  }, slowMs);

  log(`worker started (reconciliation=${fastMs}ms slow=${slowMs}ms)`);

  return () => {
    stopReconciliation();
    clearInterval(slow);
  };
}

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
