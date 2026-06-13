import { describe, it, expect, vi, beforeEach } from "vitest";
import { Keypair, Transaction } from "@stellar/stellar-sdk";

// Mock Horizon so the verify step treats the client account as unfunded
// (pure crypto verification against the master key — no network).
vi.mock("../src/services/stellar", async (importActual) => {
  const actual = await importActual<typeof import("../src/services/stellar")>();
  return {
    ...actual,
    stellar: {
      ...actual.stellar,
      loadAccount: vi.fn(async () => ({
        exists: false,
        sequence: "0",
        balances: [],
        signers: [],
        thresholds: { low: 0, med: 0, high: 0 },
      })),
    },
  };
});

import { buildChallenge, verifyChallenge } from "../src/services/sep10";
import { config } from "../src/config";

describe("SEP-10 challenge / verify", () => {
  beforeEach(() => vi.clearAllMocks());

  it("builds a valid challenge transaction for an account", () => {
    const client = Keypair.random();
    const { transaction, networkPassphrase } = buildChallenge(client.publicKey());
    expect(networkPassphrase).toBe(config.networkPassphrase);
    const tx = new Transaction(transaction, networkPassphrase);
    // A challenge is a 0-sequence tx with at least one manage_data op.
    expect(tx.sequence).toBe("0");
    expect(tx.operations.length).toBeGreaterThanOrEqual(1);
    expect(tx.operations[0].type).toBe("manageData");
  });

  it("verifies a correctly signed challenge and returns the client account id", async () => {
    const client = Keypair.random();
    const { transaction, networkPassphrase } = buildChallenge(client.publicKey());

    const tx = new Transaction(transaction, networkPassphrase);
    tx.sign(client);
    const signedXdr = tx.toXDR();

    const verified = await verifyChallenge(signedXdr);
    expect(verified).toBe(client.publicKey());
  });

  it("rejects a challenge that the client did not sign", async () => {
    const client = Keypair.random();
    const { transaction } = buildChallenge(client.publicKey());
    // Not signed by the client.
    await expect(verifyChallenge(transaction)).rejects.toBeTruthy();
  });
});
