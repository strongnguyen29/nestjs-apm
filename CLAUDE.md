# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

`@strongnguyen/nestjs-apm` — a thin NestJS wrapper around [`elastic-apm-node`](https://www.elastic.co/guide/en/apm/agent/nodejs/current/index.html). The package is **published to npm**, not consumed as an application. There is no runnable entry point inside this repo (no `main.ts`, no server).

## Commands

```bash
npm run build          # rimraf dist && tsc -p tsconfig.json
npm run publish:npm    # build + npm publish (uses npmjs.org, scope: @strongnguyen)
```

No test runner, lint script, or dev/start command is wired up. `tslint.json` exists but is not invoked by any npm script. `**/*.spec.ts` is excluded from the TypeScript build (`tsconfig.json`).

The root `index.js` / `index.d.ts` / `index.ts` all re-export `./dist`, so consumers `import` from the package root after `npm run build` populates `dist/`.

## Architecture

Source lives in `lib/`, compiles to `dist/`. Seven files total — small surface area.

**Module wiring (`lib/apm.module.ts`)**
- Only `ApmModule.registerAsync()` is exposed. There is no synchronous `register()`.
- The module registers `ApmService` *and* a global `APP_INTERCEPTOR` (`ApmInterceptor`) in one call — importing the module automatically captures errors from every controller.

**Service lifecycle (`lib/apm.service.ts`)**
- `APM.start()` is called inside `onModuleInit()`, **not** in the constructor. This is intentional: the agent needs the resolved async options before starting.
- Do not call `APM.start()` anywhere else in the module tree — it can only be started once per process.
- Public methods (`startSpan`, `startTransaction`, `captureError`, etc.) are thin proxies to the underlying `elastic-apm-node` `Agent`.

**Interceptor (`lib/apm.interceptor.ts`)**
- Distinguishes `HttpException` (captures `error.message` only) from all other errors (captures the full error object). This is **intentional** — the goal is to avoid leaking HTTP error details (4xx/5xx response bodies, stack traces) to APM while still surfacing unexpected exceptions.

**Standalone bootstrap (`lib/start.ts`)**
- Reads env vars directly and calls `APM.start()` without NestJS DI.
- Use this *only* when APM must start before NestJS bootstraps (e.g. to auto-instrument DB drivers loaded by `main.ts`). Import it as the **very first line** of `main.ts`.
- Currently **not** re-exported from `lib/index.ts` — consumers must deep-import `@strongnguyen/nestjs-apm/dist/start`. Export it explicitly if you intend it to be public API.

**Configuration token (`lib/apm.const.ts`)**
- `APM_MODULE_OPTIONS_TOKEN = 'ApmModuleOptionsToken'` — string token, not a `Symbol`. Don't change the string value, it's part of the DI contract for anyone who manually `@Inject()`s it.

## Adding Features

1. New public methods on `ApmService` should proxy the `elastic-apm-node` `Agent` API directly — keep this layer transparent.
2. New configuration options belong in `ApmModuleOptions` (`lib/apm.interface.ts`) **and** must be forwarded inside `ApmService.onModuleInit()` (the options object is passed wholesale to `APM.start()`, so just adding the field is usually enough — but check the `elastic-apm-node` types).
3. Export new public symbols from `lib/index.ts`. The root `index.ts` re-exports `./dist`, so anything reachable from `lib/index.ts` becomes part of the package API.
4. After changes, run `npm run build` — TypeScript compilation is the only correctness check available.

## Environment Variables (only used by `lib/start.ts`)

| Variable | Purpose |
|----------|---------|
| `APM_ACTIVATE` | `'true'` to enable the agent |
| `APM_SERVICE_NAME` | Overrides service name from `package.json` |
| `APM_SECRET_TOKEN` | APM server auth token |
| `APM_SERVER_URL` | APM server URL |
| `APM_ENV` | Environment label (`local` / `develop` / `staging` / `production`) |
| `APM_DISABLE_INSTRUMENTATIONS` | Comma-separated module list to skip |

When using `ApmModule.registerAsync()` (the normal path), these env names are conventions in the consumer's `ConfigService` — they are **not** read by this library.

## See Also

`AGENTS.md` in the repo root contains the same architectural notes in a slightly different format — keep both files in sync when changing core behavior.
