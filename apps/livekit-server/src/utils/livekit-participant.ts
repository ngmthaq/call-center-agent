import { RoomServiceClient } from 'livekit-server-sdk';
import type { ParticipantInfo, ParticipantPermission } from 'livekit-server-sdk';
import { config } from '../config/env';

export class LiveKitParticipantUtil {
  private readonly roomService: RoomServiceClient;

  constructor() {
    this.roomService = new RoomServiceClient(
      config.livekit.url,
      config.livekit.apiKey,
      config.livekit.apiSecret,
    );
  }

  /**
   * Lists all participants currently connected to the given room.
   */
  public listParticipants(room: string): Promise<ParticipantInfo[]> {
    return this.roomService.listParticipants(room);
  }

  /**
   * Fetches a single participant's info including published tracks.
   */
  public getParticipant(room: string, identity: string): Promise<ParticipantInfo> {
    return this.roomService.getParticipant(room, identity);
  }

  /**
   * Disconnects a participant from the room.
   */
  public removeParticipant(room: string, identity: string): Promise<void> {
    return this.roomService.removeParticipant(room, identity);
  }

  /**
   * Updates a participant's metadata string.
   */
  public updateParticipantMetadata(
    room: string,
    identity: string,
    metadata: string,
  ): Promise<ParticipantInfo> {
    return this.roomService.updateParticipant(room, identity, metadata);
  }

  /**
   * Replaces a participant's permission set atomically.
   */
  public updateParticipantPermissions(
    room: string,
    identity: string,
    permission: ParticipantPermission,
  ): Promise<ParticipantInfo> {
    return this.roomService.updateParticipant(room, identity, undefined, permission);
  }

  /**
   * Mutes or unmutes a published track owned by the participant.
   */
  public async mutePublishedTrack(
    room: string,
    identity: string,
    trackSid: string,
    muted: boolean,
  ): Promise<void> {
    await this.roomService.mutePublishedTrack(room, identity, trackSid, muted);
  }
}

export const livekitParticipantUtil = new LiveKitParticipantUtil();
