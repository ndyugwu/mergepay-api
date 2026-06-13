import { Keypair } from "@stellar/stellar-sdk";

const kp = Keypair.random();
// eslint-disable-next-line no-console
console.log(`SEP10_SIGNING_SECRET=${kp.secret()}`);
// eslint-disable-next-line no-console
console.log(`# public key: ${kp.publicKey()}`);
