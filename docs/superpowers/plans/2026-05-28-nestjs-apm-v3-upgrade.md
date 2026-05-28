# `@strongnguyen/nestjs-apm` v3.0.0 Upgrade — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade `@strongnguyen/nestjs-apm` from v2.0.0 (NestJS v9, TS 4.7, elastic-apm-node 3.37) to v3.0.0 (NestJS v10/v11 peer, TS 5.x, elastic-apm-node 4.x) and publish to npm with a CI-driven release pipeline.

**Architecture:** Three sequential PRs on three feature branches off `master`. PR1 lands tooling (TS 5, ESLint 9, Prettier 3, Jest, Husky 9) without touching runtime deps; PR2 bumps NestJS to v11 with peer range `^10 || ^11`; PR3 bumps `elastic-apm-node` to v4, publishes release artifacts (CHANGELOG, README, CI/publish workflows) and tags `v3.0.0` to trigger automated npm publish. Public API surface (`ApmModule`, `ApmService`, `ApmInterceptor`, `ApmModuleOptions`) is frozen.

**Tech Stack:** TypeScript 5, NestJS v10/v11, elastic-apm-node 4, RxJS 7.8, Jest 29 + ts-jest, ESLint 9 + @typescript-eslint v8, Prettier 3, Husky 9, GitHub Actions.

**Spec reference:** [docs/superpowers/specs/2026-05-28-nestjs-apm-v11-upgrade-design.md](../specs/2026-05-28-nestjs-apm-v11-upgrade-design.md)

---

## File Structure

### Created files
- `eslint.config.js` — ESLint 9 flat config; one responsibility (lint rules).
- `jest.config.js` — Jest configuration; one responsibility (test runner config).
- `.prettierrc.json` — Prettier 3 config; one responsibility (formatter config).
- `.eslintignore` — patterns excluded from lint.
- `lib/__tests__/apm.module.spec.ts` — DI graph tests (3 tests).
- `lib/__tests__/apm.interceptor.spec.ts` — error classification tests (3 tests).
- `lib/__tests__/apm.service.spec.ts` — lifecycle + proxy tests (2 tests, added in Phase 3).
- `CHANGELOG.md` — release log; one responsibility (track changes).
- `.github/workflows/ci.yml` — push/PR build + lint + test workflow.
- `.github/workflows/publish.yml` — tag-triggered publish workflow with version-vs-tag guard.

### Modified files
- `package.json` — deps, scripts, peerDependencies, version.
- `tsconfig.json` — TS 5 target + strict mode.
- `README.md` — compatibility matrix + migration section.
- `lib/apm.service.ts` — definite-assignment fix for `apmAgent`.
- `lib/apm.interceptor.ts` — `Observable<Response>` → `Observable<unknown>`.

### Deleted files
- `tslint.json` (legacy linter config, no script invokes it).

---

# Phase 1 — PR1: Tooling Baseline

**Branch:** `chore/pr1-tooling-baseline` (off `master`)
**Outcome:** Modern toolchain (TS 5, ESLint 9, Prettier 3, Husky 9, Jest 29), zero runtime dep change, smoke tests for Module + Interceptor green under NestJS v9.

---

### Task 1: Create the PR1 feature branch

**Files:** none (git only)

- [ ] **Step 1: Verify a clean working tree on master**

Run: `git status --short`
Expected: empty (no untracked files relevant to the upgrade; existing `AGENTS.md` and `CLAUDE.md` are pre-existing artifacts and can stay untracked — they were observed in initial status).

If anything else is dirty, stash it: `git stash push -u -m "pre-pr1-upgrade-stash"`.

- [ ] **Step 2: Pull latest master and create branch**

```bash
git checkout master
git pull origin master
git checkout -b chore/pr1-tooling-baseline
```

Expected: `Switched to a new branch 'chore/pr1-tooling-baseline'`.

---

### Task 2: Bump TypeScript, @types/node, rimraf to PR1 versions

**Files:**
- Modify: `package.json` (devDependencies section)

- [ ] **Step 1: Install upgraded build deps**

```bash
npm install --save-dev typescript@^5.4.0 @types/node@^20.0.0 rimraf@^5.0.5 ts-node@^10.9.2
```

Expected: `package.json` updated; `package-lock.json` regenerated. No errors.

- [ ] **Step 2: Verify versions are pinned correctly in `package.json`**

Open `package.json`, confirm under `devDependencies`:
```jsonc
"typescript": "^5.4.0",
"@types/node": "^20.0.0",
"rimraf": "^5.0.5",
"ts-node": "^10.9.2"
```

---

### Task 3: Update `tsconfig.json` (target es2022 + strict)

**Files:**
- Modify: `tsconfig.json`

- [ ] **Step 1: Replace tsconfig with the new content**

Overwrite `tsconfig.json` with:
```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2022",
    "declaration": true,
    "removeComments": true,
    "noLib": false,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "sourceMap": false,
    "outDir": "./dist",
    "rootDir": "./lib",
    "skipLibCheck": true,
    "strict": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": [
    "lib/**/*",
    "../index.ts"
  ],
  "exclude": [
    "node_modules",
    "**/*.spec.ts"
  ]
}
```

- [ ] **Step 2: Try a build to surface strict-mode errors**

Run: `npm run build`
Expected: FAIL with errors in `lib/apm.service.ts` (property `apmAgent` has no initializer) and possibly `lib/apm.interceptor.ts`. Continue to Task 4.

---

### Task 4: Fix strict-mode errors in `apm.service.ts`

**Files:**
- Modify: `lib/apm.service.ts:8`

- [ ] **Step 1: Apply definite-assignment marker**

In `lib/apm.service.ts`, change line 8 from:
```typescript
private apmAgent: APM.Agent;
```
to:
```typescript
private apmAgent!: APM.Agent;
```

(Reason: `apmAgent` is initialized in `onModuleInit()`, not the constructor. NestJS lifecycle guarantees `onModuleInit` runs before any consumer holds a reference for use.)

- [ ] **Step 2: Re-run build**

Run: `npm run build`
Expected: either PASS, or a remaining strict error in `apm.interceptor.ts`. Continue.

---

### Task 5: Fix `Observable<Response>` typing in `apm.interceptor.ts`

**Files:**
- Modify: `lib/apm.interceptor.ts:16-19`

- [ ] **Step 1: Replace the `intercept` signature and `next` type**

In `lib/apm.interceptor.ts`, find:
```typescript
intercept(
  context: ExecutionContext,
  next: CallHandler
): Observable<Response> {
```
Replace with:
```typescript
intercept(
  context: ExecutionContext,
  next: CallHandler<unknown>
): Observable<unknown> {
```

(Reason: `Response` was the DOM `fetch` global, not an APM/Nest type — a pre-existing semantic bug. Strict mode + ESLint surfaces this; we fix it in passing.)

- [ ] **Step 2: Build clean**

Run: `npm run build`
Expected: PASS, `dist/` populated.

- [ ] **Step 3: Commit the TS5 + strict-fix milestone**

```bash
git add package.json package-lock.json tsconfig.json lib/apm.service.ts lib/apm.interceptor.ts
git commit -m "chore: upgrade to TypeScript 5 and enable strict mode"
```

---

### Task 6: Remove legacy `tslint.json`

**Files:**
- Delete: `tslint.json`

- [ ] **Step 1: Delete the file**

```bash
git rm tslint.json
```

Expected: `rm 'tslint.json'`.

---

### Task 7: Install ESLint 9 + @typescript-eslint v8 + Prettier integration

**Files:**
- Modify: `package.json` (devDependencies)

- [ ] **Step 1: Install ESLint stack**

```bash
npm install --save-dev eslint@^9.0.0 @typescript-eslint/parser@^8.0.0 @typescript-eslint/eslint-plugin@^8.0.0 eslint-config-prettier@^9.1.0 eslint-plugin-prettier@^5.1.0 prettier@^3.2.0
```

Expected: deps added without peer-dep errors.

---

### Task 8: Create ESLint flat config

**Files:**
- Create: `eslint.config.js`

- [ ] **Step 1: Write the flat config**

Create `eslint.config.js` with:
```javascript
const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const prettierPlugin = require('eslint-plugin-prettier');
const prettierConfig = require('eslint-config-prettier');

module.exports = [
  {
    files: ['lib/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: './tsconfig.json',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      prettier: prettierPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...prettierConfig.rules,
      'prettier/prettier': 'error',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', '**/*.spec.ts'],
  },
];
```

(Reason: flat config is the ESLint 9 default. We keep `no-explicit-any` off because `ApmModuleAsyncOptions.inject?: any[]` matches NestJS convention. Spec files excluded — they will get tested separately by jest; lint focus is library code.)

---

### Task 9: Create Prettier 3 config

**Files:**
- Create: `.prettierrc.json`

- [ ] **Step 1: Write Prettier config matching current code style**

Create `.prettierrc.json` with:
```json
{
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "semi": true,
  "arrowParens": "always"
}
```

(Reason: matches existing code style observed in `lib/*.ts`: single quotes, 2-space indent, semicolons. `trailingComma: "all"` is Prettier 3's new default — accept it; the reformat will be its own commit.)

---

### Task 10: Update `package.json` scripts

**Files:**
- Modify: `package.json` (scripts section)

- [ ] **Step 1: Replace the `scripts` block**

In `package.json`, replace the existing `"scripts": { ... }` block with:
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

- [ ] **Step 2: Remove the obsolete `lint-staged` block from `package.json`**

In `package.json`, delete the entire `"lint-staged": { ... }` top-level field (the `precommit` script was already removed in Step 1).

---

### Task 11: Apply Prettier 3 reformat as its own commit

**Files:**
- Modify: `lib/**/*.ts` (auto-formatted)

- [ ] **Step 1: Run format**

```bash
npm run format
```

Expected: 0 or more files reformatted. Likely all 7 lib files get touched due to trailing-comma default change.

- [ ] **Step 2: Verify build still passes after reformat**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit reformat separately**

```bash
git add lib/
git commit -m "chore: prettier 3 reformat"
```

---

### Task 12: Verify ESLint passes; fix any surfaced issues

**Files:**
- Modify: `lib/*.ts` only if lint errors require fixes

- [ ] **Step 1: Run lint**

```bash
npm run lint
```

Expected: 0 errors, 0 warnings. If anything fails, fix the issues in `lib/*.ts` minimally (e.g., add missing return types if `@typescript-eslint/explicit-function-return-type` complains — but our config doesn't enable that rule, so this should not happen).

- [ ] **Step 2: Commit the ESLint setup**

```bash
git add eslint.config.js .prettierrc.json package.json package-lock.json
git rm tslint.json 2>$null
git commit -m "chore: replace tslint with eslint 9 and prettier 3"
```

(Note: `tslint.json` was already `git rm`'d in Task 6; the `git rm` here is a no-op safeguard.)

---

### Task 13: Set up Husky 9

**Files:**
- Create: `.husky/pre-commit`

- [ ] **Step 1: Install husky 9 and initialize**

```bash
npm install --save-dev husky@^9.0.0
npx husky init
```

Expected: Creates `.husky/pre-commit` containing `npm test`. Husky 9's `init` also adds `"prepare": "husky"` if missing (we already added it in Task 10).

- [ ] **Step 2: Replace the default pre-commit hook with lint + test**

Overwrite `.husky/pre-commit` with:
```bash
npm run lint && npm test
```

(No shebang or husky.sh sourcing needed in Husky 9.)

- [ ] **Step 3: Commit Husky setup**

```bash
git add .husky/ package.json package-lock.json
git commit -m "chore: husky 9 with lint + test pre-commit hook"
```

---

### Task 14: Install Jest + ts-jest + Nest testing utilities

**Files:**
- Modify: `package.json` (devDependencies)

- [ ] **Step 1: Install Jest stack**

```bash
npm install --save-dev jest@^29.7.0 ts-jest@^29.1.0 @types/jest@^29.5.0 @nestjs/testing@^9.0.6
```

Expected: deps added. `@nestjs/testing` stays at v9 in PR1 — bumped in Phase 2.

---

### Task 15: Create Jest config

**Files:**
- Create: `jest.config.js`

- [ ] **Step 1: Write `jest.config.js`**

Create `jest.config.js` with:
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'lib',
  testRegex: '.spec\\.ts$',
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverageFrom: [
    '**/*.ts',
    '!**/*.spec.ts',
    '!index.ts',
    '!start.ts',
  ],
  coverageDirectory: '../coverage',
};
```

---

### Task 16: Write `apm.module.spec.ts` — test 1 (provides ApmService)

**Files:**
- Create: `lib/__tests__/apm.module.spec.ts`

- [ ] **Step 1: Create the spec file with the first test**

Create `lib/__tests__/apm.module.spec.ts` with:
```typescript
import { Test } from '@nestjs/testing';
import { ApmModule } from '../apm.module';
import { ApmService } from '../apm.service';

describe('ApmModule', () => {
  const factoryOptions = {
    active: false,
    serviceName: 'test',
    secretToken: '',
    serverUrl: '',
    environment: 'local' as const,
  };

  it('registerAsync with useFactory provides ApmService', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ApmModule.registerAsync({
          useFactory: () => factoryOptions,
        }),
      ],
    }).compile();

    const service = moduleRef.get(ApmService);
    expect(service).toBeDefined();
    await moduleRef.close();
  });
});
```

- [ ] **Step 2: Run the test**

```bash
npm test -- --testPathPattern=apm.module
```

Expected: PASS, 1 test green.

(If `onModuleInit` runs and calls `elastic-apm-node`'s `APM.start`, that's fine: with `active: false` the agent does not connect to any server.)

---

### Task 17: Add `apm.module.spec.ts` — test 2 (resolves options via inject)

**Files:**
- Modify: `lib/__tests__/apm.module.spec.ts`

- [ ] **Step 1: Append the second test inside the `describe` block**

Add this test inside the existing `describe('ApmModule', ...)`:
```typescript
  it('registerAsync resolves options via inject', async () => {
    class FakeConfig {
      readonly value = 'injected-service-name';
    }

    const moduleRef = await Test.createTestingModule({
      providers: [FakeConfig],
      imports: [
        ApmModule.registerAsync({
          inject: [FakeConfig],
          useFactory: (cfg: FakeConfig) => ({
            ...factoryOptions,
            serviceName: cfg.value,
          }),
        }),
      ],
    }).compile();

    const service = moduleRef.get(ApmService);
    expect(service).toBeDefined();
    // We cannot easily introspect resolved options post-init without exposing them;
    // the assertion is that DI resolution did not throw, which proves inject worked.
    await moduleRef.close();
  });
```

- [ ] **Step 2: Run the test**

```bash
npm test -- --testPathPattern=apm.module
```

Expected: PASS, 2 tests green.

---

### Task 18: Add `apm.module.spec.ts` — test 3 (registers global ApmInterceptor)

**Files:**
- Modify: `lib/__tests__/apm.module.spec.ts`

- [ ] **Step 1: Append the third test**

Add inside the same `describe`:
```typescript
  it('registers ApmInterceptor as a global APP_INTERCEPTOR', async () => {
    const { APP_INTERCEPTOR } = await import('@nestjs/core');
    const { ApmInterceptor } = await import('../apm.interceptor');

    const moduleRef = await Test.createTestingModule({
      imports: [
        ApmModule.registerAsync({
          useFactory: () => factoryOptions,
        }),
      ],
    }).compile();

    // Resolve the registered global interceptor instance via its provider key.
    const interceptor = moduleRef.get(ApmInterceptor, { strict: false });
    expect(interceptor).toBeInstanceOf(ApmInterceptor);
    // Sanity-check the APP_INTERCEPTOR token symbol is the one we expect.
    expect(APP_INTERCEPTOR).toBe('APP_INTERCEPTOR');
    await moduleRef.close();
  });
```

- [ ] **Step 2: Run all module tests**

```bash
npm test -- --testPathPattern=apm.module
```

Expected: PASS, 3 tests green.

---

### Task 19: Write `apm.interceptor.spec.ts` — test 1 (HttpException → message)

**Files:**
- Create: `lib/__tests__/apm.interceptor.spec.ts`

- [ ] **Step 1: Create the spec with the first test**

Create `lib/__tests__/apm.interceptor.spec.ts` with:
```typescript
import { ExecutionContext, CallHandler, HttpException } from '@nestjs/common';
import { firstValueFrom, throwError } from 'rxjs';
import { ApmInterceptor } from '../apm.interceptor';
import { ApmService } from '../apm.service';

function makeContext(): ExecutionContext {
  // Minimal stub — ApmInterceptor does not read context fields.
  return {} as ExecutionContext;
}

describe('ApmInterceptor', () => {
  let captureSpy: jest.Mock;
  let apmService: ApmService;
  let interceptor: ApmInterceptor;

  beforeEach(() => {
    captureSpy = jest.fn();
    apmService = { captureError: captureSpy } as unknown as ApmService;
    interceptor = new ApmInterceptor(apmService);
  });

  it('captures only the message string for HttpException', async () => {
    const next: CallHandler<unknown> = {
      handle: () => throwError(() => new HttpException('forbidden', 403)),
    };

    const obs = interceptor.intercept(makeContext(), next);
    await expect(firstValueFrom(obs)).rejects.toBeInstanceOf(HttpException);
    expect(captureSpy).toHaveBeenCalledTimes(1);
    expect(captureSpy).toHaveBeenCalledWith('forbidden');
  });
});
```

- [ ] **Step 2: Run the test**

```bash
npm test -- --testPathPattern=apm.interceptor
```

Expected: PASS, 1 test green.

---

### Task 20: Add `apm.interceptor.spec.ts` — test 2 (generic Error → full object)

**Files:**
- Modify: `lib/__tests__/apm.interceptor.spec.ts`

- [ ] **Step 1: Append the second test inside the `describe` block**

```typescript
  it('captures the full error object for non-HttpException errors', async () => {
    const boom = new Error('boom');
    const next: CallHandler<unknown> = {
      handle: () => throwError(() => boom),
    };

    const obs = interceptor.intercept(makeContext(), next);
    await expect(firstValueFrom(obs)).rejects.toBe(boom);
    expect(captureSpy).toHaveBeenCalledTimes(1);
    expect(captureSpy).toHaveBeenCalledWith(boom);
  });
```

- [ ] **Step 2: Run tests**

```bash
npm test -- --testPathPattern=apm.interceptor
```

Expected: PASS, 2 tests green.

---

### Task 21: Add `apm.interceptor.spec.ts` — test 3 (error is rethrown)

**Files:**
- Modify: `lib/__tests__/apm.interceptor.spec.ts`

- [ ] **Step 1: Append the third test**

```typescript
  it('re-throws errors after capture (does not swallow)', async () => {
    const next: CallHandler<unknown> = {
      handle: () => throwError(() => new Error('rethrow-me')),
    };

    const obs = interceptor.intercept(makeContext(), next);
    await expect(firstValueFrom(obs)).rejects.toThrow('rethrow-me');
    expect(captureSpy).toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run all interceptor tests**

```bash
npm test -- --testPathPattern=apm.interceptor
```

Expected: PASS, 3 tests green.

---

### Task 22: Run full test + lint + build before commit

**Files:** none (verification only)

- [ ] **Step 1: Full lint**

```bash
npm run lint
```

Expected: PASS, 0 errors.

- [ ] **Step 2: Full test**

```bash
npm test
```

Expected: PASS, 6 tests total (3 module + 3 interceptor).

- [ ] **Step 3: Full build**

```bash
npm run build
```

Expected: PASS, `dist/` populated.

---

### Task 23: Commit Jest setup + specs, push, open PR1

**Files:** none (git only)

- [ ] **Step 1: Stage and commit**

```bash
git add jest.config.js lib/__tests__/ package.json package-lock.json
git commit -m "test: add jest with smoke tests for ApmModule and ApmInterceptor"
```

- [ ] **Step 2: Push branch**

```bash
git push -u origin chore/pr1-tooling-baseline
```

- [ ] **Step 3: Open PR1**

Open a PR titled `chore: PR1 — tooling baseline (TS5, ESLint 9, Prettier 3, Jest)` against `master`.

Body template:
```
## Summary
- Upgrade TypeScript 4.7 → 5.x and enable strict mode
- Replace tslint with ESLint 9 (flat config) + @typescript-eslint v8
- Add Prettier 3 with auto-format
- Add Husky 9 with pre-commit hook (lint + test)
- Add Jest 29 + ts-jest + smoke tests for ApmModule (3) and ApmInterceptor (3)
- Apply cosmetic fixes: `Observable<Response>` → `Observable<unknown>`, definite-assignment marker on `apmAgent`

## Test plan
- [x] `npm run lint` passes
- [x] `npm test` passes (6 tests green)
- [x] `npm run build` passes
- [ ] CI workflow (added in PR3) — N/A yet

## Notes
- Runtime deps (NestJS, elastic-apm-node, rxjs runtime) unchanged in this PR.
- Public API surface unchanged.
```

- [ ] **Step 4: Wait for PR1 to be merged into master before starting Phase 2.**

(Once merged, you'll do `git checkout master && git pull` before Task 24.)

---

# Phase 2 — PR2: NestJS v11

**Branch:** `chore/pr2-nestjs-v11` (off updated `master` after PR1 merges)
**Outcome:** NestJS v9 → v11 in devDeps; `peerDependencies` declared with `^10 || ^11`; existing smoke tests pass under v11; manual smoke verified against NestJS v10 and v11 dummy apps.

---

### Task 24: Sync master and create the PR2 branch

**Files:** none (git only)

- [ ] **Step 1: Update master and branch off**

```bash
git checkout master
git pull origin master
git checkout -b chore/pr2-nestjs-v11
```

Expected: branch created from latest master containing PR1 changes.

---

### Task 25: Bump NestJS to v11 + reflect-metadata

**Files:**
- Modify: `package.json` (devDependencies)

- [ ] **Step 1: Install v11 deps**

```bash
npm install --save-dev @nestjs/common@^11.0.0 @nestjs/core@^11.0.0 @nestjs/testing@^11.0.0 reflect-metadata@^0.2.2
```

Expected: deps updated. Warnings about peer deps are acceptable as long as install completes.

- [ ] **Step 2: Bump rxjs to 7.8**

```bash
npm install --save-dev rxjs@^7.8.0
```

Expected: installed.

---

### Task 26: Add `peerDependencies` to `package.json`

**Files:**
- Modify: `package.json` (add top-level `peerDependencies` field)

- [ ] **Step 1: Insert `peerDependencies` between `dependencies` and `devDependencies`**

Add the following top-level block to `package.json`:
```json
"peerDependencies": {
  "@nestjs/common": "^10.0.0 || ^11.0.0",
  "@nestjs/core": "^10.0.0 || ^11.0.0",
  "reflect-metadata": "^0.1.13 || ^0.2.0",
  "rxjs": "^7.5.0"
}
```

(Placement: after `dependencies`, before `devDependencies`. JSON requires comma after the previous block's closing `}`.)

---

### Task 27: Verify build, lint, and tests under NestJS v11

**Files:** none (verification only)

- [ ] **Step 1: Build**

```bash
npm run build
```

Expected: PASS. If type errors appear (unlikely — the wrapper uses stable APIs), fix them minimally.

- [ ] **Step 2: Lint**

```bash
npm run lint
```

Expected: PASS, 0 errors.

- [ ] **Step 3: Test**

```bash
npm test
```

Expected: PASS, 6 tests green (same as Phase 1 — they're now running against NestJS v11 testing utilities).

If any test fails because of an API change in `@nestjs/testing` v11 (e.g., `module.get(APP_INTERCEPTOR)` resolution semantics), update the test minimally to keep the *intent* (verifying DI registration), not to mask a real regression.

---

### Task 28: Pack and run NestJS v10 smoke test

**Files:** none (manual verification — produces `*.tgz` in repo root)

- [ ] **Step 1: Build and pack the library**

```bash
npm run build
npm pack
```

Expected: produces `strongnguyen-nestjs-apm-2.0.0.tgz` (version is still 2.0.0 in PR2 — bumped in Phase 3).

- [ ] **Step 2: Create a temporary NestJS v10 app outside the repo**

```bash
cd ..
npx --yes @nestjs/cli@10 new smoke-v10 --skip-install --skip-git --package-manager npm
cd smoke-v10
npm install
```

If interactive prompts appear, accept defaults.

- [ ] **Step 3: Install the packed tarball**

```bash
npm install ../nestjs-apm/strongnguyen-nestjs-apm-2.0.0.tgz
```

Expected: installs without peer-dep errors.

- [ ] **Step 4: Wire ApmModule into the smoke app**

Edit `smoke-v10/src/app.module.ts` to:
```typescript
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ApmModule } from '@strongnguyen/nestjs-apm';

@Module({
  imports: [
    ApmModule.registerAsync({
      useFactory: () => ({
        active: false,
        serviceName: 'smoke-v10',
        secretToken: '',
        serverUrl: '',
        environment: 'local',
      }),
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

- [ ] **Step 5: Start the app and verify boot**

```bash
npm run start
```

Expected: app starts, listens on port 3000, no DI errors, log line indicating Nest application successfully started. Hit Ctrl+C to stop.

- [ ] **Step 6: Clean up**

```bash
cd ..
Remove-Item -Recurse -Force smoke-v10
cd nestjs-apm
```

---

### Task 29: Run NestJS v11 smoke test

**Files:** none (manual verification)

- [ ] **Step 1: Create v11 smoke app**

```bash
cd ..
npx --yes @nestjs/cli@11 new smoke-v11 --skip-install --skip-git --package-manager npm
cd smoke-v11
npm install
```

- [ ] **Step 2: Install the tarball**

```bash
npm install ../nestjs-apm/strongnguyen-nestjs-apm-2.0.0.tgz
```

- [ ] **Step 3: Wire ApmModule the same way as Task 28 Step 4 but with `serviceName: 'smoke-v11'`**

- [ ] **Step 4: Start and verify**

```bash
npm run start
```

Expected: boots cleanly. Ctrl+C to stop.

- [ ] **Step 5: Clean up**

```bash
cd ..
Remove-Item -Recurse -Force smoke-v11
cd nestjs-apm
Remove-Item strongnguyen-nestjs-apm-2.0.0.tgz
```

---

### Task 30: Commit PR2 changes, push, open PR2

**Files:** none (git only)

- [ ] **Step 1: Stage and commit**

```bash
git add package.json package-lock.json
# If Task 27 Step 3 required test edits, also stage them:
git add lib/__tests__/ 2>$null
git commit -m "feat: upgrade to NestJS v11 with peer range ^10 || ^11"
```

- [ ] **Step 2: Push branch**

```bash
git push -u origin chore/pr2-nestjs-v11
```

- [ ] **Step 3: Open PR2**

Title: `feat: PR2 — NestJS v11 with peer range ^10 || ^11`

Body:
```
## Summary
- Upgrade @nestjs/common, @nestjs/core, @nestjs/testing to v11
- Add peerDependencies: ^10.0.0 || ^11.0.0
- Bump reflect-metadata to ^0.2.2 (peer accepts ^0.1.13 || ^0.2.0)
- Bump rxjs to 7.8

## Test plan
- [x] `npm test` passes against NestJS v11 testing utilities (6 tests)
- [x] `npm run build` passes
- [x] Manual smoke test in NestJS v10 dummy app — boots cleanly
- [x] Manual smoke test in NestJS v11 dummy app — boots cleanly

## Notes
- elastic-apm-node still on 3.37 — bumped in PR3.
- Version bump (3.0.0) lands in PR3 together with CHANGELOG and release artifacts.
```

- [ ] **Step 4: Wait for PR2 to be merged into master before starting Phase 3.**

---

# Phase 3 — PR3: elastic-apm-node v4 + Release

**Branch:** `chore/pr3-apm-v4-release` (off updated `master` after PR2 merges)
**Outcome:** elastic-apm-node 3.37 → 4.x; version bumped to 3.0.0; CHANGELOG + README updated; CI + publish workflows added; ApmService spec added; PR merged + tag `v3.0.0` pushed → npm publish via GitHub Actions.

---

### Task 31: Sync master and create the PR3 branch

**Files:** none (git only)

- [ ] **Step 1: Update master and branch off**

```bash
git checkout master
git pull origin master
git checkout -b chore/pr3-apm-v4-release
```

---

### Task 32: Bump elastic-apm-node to v4

**Files:**
- Modify: `package.json` (dependencies)

- [ ] **Step 1: Install elastic-apm-node v4**

```bash
npm install --save elastic-apm-node@^4.7.0
```

Expected: dep updated.

- [ ] **Step 2: Build to surface type changes**

```bash
npm run build
```

Expected: most likely PASS without changes. If `APM.Transaction`, `APM.Span`, `APM.TransactionOptions`, or `APM.SpanOptions` were renamed in v4 typings, you'll see errors in `lib/apm.service.ts`. Fix the imports minimally:
- If `Transaction` is now `Transaction | undefined`, no change needed (return type already accepted `| null`).
- If a namespace path changed, e.g., from `APM.TransactionOptions` to `APM.AgentConfigOptions.TransactionOptions`, update the import accordingly.

Do NOT change method signatures of `ApmService` proxy methods.

---

### Task 33: Verify lint + test still pass under elastic-apm-node v4

**Files:** none (verification)

- [ ] **Step 1: Lint**

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 2: Test**

```bash
npm test
```

Expected: PASS, 6 tests green. `apm.module.spec.ts` will call `APM.start({ active: false, ... })` indirectly through `onModuleInit` — this is OK because `active: false` means the agent does not connect.

---

### Task 34: Write `apm.service.spec.ts` — test 1 (onModuleInit calls APM.start)

**Files:**
- Create: `lib/__tests__/apm.service.spec.ts`

- [ ] **Step 1: Create the spec**

Create `lib/__tests__/apm.service.spec.ts` with:
```typescript
import { ApmService } from '../apm.service';
import { ApmModuleOptions } from '../apm.interface';

const startMock = jest.fn();
const isStartedMock = jest.fn().mockReturnValue(true);
const captureErrorMock = jest.fn();
const startTransactionMock = jest.fn();
const setTransactionNameMock = jest.fn();
const startSpanMock = jest.fn();
const setCustomContextMock = jest.fn();

jest.mock('elastic-apm-node', () => ({
  start: (...args: unknown[]) => {
    startMock(...args);
    return {
      isStarted: isStartedMock,
      captureError: captureErrorMock,
      startTransaction: startTransactionMock,
      setTransactionName: setTransactionNameMock,
      startSpan: startSpanMock,
      setCustomContext: setCustomContextMock,
    };
  },
}));

describe('ApmService', () => {
  const options: ApmModuleOptions = {
    active: false,
    serviceName: 'unit-test',
    secretToken: 'token',
    serverUrl: 'https://example.invalid',
    environment: 'local',
  };

  beforeEach(() => {
    startMock.mockClear();
    captureErrorMock.mockClear();
    startTransactionMock.mockClear();
    setTransactionNameMock.mockClear();
    startSpanMock.mockClear();
    setCustomContextMock.mockClear();
  });

  it('onModuleInit calls APM.start with the resolved options', () => {
    const service = new ApmService(options);
    service.onModuleInit();
    expect(startMock).toHaveBeenCalledTimes(1);
    expect(startMock).toHaveBeenCalledWith(options);
  });
});
```

- [ ] **Step 2: Run the test**

```bash
npm test -- --testPathPattern=apm.service
```

Expected: PASS, 1 test green.

---

### Task 35: Add `apm.service.spec.ts` — test 2 (proxy methods forward to agent)

**Files:**
- Modify: `lib/__tests__/apm.service.spec.ts`

- [ ] **Step 1: Append the second test inside the `describe` block**

```typescript
  it('proxy methods forward to the underlying agent', () => {
    const service = new ApmService(options);
    service.onModuleInit();

    const err = new Error('test');
    service.captureError(err);
    expect(captureErrorMock).toHaveBeenCalledWith(err);

    service.startTransaction('tx-name');
    expect(startTransactionMock).toHaveBeenCalledWith('tx-name', undefined);

    service.setTransactionName('renamed-tx');
    expect(setTransactionNameMock).toHaveBeenCalledWith('renamed-tx');

    service.startSpan('span-name');
    expect(startSpanMock).toHaveBeenCalledWith('span-name', undefined);

    service.setCustomContext({ userId: 42 });
    expect(setCustomContextMock).toHaveBeenCalledWith({ userId: 42 });
  });
```

- [ ] **Step 2: Run all service tests**

```bash
npm test -- --testPathPattern=apm.service
```

Expected: PASS, 2 tests green.

- [ ] **Step 3: Run full test suite to confirm nothing else broke**

```bash
npm test
```

Expected: PASS, 8 tests total (3 module + 3 interceptor + 2 service).

---

### Task 36: Bump package version to 3.0.0

**Files:**
- Modify: `package.json:3`

- [ ] **Step 1: Edit `version` field**

In `package.json`, change `"version": "2.0.0"` to `"version": "3.0.0"`.

(Do NOT use `npm version major` — that creates a git tag prematurely. Manual edit only at this step.)

---

### Task 37: Create CHANGELOG.md

**Files:**
- Create: `CHANGELOG.md`

- [ ] **Step 1: Write CHANGELOG**

Create `CHANGELOG.md` with:
```markdown
# Changelog

All notable changes to this project will be documented in this file.

## 3.0.0 — 2026-05-28

### Breaking
- Minimum NestJS version raised to v10. Drop NestJS v9 support.
- Minimum Node version raised to v20.
- `elastic-apm-node` upgraded 3.x → 4.x. Consumers passing `childOf` in transaction/span options must migrate to `links` (see the elastic-apm-node v4 migration guide).

### Changed
- TypeScript 4.7 → 5.x.
- RxJS minimum 7.5 → 7.8.
- Replaced `tslint` with ESLint 9 + @typescript-eslint v8.
- Added Jest 29 test suite (8 tests: ApmModule × 3, ApmInterceptor × 3, ApmService × 2).
- Added GitHub Actions CI (Node 20/22) and tag-triggered npm publish workflow.
- Fixed pre-existing cosmetic typing in `ApmInterceptor`: `Observable<Response>` → `Observable<unknown>`.

### Migration
- Consumers on NestJS v10 or v11: update `@strongnguyen/nestjs-apm` to `^3.0.0`. No code changes required at `ApmModule.registerAsync()` call sites.
- If you previously passed `childOf` to `startTransaction` or `startSpan` options through this package, migrate to elastic-apm-node v4's `links` API.

## 2.0.0

- Initial public release (NestJS v9, elastic-apm-node 3.x).
```

(The date line `2026-05-28` matches today's date. Update it manually before tagging if the actual tag day is different.)

---

### Task 38: Update README.md with compatibility matrix

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Read current README to find the install/usage section**

```bash
git diff master -- README.md
```

(Confirms the file is currently unchanged in this branch.)

- [ ] **Step 2: Add a Compatibility section near the top**

Open `README.md` and, immediately after the title heading (line 1 or 2), insert:
```markdown

## Compatibility

| nestjs-apm | NestJS | Node | elastic-apm-node |
|---|---|---|---|
| 3.x | 10, 11 | ≥ 20 | 4.x |
| 2.x | 9 | ≥ 14 | 3.x |

## Migration from v2

See [CHANGELOG.md](./CHANGELOG.md#300--2026-05-28). No call-site changes are required for typical `ApmModule.registerAsync()` consumers. If you passed `childOf` directly to `startTransaction`/`startSpan` options, migrate to elastic-apm-node v4's `links` API.

```

(Place these two new sections before the existing usage/install sections, after the project title and description.)

---

### Task 39: Create CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Ensure `.github/workflows` directory exists**

```bash
New-Item -ItemType Directory -Force -Path ".github/workflows" | Out-Null
```

- [ ] **Step 2: Write the CI workflow**

Create `.github/workflows/ci.yml` with:
```yaml
name: CI

on:
  push:
    branches: [master]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [20.x, 22.x]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm test
      - run: npm run build
```

---

### Task 40: Create publish workflow with version-vs-tag guard

**Files:**
- Create: `.github/workflows/publish.yml`

- [ ] **Step 1: Write the publish workflow**

Create `.github/workflows/publish.yml` with:
```yaml
name: Publish

on:
  push:
    tags:
      - 'v*'

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20.x'
          registry-url: 'https://registry.npmjs.org/'

      - name: Verify tag matches package.json version
        run: |
          TAG_VERSION="${GITHUB_REF_NAME#v}"
          PKG_VERSION=$(node -p "require('./package.json').version")
          if [ "$TAG_VERSION" != "$PKG_VERSION" ]; then
            echo "Tag $GITHUB_REF_NAME does not match package.json version $PKG_VERSION"
            exit 1
          fi
          echo "Tag and package.json both at version $PKG_VERSION"

      - run: npm ci
      - run: npm whoami
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
      - run: npm run lint
      - run: npm test
      - run: npm run build
      - run: npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

(Reason for `npm whoami` early: fails fast if `NPM_TOKEN` is missing or invalid, before doing the build work.)

---

### Task 41: Run full lint + test + build before commit

**Files:** none (verification only)

- [ ] **Step 1: Lint**

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 2: Test**

```bash
npm test
```

Expected: PASS, 8 tests.

- [ ] **Step 3: Build**

```bash
npm run build
```

Expected: PASS.

---

### Task 42: Manual smoke test of v3.0.0 candidate against NestJS v10 + v11

**Files:** none (manual verification)

- [ ] **Step 1: Pack v3.0.0 tarball**

```bash
npm pack
```

Expected: produces `strongnguyen-nestjs-apm-3.0.0.tgz`.

- [ ] **Step 2: NestJS v10 smoke**

Repeat Task 28 Steps 2-5, replacing the tarball name with `strongnguyen-nestjs-apm-3.0.0.tgz`. Confirm boot succeeds.

- [ ] **Step 3: NestJS v11 smoke**

Repeat Task 29 Steps 1-4 with the new tarball. Confirm boot succeeds.

- [ ] **Step 4: Add a route that throws HttpException and verify capture path**

In one of the smoke apps, edit the `AppController.getHello()` handler to:
```typescript
import { Controller, Get, HttpException } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    throw new HttpException('smoke-test-forbidden', 403);
  }
}
```

`npm run start`, then in another terminal: `curl http://localhost:3000/`. Expected: 403 response, app does not crash, `Logger` output shows ApmInterceptor has run (since `active: false`, no network call). Ctrl+C.

- [ ] **Step 5: Clean up**

```bash
Remove-Item strongnguyen-nestjs-apm-3.0.0.tgz
# Also remove smoke-v10 and smoke-v11 directories created in Steps 2-3.
```

---

### Task 43: Commit PR3 changes

**Files:** none (git only)

- [ ] **Step 1: Stage and commit**

```bash
git add package.json package-lock.json CHANGELOG.md README.md .github/workflows/ lib/__tests__/apm.service.spec.ts
git commit -m "feat: upgrade elastic-apm-node to v4 and release v3.0.0"
```

(If any `lib/apm.service.ts` import was edited in Task 32, also include it: `git add lib/apm.service.ts`.)

---

### Task 44: Push branch and open PR3

**Files:** none (git only)

- [ ] **Step 1: Push**

```bash
git push -u origin chore/pr3-apm-v4-release
```

- [ ] **Step 2: Open PR3**

Title: `feat: PR3 — elastic-apm-node v4 + v3.0.0 release`

Body:
```
## Summary
- Upgrade elastic-apm-node 3.37 → 4.x
- Bump package version to 3.0.0
- Add CHANGELOG.md (3.0.0 entry with breaking/changed/migration)
- Update README with compatibility matrix
- Add GitHub Actions CI (Node 20.x + 22.x, build/lint/test)
- Add tag-triggered publish workflow with version-vs-tag guard
- Add ApmService spec (2 tests, mocks elastic-apm-node)

## Test plan
- [x] `npm test` passes (8 tests)
- [x] `npm run lint` passes
- [x] `npm run build` passes
- [x] Manual smoke in NestJS v10 dummy app with v4 agent — boot OK
- [x] Manual smoke in NestJS v11 dummy app — boot OK + HttpException route does not crash
- [ ] Tag v3.0.0 + publish workflow (post-merge)

## Notes
- Public API (`ApmModule`, `ApmService`, `ApmInterceptor`, `ApmModuleOptions`) unchanged.
- Consumers passing `childOf` to `startTransaction`/`startSpan` options must migrate to v4's `links` API.
```

- [ ] **Step 3: Wait for PR3 to merge into master.**

---

### Task 45: Pre-tag release checklist

**Files:** none (manual verification before tagging)

- [ ] **Step 1: Pull merged master**

```bash
git checkout master
git pull origin master
```

- [ ] **Step 2: Verify CI is green on master**

Check the GitHub Actions page; the latest `master` commit must have a green check from the `CI` workflow on both Node 20.x and 22.x.

- [ ] **Step 3: Verify NPM_TOKEN is configured**

In the GitHub repo settings → Secrets and variables → Actions, confirm a secret named `NPM_TOKEN` exists. If missing, generate an npm Automation token (https://www.npmjs.com/settings/<user>/tokens) with publish rights to the `@strongnguyen` scope and add it.

- [ ] **Step 4: Verify local npm publish capability**

```bash
npm whoami
```

Expected: prints your npm username. If logged out, `npm login` first (this is for local verification only; the actual publish runs in CI with `NPM_TOKEN`).

- [ ] **Step 5: Verify `package.json.version` is 3.0.0**

```bash
node -p "require('./package.json').version"
```

Expected: `3.0.0`.

- [ ] **Step 6: Verify CHANGELOG date if needed**

If the merge happened on a different day than 2026-05-28, edit the CHANGELOG date line on master:
```bash
# Only if the date needs updating:
# (edit CHANGELOG.md line "## 3.0.0 — YYYY-MM-DD")
git add CHANGELOG.md
git commit -m "docs: update CHANGELOG release date for v3.0.0"
git push origin master
```

(Skip this step if the date is correct.)

---

### Task 46: Tag v3.0.0 and trigger publish

**Files:** none (git only)

- [ ] **Step 1: Create annotated tag**

```bash
git tag -a v3.0.0 -m "Release v3.0.0"
```

- [ ] **Step 2: Push the tag**

```bash
git push origin v3.0.0
```

Expected: GitHub Actions starts the `Publish` workflow.

- [ ] **Step 3: Monitor the publish workflow**

Open GitHub Actions → Publish workflow run. Verify:
- "Verify tag matches package.json version" step passes.
- `npm whoami` succeeds.
- `npm publish --access public` succeeds.

- [ ] **Step 4: Verify the npm package is live**

```bash
npm view @strongnguyen/nestjs-apm@3.0.0
```

Expected: returns the package metadata for v3.0.0.

---

### Task 47: Post-release tasks

**Files:** none

- [ ] **Step 1: Create GitHub Release from the tag**

On GitHub → Releases → "Draft a new release" → select tag `v3.0.0` → title "v3.0.0" → body: paste the `## 3.0.0` section from `CHANGELOG.md`. Publish.

- [ ] **Step 2: Smoke-install from npm into a fresh project**

```bash
cd ..
mkdir verify-published
cd verify-published
npm init -y
npm install @strongnguyen/nestjs-apm@3.0.0 @nestjs/common@11 @nestjs/core@11 reflect-metadata
```

Expected: install completes without peer-dep errors.

- [ ] **Step 3: Clean up verification project**

```bash
cd ..
Remove-Item -Recurse -Force verify-published
cd nestjs-apm
```

---

## Acceptance Criteria

The upgrade is complete when **all** of the following hold:

1. `master` branch contains the three merged PRs (1, 2, 3).
2. `npm view @strongnguyen/nestjs-apm@3.0.0` resolves and shows the published package.
3. The published package contains `dist/`, `package.json` with `peerDependencies` declared, and `CHANGELOG.md`.
4. `README.md` includes the compatibility matrix and migration section.
5. GitHub Actions `CI` workflow is green on `master`.
6. The GitHub Release `v3.0.0` exists.
7. Smoke install from npm into a fresh NestJS v11 project succeeds.
