import { describe, it, expect } from "vitest";
import { Keypair, Transaction } from "@stellar/stellar-sdk";
import { stellar, validatePaymentTx } from "../src/services/stellar";
import { config } from "../src/config";

const from = Keypair.random();
const to = Keypair.random();

const intent = {
  sourcePublicKey: from.publicKey(),
  destination: to.publicKey(),
  asset: { code: "XLM", issuer: null },
  amount: "12.5000000",
  memoCode: "ABC123",
};

function buildXdr(overrides: Partial<typeof intent> = {}): string {
  return stellar.buildPayment({
    sourcePublicKey: overrides.sourcePublicKey ?? intent.sourcePublicKey,
    sourceSequence: "12345",
    destination: overrides.destination ?? intent.destination,
    asset: overrides.asset ?? intent.asset,
    amount: overrides.amount ?? intent.amount,
    memoCode: overrides.memoCode ?? intent.memoCode,
  });
}

describe("payment XDR validation", () => {
  it("accepts a transaction that matches the intent", () => {
    const tx = new Transaction(buildXdr(), config.networkPassphrase);
    expect(() => validatePaymentTx(tx, intent)).not.toThrow();
  });

  it("rejects a mismatched amount", () => {
    const tx = new Transaction(buildXdr({ amount: "99" }), config.networkPassphrase);
    expect(() => validatePaymentTx(tx, intent)).toThrow(/amount/i);
  });

  it("rejects a mismatched destination", () => {
    const other = Keypair.random().publicKey();
    const tx = new Transaction(
      buildXdr({ destination: other }),
      config.networkPassphrase
    );
    expect(() => validatePaymentTx(tx, intent)).toThrow(/destination/i);
  });

  it("rejects a mismatched memo", () => {
    const tx = new Transaction(
      buildXdr({ memoCode: "DIFFERENT" }),
      config.networkPassphrase
    );
    expect(() => validatePaymentTx(tx, intent)).toThrow(/memo/i);
  });

  it("builds a memo within the 28-byte limit", () => {
    const tx = new Transaction(buildXdr(), config.networkPassphrase);
    const memo = (tx.memo as any).value.toString();
    expect(memo).toBe("MP:ABC123");
    expect(Buffer.byteLength(memo)).toBeLessThanOrEqual(28);
  });
});
