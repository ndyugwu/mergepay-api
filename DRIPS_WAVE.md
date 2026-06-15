# Drips Wave — Maintainer Guide & Bounty Queue

This document is everything Mergepay needs to be **accepted into a Stellar Drips
Wave Program** and to run it well. It is split into:

1. **Application checklist** — what's already in the repo vs. the human steps only you can do.
2. **FUNDING.json** — the on-chain claim file (you must set your address).
3. **Labels** — the complexity labels reviewers look for.
4. **Bounty queue** — 6 ready-to-paste, well-scoped issues (backend only).

> **Apply the Wave with this backend repo (`mergepay/mergepay-api`).** Its issue
> queue below is intentionally backend-focused so contributions never touch the
> finished frontend. The `mergepay-web` repo still carries its own `FUNDING.json`,
> `LICENSE`, and `CONTRIBUTING.md` so it is independently claimable later.

---

## 1. Application checklist

### ✅ Already in the repository (code/docs done)

- [x] **GitHub Organization host** — repo lives under the `mergepay` org (not a personal account).
- [x] **Open-source license** — [`LICENSE`](LICENSE) (MIT).
- [x] **`FUNDING.json`** at the repo root on the default branch (address must be set — see §2).
- [x] **README with ecosystem utility** — top of [`README.md`](README.md) states the Stellar integration (SEP-10, payments+memos, trustlines, multisig, SEP-24).
- [x] **5-minute setup guide** — copy-paste `git clone` → `npm install` → `npm run dev` in the README.
- [x] **`CONTRIBUTING.md`** — PR standards, coding standards, testing workflow, public-communication rule, and the Drips claim/complexity flow.
- [x] **Bounty issue template** — [`.github/ISSUE_TEMPLATE/drips_wave_task.md`](.github/ISSUE_TEMPLATE/drips_wave_task.md).
- [x] **Bounty queue** — 6 scoped issues with acceptance criteria below (§4), ready to paste.

### 🧑‍💻 Human steps only you can do (cannot be committed)

- [ ] **Repo is Public** — confirm in GitHub repo Settings.
- [ ] **Set your Ethereum address** in `FUNDING.json` (§2) and commit to `main`.
- [ ] **Claim the project on Drips** — Drips App → connect wallet → Projects → Claim, which verifies `FUNDING.json`.
- [ ] **Install the Drips Wave GitHub App** on the `mergepay` org with read/write on issues, labels, and PRs.
- [ ] **Create the complexity labels** (§3) in the repo.
- [ ] **File the 6 issues** (§4) and apply a complexity label to each.
- [ ] **Apply to the Stellar Wave Program** in the Drips Wave app and wait for approval.
- [ ] **Complete KYC / identity verification** on Drips (required before distributing rewards).

---

## 2. `FUNDING.json` — set your address

The file at the repo root currently contains a **placeholder** zero address:

```json
{ "drips": { "ethereum": { "ownedBy": "0x0000000000000000000000000000000000000000" } } }
```

Replace `0x0000…0000` with the **Ethereum address you will claim the project with**
in the Drips App, then commit it to the default branch. Drips reads this file to
verify you are the legitimate maintainer. The claim will fail (safely) until the
address matches your connected wallet — it will never silently use the wrong one.

If the Wave you join settles on a different chain (e.g. Optimism, Filecoin), add that
network key alongside `ethereum`:

```json
{
  "drips": {
    "ethereum": { "ownedBy": "0xYourAddress" },
    "optimism": { "ownedBy": "0xYourAddress" }
  }
}
```

---

## 3. Complexity labels

Drips Wave maps issue complexity to reward points. Create these labels in the repo
(GitHub → Issues → Labels → New label), or with the GitHub CLI:

```bash
gh label create "complexity: trivial" --color BFE9F0 --description "Drips Wave — small, well-bounded task"
gh label create "complexity: medium"  --color D7F94B --description "Drips Wave — moderate scope, some design"
gh label create "complexity: high"    --color FF8A3C --description "Drips Wave — large or cross-cutting task"
gh label create "drips-wave"          --color 6C4DF6 --description "Tracked in a Drips Wave program"
gh label create "good first issue"    --color 0E8A16 --description "Good entry point for new contributors"
```

Apply exactly one `complexity:*` label per issue, plus `drips-wave`.

---

## 4. Bounty queue (ready to paste)

Six backend issues, each scoped to the existing codebase with explicit acceptance
criteria. Paste each into a new GitHub Issue and apply the labels noted. All are
fully offline-testable (Prisma + Horizon are mocked), so contributors never need a
database or live network — which keeps them unblocked.

---

### Issue 1 — Publish an OpenAPI 3 spec and serve Swagger UI at `/docs`
**Labels:** `drips-wave`, `complexity: medium`, `good first issue`

**Context / why.** The REST surface is documented prose-only in the README. A
machine-readable OpenAPI spec lets contributors (and graders) explore the API,
generate clients, and validate request/response shapes. Fastify integrates cleanly
with `@fastify/swagger` + `@fastify/swagger-ui`.

**Where.** `src/app.ts` (plugin registration), each file in `src/routes/*` (attach
`schema` to routes), optionally a new `src/openapi.ts` for shared components.

**Scope.**
- Register `@fastify/swagger` and `@fastify/swagger-ui` (UI mounted at `/docs`).
- Describe at least the auth, groups, expenses, settlement, and history routes using
  the Zod schemas already defined (reuse, don't duplicate — `zod-to-json-schema` is fine).
- Document the standard error shape `{ error: { code, message } }`.

**Acceptance criteria.**
- [ ] `GET /docs` serves interactive Swagger UI in dev.
- [ ] `GET /docs/json` (or `/openapi.json`) returns a valid OpenAPI 3 document.
- [ ] Auth, groups, expenses, settlement, and history endpoints appear with params, bodies, and responses.
- [ ] `npm run build` and `npm test` pass; a test asserts the spec endpoint returns 200 and `openapi: "3..."`.
- [ ] README links to `/docs`.

**Out of scope.** No frontend changes; no auth changes.

---

### Issue 2 — Add request IDs and structured request logging (with secret redaction)
**Labels:** `drips-wave`, `complexity: trivial`, `good first issue`

**Context / why.** Production debugging needs correlatable logs. Fastify ships with
pino; we just need a request id, a one-line completion log, and redaction so we never
log `Authorization` headers or secrets.

**Where.** `src/app.ts` (Fastify logger + `genReqId` + hooks).

**Scope.**
- Generate a request id per request (`genReqId`, e.g. `nanoid`) and echo it in an `x-request-id` response header.
- Log method, path, statusCode, and duration on response.
- Configure pino `redact` for `req.headers.authorization` and any token fields.

**Acceptance criteria.**
- [ ] Every response includes an `x-request-id` header.
- [ ] Completed requests emit one structured log line containing method, path, status, ms, and the request id.
- [ ] `Authorization` headers never appear in logs (verify by inspection/redact config).
- [ ] A route test asserts the `x-request-id` header is present.
- [ ] `npm run build` and `npm test` pass.

**Out of scope.** No external log shipping; no frontend changes.

---

### Issue 3 — Idempotency keys for `POST /settlements/:id/confirm`
**Labels:** `drips-wave`, `complexity: medium`

**Context / why.** A client retry (flaky network, double-tap) could attempt to submit
the same signed settlement twice. The XDR-mismatch guard already prevents tampering,
but an `Idempotency-Key` makes confirm safely retryable and returns the original result.

**Where.** `prisma/schema.prisma` (new `IdempotencyKey` model + migration),
`src/routes/settlements.ts` (confirm handler).

**Scope.**
- Accept an optional `Idempotency-Key` header on the confirm endpoint.
- Persist `{ key, requestHash, responseJson, createdAt }`; on repeat with the same key,
  return the stored response instead of re-submitting.
- Same key + different request body → `409 idempotency_conflict`.

**Acceptance criteria.**
- [ ] First confirm with a key submits and stores the response.
- [ ] Repeat confirm with the same key + same body returns the **stored** response and does **not** call Horizon again (assert the mock is called once).
- [ ] Same key + different body returns `409` with `{ error: { code: "idempotency_conflict" } }`.
- [ ] New Prisma model + migration committed; `npm run build` and `npm test` pass with new tests.

**Out of scope.** Idempotency for other endpoints (follow-up); no frontend changes.

---

### Issue 4 — Cursor pagination and filtering for `GET /history` and `GET /groups/:id/ledger`
**Labels:** `drips-wave`, `complexity: high`

**Context / why.** These endpoints currently return unbounded lists; they will not
scale and are awkward to page in the UI. Add stable cursor pagination and basic filters.

**Where.** `src/routes/history.ts`, the ledger route under `src/routes/groups.ts`
(or wherever `/groups/:id/ledger` lives), and any shared query helper in `src/services/*`.

**Scope.**
- Support `limit` (default 25, max 100) and an opaque `cursor` (e.g. base64 of `createdAt,id`).
- Support filters: `assetCode`, `status`, and `from`/`to` date range (all Zod-validated).
- Return `{ items, nextCursor }`; `nextCursor` is null on the last page.
- Keep the default response backward compatible (still returns items).

**Acceptance criteria.**
- [ ] Paging through a seeded fixture returns every item exactly once with no overlap.
- [ ] `limit` is clamped to the max; invalid `cursor`/filters return `400`.
- [ ] Filters narrow results correctly (covered by tests).
- [ ] `nextCursor` is null only on the final page.
- [ ] `npm run build` and `npm test` pass with new pagination tests.

**Out of scope.** Frontend wiring; offset pagination.

---

### Issue 5 — Expand SEP-24 anchor service tests and add retry/backoff to anchor HTTP calls
**Labels:** `drips-wave`, `complexity: medium`

**Context / why.** `src/services/anchor.ts` carries the SEP-24 deposit/withdraw and
webhook logic but is thinly tested, and transient anchor/network errors aren't retried.
Hardening this is high-value and fully mockable.

**Where.** `src/services/anchor.ts`, new `tests/anchor.test.ts`.

**Scope.**
- Add exponential backoff with jitter (small, bounded retry count) around anchor HTTP calls; do **not** retry 4xx.
- Add tests for: anchor status → internal status mapping, webhook signature verification
  (valid and invalid `x-anchor-signature`), and the deposit/withdraw session happy path — all with mocked HTTP.

**Acceptance criteria.**
- [ ] `tests/anchor.test.ts` covers status mapping, webhook signature accept/reject, and a session happy path.
- [ ] Transient 5xx/network errors retry with backoff; 4xx do not retry (asserted via mock call counts).
- [ ] Anchor line coverage ≥ 90% (report via `vitest run --coverage`).
- [ ] Tests run offline; `npm run build` and `npm test` pass.

**Out of scope.** Real anchor onboarding; frontend changes.

---

### Issue 6 — Add a REST Client (`.http`) request collection for local API exploration
**Labels:** `drips-wave`, `complexity: trivial`, `good first issue`

**Context / why.** New contributors need a frictionless way to exercise the API.
A committed `.http` collection (VS Code REST Client / JetBrains HTTP client) walks the
full happy path: SEP-10 auth → create group → add expense → build settlement.

**Where.** New `docs/api.http`, a short section in `README.md`.

**Scope.**
- Provide requests for: `POST /auth/challenge`, `POST /auth/verify`, `POST /groups`,
  `POST /groups/:id/expenses`, `POST /expenses/:id/settle`, `GET /history`.
- Use `@variables` for `baseUrl` and `token` so the flow is runnable end-to-end.
- Document usage in the README (which extension, how to set the token).

**Acceptance criteria.**
- [ ] `docs/api.http` exists and the requests are valid against a locally running API.
- [ ] Variables for base URL and bearer token are at the top and reused.
- [ ] README documents how to use it.
- [ ] No code changes required to `src/` (docs-only); `npm run build` still passes.

**Out of scope.** Frontend changes; automated contract testing.

---

## 5. Tips to "definitely get selected"

- **File 5–6 issues, not 1.** Reviewers want a queue they can immediately build on. The list above gives a Trivial→High spread.
- **Every issue has acceptance criteria.** Each one above ends with a checklist — keep that pattern for any new issues.
- **Point to files.** Each issue names the files to touch, proving you understand your own codebase.
- **Keep tasks offline-testable.** All six need no DB or network, so contributors are never blocked.
- **One complexity label each** (`trivial`/`medium`/`high`) + `drips-wave`.
