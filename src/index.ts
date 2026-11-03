import { createApp } from './api/app.ts';
import { loadConfig } from './config.ts';
import { createNaukriClient } from './naukri/index.ts';

let config;
try {
  config = loadConfig();
} catch (err) {
  console.error((err as Error).message);
  process.exit(1);
}

const naukri = createNaukriClient(config.naukri);
const server = createApp(naukri, config.apiKey).listen(config.port, () => {
  console.log(`noperi listening on :${config.port}`);
});

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    server.close(() => {
      naukri.close();
      process.exit(0);
    });
  });
}
