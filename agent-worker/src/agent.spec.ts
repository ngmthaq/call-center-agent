/**
 * Smoke spec for `./agent.ts`.
 *
 * Goals:
 *  - Verify the module can be imported without starting any Worker or making
 *    network calls.
 *  - Verify the default export shape and the `agentName` named export.
 *
 * The `@livekit/agents` and `@livekit/rtc-node` SDKs are mocked so that
 * `defineAgent` is a pure identity wrapper and `RoomEvent` is a static
 * lookup table. No real Worker is constructed; the module simply evaluates.
 */

jest.mock('@livekit/agents', () => ({
  defineAgent: (cfg: unknown): unknown => cfg,
}));

jest.mock('@livekit/rtc-node', () => ({
  RoomEvent: {
    ParticipantConnected: 'pc',
    ParticipantDisconnected: 'pd',
  },
}));

describe('agent module — import shape', () => {
  const ORIGINAL_AGENT_NAME = process.env.AGENT_NAME;

  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    if (ORIGINAL_AGENT_NAME === undefined) {
      delete process.env.AGENT_NAME;
    } else {
      process.env.AGENT_NAME = ORIGINAL_AGENT_NAME;
    }
  });

  it('loads dynamically without throwing or starting a Worker', async () => {
    // Arrange
    process.env.AGENT_NAME = 'assistant';

    // Act
    const act = async (): Promise<unknown> => await import('./agent');

    // Assert
    await expect(act()).resolves.toBeDefined();
  });

  it('default-exports a non-null object (the defineAgent config)', async () => {
    // Arrange
    process.env.AGENT_NAME = 'assistant';

    // Act
    const mod = await import('./agent');

    // Assert
    expect(typeof mod.default).toBe('object');
    expect(mod.default).not.toBeNull();
  });

  it('exposes agentName equal to process.env.AGENT_NAME when set', async () => {
    // Arrange
    process.env.AGENT_NAME = 'assistant';

    // Act
    const mod = await import('./agent');

    // Assert
    expect(mod.agentName).toBe('assistant');
  });

  it('exposes an empty agentName when AGENT_NAME is not set', async () => {
    // Arrange
    delete process.env.AGENT_NAME;

    // Act
    const mod = await import('./agent');

    // Assert
    expect(mod.agentName).toBe('');
  });
});
