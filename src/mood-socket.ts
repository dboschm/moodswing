import { parseServerMessage, type ClientMessage, type ServerMessage } from '../shared/protocol';

export type ConnectionStatus = 'connecting' | 'live' | 'reconnecting';

/** API Gateway closes WebSockets that are idle for 10 minutes. */
const HEARTBEAT_MS = 8 * 60 * 1000;
const MIN_RETRY_MS = 500;
const MAX_RETRY_MS = 10_000;

export interface MoodSocketOptions {
  resolveUrl: () => Promise<string>;
  createWebSocket?: (url: string) => WebSocket;
  random?: () => number;
}

type Listener<T> = (value: T) => void;

/** Only the latest message of each kind is worth sending after a reconnect. */
function outboxKey(message: ClientMessage): string | null {
  return message.action === 'ping' ? null : message.action;
}

/**
 * One WebSocket for the whole app that keeps itself connected: it retries with
 * jittered backoff, sends heartbeats, and reconnects as soon as the tab wakes up.
 */
export class MoodSocket {
  private readonly resolveUrl: () => Promise<string>;
  private readonly createWebSocket: (url: string) => WebSocket;
  private readonly random: () => number;
  private socket: WebSocket | null = null;
  private connecting = false;
  private started = false;
  private status: ConnectionStatus = 'connecting';
  private attempts = 0;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private heartbeatTimer: ReturnType<typeof setInterval> | undefined;
  private readonly outbox = new Map<string, ClientMessage>();
  private readonly messageListeners = new Set<Listener<ServerMessage>>();
  private readonly statusListeners = new Set<Listener<ConnectionStatus>>();
  private readonly openListeners = new Set<() => void>();

  constructor(options: MoodSocketOptions) {
    this.resolveUrl = options.resolveUrl;
    this.createWebSocket = options.createWebSocket ?? ((url) => new WebSocket(url));
    this.random = options.random ?? Math.random;
  }

  start(): void {
    if (this.started) {
      return;
    }

    this.started = true;
    document.addEventListener('visibilitychange', this.handleWake);
    window.addEventListener('online', this.handleWake);
    void this.connect();
  }

  stop(): void {
    this.started = false;
    document.removeEventListener('visibilitychange', this.handleWake);
    window.removeEventListener('online', this.handleWake);
    clearTimeout(this.retryTimer);
    clearInterval(this.heartbeatTimer);
    this.socket?.close();
    this.socket = null;
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  /** Sends right away when connected; otherwise sends the latest message of its kind once reconnected. */
  send(message: ClientMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
      return;
    }

    const key = outboxKey(message);

    if (key) {
      this.outbox.set(key, message);
    }
  }

  onMessage(listener: Listener<ServerMessage>): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  onStatus(listener: Listener<ConnectionStatus>): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  /** Runs on every (re)connect, before queued messages are flushed. */
  onOpen(listener: () => void): () => void {
    this.openListeners.add(listener);
    return () => this.openListeners.delete(listener);
  }

  private async connect(): Promise<void> {
    if (!this.started || this.connecting || this.socket) {
      return;
    }

    clearTimeout(this.retryTimer);
    this.connecting = true;
    let url: string;

    try {
      url = await this.resolveUrl();
    } catch {
      this.connecting = false;
      this.scheduleReconnect();
      return;
    }

    this.connecting = false;

    if (!this.started) {
      return;
    }

    const socket = this.createWebSocket(url);
    this.socket = socket;

    socket.onopen = () => {
      if (this.socket !== socket) {
        return;
      }

      this.attempts = 0;
      this.setStatus('live');
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = setInterval(() => this.send({ action: 'ping' }), HEARTBEAT_MS);
      this.openListeners.forEach((listener) => listener());
      this.flushOutbox();
    };

    socket.onmessage = (event: MessageEvent) => {
      const message = this.socket === socket ? parseServerMessage(String(event.data)) : null;

      if (message) {
        this.messageListeners.forEach((listener) => listener(message));
      }
    };

    socket.onclose = () => {
      if (this.socket !== socket) {
        return;
      }

      this.socket = null;
      clearInterval(this.heartbeatTimer);
      this.scheduleReconnect();
    };

    socket.onerror = () => socket.close();
  }

  private flushOutbox(): void {
    const queued = [...this.outbox.values()];

    this.outbox.clear();
    queued.forEach((message) => this.send(message));
  }

  private scheduleReconnect(): void {
    if (!this.started) {
      return;
    }

    this.setStatus('reconnecting');
    const delay = Math.min(MAX_RETRY_MS, MIN_RETRY_MS * 2 ** this.attempts) * (0.5 + this.random() / 2);
    this.attempts += 1;
    clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => void this.connect(), delay);
  }

  private readonly handleWake = () => {
    if (document.visibilityState === 'visible' && !this.socket && !this.connecting) {
      this.attempts = 0;
      void this.connect();
    }
  };

  private setStatus(status: ConnectionStatus): void {
    if (status !== this.status) {
      this.status = status;
      this.statusListeners.forEach((listener) => listener(status));
    }
  }
}
