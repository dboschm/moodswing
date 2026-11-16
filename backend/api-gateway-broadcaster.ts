import {
  PostToConnectionCommand,
  type ApiGatewayManagementApiClient,
} from '@aws-sdk/client-apigatewaymanagementapi';
import type { ServerMessage } from '../shared/protocol';
import type { Broadcaster } from './session-store';

function isGone(error: unknown): boolean {
  const { name, $metadata } = (error ?? {}) as { name?: string; $metadata?: { httpStatusCode?: number } };

  return name === 'GoneException' || $metadata?.httpStatusCode === 410;
}

/** Pushes messages to browsers through API Gateway's @connections API. */
export class ApiGatewayBroadcaster implements Broadcaster {
  constructor(
    private readonly client: ApiGatewayManagementApiClient,
    private readonly logger: Pick<Console, 'warn'> = console,
  ) {}

  async send(connectionIds: readonly string[], message: ServerMessage): Promise<string[]> {
    const data = new TextEncoder().encode(JSON.stringify(message));
    const results = await Promise.allSettled(
      connectionIds.map((connectionId) =>
        this.client.send(new PostToConnectionCommand({ ConnectionId: connectionId, Data: data })),
      ),
    );
    const gone: string[] = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        return;
      }

      if (isGone(result.reason)) {
        gone.push(connectionIds[index]);
      } else {
        this.logger.warn(`Could not post to ${connectionIds[index]}`, result.reason);
      }
    });

    return gone;
  }
}
