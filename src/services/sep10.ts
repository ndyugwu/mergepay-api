/**
 * SEP-10 (Stellar Web Authentication) — challenge/verify on the server side.
 *
 * The server holds one signing keypair (SEP10_SIGNING_SECRET). It builds a
 * challenge transaction the client signs with their wallet; we then verify the
 * client's signature to prove control of the account.
 */

import { Keypair, WebAuth, Transaction } from "@stellar/stellar-sdk";
import { config } from "../config";
import { Errors } from "../errors";
import { stellar } from "./stellar";

let _serverKeypair: Keypair | null = null;

export function serverKeypair(): Keypair {
  if (_serverKeypair) return _serverKeypair;
  if (config.SEP10_SIGNING_SECRET) {
    _serverKeypair = Keypair.fromSecret(config.SEP10_SIGNING_SECRET);
  } else {
    // Deterministic-enough ephemeral key for dev/test when none is configured.
    _serverKeypair = Keypair.random();
  }
  return _serverKeypair;
}

export function buildChallenge(account: string): {
  transaction: string;
  networkPassphrase: string;
} {
  const transaction = WebAuth.buildChallengeTx(
    serverKeypair(),
    account,
    config.SEP10_HOME_DOMAIN,
    300,
    config.networkPassphrase,
    config.WEB_AUTH_DOMAIN
  );
  return { transaction, networkPassphrase: config.networkPassphrase };
}

/**
 * Verify a signed challenge. Returns the authenticated client public key.
 * Handles unfunded accounts by verifying against the account's master key.
 */
export async function verifyChallenge(signedXdr: string): Promise<string> {
  let clientAccountId: string;
  try {
    const read = WebAuth.readChallengeTx(
      signedXdr,
      serverKeypair().publicKey(),
      config.networkPassphrase,
      config.SEP10_HOME_DOMAIN,
      config.WEB_AUTH_DOMAIN
    );
    clientAccountId = read.clientAccountID;
  } catch (e: any) {
    throw Errors.badRequest("invalid_challenge", e?.message ?? "Invalid challenge");
  }

  const snapshot = await stellar.loadAccount(clientAccountId);

  try {
    if (!snapshot.exists) {
      // Unfunded account: verify the master-key signature directly.
      WebAuth.verifyChallengeTxSigners(
        signedXdr,
        serverKeypair().publicKey(),
        config.networkPassphrase,
        [clientAccountId],
        config.SEP10_HOME_DOMAIN,
        config.WEB_AUTH_DOMAIN
      );
    } else {
      const signerSummary = snapshot.signers.map((s) => ({
        key: s.key,
        weight: s.weight,
      }));
      const med = snapshot.thresholds.med || 1;
      WebAuth.verifyChallengeTxThreshold(
        signedXdr,
        serverKeypair().publicKey(),
        config.networkPassphrase,
        med,
        signerSummary as any,
        config.SEP10_HOME_DOMAIN,
        config.WEB_AUTH_DOMAIN
      );
    }
  } catch (e: any) {
    throw Errors.unauthorized(
      `Challenge signature verification failed: ${e?.message ?? "unknown"}`
    );
  }

  return clientAccountId;
}

/** Validate the structure of a transaction XDR string (used in tests). */
export function parseTransaction(xdr: string): Transaction {
  return new Transaction(xdr, config.networkPassphrase);
}
