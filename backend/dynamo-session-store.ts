import {
  DeleteCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  type DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';
import type { SessionStatus } from '../shared/protocol';
import type { SessionMeta, SessionState, SessionStore } from './session-store';

/*
 * Single-table layout:
 *   SESSION#<code> / META              session status, creator token hash
 *   SESSION#<code> / VOTE#<voterId>    one item per voter
 *   SESSION#<code> / CONN#<connection> who to broadcast to
 *   CONN#<connection> / CONN           reverse lookup for $disconnect
 * One query on the session partition yields everything a snapshot needs.
 */
const META = 'META';
const VOTE_PREFIX = 'VOTE#';
const CONNECTION_PREFIX = 'CONN#';

export const sessionKey = (code: string) => `SESSION#${code}`;
export const connectionKey = (connectionId: string) => `${CONNECTION_PREFIX}${connectionId}`;

function isConditionalCheckFailure(error: unknown): boolean {
  return error instanceof Error && error.name === 'ConditionalCheckFailedException';
}

export class DynamoSessionStore implements SessionStore {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async createSession(meta: SessionMeta): Promise<boolean> {
    try {
      await this.client.send(
        new PutCommand({
          TableName: this.tableName,
          Item: {
            pk: sessionKey(meta.code),
            sk: META,
            status: meta.status,
            createdAt: meta.createdAt,
            creatorTokenHash: meta.creatorTokenHash,
            expiresAt: meta.expiresAt,
          },
          ConditionExpression: 'attribute_not_exists(pk)',
        }),
      );
      return true;
    } catch (error) {
      if (isConditionalCheckFailure(error)) {
        return false;
      }

      throw error;
    }
  }

  async loadSession(code: string): Promise<SessionState | null> {
    let meta: SessionMeta | undefined;
    const votes = new Map<string, number>();
    const connectionIds: string[] = [];
    let exclusiveStartKey: Record<string, unknown> | undefined;

    do {
      const page = await this.client.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: 'pk = :pk',
          ExpressionAttributeValues: { ':pk': sessionKey(code) },
          ExclusiveStartKey: exclusiveStartKey,
        }),
      );

      for (const item of page.Items ?? []) {
        const sk = String(item.sk);

        if (sk === META) {
          meta = {
            code,
            status: item.status as SessionStatus,
            createdAt: Number(item.createdAt),
            creatorTokenHash: String(item.creatorTokenHash),
            expiresAt: Number(item.expiresAt),
            ...(item.closedAt === undefined ? {} : { closedAt: Number(item.closedAt) }),
          };
        } else if (sk.startsWith(VOTE_PREFIX)) {
          votes.set(sk.slice(VOTE_PREFIX.length), Number(item.mood));
        } else if (sk.startsWith(CONNECTION_PREFIX)) {
          connectionIds.push(sk.slice(CONNECTION_PREFIX.length));
        }
      }

      exclusiveStartKey = page.LastEvaluatedKey;
    } while (exclusiveStartKey);

    return meta ? { meta, votes, connectionIds } : null;
  }

  async putVote(code: string, voterId: string, mood: number, updatedAt: number, expiresAt: number) {
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: { pk: sessionKey(code), sk: `${VOTE_PREFIX}${voterId}`, mood, updatedAt, expiresAt },
      }),
    );
  }

  async closeSession(code: string, closedAt: number) {
    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { pk: sessionKey(code), sk: META },
        UpdateExpression: 'SET #status = :closed, closedAt = :closedAt',
        ConditionExpression: 'attribute_exists(pk)',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: { ':closed': 'closed', ':closedAt': closedAt },
      }),
    );
  }

  async attachConnection(connectionId: string, code: string, expiresAt: number) {
    const { Attributes: previous } = await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: { pk: connectionKey(connectionId), sk: 'CONN', sessionCode: code, expiresAt },
        ReturnValues: 'ALL_OLD',
      }),
    );
    const previousCode = previous?.sessionCode as string | undefined;

    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: { pk: sessionKey(code), sk: connectionKey(connectionId), expiresAt },
      }),
    );

    if (previousCode && previousCode !== code) {
      await this.deleteMembership(previousCode, connectionId);
    }

    return previousCode;
  }

  async detachConnection(connectionId: string) {
    const { Attributes: previous } = await this.client.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: { pk: connectionKey(connectionId), sk: 'CONN' },
        ReturnValues: 'ALL_OLD',
      }),
    );
    const code = previous?.sessionCode as string | undefined;

    if (code) {
      await this.deleteMembership(code, connectionId);
    }

    return code;
  }

  private async deleteMembership(code: string, connectionId: string) {
    await this.client.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: { pk: sessionKey(code), sk: connectionKey(connectionId) },
      }),
    );
  }
}
