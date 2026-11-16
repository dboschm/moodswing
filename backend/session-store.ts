import type { ServerMessage, SessionStatus } from '../shared/protocol';

export interface SessionMeta {
  code: string;
  status: SessionStatus;
  createdAt: number;
  /** Starts at 0 and goes up on every restart; only votes from the current round count. */
  round: number;
  closedAt?: number;
  soothedAt?: number;
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
  putVote(code: string, voterId: string, mood: number, round: number, updatedAt: number, expiresAt: number): Promise<void>;
  closeSession(code: string, closedAt: number): Promise<void>;
  sootheSession(code: string, soothedAt: number): Promise<void>;
  /** Reopens a closed session as a new round with no votes, expiring later. */
  restartSession(code: string, round: number, expiresAt: number): Promise<void>;
  /** Moves a connection into a session; returns the session it was in before, if any. */
  attachConnection(connectionId: string, code: string, expiresAt: number): Promise<string | undefined>;
  /** Forgets a connection; returns the session it was in, if any. */
  detachConnection(connectionId: string): Promise<string | undefined>;
}

export interface Broadcaster {
  /** Sends a message to each connection and returns the ones that no longer exist. */
  send(connectionIds: readonly string[], message: ServerMessage): Promise<string[]>;
}
