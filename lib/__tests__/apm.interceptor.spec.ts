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

  it('re-throws errors after capture (does not swallow)', async () => {
    const next: CallHandler<unknown> = {
      handle: () => throwError(() => new Error('rethrow-me')),
    };

    const obs = interceptor.intercept(makeContext(), next);
    await expect(firstValueFrom(obs)).rejects.toThrow('rethrow-me');
    expect(captureSpy).toHaveBeenCalled();
  });
});
