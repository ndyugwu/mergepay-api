import "dotenv/config";
import { z } from "zod";
import { Networks } from "@stellar/stellar-sdk";

const schema = z.object({
  DATABASE_URL: z.string().default("postgresql://postgres:postgres@localhost:5432/mergepay"),
  PORT: z.coerce.number().default(4000),
  API_PUBLIC_URL: z.string().default("http://localhost:4000"),
  WEB_URL: z.string().default("http://localhost:3000"),
  JWT_SECRET: z.string().default("change-me-in-production"),
  STELLAR_NETWORK: z.enum(["testnet", "public"]).default("testnet"),
  HORIZON_URL: z.string().default("https://horizon-testnet.stellar.org"),
  SEP10_SIGNING_SECRET: z.string().optional(),
  SEP10_HOME_DOMAIN: z.string().default("localhost:4000"),
  WEB_AUTH_DOMAIN: z.string().default("localhost:4000"),
  ANCHOR_HOME_DOMAIN: z.string().default("testanchor.stellar.org"),
  ANCHOR_NAME: z.string().default("Stellar Test Anchor"),
  ANCHOR_WEBHOOK_SECRET: z.string().default("change-me"),
  STABLE_ASSET_CODE: z.string().default("USDC"),
  STABLE_ASSET_ISSUER: z
    .string()
    .default("GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"),
  UPLOADS_DIR: z.string().default("./uploads"),
  NODE_ENV: z.string().default("development"),
});

const parsed = schema.parse(process.env);

export const config = {
  ...parsed,
  isTest: process.env.NODE_ENV === "test" || process.env.VITEST === "true",
  networkPassphrase:
    parsed.STELLAR_NETWORK === "public" ? Networks.PUBLIC : Networks.TESTNET,
  jwtExpiresIn: "12h" as const,
};

export type Config = typeof config;
