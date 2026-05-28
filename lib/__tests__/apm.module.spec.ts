import { Module } from '@nestjs/common';
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

  it('registerAsync resolves options via inject', async () => {
    class FakeConfig {
      readonly value = 'injected-service-name';
    }

    @Module({
      providers: [FakeConfig],
      exports: [FakeConfig],
    })
    class FakeConfigModule {}

    const moduleRef = await Test.createTestingModule({
      imports: [
        ApmModule.registerAsync({
          imports: [FakeConfigModule],
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

  it('registers ApmInterceptor as a global APP_INTERCEPTOR', async () => {
    const { APP_INTERCEPTOR } = await import('@nestjs/core');
    const { ApmInterceptor } = await import('../apm.interceptor');

    // Inspect the DynamicModule shape directly — APP_INTERCEPTOR is a class-keyed
    // string token consumed by Nest's ApplicationConfig, not exposed via moduleRef.get
    // by class, so we verify the provider registration declaratively.
    const dynamicModule = ApmModule.registerAsync({
      useFactory: () => factoryOptions,
    });

    const interceptorProvider = (dynamicModule.providers ?? []).find(
      (p) =>
        typeof p === 'object' &&
        p !== null &&
        'provide' in p &&
        (p as { provide: unknown }).provide === APP_INTERCEPTOR,
    ) as { provide: unknown; useClass: unknown } | undefined;
    expect(interceptorProvider).toBeDefined();
    expect(interceptorProvider!.useClass).toBe(ApmInterceptor);
    // Sanity-check the APP_INTERCEPTOR token symbol is the one we expect.
    expect(APP_INTERCEPTOR).toBe('APP_INTERCEPTOR');
  });
});
