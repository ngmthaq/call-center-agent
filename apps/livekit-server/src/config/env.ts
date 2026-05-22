const DEFAULT_PORT = 3000;
const DEFAULT_NODE_ENV = 'development';

const parsePort = (raw: string | undefined): number => {
  if (raw === undefined || raw === '') {
    return DEFAULT_PORT;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : DEFAULT_PORT;
};

export interface AppConfig {
  readonly port: number;
  readonly nodeEnv: string;
}

export const config: AppConfig = {
  port: parsePort(process.env.PORT),
  nodeEnv: process.env.NODE_ENV ?? DEFAULT_NODE_ENV,
};
