import { getWeather } from './getWeather';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const tools: Record<string, any> = {
  getWeather,
} as const;
