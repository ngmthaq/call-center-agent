const parsePort = (raw: string | undefined): number => {
  const DEFAULT_PORT = 3000;
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

// console.log(process.env);

let config = {} as Readonly<{
  port: number;
  nodeEnv: string;
  livekit: {
    apiKey: string;
    apiSecret: string;
    url: string;
  };
}>;

function loadConfig() {
  if (Object.keys(config).length > 0) return;
  config = {
    port: parsePort(process.env.PORT),
    nodeEnv: process.env.NODE_ENV ?? 'development',
    livekit: {
      apiKey: parseRequiredString(process.env.LIVEKIT_API_KEY, 'LIVEKIT_API_KEY'),
      apiSecret: parseRequiredString(process.env.LIVEKIT_API_SECRET, 'LIVEKIT_API_SECRET'),
      url: parseRequiredString(process.env.LIVEKIT_URL, 'LIVEKIT_URL'),
    } as const,
  } as const;
}

export { loadConfig, config };
