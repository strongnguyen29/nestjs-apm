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
```
