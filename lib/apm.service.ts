import { Inject, Injectable, Logger } from '@nestjs/common';
import * as APM from 'elastic-apm-node';
import { APM_MODULE_OPTIONS_TOKEN } from './apm.const';
import { ApmModuleOptions } from './apm.interface';

@Injectable()
export class ApmService {
  private apmAgent: APM.Agent;
  private readonly logger: Logger;

  constructor(@Inject(APM_MODULE_OPTIONS_TOKEN) private options: ApmModuleOptions) {
    // constructor
    this.logger = new Logger(ApmService.name)
  }

  onModuleInit() {
    this.logger.debug(' onModuleInit: APM config: ' + JSON.stringify(this.options))
    this.apmAgent = APM.start(this.options);
    if (this.apmAgent.isStarted()) {
      this.logger.debug(' onModuleInit: APM is started')
    }
  }

  captureError(data: any): void {
    this.apmAgent.captureError(data);
  }

  startTransaction(name?: string, options?: APM.TransactionOptions): APM.Transaction | null {
    return this.apmAgent.startTransaction(name, options);
  }

  setTransactionName(name: string): void {
    this.apmAgent.setTransactionName(name);
  }

  startSpan(name?: string, options?: APM.SpanOptions): APM.Span | null {
    return this.apmAgent.startSpan(name, options);
  }

  setCustomContext(context: Record<string, unknown>): void {
    this.apmAgent.setCustomContext(context);
  }
}
