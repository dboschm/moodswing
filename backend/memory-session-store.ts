import type { SessionMeta, SessionState, SessionStore } from './session-store';

interface StoredSession {
  meta: SessionMeta;
  votes: Map<string, number>;
  connectionIds: Set<string>;
}

/** Keeps everything in memory: used by the dev server and tests. */
export class MemorySessionStore implements SessionStore {
  private readonly sessions = new Map<string, StoredSession>();
  private readonly connections = new Map<string, string>();

  async createSession(meta: SessionMeta): Promise<boolean> {
    if (this.sessions.has(meta.code)) {
      return false;
    }

    this.sessions.set(meta.code, { meta: { ...meta }, votes: new Map(), connectionIds: new Set() });
    return true;
  }

  async loadSession(code: string): Promise<SessionState | null> {
    const session = this.sessions.get(code);

    if (!session) {
      return null;
    }

    return {
      meta: { ...session.meta },
      votes: new Map(session.votes),
      connectionIds: [...session.connectionIds],
    };
  }

  async putVote(code: string, voterId: string, mood: number): Promise<void> {
    this.sessions.get(code)?.votes.set(voterId, mood);
  }

  async closeSession(code: string, closedAt: number): Promise<void> {
    const session = this.sessions.get(code);

    if (session) {
      session.meta = { ...session.meta, status: 'closed', closedAt };
    }
  }

  async sootheSession(code: string, soothedAt: number): Promise<void> {
    const session = this.sessions.get(code);

    if (session) {
      session.meta = { ...session.meta, soothedAt };
    }
  }

  async restartSession(code: string, round: number, expiresAt: number): Promise<void> {
    const session = this.sessions.get(code);

    if (session) {
      const { closedAt: _closedAt, soothedAt: _soothedAt, ...meta } = session.meta;

      session.meta = { ...meta, status: 'open', round, expiresAt };
      session.votes.clear();
    }
  }

  async attachConnection(connectionId: string, code: string): Promise<string | undefined> {
    const previous = this.connections.get(connectionId);

    if (previous && previous !== code) {
      this.sessions.get(previous)?.connectionIds.delete(connectionId);
    }

    this.connections.set(connectionId, code);
    this.sessions.get(code)?.connectionIds.add(connectionId);
    return previous;
  }

  async detachConnection(connectionId: string): Promise<string | undefined> {
    const code = this.connections.get(connectionId);

    this.connections.delete(connectionId);

    if (code) {
      this.sessions.get(code)?.connectionIds.delete(connectionId);
    }

    return code;
  }
}
