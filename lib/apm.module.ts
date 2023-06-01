import { DynamicModule } from '@nestjs/common';
import { ApmService } from './apm.service';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ApmInterceptor } from './apm.interceptor';
import { ApmModuleAsyncOptions } from './apm.interface';
import { APM_MODULE_OPTIONS_TOKEN } from './apm.const';

export class ApmModule {
  static registerAsync(options: ApmModuleAsyncOptions): DynamicModule {
    return {
      module: ApmModule,
      imports: options.imports,
      providers: [
        {
          provide: APM_MODULE_OPTIONS_TOKEN,
          useFactory: options.useFactory,
          inject: options.inject,
        },
        ApmService,
        {
          provide: APP_INTERCEPTOR,
          useClass: ApmInterceptor
        }
      ],
      exports: [ApmService]
    };
  }
}
