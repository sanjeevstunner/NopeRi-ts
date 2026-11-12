import { createApp } from './api/app.ts';
import { loadConfig } from './config.ts';
import { createNaukriClient } from './naukri/index.ts';
import { createGulfClient } from './naukrigulf/index.ts';

let config;
try {
  config = loadConfig();
} catch (err) {
  console.error((err as Error).message);
  process.exit(1);
}

const naukri = config.naukri && createNaukriClient(config.naukri);
const gulf = config.gulf && createGulfClient(config.gulf);
const server = createApp(naukri, config.apiKey, gulf).listen(config.port, () => {
  console.log(`noperi listening on :${config.port}`);
});

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    server.close(() => {
      naukri?.close();
      gulf?.close();
      process.exit(0);
    });
  });
}
