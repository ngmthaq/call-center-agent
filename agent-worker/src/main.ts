import { ServerOptions, cli } from '@livekit/agents';
import path from 'node:path';

import { loadConfig, WorkerConfig } from './config';
import { createLogger } from './logger';

const AGENT_MODULE_PATH = path.resolve(__dirname, 'agent.js');

function bootstrap(): void {
  const log = createLogger('agent-worker:main');
  const config = tryLoadConfig(log);
  const childLog = createLogger('agent-worker:main', { level: config.logLevel });

  const options = new ServerOptions({
    agent: AGENT_MODULE_PATH,
    agentName: config.agentName,
    wsURL: config.livekitUrl,
    apiKey: config.livekitApiKey,
    apiSecret: config.livekitApiSecret,
    logLevel: config.logLevel,
  });

  childLog.info(
    {
      agentName: config.agentName,
      livekitUrl: config.livekitUrl,
      logLevel: config.logLevel,
    },
    'starting agent worker with explicit dispatch',
  );

  registerShutdownHandlers(childLog);

  cli.runApp(options);
}

function tryLoadConfig(log: ReturnType<typeof createLogger>): WorkerConfig {
  try {
    return loadConfig();
  } catch (err: unknown) {
    log.fatal({ err }, 'invalid worker configuration; exiting');
    process.exit(1);
    throw new Error('unreachable');
  }
}

function registerShutdownHandlers(log: ReturnType<typeof createLogger>): void {
  let shuttingDown = false;
  const handle = (signal: NodeJS.Signals): void => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    log.info({ signal }, 'received shutdown signal; allowing CLI drain to complete');
  };

  process.on('SIGTERM', handle);
  process.on('SIGINT', handle);

  process.on('uncaughtException', (err: unknown) => {
    log.fatal({ err }, 'uncaughtException; exiting');
    process.exit(1);
  });

  process.on('unhandledRejection', (reason: unknown) => {
    log.fatal({ reason }, 'unhandledRejection; exiting');
    process.exit(1);
  });
}

bootstrap();
