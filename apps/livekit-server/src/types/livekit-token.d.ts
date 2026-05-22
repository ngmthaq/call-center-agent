import type { VideoGrant } from 'livekit-server-sdk';

export interface CreateAccessTokenInput {
  roomName: string;
  identity: string;
  name?: string;
  metadata?: string;
  ttl?: string | number;
  grants?: VideoGrant;
}
