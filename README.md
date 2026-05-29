# nestjs-elastic-apm

## Installation

```
$ npm i @strongnguyen/nestjs-apm
```

## Use


### app.module.ts

```typescript
import { ApmModule } from '@strongnguyen/nestjs-apm';

@Module({
    imports: [
        ApmModule.registerAsync(
            imports: [ConfigModule],
            useFactory: (configService: ConfigService) => ({
                active: configService.get('APM_ACTIVATE'),
                serviceName: configService.get('APM_SERVICE_NAME'),
                serverUrl: configService.get('APM_SERVER_URL'),
                secretToken: configService.get('APM_SECRET_TOKEN'),
                environment: configService.get('APM_ENV'),
                disableInstrumentations: 
                  configService.get('APM_DISABLE_INSTRUMENTATIONS').split(','), // optional
            }),
            inject: [ConfigService],
        )
    ]
})
export class AppModule {}
```

### Usage in the service

```
...
import { ApmService } from '@strongnguyen/nestjs-apm';
...
...
@Injectable()
export class TestService {
constructor(private readonly apmService: ApmService) {}

doSomething(): void {
const span = this.apmService.startSpan('Custom span name');
....
span.end();
}
}
...
```

### Env variables

```
# Override service name from package.json
APM_SERVICE_NAME
# APM Server requires a token
APM_SECRET_TOKEN
# APM Server URL
APM_SERVER_URL
# Set 'true' value to enable APM agent
APM_ACTIVATE
# Environment run app local / production / develop
APM_ENV
# Set comma-separated values to disable particular modules to be instrumented
APM_DISABLE_INSTRUMENTATIONS

# --- Elastic APM native variables (also supported) ---
# Set 'true' value to enable APM agent
ELASTIC_APM_ACTIVE
# Override environment value
ELASTIC_APM_ENVIRONMENT
# Override the verification of SSL certificate.
ELASTIC_APM_VERIFY_SERVER_CERT
# Set the verbosity level for the agent’s logging. Possible levels are: trace (the most verbose logging, avoid in production), debug, info, warning, error, critical, and off (disable all logging).
ELASTIC_APM_LOG_LEVEL
# Enable capturing the HTTP body of incoming HTTP requests. Possible options are: off, all, errors, and transactions.
ELASTIC_APM_CAPTURE_BODY
# Capture apm error log stack traces. Possible options are: never, messages, always
ELASTIC_APM_CAPTURE_ERROR_LOG_STACK_TRACES
# Set this option to true to use the URL path as the transaction name if no other route could be determined. 
ELASTIC_APM_USE_PATH_AS_TRANSACTION_NAME
```
