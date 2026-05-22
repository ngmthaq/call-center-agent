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

export function llmFactory(type: ProviderType) {
  switch (type) {
    case ProviderType.INFERENCE:
      return new inference.LLM({ model: 'gemini-2.0-flash' });

    case ProviderType.OPENAI:
      return new openai.LLM({ model: 'gpt-4' });

    case ProviderType.GOOGLE:
      return new google.LLM({ model: 'gemini-pro' });

    case ProviderType.MISTRAL:
      return new mistral.LLM({ model: 'mistral-small-latest' });

    default:
      throw new Error(`Unsupported provider type: ${type}`);
  }
}

export function sttFactory(type: ProviderType) {
  switch (type) {
    case ProviderType.INFERENCE:
      return new inference.STT({ model: 'whisper-1' });

    case ProviderType.OPENAI:
      return new openai.STT({ model: 'whisper-1' });

    case ProviderType.DEEPGRAM:
      return new deepgram.STT({ model: 'base' });

    case ProviderType.ELEVEN:
      return new eleven.STT({ modelId: 'scribe_v1' });

    case ProviderType.MISTRAL:
      return new mistral.STT({ model: 'voxtral-mini-transcribe-realtime-2602', language: 'multi' });

    case ProviderType.XAI:
      return new xai.STT();

    default:
      throw new Error(`Unsupported provider type: ${type}`);
  }
}

export function ttsFactory(type: ProviderType) {
  switch (type) {
    case ProviderType.INFERENCE:
      return new inference.TTS({ model: 'tts-1' });

    case ProviderType.OPENAI:
      return new openai.TTS({ model: 'tts-1' });

    case ProviderType.ELEVEN:
      return new eleven.TTS({ model: 'eleven_multilingual_v1' });

    case ProviderType.CARTESIA:
      return new cartesia.TTS({ model: 'cartesia:alloy' });

    case ProviderType.NEUPHONIC:
      return new neuphonic.TTS({ model: 'neuphonic:eva' });

    case ProviderType.RESEMBLE:
      return new resemble.TTS({ model: 'chatterbox' });

    case ProviderType.RIME:
      return new rime.TTS({ model: 'rime:luma' });

    case ProviderType.INWORLD:
      return new inworld.TTS({ model: 'inworld:emma' });

    case ProviderType.MISTRAL:
      return new mistral.TTS({ model: 'voxtral-mini-tts-latest', voice: 'en_paul_neutral' });

    case ProviderType.FISH:
      return new fish.TTS({ model: 'fish:lucy' });

    case ProviderType.HUME:
      return new hume.TTS();

    default:
      throw new Error(`Unsupported provider type: ${type}`);
  }
}

export const providerFactory = {
  llm: llmFactory,
  stt: sttFactory,
  tts: ttsFactory,
};
