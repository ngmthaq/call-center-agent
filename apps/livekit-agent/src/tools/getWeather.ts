import { dedent, llm } from '@livekit/agents';
import z from 'zod';

export const getWeather = llm.tool({
  description: dedent`
        Use this tool to look up current weather information in the given location.
        If the location is not supported by the weather service, the tool will indicate this.
        You must tell the user the location's weather is unavailable.
    `.trim(),
  parameters: z.object({
    location: z
      .string()
      .describe('The location to look up weather information for (e.g. city name)'),
  }),
  execute: async ({ location }) => {
    console.log(`Looking up weather for ${location}`);
    return 'sunny with a temperature of 70 degrees.';
  },
});
