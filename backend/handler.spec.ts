import type { APIGatewayProxyWebsocketEventV2 } from 'aws-lambda';
import { describe, expect, it } from 'vitest';
import type { ServerMessage } from '../shared/protocol';
import { createHandler } from './handler';
import { MemorySessionStore } from './memory-session-store';

function event(routeKey: string, connectionId: string, body?: unknown): APIGatewayProxyWebsocketEventV2 {
  return {
    requestContext: {
      routeKey,
      connectionId,
      domainName: 'abc123.execute-api.eu-central-1.amazonaws.com',
      stage: 'prod',
    },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    isBase64Encoded: false,
  } as APIGatewayProxyWebsocketEventV2;
}

function setup() {
  const store = new MemorySessionStore();
  const sent: { endpoint: string; connectionId: string; message: ServerMessage }[] = [];
  const handler = createHandler({
    store,
    broadcasterFor: (endpoint) => ({
      async send(connectionIds, message) {
        connectionIds.forEach((connectionId) => sent.push({ endpoint, connectionId, message }));
        return [];
      },
    }),
  });

  return { store, sent, handler };
}

describe('handler', () => {
  it('accepts connections without sending anything', async () => {
    const { handler, sent } = setup();

    expect(await handler(event('$connect', 'c1'))).toEqual({ statusCode: 200 });
    expect(sent).toEqual([]);
  });

  it('replies through the @connections endpoint of the calling stage', async () => {
    const { handler, sent } = setup();

    await handler(event('createSession', 'c1', { action: 'createSession' }));

    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      endpoint: 'https://abc123.execute-api.eu-central-1.amazonaws.com/prod',
      connectionId: 'c1',
      message: { type: 'sessionCreated' },
    });
  });

  it('answers unknown or malformed messages on $default with an error', async () => {
    const { handler, sent } = setup();

    await handler(event('$default', 'c1', 'not json'));
    await handler(event('$default', 'c1', { action: 'ping' }));

    expect(sent.map(({ message }) => message)).toEqual([{ type: 'error', reason: 'INVALID_MESSAGE' }, { type: 'pong' }]);
  });

  it('forgets the connection on $disconnect and tells the rest of the session', async () => {
    const { handler, sent, store } = setup();
    await handler(event('createSession', 'c1', { action: 'createSession' }));
    const created = sent[0].message;

    if (created.type !== 'sessionCreated') {
      throw new Error('expected sessionCreated');
    }

    await handler(event('join', 'c1', { action: 'join', code: created.code, voterId: 'voter-aaaa-1111' }));
    await handler(event('join', 'c2', { action: 'join', code: created.code, voterId: 'voter-bbbb-2222' }));
    sent.length = 0;

    await handler(event('$disconnect', 'c2'));

    expect((await store.loadSession(created.code))?.connectionIds).toEqual(['c1']);
    expect(sent).toEqual([
      expect.objectContaining({ connectionId: 'c1', message: expect.objectContaining({ type: 'snapshot' }) }),
    ]);
  });
});
