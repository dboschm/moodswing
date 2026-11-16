import {
  ApiGatewayManagementApiClient,
  GoneException,
  PostToConnectionCommand,
} from '@aws-sdk/client-apigatewaymanagementapi';
import { mockClient } from 'aws-sdk-client-mock';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiGatewayBroadcaster } from './api-gateway-broadcaster';

const managementApi = mockClient(ApiGatewayManagementApiClient);

describe('ApiGatewayBroadcaster', () => {
  beforeEach(() => managementApi.reset());

  it('posts the message to every connection and reports the gone ones', async () => {
    managementApi
      .on(PostToConnectionCommand, { ConnectionId: 'gone' })
      .rejects(new GoneException({ message: 'gone', $metadata: { httpStatusCode: 410 } }));
    managementApi.on(PostToConnectionCommand, { ConnectionId: 'broken' }).rejects(new Error('throttled'));
    managementApi.on(PostToConnectionCommand, { ConnectionId: 'live' }).resolves({});
    const warn = vi.fn();
    const broadcaster = new ApiGatewayBroadcaster(
      new ApiGatewayManagementApiClient({ endpoint: 'https://example.com/prod', region: 'eu-central-1' }),
      { warn },
    );

    const gone = await broadcaster.send(['live', 'gone', 'broken'], { type: 'pong' });

    expect(gone).toEqual(['gone']);
    expect(warn).toHaveBeenCalledOnce();
    const sent = managementApi.commandCalls(PostToConnectionCommand)[0].args[0].input;
    expect(sent.ConnectionId).toBe('live');
    expect(new TextDecoder().decode(sent.Data as Uint8Array)).toBe('{"type":"pong"}');
  });
});
