import dotenv from 'dotenv';
import path from 'path';
import { createApp } from './app';
import { config, loadConfig } from './config/env';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

loadConfig();

const app = createApp();

app.listen(config.port, () => {
  console.log(`Server listening on port ${config.port}`);
});
