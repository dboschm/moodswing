import { isMood } from './mood';

/**
 * Messages between the browser and the backend over the WebSocket.
 * API Gateway routes client messages by their `action` field.
 */

/** No 0/O, 1/I/L so codes survive being read out loud. */
export const SESSION_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const SESSION_CODE_PREFIX = 'MS-';
export const SESSION_CODE_LENGTH = 6;
const SESSION_CODE_PATTERN = /^MS-[2-9A-HJKMNP-Z]{6}$/;
const VOTER_ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/;
const CREATOR_TOKEN_PATTERN = /^[A-Za-z0-9_-]{20,128}$/;
const MAX_MESSAGE_LENGTH = 2048;

/** Where the Vite dev server serves the in-memory backend. */
export const DEV_WEBSOCKET_PATH = '/dev-ws';

export type ClientMessage =
  | { action: 'createSession' }
  | { action: 'join'; code: string; voterId: string }
  | { action: 'vote'; code: string; voterId: string; mood: number }
  | { action: 'endSession'; code: string; creatorToken: string }
  | { action: 'soothe'; code: string; creatorToken: string }
  | { action: 'restartSession'; code: string; creatorToken: string }
  | { action: 'ping' };

export type ClientAction = ClientMessage['action'];

export type SessionStatus = 'open' | 'closed';

export interface SessionSnapshot {
  code: string;
  status: SessionStatus;
  /** Every voter's mood, sorted ascending so the order gives nobody away. */
  moods: number[];
  /** Connections currently in the session. */
  online: number;
  createdAt: number;
  /** Goes up each time the creator starts the session again with no moods. */
  round: number;
  closedAt?: number;
  /** When the creator let every swing settle into Content after closing. */
  soothedAt?: number;
}

export type ErrorReason =
  | 'SESSION_NOT_FOUND'
  | 'SESSION_CLOSED'
  | 'SESSION_OPEN'
  | 'SESSION_FULL'
  | 'FORBIDDEN'
  | 'INVALID_MESSAGE'
  | 'INTERNAL';

export type ServerMessage =
  | { type: 'sessionCreated'; code: string; creatorToken: string }
  | { type: 'joined'; code: string; round: number; yourMood: number | null }
  | { type: 'snapshot'; snapshot: SessionSnapshot }
  | { type: 'pong' }
  | { type: 'error'; reason: ErrorReason; action?: ClientAction; code?: string };

export function isSessionCode(value: unknown): value is string {
  return typeof value === 'string' && SESSION_CODE_PATTERN.test(value);
}

/** Accepts what people type ("k7q4xz", "ms-K7Q4XZ ") and returns the canonical code. */
export function normalizeSessionCode(input: string): string | null {
  const compact = input.trim().toUpperCase().replace(/\s+/g, '');
  const code = compact.startsWith(SESSION_CODE_PREFIX) ? compact : `${SESSION_CODE_PREFIX}${compact}`;

  return isSessionCode(code) ? code : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isVoterId(value: unknown): value is string {
  return typeof value === 'string' && VOTER_ID_PATTERN.test(value);
}

function isCreatorToken(value: unknown): value is string {
  return typeof value === 'string' && CREATOR_TOKEN_PATTERN.test(value);
}

/** Validates an untrusted client message; returns null for anything malformed. */
export function parseClientMessage(raw: string): ClientMessage | null {
  if (raw.length > MAX_MESSAGE_LENGTH) {
    return null;
  }

  let data: unknown;

  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isRecord(data)) {
    return null;
  }

  switch (data.action) {
    case 'createSession':
    case 'ping':
      return { action: data.action };
    case 'join':
      return isSessionCode(data.code) && isVoterId(data.voterId)
        ? { action: 'join', code: data.code, voterId: data.voterId }
        : null;
    case 'vote':
      return isSessionCode(data.code) && isVoterId(data.voterId) && isMood(data.mood)
        ? { action: 'vote', code: data.code, voterId: data.voterId, mood: data.mood }
        : null;
    case 'endSession':
    case 'soothe':
    case 'restartSession':
      return isSessionCode(data.code) && isCreatorToken(data.creatorToken)
        ? { action: data.action, code: data.code, creatorToken: data.creatorToken }
        : null;
    default:
      return null;
  }
}

/** The server is trusted, so this only guards against garbage frames. */
export function parseServerMessage(raw: string): ServerMessage | null {
  try {
    const data: unknown = JSON.parse(raw);
    return isRecord(data) && typeof data.type === 'string' ? (data as ServerMessage) : null;
  } catch {
    return null;
  }
}
