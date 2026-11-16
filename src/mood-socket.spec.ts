// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MoodSocket } from './mood-socket';

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  readyState = 0;
  sent: unknown[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this);
  }

  send(data: string) {
    this.sent.push(JSON.parse(data));
  }

  close() {
    this.readyState = 3;
    this.onclose?.();
  }

  open() {
    this.readyState = 1;
    this.onopen?.();
  }

  receive(message: unknown) {
    this.onmessage?.({ data: JSON.stringify(message) });
  }
}

const latest = () => FakeWebSocket.instances.at(-1)!;

describe('MoodSocket', () => {
  let socket: MoodSocket;

  beforeEach(async () => {
    vi.useFakeTimers();
    FakeWebSocket.instances = [];
    socket = new MoodSocket({
      resolveUrl: async () => 'ws://test/dev-ws',
      createWebSocket: (url) => new FakeWebSocket(url) as unknown as WebSocket,
      random: () => 1,
    });
    socket.start();
    await vi.advanceTimersByTimeAsync(0);
  });

  afterEach(() => {
    socket.stop();
    vi.useRealTimers();
  });

  it('queues messages until connected, keeping only the latest of each kind', () => {
    socket.onOpen(() => socket.send({ action: 'join', code: 'MS-AAAAAA', voterId: 'voter-0001' }));
    socket.send({ action: 'vote', code: 'MS-AAAAAA', voterId: 'voter-0001', mood: 10 });
    socket.send({ action: 'vote', code: 'MS-AAAAAA', voterId: 'voter-0001', mood: 90 });
    socket.send({ action: 'ping' });

    latest().open();

    expect(latest().url).toBe('ws://test/dev-ws');
    expect(latest().sent).toEqual([
      { action: 'join', code: 'MS-AAAAAA', voterId: 'voter-0001' },
      { action: 'vote', code: 'MS-AAAAAA', voterId: 'voter-0001', mood: 90 },
    ]);
  });

  it('hands parsed server messages to listeners and ignores garbage', () => {
    const received = vi.fn();
    socket.onMessage(received);
    latest().open();

    latest().receive({ type: 'pong' });
    latest().onmessage?.({ data: 'not json' });

    expect(received).toHaveBeenCalledExactlyOnceWith({ type: 'pong' });
  });

  it('reconnects with growing delays and reports its status', async () => {
    const statuses: string[] = [];
    socket.onStatus((status) => statuses.push(status));
    latest().open();

    latest().close();
    expect(statuses).toEqual(['live', 'reconnecting']);
    await vi.advanceTimersByTimeAsync(499);
    expect(FakeWebSocket.instances).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(FakeWebSocket.instances).toHaveLength(2);

    latest().close();
    await vi.advanceTimersByTimeAsync(999);
    expect(FakeWebSocket.instances).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(FakeWebSocket.instances).toHaveLength(3);

    latest().open();
    expect(statuses.at(-1)).toBe('live');
  });

  it('sends a heartbeat so API Gateway keeps the connection', async () => {
    latest().open();

    await vi.advanceTimersByTimeAsync(8 * 60 * 1000);

    expect(latest().sent).toEqual([{ action: 'ping' }]);
  });

  it('stops reconnecting once stopped', async () => {
    latest().open();
    socket.stop();

    await vi.advanceTimersByTimeAsync(60_000);

    expect(FakeWebSocket.instances).toHaveLength(1);
  });
});
