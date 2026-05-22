export interface HealthStatus {
  readonly status: 'ok';
}

export const getHealthStatus = (): HealthStatus => ({ status: 'ok' as const });
