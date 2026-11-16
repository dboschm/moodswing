import {
  parseClientMessage,
  type ClientAction,
  type ClientMessage,
  type ErrorReason,
  type ServerMessage,
  type SessionSnapshot,
} from '../shared/protocol';
import {
  creatorTokenMatches,
  generateCreatorToken,
  generateSessionCode,
  hashCreatorToken,
} from './session-code';
import type { Broadcaster, SessionState, SessionStore } from './session-store';

export const SESSION_TTL_SECONDS = 24 * 60 * 60;
/** API Gateway drops WebSocket connections after 2 hours, so this only cleans up leaks. */
export const CONNECTION_TTL_SECONDS = 3 * 60 * 60;
export const MAX_VOTERS = 200;
const CREATE_ATTEMPTS = 5;

export interface SessionServiceOptions {
  store: SessionStore;
  broadcaster: Broadcaster;
  now?: () => number;
  generateCode?: () => string;
  generateToken?: () => string;
  logger?: Pick<Console, 'error'>;
}

function toEpochSeconds(millis: number): number {
  return Math.floor(millis / 1000);
}

function toSnapshot(state: SessionState): SessionSnapshot {
  const { meta } = state;

  return {
    code: meta.code,
    status: meta.status,
    moods: [...state.votes.values()].sort((a, b) => a - b),
    online: state.connectionIds.length,
    createdAt: meta.createdAt,
    round: meta.round,
    ...(meta.closedAt === undefined ? {} : { closedAt: meta.closedAt }),
    ...(meta.soothedAt === undefined ? {} : { soothedAt: meta.soothedAt }),
  };
}

/**
 * The mood session rules, independent of how messages arrive: the Lambda
 * handler and the Vite dev server both drive this.
 */
export class SessionService {
  private readonly store: SessionStore;
  private readonly broadcaster: Broadcaster;
  private readonly now: () => number;
  private readonly generateCode: () => string;
  private readonly generateToken: () => string;
  private readonly logger: Pick<Console, 'error'>;

  constructor(options: SessionServiceOptions) {
    this.store = options.store;
    this.broadcaster = options.broadcaster;
    this.now = options.now ?? Date.now;
    this.generateCode = options.generateCode ?? (() => generateSessionCode());
    this.generateToken = options.generateToken ?? generateCreatorToken;
    this.logger = options.logger ?? console;
  }

  /** Validates and handles one raw frame. Never throws; failures are reported to the sender. */
  async handleRawMessage(connectionId: string, raw: string): Promise<void> {
    const message = parseClientMessage(raw);

    if (!message) {
      await this.fail(connectionId, 'INVALID_MESSAGE');
      return;
    }

    try {
      await this.handleMessage(connectionId, message);
    } catch (error) {
      this.logger.error(`Failed to handle ${message.action}`, error);
      await this.fail(connectionId, 'INTERNAL', message.action).catch(() => undefined);
    }
  }

  async handleMessage(connectionId: string, message: ClientMessage): Promise<void> {
    switch (message.action) {
      case 'createSession':
        return this.createSession(connectionId);
      case 'join':
        return this.join(connectionId, message.code, message.voterId);
      case 'vote':
        return this.vote(connectionId, message.code, message.voterId, message.mood);
      case 'endSession':
        return this.endSession(connectionId, message.code, message.creatorToken);
      case 'soothe':
        return this.soothe(connectionId, message.code, message.creatorToken);
      case 'restartSession':
        return this.restartSession(connectionId, message.code, message.creatorToken);
      case 'ping':
        return this.reply(connectionId, { type: 'pong' });
    }
  }

  async handleDisconnect(connectionId: string): Promise<void> {
    const code = await this.store.detachConnection(connectionId);
    const state = code ? await this.loadLiveSession(code) : null;

    if (state) {
      await this.broadcastSnapshot(state);
    }
  }

  private async createSession(connectionId: string): Promise<void> {
    for (let attempt = 0; attempt < CREATE_ATTEMPTS; attempt += 1) {
      const code = this.generateCode();
      const creatorToken = this.generateToken();
      const createdAt = this.now();
      const created = await this.store.createSession({
        code,
        status: 'open',
        createdAt,
        round: 0,
        creatorTokenHash: hashCreatorToken(creatorToken),
        expiresAt: toEpochSeconds(createdAt) + SESSION_TTL_SECONDS,
      });

      if (created) {
        await this.reply(connectionId, { type: 'sessionCreated', code, creatorToken });
        return;
      }
    }

    throw new Error(`No free session code after ${CREATE_ATTEMPTS} attempts`);
  }

  private async join(connectionId: string, code: string, voterId: string): Promise<void> {
    const state = await this.loadLiveSession(code);

    if (!state) {
      await this.fail(connectionId, 'SESSION_NOT_FOUND', 'join', code);
      return;
    }

    const previousCode = await this.store.attachConnection(
      connectionId,
      code,
      toEpochSeconds(this.now()) + CONNECTION_TTL_SECONDS,
    );

    if (!state.connectionIds.includes(connectionId)) {
      state.connectionIds.push(connectionId);
    }

    await this.reply(connectionId, {
      type: 'joined',
      code,
      round: state.meta.round,
      yourMood: state.votes.get(voterId) ?? null,
    });
    await this.broadcastSnapshot(state);

    const previousState = previousCode && previousCode !== code ? await this.loadLiveSession(previousCode) : null;

    if (previousState) {
      await this.broadcastSnapshot(previousState);
    }
  }

  private async vote(connectionId: string, code: string, voterId: string, mood: number): Promise<void> {
    const state = await this.loadLiveSession(code);

    if (!state) {
      await this.fail(connectionId, 'SESSION_NOT_FOUND', 'vote', code);
      return;
    }

    if (state.meta.status === 'closed') {
      await this.fail(connectionId, 'SESSION_CLOSED', 'vote', code);
      return;
    }

    if (!state.votes.has(voterId) && state.votes.size >= MAX_VOTERS) {
      await this.fail(connectionId, 'SESSION_FULL', 'vote', code);
      return;
    }

    await this.store.putVote(code, voterId, mood, state.meta.round, this.now(), state.meta.expiresAt);
    state.votes.set(voterId, mood);
    await this.broadcastSnapshot(state, connectionId);
  }

  private async endSession(connectionId: string, code: string, creatorToken: string): Promise<void> {
    const state = await this.loadForCreator(connectionId, 'endSession', code, creatorToken);

    if (!state) {
      return;
    }

    if (state.meta.status === 'open') {
      const closedAt = this.now();

      await this.store.closeSession(code, closedAt);
      state.meta = { ...state.meta, status: 'closed', closedAt };
    }

    await this.broadcastSnapshot(state, connectionId);
  }

  /** Lets every swing settle into Content; only once the session has ended. */
  private async soothe(connectionId: string, code: string, creatorToken: string): Promise<void> {
    const state = await this.loadForCreator(connectionId, 'soothe', code, creatorToken);

    if (!state) {
      return;
    }

    if (state.meta.status === 'open') {
      await this.fail(connectionId, 'SESSION_OPEN', 'soothe', code);
      return;
    }

    if (state.meta.soothedAt === undefined) {
      const soothedAt = this.now();

      await this.store.sootheSession(code, soothedAt);
      state.meta = { ...state.meta, soothedAt };
    }

    await this.broadcastSnapshot(state, connectionId);
  }

  /** Reopens an ended session under the same code, with no moods, so the link can be reused. */
  private async restartSession(connectionId: string, code: string, creatorToken: string): Promise<void> {
    const state = await this.loadForCreator(connectionId, 'restartSession', code, creatorToken);

    if (!state) {
      return;
    }

    if (state.meta.status === 'open') {
      await this.fail(connectionId, 'SESSION_OPEN', 'restartSession', code);
      return;
    }

    const round = state.meta.round + 1;
    const expiresAt = toEpochSeconds(this.now()) + SESSION_TTL_SECONDS;
    const { closedAt: _closedAt, soothedAt: _soothedAt, ...meta } = state.meta;

    await this.store.restartSession(code, round, expiresAt);
    state.meta = { ...meta, status: 'open', round, expiresAt };
    state.votes.clear();
    await this.broadcastSnapshot(state, connectionId);
  }

  /** Loads a session for an action only its creator may take, telling the sender when they can't. */
  private async loadForCreator(
    connectionId: string,
    action: ClientAction,
    code: string,
    creatorToken: string,
  ): Promise<SessionState | null> {
    const state = await this.loadLiveSession(code);

    if (!state) {
      await this.fail(connectionId, 'SESSION_NOT_FOUND', action, code);
      return null;
    }

    if (!creatorTokenMatches(creatorToken, state.meta.creatorTokenHash)) {
      await this.fail(connectionId, 'FORBIDDEN', action, code);
      return null;
    }

    return state;
  }

  /** DynamoDB removes expired items lazily, so expiry is also enforced here. */
  private async loadLiveSession(code: string): Promise<SessionState | null> {
    const state = await this.store.loadSession(code);

    if (!state || state.meta.expiresAt <= toEpochSeconds(this.now())) {
      return null;
    }

    return state;
  }

  private async broadcastSnapshot(state: SessionState, alsoTo?: string): Promise<void> {
    const recipients = new Set(state.connectionIds);

    if (alsoTo) {
      recipients.add(alsoTo);
    }

    const gone = await this.broadcaster.send([...recipients], { type: 'snapshot', snapshot: toSnapshot(state) });

    await Promise.all(gone.map((connectionId) => this.store.detachConnection(connectionId)));
  }

  private async reply(connectionId: string, message: ServerMessage): Promise<void> {
    await this.broadcaster.send([connectionId], message);
  }

  private async fail(connectionId: string, reason: ErrorReason, action?: ClientAction, code?: string) {
    await this.reply(connectionId, {
      type: 'error',
      reason,
      ...(action ? { action } : {}),
      ...(code ? { code } : {}),
    });
  }
}
