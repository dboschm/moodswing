import { ApiGatewayManagementApiClient } from '@aws-sdk/client-apigatewaymanagementapi';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { APIGatewayProxyResultV2, APIGatewayProxyWebsocketEventV2 } from 'aws-lambda';
import { ApiGatewayBroadcaster } from './api-gateway-broadcaster';
import { DynamoSessionStore } from './dynamo-session-store';
import { SessionService } from './session-service';
import type { Broadcaster, SessionStore } from './session-store';

export interface HandlerDependencies {
  store: SessionStore;
  /** The @connections endpoint differs per API and stage, so broadcasters are made per request. */
  broadcasterFor: (endpoint: string) => Broadcaster;
  now?: () => number;
}

export type WebSocketHandler = (event: APIGatewayProxyWebsocketEventV2) => Promise<APIGatewayProxyResultV2>;

const OK = { statusCode: 200 } as const;

/** One function serves every route: $connect, $disconnect, $default and each client action. */
export function createHandler({ store, broadcasterFor, now }: HandlerDependencies): WebSocketHandler {
  return async (event) => {
    const { routeKey, connectionId, domainName, stage } = event.requestContext;
    const service = new SessionService({
      store,
      broadcaster: broadcasterFor(`https://${domainName}/${stage}`),
      now,
    });

    switch (routeKey) {
      case '$connect':
        return OK;
      case '$disconnect':
        try {
          await service.handleDisconnect(connectionId);
        } catch (error) {
          console.error('Failed to clean up connection', error);
        }
        return OK;
      default:
        await service.handleRawMessage(connectionId, event.body ?? '');
        return OK;
    }
  };
}

function awsDependencies(): HandlerDependencies {
  const tableName = process.env.TABLE_NAME;

  if (!tableName) {
    throw new Error('TABLE_NAME is not set');
  }

  const documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
    marshallOptions: { removeUndefinedValues: true },
  });
  const broadcasters = new Map<string, Broadcaster>();

  return {
    store: new DynamoSessionStore(documentClient, tableName),
    broadcasterFor: (endpoint) => {
      let broadcaster = broadcasters.get(endpoint);

      if (!broadcaster) {
        broadcaster = new ApiGatewayBroadcaster(new ApiGatewayManagementApiClient({ endpoint }));
        broadcasters.set(endpoint, broadcaster);
      }

      return broadcaster;
    },
  };
}

let awsHandler: WebSocketHandler | undefined;

export const handler: WebSocketHandler = (event) => {
  awsHandler ??= createHandler(awsDependencies());
  return awsHandler(event);
};
