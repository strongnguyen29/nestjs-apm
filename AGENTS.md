# nestjs-apm — Agent Guide

NestJS module wrapping [elastic-apm-node](https://www.elastic.co/guide/en/apm/agent/nodejs/current/index.html) for Elastic APM integration. Package: `@strongnguyen/nestjs-apm`.

## Build & Publish

```bash
npm run build          # rimraf dist && tsc -p tsconfig.json
npm run publish:npm    # build + npm publish
```

TypeScript source lives in `lib/`, compiled output goes to `dist/`. The root `index.js` re-exports from `./dist`.

## Architecture

| File | Role |
|------|------|
| `lib/apm.module.ts` | `ApmModule.registerAsync()` — only async registration is supported |
| `lib/apm.service.ts` | Injectable service; wraps `elastic-apm-node`, initialized in `onModuleInit()` |
| `lib/apm.interceptor.ts` | Global `APP_INTERCEPTOR` — auto-captures errors from every request |
| `lib/apm.interface.ts` | `ApmModuleOptions` and `ApmModuleAsyncOptions` types |
| `lib/apm.const.ts` | `APM_MODULE_OPTIONS_TOKEN` injection token |
| `lib/start.ts` | Standalone bootstrap (reads env vars directly); use when APM must start before NestJS |
| `lib/index.ts` | Barrel re-export for the `lib/` directory |

## Key Conventions

- **Only `registerAsync()`** is exposed — there is no synchronous `register()` method.
- **`ApmService.onModuleInit()`** starts the APM agent; do not call `APM.start()` elsewhere in the module tree.
- **`ApmInterceptor`** distinguishes `HttpException` (captures `.message` only) from all other errors (captures full error object). This is intentional to avoid leaking HTTP error details.
- **`start.ts`** is for apps that need APM instrumentation before NestJS bootstraps (e.g., auto-instrument DB drivers). Import it as the very first line of `main.ts`.
- No test suite exists yet. `**/*.spec.ts` files are excluded from the TypeScript build.

## Environment Variables (used by `start.ts`)

| Variable | Purpose |
|----------|---------|
| `APM_ACTIVATE` | `'true'` to enable the agent |
| `APM_SERVICE_NAME` | Override service name from package.json |
| `APM_SECRET_TOKEN` | APM server auth token |
| `APM_SERVER_URL` | APM server URL |
| `APM_ENV` | Environment label (`local` / `develop` / `staging` / `production`) |
| `APM_DISABLE_INSTRUMENTATIONS` | Comma-separated list of modules to skip |

## Adding Features

1. New public methods on `ApmService` should proxy the `elastic-apm-node` `Agent` API directly.
2. New configuration options belong in `ApmModuleOptions` (`lib/apm.interface.ts`) and must be forwarded in `ApmService.onModuleInit()`.
3. Export any new public symbols from `lib/index.ts`.
4. After changes, run `npm run build` to verify compilation before publishing.
