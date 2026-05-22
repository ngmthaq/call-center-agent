import { RoomServiceClient } from 'livekit-server-sdk';
import type { CreateOptions, Room } from 'livekit-server-sdk';
import { config } from '../config/env';

export class LiveKitRoomUtil {
  private readonly roomService: RoomServiceClient;

  constructor() {
    this.roomService = new RoomServiceClient(
      config.livekit.url,
      config.livekit.apiKey,
      config.livekit.apiSecret,
    );
  }

  /**
   * Creates a new LiveKit room with the supplied options.
   */
  public createRoom(opts: CreateOptions): Promise<Room> {
    return this.roomService.createRoom(opts);
  }

  /**
   * Lists active rooms; when names is omitted returns all rooms.
   */
  public listRooms(names?: string[]): Promise<Room[]> {
    return this.roomService.listRooms(names);
  }

  /**
   * Returns a single room by name, or null when no such room is active.
   */
  public async getRoom(name: string): Promise<Room | null> {
    const result = await this.listRooms([name]);
    return result[0] ?? null;
  }

  /**
   * Deletes the room and disconnects all participants.
   */
  public deleteRoom(name: string): Promise<void> {
    return this.roomService.deleteRoom(name);
  }

  /**
   * Updates the room's metadata field.
   */
  public updateRoomMetadata(name: string, metadata: string): Promise<Room> {
    return this.roomService.updateRoomMetadata(name, metadata);
  }
}

export const livekitRoomUtil = new LiveKitRoomUtil();
