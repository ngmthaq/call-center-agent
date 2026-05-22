/**
 * @file agent.ts
 *
 * Defines a custom voice AI assistant by extending the base Agent class.
 *
 * - LLM (Large Language Model): agent's brain — processes user input and generates responses.
 *   See all available models at https://docs.livekit.io/agents/models/llm/
 *
 * - To use a realtime model instead of a voice pipeline, replace the LLM with a
 *   RealtimeModel and remove STT/TTS from AgentSession.
 *   (Note: This is for the OpenAI Realtime API.
 *    For other providers, see https://docs.livekit.io/agents/models/realtime/)
 *   Steps:
 *   1. Install '@livekit/agents-plugin-openai'
 *   2. Set OPENAI_API_KEY in .env.local
 *   3. Add `import * as openai from '@livekit/agents-plugin-openai'` to this file
 *   4. Replace the llm option with: llm: new openai.realtime.RealtimeModel({ voice: 'marin' })
 *
 * - To add tools, specify `tools` in the constructor.
 *   Also add `import { llm } from '@livekit/agents'` and `import { z } from 'zod'`.
 *   See the commented-out `getWeather` example below.
 */
import { voice } from '@livekit/agents';
import { tools } from '../tools';
import { instructions } from './instructions';
import { ProviderType, providerFactory } from './provider';

export class LLMAgent extends voice.Agent {
  constructor() {
    super({
      instructions: instructions,
      llm: providerFactory.llm(ProviderType.MISTRAL),
      tools: tools,
    });
  }
}
