import { inference } from '@livekit/agents';
import * as cartesia from '@livekit/agents-plugin-cartesia';
import * as deepgram from '@livekit/agents-plugin-deepgram';
import * as eleven from '@livekit/agents-plugin-elevenlabs';
import * as fish from '@livekit/agents-plugin-fishaudio';
import * as google from '@livekit/agents-plugin-google';
import * as hume from '@livekit/agents-plugin-hume';
import * as inworld from '@livekit/agents-plugin-inworld';
import * as mistral from '@livekit/agents-plugin-mistralai';
import * as neuphonic from '@livekit/agents-plugin-neuphonic';
import * as openai from '@livekit/agents-plugin-openai';
import * as resemble from '@livekit/agents-plugin-resemble';
import * as rime from '@livekit/agents-plugin-rime';
import * as xai from '@livekit/agents-plugin-xai';

export enum ProviderType {
  INFERENCE,
  OPENAI,
  GOOGLE,
  DEEPGRAM,
  ELEVEN,
  CARTESIA,
  NEUPHONIC,
  RESEMBLE,
  RIME,
  INWORLD,
  MISTRAL,
  XAI,
  FISH,
  HUME,
}

const LLM_REGISTRY = {
  [ProviderType.INFERENCE]: () => new inference.LLM({ model: 'gemini-2.0-flash' }),
  [ProviderType.OPENAI]: () => new openai.LLM({ model: 'gpt-4' }),
  [ProviderType.GOOGLE]: () => new google.LLM({ model: 'gemini-pro' }),
  [ProviderType.MISTRAL]: () => new mistral.LLM({ model: 'mistral-small-latest' }),
} satisfies Partial<Record<ProviderType, () => unknown>>;

const STT_REGISTRY = {
  [ProviderType.INFERENCE]: () => new inference.STT({ model: 'whisper-1' }),
  [ProviderType.OPENAI]: () => new openai.STT({ model: 'whisper-1' }),
  [ProviderType.DEEPGRAM]: () => new deepgram.STT({ model: 'base' }),
  [ProviderType.ELEVEN]: () => new eleven.STT({ modelId: 'scribe_v1' }),
  [ProviderType.MISTRAL]: () =>
    new mistral.STT({ model: 'voxtral-mini-transcribe-realtime-2602', language: 'multi' }),
  [ProviderType.XAI]: () => new xai.STT(),
} satisfies Partial<Record<ProviderType, () => unknown>>;

const TTS_REGISTRY = {
  [ProviderType.INFERENCE]: () => new inference.TTS({ model: 'tts-1' }),
  [ProviderType.OPENAI]: () => new openai.TTS({ model: 'tts-1' }),
  [ProviderType.ELEVEN]: () => new eleven.TTS({ model: 'eleven_multilingual_v1' }),
  [ProviderType.CARTESIA]: () => new cartesia.TTS({ model: 'cartesia:alloy' }),
  [ProviderType.NEUPHONIC]: () => new neuphonic.TTS({ model: 'neuphonic:eva' }),
  [ProviderType.RESEMBLE]: () => new resemble.TTS({ model: 'chatterbox' }),
  [ProviderType.RIME]: () => new rime.TTS({ model: 'rime:luma' }),
  [ProviderType.INWORLD]: () => new inworld.TTS({ model: 'inworld:emma' }),
  [ProviderType.MISTRAL]: () =>
    new mistral.TTS({ model: 'voxtral-mini-tts-latest', voice: 'en_paul_neutral' }),
  [ProviderType.FISH]: () => new fish.TTS({ model: 'fish:lucy' }),
  [ProviderType.HUME]: () => new hume.TTS(),
} satisfies Partial<Record<ProviderType, () => unknown>>;

export function llmFactory(type: ProviderType) {
  const factory = LLM_REGISTRY[type as keyof typeof LLM_REGISTRY];
  if (factory === undefined) {
    throw new Error(`Unsupported provider type: ${type}`);
  }
  return factory();
}

export function sttFactory(type: ProviderType) {
  const factory = STT_REGISTRY[type as keyof typeof STT_REGISTRY];
  if (factory === undefined) {
    throw new Error(`Unsupported provider type: ${type}`);
  }
  return factory();
}

export function ttsFactory(type: ProviderType) {
  const factory = TTS_REGISTRY[type as keyof typeof TTS_REGISTRY];
  if (factory === undefined) {
    throw new Error(`Unsupported provider type: ${type}`);
  }
  return factory();
}

export const providerFactory = {
  llm: llmFactory,
  stt: sttFactory,
  tts: ttsFactory,
};
