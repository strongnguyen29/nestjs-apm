# nestjs-elastic-apm

## Installation

```
$ npm i @strongnguyen/nestjs-apm
```

## NestJs config

### main.ts (first line)

```
import * as dotenv from 'dotenv';
dotenv.config(); //
import apm from '@strongnguyen/nestjs-apm';
...
```

### app.module.ts

```
...
import { ApmModule } from '@strongnguyen/nestjs-apm';
...
```

```
@Module({
...
imports: [
...,
ApmModule.register(),
...
]
})
export class AppModule { }
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
