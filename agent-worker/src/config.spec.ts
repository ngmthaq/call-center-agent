import { loadConfig, WorkerConfigError, type WorkerConfig } from './config';

type EnvOverrides = Record<string, string | undefined>;

const VALID_ENV: Readonly<EnvOverrides> = Object.freeze({
  LIVEKIT_URL: 'wss://example.livekit.cloud',
  LIVEKIT_API_KEY: 'api-key-123',
  LIVEKIT_API_SECRET: 'api-secret-456',
  AGENT_NAME: 'assistant',
  LOG_LEVEL: 'debug',
});

function makeEnv(overrides: EnvOverrides = {}): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...VALID_ENV };
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete env[key];
    } else {
      env[key] = value;
    }
  }
  return env;
}

describe('loadConfig — happy path', () => {
  it('returns a typed config with all matching values when env is valid', () => {
    // Arrange
    const env = makeEnv();

    // Act
    const config: WorkerConfig = loadConfig(env);

    // Assert
    expect(config).toEqual({
      livekitUrl: 'wss://example.livekit.cloud',
      livekitApiKey: 'api-key-123',
      livekitApiSecret: 'api-secret-456',
      agentName: 'assistant',
      logLevel: 'debug',
    });
  });

  it('returns a frozen object so callers cannot mutate it', () => {
    // Arrange
    const env = makeEnv();

    // Act
    const config = loadConfig(env);

    // Assert
    expect(Object.isFrozen(config)).toBe(true);
  });

  it('trims surrounding whitespace from required values', () => {
    // Arrange
    const env = makeEnv({
      LIVEKIT_URL: '  wss://example.livekit.cloud  ',
      LIVEKIT_API_KEY: '  api-key-123  ',
      LIVEKIT_API_SECRET: '  api-secret-456  ',
      AGENT_NAME: '  assistant  ',
    });

    // Act
    const config = loadConfig(env);

    // Assert
    expect(config).toMatchObject({
      livekitUrl: 'wss://example.livekit.cloud',
      livekitApiKey: 'api-key-123',
      livekitApiSecret: 'api-secret-456',
      agentName: 'assistant',
    });
  });
});

describe('loadConfig — missing required keys', () => {
  it.each([['LIVEKIT_URL'], ['LIVEKIT_API_KEY'], ['LIVEKIT_API_SECRET'], ['AGENT_NAME']] as const)(
    'throws WorkerConfigError when %s is undefined',
    (key) => {
      // Arrange
      const env = makeEnv({ [key]: undefined });

      // Act
      const act = (): WorkerConfig => loadConfig(env);

      // Assert
      expect(act).toThrow(WorkerConfigError);
    },
  );

  it.each([['LIVEKIT_URL'], ['LIVEKIT_API_KEY'], ['LIVEKIT_API_SECRET'], ['AGENT_NAME']] as const)(
    'throws WorkerConfigError when %s is blank/whitespace',
    (key) => {
      // Arrange
      const env = makeEnv({ [key]: '   ' });

      // Act
      const act = (): WorkerConfig => loadConfig(env);

      // Assert
      expect(act).toThrow(WorkerConfigError);
    },
  );

  it('lists every missing key in the error message', () => {
    // Arrange
    const env = makeEnv({
      LIVEKIT_URL: undefined,
      LIVEKIT_API_KEY: undefined,
      LIVEKIT_API_SECRET: undefined,
      AGENT_NAME: undefined,
    });

    // Act
    const act = (): WorkerConfig => loadConfig(env);

    // Assert
    expect(act).toThrow(/LIVEKIT_URL.*LIVEKIT_API_KEY.*LIVEKIT_API_SECRET.*AGENT_NAME/);
  });
});

describe('loadConfig — URL prefix validation', () => {
  it('accepts a ws:// URL', () => {
    // Arrange
    const env = makeEnv({ LIVEKIT_URL: 'ws://localhost:7880' });

    // Act
    const config = loadConfig(env);

    // Assert
    expect(config.livekitUrl).toBe('ws://localhost:7880');
  });

  it('accepts a wss:// URL', () => {
    // Arrange
    const env = makeEnv({ LIVEKIT_URL: 'wss://example.livekit.cloud' });

    // Act
    const config = loadConfig(env);

    // Assert
    expect(config.livekitUrl).toBe('wss://example.livekit.cloud');
  });

  it('throws WorkerConfigError when URL uses http://', () => {
    // Arrange
    const env = makeEnv({ LIVEKIT_URL: 'http://example.livekit.cloud' });

    // Act
    const act = (): WorkerConfig => loadConfig(env);

    // Assert
    expect(act).toThrow(WorkerConfigError);
  });

  it('throws WorkerConfigError when URL uses https://', () => {
    // Arrange
    const env = makeEnv({ LIVEKIT_URL: 'https://example.livekit.cloud' });

    // Act
    const act = (): WorkerConfig => loadConfig(env);

    // Assert
    expect(act).toThrow(WorkerConfigError);
  });

  it('throws WorkerConfigError when URL has no protocol', () => {
    // Arrange
    const env = makeEnv({ LIVEKIT_URL: 'example.livekit.cloud' });

    // Act
    const act = (): WorkerConfig => loadConfig(env);

    // Assert
    expect(act).toThrow(WorkerConfigError);
  });
});

describe('loadConfig — LOG_LEVEL handling', () => {
  it('defaults logLevel to "info" when LOG_LEVEL is undefined', () => {
    // Arrange
    const env = makeEnv({ LOG_LEVEL: undefined });

    // Act
    const config = loadConfig(env);

    // Assert
    expect(config.logLevel).toBe('info');
  });

  it('defaults logLevel to "info" when LOG_LEVEL is blank', () => {
    // Arrange
    const env = makeEnv({ LOG_LEVEL: '   ' });

    // Act
    const config = loadConfig(env);

    // Assert
    expect(config.logLevel).toBe('info');
  });

  it.each(['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const)(
    'accepts %s as a valid LOG_LEVEL',
    (level) => {
      // Arrange
      const env = makeEnv({ LOG_LEVEL: level });

      // Act
      const config = loadConfig(env);

      // Assert
      expect(config.logLevel).toBe(level);
    },
  );

  it('normalizes LOG_LEVEL casing to lowercase', () => {
    // Arrange
    const env = makeEnv({ LOG_LEVEL: 'DEBUG' });

    // Act
    const config = loadConfig(env);

    // Assert
    expect(config.logLevel).toBe('debug');
  });

  it('throws WorkerConfigError when LOG_LEVEL is unrecognized', () => {
    // Arrange
    const env = makeEnv({ LOG_LEVEL: 'shout' });

    // Act
    const act = (): WorkerConfig => loadConfig(env);

    // Assert
    expect(act).toThrow(WorkerConfigError);
  });
});
