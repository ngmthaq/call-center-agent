import { type JobContext, defineAgent } from '@livekit/agents';
import { RoomEvent, type RemoteParticipant } from '@livekit/rtc-node';

import { loadConfig } from './config';
import { createLogger } from './logger';

export const agentName: string = (process.env.AGENT_NAME ?? '').trim();

export const agent = defineAgent({
  entry: async (ctx: JobContext): Promise<void> => {
    const config = loadConfig();
    const log = createLogger('agent-worker', { level: config.logLevel });

    const room = ctx.room;
    const jobId = ctx.job.id;
    const roomName = room.name ?? ctx.job.room?.name ?? 'unknown';

    log.info({ jobId, roomName, agentName: config.agentName }, 'agent entrypoint started');

    room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
      log.info(
        {
          jobId,
          roomName,
          identity: participant.identity,
          kind: participant.kind,
        },
        'participant_joined',
      );
    });

    room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
      log.info(
        {
          jobId,
          roomName,
          identity: participant.identity,
          kind: participant.kind,
        },
        'participant_left',
      );
    });

    ctx.addShutdownCallback(() => {
      log.info({ jobId, roomName }, 'agent entrypoint shutting down');
      return Promise.resolve();
    });

    await ctx.connect();
    log.info({ jobId, roomName }, 'agent connected to room');
  },
});

export default agent;
