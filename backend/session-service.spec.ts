import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClientMessage, ServerMessage, SessionSnapshot } from '../shared/protocol';
import { MemorySessionStore } from './memory-session-store';
import { MAX_VOTERS, SESSION_TTL_SECONDS, SessionService } from './session-service';
import type { Broadcaster } from './session-store';

class RecordingBroadcaster implements Broadcaster {
  readonly inbox = new Map<string, ServerMessage[]>();
  readonly gone = new Set<string>();

  async send(connectionIds: readonly string[], message: ServerMessage): Promise<string[]> {
    const gone: string[] = [];

    for (const connectionId of connectionIds) {
      if (this.gone.has(connectionId)) {
        gone.push(connectionId);
        continue;
      }

      this.inbox.set(connectionId, [...(this.inbox.get(connectionId) ?? []), message]);
    }

    return gone;
  }

  last(connectionId: string): ServerMessage | undefined {
    return this.inbox.get(connectionId)?.at(-1);
  }

  lastSnapshot(connectionId: string): SessionSnapshot | undefined {
    const snapshots = (this.inbox.get(connectionId) ?? []).filter((message) => message.type === 'snapshot');
    const last = snapshots.at(-1);

    return last?.type === 'snapshot' ? last.snapshot : undefined;
  }
}

const VOTER_A = 'voter-aaaa-1111';
const VOTER_B = 'voter-bbbb-2222';

describe('SessionService', () => {
  let store: MemorySessionStore;
  let broadcaster: RecordingBroadcaster;
  let now: number;
  let service: SessionService;

  const send = (connectionId: string, message: ClientMessage) =>
    service.handleRawMessage(connectionId, JSON.stringify(message));

  async function createSession(connectionId = 'creator'): Promise<{ code: string; creatorToken: string }> {
    await send(connectionId, { action: 'createSession' });
    const reply = broadcaster.last(connectionId);

    if (reply?.type !== 'sessionCreated') {
      throw new Error(`Expected sessionCreated, got ${JSON.stringify(reply)}`);
    }

    return reply;
  }

  beforeEach(() => {
    store = new MemorySessionStore();
    broadcaster = new RecordingBroadcaster();
    now = Date.UTC(2026, 10, 16, 12);
    service = new SessionService({ store, broadcaster, now: () => now, logger: { error: vi.fn() } });
  });

  it('creates a session with a shareable code and a creator token', async () => {
    const { code, creatorToken } = await createSession();

    expect(code).toMatch(/^MS-[2-9A-HJKMNP-Z]{6}$/);
    expect(creatorToken.length).toBeGreaterThanOrEqual(43);
  });

  it('retries when a generated code is already taken', async () => {
    const codes = ['MS-AAAAAA', 'MS-AAAAAA', 'MS-BBBBBB'];
    service = new SessionService({ store, broadcaster, now: () => now, generateCode: () => codes.shift()! });

    expect((await createSession('first')).code).toBe('MS-AAAAAA');
    expect((await createSession('second')).code).toBe('MS-BBBBBB');
  });

  it('rejects joining a session that does not exist', async () => {
    await send('a', { action: 'join', code: 'MS-ZZZZZZ', voterId: VOTER_A });

    expect(broadcaster.last('a')).toEqual({
      type: 'error',
      reason: 'SESSION_NOT_FOUND',
      action: 'join',
      code: 'MS-ZZZZZZ',
    });
  });

  it('shares every vote with everyone in the session, anonymously and sorted', async () => {
    const { code } = await createSession();
    await send('a', { action: 'join', code, voterId: VOTER_A });
    await send('b', { action: 'join', code, voterId: VOTER_B });

    expect(broadcaster.inbox.get('a')).toContainEqual({ type: 'joined', code, round: 0, yourMood: null });

    await send('a', { action: 'vote', code, voterId: VOTER_A, mood: 90 });
    await send('b', { action: 'vote', code, voterId: VOTER_B, mood: 10 });

    const snapshot = broadcaster.lastSnapshot('a');
    expect(snapshot).toMatchObject({ code, status: 'open', moods: [10, 90], online: 2 });
    expect(broadcaster.lastSnapshot('b')).toEqual(snapshot);
    expect(JSON.stringify([...broadcaster.inbox.values()])).not.toContain(VOTER_A);
  });

  it('replaces a voter’s earlier vote', async () => {
    const { code } = await createSession();
    await send('a', { action: 'join', code, voterId: VOTER_A });
    await send('a', { action: 'vote', code, voterId: VOTER_A, mood: 90 });
    await send('a', { action: 'vote', code, voterId: VOTER_A, mood: 30 });

    expect(broadcaster.lastSnapshot('a')?.moods).toEqual([30]);
  });

  it('tells a returning voter their mood on a new connection', async () => {
    const { code } = await createSession();
    await send('a', { action: 'join', code, voterId: VOTER_A });
    await send('a', { action: 'vote', code, voterId: VOTER_A, mood: 64 });
    await service.handleDisconnect('a');
    await send('a2', { action: 'join', code, voterId: VOTER_A });

    expect(broadcaster.inbox.get('a2')).toContainEqual({ type: 'joined', code, round: 0, yourMood: 64 });
  });

  it('only lets the creator end the session, then locks votes', async () => {
    const { code, creatorToken } = await createSession();
    await send('a', { action: 'join', code, voterId: VOTER_A });
    await send('a', { action: 'vote', code, voterId: VOTER_A, mood: 70 });

    await send('a', { action: 'endSession', code, creatorToken: 'x'.repeat(43) });
    expect(broadcaster.last('a')).toMatchObject({ type: 'error', reason: 'FORBIDDEN' });

    now += 60_000;
    await send('creator', { action: 'endSession', code, creatorToken });
    expect(broadcaster.lastSnapshot('a')).toMatchObject({ status: 'closed', closedAt: now, moods: [70] });
    expect(broadcaster.lastSnapshot('creator')).toMatchObject({ status: 'closed' });

    await send('a', { action: 'vote', code, voterId: VOTER_A, mood: 10 });
    expect(broadcaster.last('a')).toMatchObject({ type: 'error', reason: 'SESSION_CLOSED' });
    expect((await store.loadSession(code))?.votes.get(VOTER_A)).toBe(70);
  });

  it('only lets the creator soothe, and only once the session has ended', async () => {
    const { code, creatorToken } = await createSession();
    await send('a', { action: 'join', code, voterId: VOTER_A });

    await send('creator', { action: 'soothe', code, creatorToken });
    expect(broadcaster.last('creator')).toMatchObject({ type: 'error', reason: 'SESSION_OPEN', action: 'soothe' });

    await send('creator', { action: 'endSession', code, creatorToken });
    await send('a', { action: 'soothe', code, creatorToken: 'x'.repeat(43) });
    expect(broadcaster.last('a')).toMatchObject({ type: 'error', reason: 'FORBIDDEN', action: 'soothe' });

    now += 5_000;
    const soothedAt = now;
    await send('creator', { action: 'soothe', code, creatorToken });
    expect(broadcaster.lastSnapshot('a')).toMatchObject({ status: 'closed', soothedAt });

    now += 5_000;
    await send('creator', { action: 'soothe', code, creatorToken });
    expect(broadcaster.lastSnapshot('a')?.soothedAt).toBe(soothedAt);
  });

  it('restarts an ended session under the same code with no moods', async () => {
    const { code, creatorToken } = await createSession();
    await send('a', { action: 'join', code, voterId: VOTER_A });
    await send('a', { action: 'vote', code, voterId: VOTER_A, mood: 70 });

    await send('creator', { action: 'restartSession', code, creatorToken });
    expect(broadcaster.last('creator')).toMatchObject({ type: 'error', reason: 'SESSION_OPEN' });

    await send('creator', { action: 'endSession', code, creatorToken });
    await send('creator', { action: 'soothe', code, creatorToken });
    await send('a', { action: 'restartSession', code, creatorToken: 'x'.repeat(43) });
    expect(broadcaster.last('a')).toMatchObject({ type: 'error', reason: 'FORBIDDEN' });

    now += 23 * 60 * 60 * 1000;
    await send('creator', { action: 'restartSession', code, creatorToken });
    const snapshot = broadcaster.lastSnapshot('a');
    expect(snapshot).toMatchObject({ code, status: 'open', round: 1, moods: [] });
    expect(snapshot).not.toHaveProperty('closedAt');
    expect(snapshot).not.toHaveProperty('soothedAt');

    // The old vote is gone for good: rejoining finds no mood, and the session lives on past its first day.
    now += 2 * 60 * 60 * 1000;
    await send('a2', { action: 'join', code, voterId: VOTER_A });
    expect(broadcaster.inbox.get('a2')).toContainEqual({ type: 'joined', code, round: 1, yourMood: null });
    await send('a2', { action: 'vote', code, voterId: VOTER_A, mood: 20 });
    expect(broadcaster.lastSnapshot('a2')).toMatchObject({ moods: [20], round: 1 });
  });

  it('caps the number of voters but lets existing voters change their mood', async () => {
    const { code } = await createSession();

    for (let index = 0; index < MAX_VOTERS; index += 1) {
      await send('a', { action: 'vote', code, voterId: `voter-${String(index).padStart(8, '0')}`, mood: 50 });
    }

    await send('a', { action: 'vote', code, voterId: 'voter-one-too-many', mood: 50 });
    expect(broadcaster.last('a')).toMatchObject({ type: 'error', reason: 'SESSION_FULL' });

    await send('a', { action: 'vote', code, voterId: 'voter-00000000', mood: 99 });
    expect(broadcaster.last('a')).toMatchObject({ type: 'snapshot' });
  });

  it('treats an expired session as not found', async () => {
    const { code } = await createSession();
    now += SESSION_TTL_SECONDS * 1000;

    await send('a', { action: 'join', code, voterId: VOTER_A });
    expect(broadcaster.last('a')).toMatchObject({ type: 'error', reason: 'SESSION_NOT_FOUND' });
  });

  it('updates the online count when someone leaves', async () => {
    const { code } = await createSession();
    await send('a', { action: 'join', code, voterId: VOTER_A });
    await send('b', { action: 'join', code, voterId: VOTER_B });
    await service.handleDisconnect('b');

    expect(broadcaster.lastSnapshot('a')?.online).toBe(1);
  });

  it('moves a connection out of its previous session when it joins another', async () => {
    const first = await createSession('c1');
    const second = await createSession('c2');
    await send('a', { action: 'join', code: first.code, voterId: VOTER_A });
    await send('b', { action: 'join', code: first.code, voterId: VOTER_B });
    await send('a', { action: 'join', code: second.code, voterId: VOTER_A });

    expect(broadcaster.lastSnapshot('b')).toMatchObject({ code: first.code, online: 1 });
    expect((await store.loadSession(second.code))?.connectionIds).toEqual(['a']);
  });

  it('forgets connections that have gone away', async () => {
    const { code } = await createSession();
    await send('a', { action: 'join', code, voterId: VOTER_A });
    await send('b', { action: 'join', code, voterId: VOTER_B });
    broadcaster.gone.add('b');

    await send('a', { action: 'vote', code, voterId: VOTER_A, mood: 20 });

    expect((await store.loadSession(code))?.connectionIds).toEqual(['a']);
  });

  it('answers pings and rejects malformed frames', async () => {
    await send('a', { action: 'ping' });
    expect(broadcaster.last('a')).toEqual({ type: 'pong' });

    await service.handleRawMessage('a', '{"action":"vote","mood":"lots"}');
    expect(broadcaster.last('a')).toEqual({ type: 'error', reason: 'INVALID_MESSAGE' });
  });

  it('reports unexpected failures to the sender instead of throwing', async () => {
    vi.spyOn(store, 'loadSession').mockRejectedValue(new Error('boom'));

    await send('a', { action: 'join', code: 'MS-ZZZZZZ', voterId: VOTER_A });
    expect(broadcaster.last('a')).toEqual({ type: 'error', reason: 'INTERNAL', action: 'join' });
  });
});
