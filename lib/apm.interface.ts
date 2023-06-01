import { ModuleMetadata, Type } from '@nestjs/common';

export interface ApmModuleOptions {
  active: boolean;
  serviceName: string;
  secretToken: string;
  serverUrl: string;
  environment: 'local' | 'develop' | 'staging' | 'production' | string;
  disableInstrumentations?: string[]
}

export interface ApmModuleOptionsFactory {
  createApmModuleOptions(): Promise<ApmModuleOptions> | ApmModuleOptions;
}

export interface ApmModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  inject?: any[];
  useClass?: Type<ApmModuleOptionsFactory>;
  useExisting?: Type<ApmModuleOptionsFactory>;
  useFactory?: (...args: any[]) => Promise<ApmModuleOptions> | ApmModuleOptions;
}
