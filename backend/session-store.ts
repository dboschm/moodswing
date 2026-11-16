import type { ServerMessage, SessionStatus } from '../shared/protocol';

export interface SessionMeta {
  code: string;
  status: SessionStatus;
  createdAt: number;
  closedAt?: number;
  creatorTokenHash: string;
  /** Epoch seconds, as DynamoDB TTL expects. */
  expiresAt: number;
}

export interface SessionState {
  meta: SessionMeta;
  /** voterId → mood */
  votes: Map<string, number>;
  connectionIds: string[];
}

export interface SessionStore {
  /** Returns false when a session with the same code already exists. */
  createSession(meta: SessionMeta): Promise<boolean>;
  loadSession(code: string): Promise<SessionState | null>;
  putVote(code: string, voterId: string, mood: number, updatedAt: number, expiresAt: number): Promise<void>;
  closeSession(code: string, closedAt: number): Promise<void>;
  /** Moves a connection into a session; returns the session it was in before, if any. */
  attachConnection(connectionId: string, code: string, expiresAt: number): Promise<string | undefined>;
  /** Forgets a connection; returns the session it was in, if any. */
  detachConnection(connectionId: string): Promise<string | undefined>;
}

export interface Broadcaster {
  /** Sends a message to each connection and returns the ones that no longer exist. */
  send(connectionIds: readonly string[], message: ServerMessage): Promise<string[]>;
}
