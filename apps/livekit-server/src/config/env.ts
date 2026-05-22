const DEFAULT_PORT = 3000;
const DEFAULT_NODE_ENV = 'development';

const parsePort = (raw: string | undefined): number => {
  if (raw === undefined || raw === '') return DEFAULT_PORT;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : DEFAULT_PORT;
};

const parseRequiredString = (raw: string | undefined, keyName: string): string => {
  if (raw === undefined) {
    throw new Error(`Missing required env var: ${keyName}`);
  }
  const trimmed = raw.trim();
  if (trimmed === '') {
    throw new Error(`Missing required env var: ${keyName}`);
  }
  return trimmed;
};

export const config = {
  port: parsePort(process.env.PORT),
  nodeEnv: process.env.NODE_ENV ?? DEFAULT_NODE_ENV,
  livekit: {
    apiKey: parseRequiredString(process.env.LIVEKIT_API_KEY, 'LIVEKIT_API_KEY'),
    apiSecret: parseRequiredString(process.env.LIVEKIT_API_SECRET, 'LIVEKIT_API_SECRET'),
    url: parseRequiredString(process.env.LIVEKIT_URL, 'LIVEKIT_URL'),
  } as const,
} as const;
