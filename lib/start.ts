import * as apmAgent from 'elastic-apm-node';

const options: apmAgent.AgentConfigOptions = {
  active: process.env.APM_ACTIVATE === 'true'
};
if (process.env.APM_SERVICE_NAME) {
  options['serviceName'] = process.env.APM_SERVICE_NAME;
}
if (process.env.APM_SECRET_TOKEN) {
  options['secretToken'] = process.env.APM_SECRET_TOKEN;
}
if (process.env.APM_SERVER_URL) {
  options['serverUrl'] = process.env.APM_SERVER_URL;
}
if (process.env.APM_ENV) {
  options['environment'] = process.env.APM_ENV;
}
if (process.env.APM_DISABLE_INSTRUMENTATIONS) {
  options['disableInstrumentations'] =
    process.env.APM_DISABLE_INSTRUMENTATIONS.split(',');
}

const apm: apmAgent.Agent = apmAgent.start(options);
export { apm };
