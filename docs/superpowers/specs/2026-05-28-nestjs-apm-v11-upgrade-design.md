# Design Spec — `@strongnguyen/nestjs-apm` v3.0.0 Upgrade

- **Status:** Draft (awaiting user review)
- **Date:** 2026-05-28
- **Author:** cuongnv (with Claude Code assistance)
- **Scope:** Upgrade `@strongnguyen/nestjs-apm` from v2.0.0 (NestJS v9, TypeScript 4.7, elastic-apm-node 3.37) to v3.0.0 (NestJS v10/v11, TypeScript 5.x, elastic-apm-node 4.x, modernized toolchain).

---

## 1. Goals & Non-goals

### Goals
- Upgrade the package to be compatible with **NestJS v10 and v11**, drop v9.
- Bump runtime dependency `elastic-apm-node` from `3.x` to `4.x`.
- Modernize the development toolchain: TypeScript 5, ESLint, Jest, Prettier 3, Husky 9, rimraf 5.
- Add a minimum viable test suite (Jest + smoke tests for Module, Service, Interceptor).
- Add GitHub Actions CI (build + lint + test on push/PR) and tag-triggered npm publish.
- **Preserve the public API surface** — no changes to `ApmModule.registerAsync()`, `ApmService` method signatures, or `ApmInterceptor` behavior.

### Non-goals
- Do **not** introduce new public methods on `ApmService` to expose elastic-apm-node v4 features (e.g., `setLabel` ergonomics, OpenTelemetry bridge). API surface frozen.
- Do **not** refactor toward decorators (`@Trace()`, `@CaptureError()`) or OpenTelemetry integration. Out of scope.
- Do **not** convert to ESM. Stay CommonJS.
- Do **not** expand `ApmModuleOptions` to extend `Partial<AgentConfigOptions>`. Keep the interface rigid with the existing 6 fields.

---

## 2. Final scope summary (decided in brainstorming)

| Topic | Decision |
|---|---|
| Upgrade breadth | Full: NestJS v11 + TS 5 + Node 20 + elastic-apm-node v4 + tooling |
| Peer range | `^10.0.0 \|\| ^11.0.0` (drop v9); major bump 2.0.0 → 3.0.0 |
| `ApmService` API | Signatures unchanged; only return types may shift cosmetically due to v4 typings |
| Testing | Jest + smoke tests for Module, Service, Interceptor (~5-8 tests total) |
| Linter | Replace `tslint` with ESLint 9 + `@typescript-eslint` v8 |
| Module format | Keep CommonJS |
| CI | GitHub Actions: build/lint/test on push & PR; auto-publish on `v*` tag |
| `ApmModuleOptions` | Keep rigid (active, serviceName, secretToken, serverUrl, environment, disableInstrumentations?) |

---

## 3. Implementation strategy — 3 phased PRs

Each PR builds, lints, and (after PR1) tests green. Branches are feature branches off `master`; each subsequent branch is rebased onto `master` after the previous PR merges.

```
master ──┬── PR1: chore/pr1-tooling-baseline ─────────► master
         │
         └── (after PR1) PR2: chore/pr2-nestjs-v11 ───► master
                            │
                            └── (after PR2) PR3: chore/pr3-apm-v4-release ───► master ─tag v3.0.0─► npm publish
```

### Definition of done per PR

| PR | `npm run build` | `npm run lint` | `npm test` | Publish |
|---|---|---|---|---|
| PR1 | pass | pass | pass (smoke tests run on NestJS v9) | no |
| PR2 | pass | pass | pass (same smoke tests run on NestJS v11) | no |
| PR3 | pass | pass | pass (Service spec added; mocks elastic-apm-node v4) | yes, after tag `v3.0.0` |

---

## 4. PR1 — Tooling baseline

**Goal:** Modernize dev toolchain without touching runtime dependencies. After PR1, runtime code is byte-identical to v2.0.0 except for cosmetic strict-mode fixes; only build/lint/test pipeline changes.

### 4.1 Dependency changes

```jsonc
// devDependencies after PR1
{
  "@types/node": "^20.0.0",
  "typescript": "^5.4.0",
  "rimraf": "^5.0.5",
  "prettier": "^3.2.0",
  "husky": "^9.0.0",
  "rxjs": "^7.8.0",
  "ts-node": "^10.9.2",

  "eslint": "^9.0.0",
  "@typescript-eslint/parser": "^8.0.0",
  "@typescript-eslint/eslint-plugin": "^8.0.0",
  "eslint-config-prettier": "^9.1.0",
  "eslint-plugin-prettier": "^5.1.0",

  "jest": "^29.7.0",
  "ts-jest": "^29.1.0",
  "@types/jest": "^29.5.0",
  "@nestjs/testing": "^9.0.6"
}
```

Note: `@nestjs/testing` stays at v9 in PR1 (matches the runtime peer at this point) — bumped in PR2.

### 4.2 tsconfig.json changes

- `"target": "es2022"`
- `"strict": true` (enables `strictNullChecks`, `noImplicitAny`, etc.)
- Keep `"module": "commonjs"`, `"declaration": true`, `"emitDecoratorMetadata": true`, `"experimentalDecorators": true`, `"outDir": "./dist"`, `"rootDir": "./lib"`

### 4.3 New files

- `eslint.config.js` (flat config) extending `@typescript-eslint/recommended` + prettier integration.
- `jest.config.js` (CommonJS export, ts-jest preset, `rootDir: 'lib'`).
- `lib/__tests__/apm.module.spec.ts` — 3 tests for `ApmModule.registerAsync`.
- `lib/__tests__/apm.interceptor.spec.ts` — 3 tests for `ApmInterceptor`.
- `.prettierrc` (if not present) aligning printWidth, singleQuote with existing style.

### 4.4 Deleted

- `tslint.json`
- Inline `lint-staged` block in `package.json` (move to `.lintstagedrc.json` is optional — can defer to PR3 or skip entirely).

### 4.5 Updated `package.json` scripts

```json
"scripts": {
  "build": "rimraf dist && tsc -p tsconfig.json",
  "lint": "eslint lib --max-warnings 0",
  "lint:fix": "eslint lib --fix",
  "test": "jest",
  "test:cov": "jest --coverage",
  "format": "prettier --write \"lib/**/*.ts\"",
  "prepare": "husky",
  "publish:npm": "npm run build && npm publish"
}
```

### 4.6 Strict-mode fixes (all completed in PR1)

The following fixes must land in PR1 because `strict: true` and stronger linting expose them. PR2 only verifies they hold up under NestJS v11 types.

- `apm.service.ts:8` `private apmAgent: APM.Agent;` → add definite assignment `private apmAgent!: APM.Agent;` (initialized in `onModuleInit`).
- `apm.interceptor.ts:19` `Observable<Response>` is semantically wrong (`Response` is the DOM `fetch` global); change to `Observable<unknown>` and `CallHandler<unknown>`. This is a "fix in passing" — pre-existing bug, surfaced because the new ESLint config treats global type usage as a warning.
- `apm.interface.ts:17` `inject?: any[]` is acceptable (matches NestJS conventions); no change.

### 4.7 PR1 risks

1. Prettier 3 reformatting produces a large diff. Mitigation: commit reformat in its own commit (`chore: prettier 3 reformat`) separate from logic changes.
2. ESLint 9 flat config + plugins mismatch. Mitigation: pin `@typescript-eslint` ^8 (supports flat config natively).
3. `strict: true` exposes hidden type errors. Mitigation: 7 small files — quick audit; if more than 5 fixes needed, consider enabling strict flags one by one.

---

## 5. PR2 — NestJS v11

**Goal:** Bump `@nestjs/common`, `@nestjs/core`, `@nestjs/testing`, `reflect-metadata` to versions compatible with NestJS v10 and v11. Add `peerDependencies` (currently missing).

### 5.1 Dependency changes

```jsonc
{
  "devDependencies": {
    "@nestjs/common": "^11.0.0",
    "@nestjs/core": "^11.0.0",
    "@nestjs/testing": "^11.0.0",
    "reflect-metadata": "^0.2.2"
  },
  "peerDependencies": {
    "@nestjs/common": "^10.0.0 || ^11.0.0",
    "@nestjs/core": "^10.0.0 || ^11.0.0",
    "reflect-metadata": "^0.1.13 || ^0.2.0",
    "rxjs": "^7.5.0"
  }
}
```

### 5.2 Code audit against NestJS v11 breaking changes

| File | Affected by v11 breaking changes? | Action in PR2 |
|---|---|---|
| `apm.module.ts` | No (`DynamicModule`, `APP_INTERCEPTOR` unchanged) | None |
| `apm.service.ts` | No (`@Inject`, `@Injectable`, `Logger`, `onModuleInit` unchanged) | Verify §4.6 fixes still pass under v11 types |
| `apm.interceptor.ts` | No (`NestInterceptor`, `ExecutionContext`, `CallHandler`, `HttpException` unchanged) | Verify §4.6 fix still passes |
| `apm.interface.ts` | No (`ModuleMetadata`, `Type` unchanged) | None |
| `apm.const.ts` | Not Nest-dependent | None |
| `start.ts` | Not Nest-dependent | None |
| `index.ts` | Re-export only | None |

### 5.3 PR2 manual verification

- `npm pack` produces tarball.
- Spin up two dummy projects: one NestJS v10 (peer-range floor) and one NestJS v11 (peer-range ceiling).
- In each, install the tarball, wire `ApmModule.registerAsync({ useFactory: () => ({ active: false, serviceName: 'smoke', secretToken: '', serverUrl: '', environment: 'local' }) })` into `AppModule`, `npm run start:dev`, confirm boot succeeds and no DI errors.

### 5.4 PR2 risks

1. `reflect-metadata` 0.1.x ↔ 0.2.x mismatch with consumer dependency tree. Mitigation: peer range allows both; smoke test both.
2. NestJS v10 dummy app verification mandatory — without it, the `^10` peer claim is untested.
3. `Logger` formatting changed slightly in v11 — cosmetic, ignored.

---

## 6. PR3 — elastic-apm-node v4 + Release

**Goal:** Bump runtime dependency to v4, finalize release artifacts (version, CHANGELOG, README, CI workflows), tag and publish.

### 6.1 Dependency changes

```jsonc
{
  "version": "3.0.0",
  "dependencies": {
    "elastic-apm-node": "^4.7.0"
  }
}
```

### 6.2 elastic-apm-node v4 breaking changes — impact audit

| v4 change | Used in this package? | Action |
|---|---|---|
| Drop Node <14.17 | – | None (already on Node 20+) |
| `startTransaction(name, options)` — `options.childOf` removed, use `links` | Proxy only, no hard-coded options | None; document in CHANGELOG migration |
| `startSpan(name, options)` — same as above | Proxy only | None; document |
| `setLabel(key, value, stringify)` — third parameter removed | Not exposed by wrapper | None |
| Types ship from package directly (no `@types/elastic-apm-node`) | Already using `import * as APM from 'elastic-apm-node'` | None |
| `Agent.isStarted()`, `setCustomContext`, `setTransactionName`, `captureError` | All used | No signature change — confirm during PR3 implementation |
| `APM.start(options)` returns `Agent` | Used | No change |
| Extended `AgentConfigOptions` (new optional fields like `opentelemetryBridge`) | Not exposed | None (interface rigid by decision) |

If any `APM.Transaction` / `APM.Span` / `APM.TransactionOptions` / `APM.SpanOptions` type is renamed in v4, update imports in `apm.service.ts`. Confirm during implementation.

### 6.3 Code changes

- `apm.service.ts` — adjust type imports if v4 renamed any type symbols (likely zero or minimal).
- `apm.interface.ts` — **no change** (per decision, interface stays rigid).
- `start.ts` — already uses `AgentConfigOptions` from the package; verify the import path is unchanged in v4.

### 6.4 New release artifacts

#### CHANGELOG.md (new file)

```markdown
# Changelog

## 3.0.0 — YYYY-MM-DD

### Breaking
- Minimum NestJS version raised to v10. Drop NestJS v9 support.
- Minimum Node version raised to v20.
- `elastic-apm-node` upgraded 3.x → 4.x. Consumers passing `childOf` in transaction/span options must migrate to `links` (see elastic-apm-node v4 migration guide).

### Changed
- TypeScript 4.7 → 5.x.
- RxJS minimum 7.5 → 7.8.
- Replaced `tslint` with ESLint + @typescript-eslint.
- Added Jest test suite.
- Added GitHub Actions CI (Node 20/22) and tag-triggered npm publish.
- Fixed cosmetic typing in `ApmInterceptor`: `Observable<Response>` → `Observable<unknown>`.

### Migration
- Consumers on NestJS v10 or v11: update `@strongnguyen/nestjs-apm` to `^3.0.0`. No code changes required at `ApmModule.registerAsync()` call sites.
- If you previously passed `childOf` to `startTransaction`/`startSpan` options through this package, migrate to elastic-apm-node v4's `links` API.
```

#### README.md updates

- Update install snippet to reflect NestJS v10/v11 compatibility.
- Add a "Compatibility" table:
  | nestjs-apm version | NestJS | Node | elastic-apm-node |
  |---|---|---|---|
  | 3.x | 10, 11 | ≥ 20 | 4.x |
  | 2.x | 9 | ≥ 14 | 3.x |
- Add "Migration from v2" section pointing at CHANGELOG.

#### `.github/workflows/ci.yml`

- Trigger: `on: { push: { branches: [master] }, pull_request: {} }`
- Job `test`:
  - `strategy.matrix.node-version: [20.x, 22.x]`
  - Steps: `actions/checkout@v4` → `actions/setup-node@v4` with npm cache → `npm ci` → `npm run lint` → `npm test` → `npm run build`.

#### `.github/workflows/publish.yml`

- Trigger: `on: { push: { tags: ['v*'] } }`
- Steps:
  1. `actions/checkout@v4`
  2. `actions/setup-node@v4` with `node-version: 20.x` and `registry-url: 'https://registry.npmjs.org/'`
  3. `npm ci`
  4. **Version-tag consistency check** (fail-fast guard): read tag (`${{ github.ref_name }}`), strip `v`, compare against `package.json` version. Fail if mismatch.
  5. `npm run lint`
  6. `npm test`
  7. `npm run build`
  8. `npm publish --access public` with `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}`

### 6.5 Tests updated in PR3

- `lib/__tests__/apm.service.spec.ts` — **new**, 2 tests:
  - `onModuleInit calls APM.start with options` (mocks `elastic-apm-node`).
  - `proxy methods forward to agent` (single test covering `captureError`, `startTransaction`, `startSpan`, `setCustomContext`, `setTransactionName`).
- Existing specs unchanged unless v4 typing breaks them.

### 6.6 Release execution checklist (manual, after PR3 merges)

- [ ] CI green on master.
- [ ] `package.json.version` = "3.0.0".
- [ ] CHANGELOG.md has "## 3.0.0" entry with concrete release date.
- [ ] README.md compatibility table updated.
- [ ] Repo secret `NPM_TOKEN` exists and is valid.
- [ ] Local `npm whoami` confirms publish rights for `@strongnguyen` scope.
- [ ] Dummy app NestJS v10 smoke test passed with packed tarball.
- [ ] Dummy app NestJS v11 smoke test passed with packed tarball.
- [ ] Create annotated tag: `git tag -a v3.0.0 -m "Release v3.0.0"`.
- [ ] `git push origin v3.0.0` → workflow runs → `npm view @strongnguyen/nestjs-apm@3.0.0` resolves.
- [ ] (Optional) Create GitHub Release from tag, paste CHANGELOG section.

### 6.7 PR3 risks

1. v4 type rename breaks `APM.Transaction`/`APM.Span` imports → build fail in PR3. Mitigation: build is the first feedback, fix imports as encountered.
2. `NPM_TOKEN` missing or expired → publish workflow fails. Mitigation: pre-PR3-merge verification step in checklist.
3. Tag pushed before `package.json.version` updated → version-tag check fails, publish blocked. Mitigation: workflow guard already enforces this.

---

## 7. Testing strategy

### 7.1 Test focus (3 critical behaviors)

1. **Module DI graph correctness** — `ApmModule.registerAsync()` provides `APM_MODULE_OPTIONS_TOKEN`, `ApmService`, and a global `APP_INTERCEPTOR` mapped to `ApmInterceptor`.
2. **Lifecycle correctness** — `ApmService.onModuleInit()` calls `APM.start(options)` exactly once with the resolved options object.
3. **Interceptor error classification** — `HttpException` → `captureError(error.message)`; any other error → `captureError(error)`; in all cases the error is **re-thrown** (not swallowed).

### 7.2 Spec files

- `lib/__tests__/apm.module.spec.ts` (3 tests) — added in PR1.
- `lib/__tests__/apm.interceptor.spec.ts` (3 tests) — added in PR1.
- `lib/__tests__/apm.service.spec.ts` (2 tests) — added in PR3.

### 7.3 Not tested (intentionally)

- `apm.const.ts` — literal string token; no logic.
- `apm.interface.ts` — type-only.
- `start.ts` — env-driven bootstrap with hard side effect on import. Manual smoke in dummy app covers it; ROI of automated test too low.
- `index.ts` — pure re-export.

### 7.4 Coverage targets

- No hard threshold set in `jest.config.js` for now.
- `collectCoverageFrom` excludes `index.ts` and `start.ts` to keep the report meaningful.
- Expected effective coverage: ~60-70% (sufficient for a thin proxy wrapper).

### 7.5 Manual smoke testing protocol

Run **twice**: once after PR2 merges (verifies NestJS v10 and v11), once before tagging v3.0.0 in PR3 (verifies elastic-apm-node v4).

For each NestJS major version (10, 11):
1. `nest new tmp-app` selecting that version.
2. `npm install <path-to-tarball>` from `npm pack` of this repo.
3. Wire `ApmModule.registerAsync({ useFactory: () => ({ active: false, serviceName: 'smoke', secretToken: '', serverUrl: '', environment: 'local' }) })` into `AppModule`.
4. `npm run start:dev` — confirm boot, no DI errors, no module init crash.
5. Add a route that throws `new HttpException('test', 400)` → curl → confirm interceptor does not crash the request and `captureError` is logged (or, with `active: false`, simply observe no crash).

---

## 8. Risk register

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | `strict: true` exposes hidden type errors in PR1 | High | Low (clear build failure) | Use `!:` definite assignment or nullable types; enable flags one-by-one if needed |
| R2 | `reflect-metadata` 0.1.x ↔ 0.2.x consumer conflicts | Medium | Medium (decorator runtime break) | Peer range `^0.1.13 \|\| ^0.2.0`; smoke test both NestJS v10 and v11 |
| R3 | NestJS v10 consumer hits a v11-only feature path | Low | Medium | Package only proxies stable `@nestjs/common` APIs present in both; smoke test verifies |
| R4 | elastic-apm-node v4 type rename breaks imports | Medium | Low (build fail in PR3) | Audit types during PR3 implementation; document in CHANGELOG if any consumer-visible type rename |
| R5 | Consumer relies on removed `childOf` option | Low | Medium (silently ignored at runtime in v4) | Document in CHANGELOG migration; do not back-fill in wrapper |
| R6 | Prettier 3 reformat creates massive PR1 diff | Medium | Low | Separate reformat into its own commit |
| R7 | `NPM_TOKEN` missing → publish workflow fails | High if forgotten | High (release blocked) | Pre-tag checklist; CI publish includes early `npm whoami` step |
| R8 | Tag pushed with mismatched `package.json.version` | Medium | High (wrong version on npm) | Workflow `publish.yml` includes hard version-vs-tag check |
| R9 | ESLint 9 flat config plugin conflicts | Medium | Low (lint only) | Pin `@typescript-eslint` ^8 which supports flat config |
| R10 | Husky 9 hooks not installed for new contributors | Low | Low | `prepare: "husky"` script auto-runs on `npm install` |
| R11 | Consumer extends `ApmModuleOptions` interface | Low | Low | Interface stays rigid (per decision) — 100% additive-compat for extenders |

---

## 9. Rollback playbook

| Trigger | Action | Consequence |
|---|---|---|
| PR1 merged, lint/test failure surfaces | `git revert <pr1-merge-sha>` | Returns to v2.0.0 toolchain; spec files can be carried in a branch for retry |
| PR2 merged, dummy NestJS v10 app crashes | `git revert <pr2-merge-sha>` | Returns to PR1 state (TS5 tooling + NestJS v9). Nothing published yet |
| PR3 merged but **not yet tagged** | `git revert <pr3-merge-sha>` | Returns to PR2 state. Safe |
| PR3 tagged + published, regression discovered | `npm deprecate @strongnguyen/nestjs-apm@3.0.0 "Critical bug, use 2.0.0 or wait 3.0.1"` → fix forward → publish `3.0.1` | Consumers see deprecation warning; forward-fix only (npm version numbers cannot be reused) |
| Publish workflow fails after `npm publish` started uploading | If 3.0.0 partially claimed, bump to `3.0.1`, re-tag, re-push | npm version slots are immutable |

### Reversibility summary

- PR1 / PR2 / PR3-before-tag: **fully reversible** via `git revert`.
- PR3-after-tag (publish succeeded): **forward-fix only**.

---

## 10. Public API contract (frozen)

The following are guaranteed unchanged across the v2 → v3 transition:

- `ApmModule.registerAsync(options: ApmModuleAsyncOptions): DynamicModule` — signature, behavior, side effects.
- `APP_INTERCEPTOR` registration of `ApmInterceptor` happens automatically when the module is imported.
- `APM_MODULE_OPTIONS_TOKEN = 'ApmModuleOptionsToken'` — exact string value preserved (DI contract).
- `ApmService` public methods: `captureError`, `startTransaction`, `setTransactionName`, `startSpan`, `setCustomContext` — names and parameter signatures unchanged. Return types **may** become more strictly typed due to elastic-apm-node v4 typings; this is cosmetic and non-breaking for typical consumer usage.
- `ApmInterceptor` error handling: `HttpException` captures message only; other errors capture the full error object; errors are re-thrown.
- `ApmModuleOptions` fields: `active`, `serviceName`, `secretToken`, `serverUrl`, `environment`, `disableInstrumentations?`. Interface remains rigid; no new fields added by this upgrade.
- `lib/start.ts` remains a deep-import (`@strongnguyen/nestjs-apm/dist/start`) — not re-exported from `lib/index.ts`, per existing CLAUDE.md guidance.

---

## 11. Open questions / deferred decisions

None blocking. The following were intentionally deferred:

- Adding `lib/start.ts` to `index.ts` re-exports — not in scope.
- Exposing additional v4 features (`setLabel`, OpenTelemetry bridge, etc.) on `ApmService` — out of scope.
- Coverage hard threshold in CI — deferred until coverage baseline is observed in practice.
- Codecov / coverage upload — deferred.
- Migrating to flat `lint-staged` config — deferred or skipped.

---

## 12. Acceptance criteria (final)

The upgrade is complete when **all** of the following hold:

1. `master` branch contains the three merged PRs.
2. `npm view @strongnguyen/nestjs-apm@3.0.0` resolves and shows the published package.
3. Installing `@strongnguyen/nestjs-apm@3.0.0` in a NestJS v10 project succeeds and the module boots cleanly.
4. Installing `@strongnguyen/nestjs-apm@3.0.0` in a NestJS v11 project succeeds and the module boots cleanly.
5. The published package contains `dist/`, `package.json` with `peerDependencies` declared, and a `CHANGELOG.md`.
6. CI is green on `master` and has been green for the last 3 commits before the tag.
7. README compatibility matrix and migration section are present and accurate.
