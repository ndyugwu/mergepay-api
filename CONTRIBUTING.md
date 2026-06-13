# Contributing to Mergepay API

Thanks for helping build an open-source, Stellar-native public good!

## Coding standards

- TypeScript `strict`. Validate **every** request with Zod.
- The API contract is mirrored in `mergepay-web/src/lib/types.ts` — keep them in sync.
- Never store or handle user private keys. Build unsigned XDRs; the wallet signs; validate the signed XDR against the intent before submitting.
- Every group action must check membership; admin-only actions must check the role.
- Write audit logs for state-changing actions.
- Keep Horizon/anchor I/O inside `src/services/*` so it stays mockable.

## Branching model

- `main` is always deployable and green.
- Branch from `main`: `feat/<name>`, `fix/<name>`, `docs/<name>`.

## Issue labels

`bug`, `feature`, `stellar`, `security`, `good first issue`, `docs`.

## PR checklist

- [ ] `npm run build` passes (zero TS errors)
- [ ] `npm test` passes (no DB/network needed — mock them)
- [ ] New endpoints validated with Zod + permission checks
- [ ] Contract changes mirrored in `mergepay-web`
- [ ] No secrets committed

## Tests

Tests must run offline. Mock Prisma (`vi.mock("../src/db")`) and the Stellar
service (`vi.mock("../src/services/stellar")`). Use `app.inject` for route tests.
