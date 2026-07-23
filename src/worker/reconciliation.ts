import pino from "pino";
import { prisma } from "../db";
import { stellar } from "../services/stellar";

const logger = pino({ name: "reconciliation-worker" });

function environmentNumber(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export const reconciliationConfig = {
  intervalMs: environmentNumber("RECONCILIATION_INTERVAL", 30_000),
  confirmationThreshold: environmentNumber("CONFIRMATION_THRESHOLD", 1),
  timeoutMs: environmentNumber("TX_TIMEOUT", 300_000),
  maxRetries: environmentNumber("RECONCILIATION_MAX_RETRIES", 3),
};

type ReconciliationRecord = {
  id: string;
  status: string;
  stellarTxHash: string | null;
  updatedAt: Date;
  model: string;
  delegate: any;
};

function delegates(): Array<{ model: string; delegate: any }> {
  const client = prisma as any;
  return [
    { model: "settlement", delegate: client.settlement },
    { model: "withdrawal", delegate: client.withdrawal },
    { model: "treasuryProposal", delegate: client.treasuryProposal },
    { model: "treasuryTransaction", delegate: client.treasuryTransaction },
  ].filter((entry) => entry.delegate);
}

async function loadPendingRecords(): Promise<ReconciliationRecord[]> {
  const olderThan = new Date(Date.now() - reconciliationConfig.intervalMs);
  const records: ReconciliationRecord[] = [];

  for (const { model, delegate } of delegates()) {
    const rows = await delegate.findMany({
      where: {
        status: { in: ["pending", "submitted"] },
        updatedAt: { lt: olderThan },
        stellarTxHash: { not: null },
      },
    });

    for (const row of rows) {
      if (!row.stellarTxHash) continue;
      records.push({
        id: row.id,
        status: row.status,
        stellarTxHash: row.stellarTxHash,
        updatedAt: row.updatedAt,
        model,
        delegate,
      });
    }
  }

  return records;
}

async function reconcileRecord(record: ReconciliationRecord): Promise<void> {
  if (!record.stellarTxHash) return;

  try {
    const transaction = await stellar.getTransaction(record.stellarTxHash);

    if (!transaction) {
      const timedOut =
        Date.now() - record.updatedAt.getTime() >= reconciliationConfig.timeoutMs;
      if (!timedOut) return;

      await record.delegate.update({
        where: { id: record.id },
        data: { status: "failed" },
      });
      logger.warn(
        { model: record.model, id: record.id, hash: record.stellarTxHash },
        "transaction timed out and was marked failed"
      );
      return;
    }

    if (transaction.successful) {
      if (!transaction.ledger && reconciliationConfig.confirmationThreshold > 0) {
        return;
      }

      if (record.status === "confirmed") return;
      await record.delegate.update({
        where: { id: record.id },
        data: { status: "confirmed" },
      });
      logger.info(
        { model: record.model, id: record.id, hash: record.stellarTxHash, ledger: transaction.ledger },
        "transaction confirmed"
      );
      return;
    }

    if (record.status === "failed") return;
    await record.delegate.update({
      where: { id: record.id },
      data: { status: "failed" },
    });
    logger.warn(
      { model: record.model, id: record.id, hash: record.stellarTxHash },
      "transaction failed on Stellar"
    );
  } catch (error) {
    logger.error(
      { err: error, model: record.model, id: record.id, hash: record.stellarTxHash },
      "unable to reconcile transaction; will retry"
    );
  }
}

export async function reconcileTransactions(): Promise<void> {
  let records: ReconciliationRecord[];
  try {
    records = await loadPendingRecords();
  } catch (error) {
    logger.error({ err: error }, "unable to load transactions for reconciliation");
    return;
  }

  for (const record of records) {
    await reconcileRecord(record);
  }
}

export function startReconciliation(intervalMs = reconciliationConfig.intervalMs): () => void {
  let stopped = false;
  let timer: NodeJS.Timeout;

  const schedule = () => {
    if (stopped) return;
    timer = setTimeout(async () => {
      await reconcileTransactions();
      schedule();
    }, intervalMs);
  };

  void reconcileTransactions().finally(schedule);

  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}

export const runReconciliation = reconcileTransactions;
