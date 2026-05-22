/**
 * @file main.ts
 *
 * Agent entry point. Loads environment variables from .env.local — set
 * LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET when running locally
 * or self-hosting.
 *
 * Sets up a voice AI pipeline using Mistral (STT), Mistral (TTS), Silero
 * (VAD), and the LiveKit turn detector:
 *
 * - STT (Speech-to-text): agent's ears — turns user speech into text for the LLM.
 *   See all available models at https://docs.livekit.io/agents/models/stt/
 * - TTS (Text-to-speech): agent's voice — turns LLM text into audible speech.
 *   See all available models and voice selections at https://docs.livekit.io/agents/models/tts/
 * - VAD + turn detection: determines when the user is speaking and when the
 *   agent should respond. See https://docs.livekit.io/agents/build/turns
 * - preemptiveGeneration: allows the LLM to generate a response while waiting
 *   for end of turn.
 * - noiseCancellation: ai-coustics QUAIL audio enhancement — works for both
 *   WebRTC and telephony (SIP) participants.
 *
 * On entry: starts the session (initializes the pipeline and warms up models),
 * joins the room, and greets the user. Runs the agent server via cli.runApp.
 */
import { ServerOptions, cli, defineAgent, voice } from '@livekit/agents';
import * as livekit from '@livekit/agents-plugin-livekit';
import * as silero from '@livekit/agents-plugin-silero';
import { audioEnhancement } from '@livekit/plugins-ai-coustics';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { LLMAgent } from './agents';
import { ProviderType, providerFactory } from './agents/provider';
import type { ProcessUserData } from './types/process-user-data';

dotenv.config({ path: '.env.local' });

export default defineAgent<ProcessUserData>({
  prewarm: async (proc) => {
    proc.userData.vad = await silero.VAD.load();
  },

  entry: async (ctx) => {
    const session = new voice.AgentSession({
      stt: providerFactory.stt(ProviderType.MISTRAL),
      tts: providerFactory.tts(ProviderType.MISTRAL),
      turnDetection: new livekit.turnDetector.MultilingualModel(),
      vad: ctx.proc.userData.vad,
      voiceOptions: {
        preemptiveGeneration: true,
      },
    });

    await session.start({
      agent: new LLMAgent(),
      room: ctx.room,
      inputOptions: {
        noiseCancellation: audioEnhancement({
          model: 'quailVfS',
        }),
      },
    });

    await ctx.connect();

    session.generateReply({
      instructions: 'Greet the user in a helpful and friendly manner.',
    });
  },
});

cli.runApp(
  new ServerOptions({
    agent: fileURLToPath(import.meta.url),
  }),
);
