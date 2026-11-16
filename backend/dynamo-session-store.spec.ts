import { ConditionalCheckFailedException, DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DeleteCommand, DynamoDBDocumentClient, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { beforeEach, describe, expect, it } from 'vitest';
import { DynamoSessionStore } from './dynamo-session-store';

const TABLE = 'MoodTable';
const dynamo = mockClient(DynamoDBDocumentClient);

describe('DynamoSessionStore', () => {
  let store: DynamoSessionStore;

  beforeEach(() => {
    dynamo.reset();
    store = new DynamoSessionStore(DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'eu-central-1' })), TABLE);
  });

  it('creates a session only if the code is free', async () => {
    dynamo
      .on(PutCommand)
      .rejectsOnce(new ConditionalCheckFailedException({ message: 'taken', $metadata: {} }))
      .resolves({});
    const meta = {
      code: 'MS-AAAAAA',
      status: 'open' as const,
      createdAt: 1,
      round: 0,
      creatorTokenHash: 'hash',
      expiresAt: 100,
    };

    expect(await store.createSession(meta)).toBe(false);
    expect(await store.createSession(meta)).toBe(true);
    expect(dynamo.commandCalls(PutCommand)[0].args[0].input).toEqual({
      TableName: TABLE,
      Item: {
        pk: 'SESSION#MS-AAAAAA',
        sk: 'META',
        status: 'open',
        createdAt: 1,
        round: 0,
        creatorTokenHash: 'hash',
        expiresAt: 100,
      },
      ConditionExpression: 'attribute_not_exists(pk)',
    });
  });

  it('rethrows other errors when creating', async () => {
    dynamo.on(PutCommand).rejects(new Error('throttled'));

    await expect(
      store.createSession({ code: 'MS-AAAAAA', status: 'open', createdAt: 1, round: 0, creatorTokenHash: 'h', expiresAt: 1 }),
    ).rejects.toThrow('throttled');
  });

  it('loads metadata, current-round votes and connections across pages', async () => {
    dynamo
      .on(QueryCommand)
      .resolvesOnce({
        Items: [
          { pk: 'SESSION#MS-AAAAAA', sk: 'CONN#c1', expiresAt: 9 },
          { pk: 'SESSION#MS-AAAAAA', sk: 'VOTE#voter-0', mood: 10, round: 0 },
          {
            pk: 'SESSION#MS-AAAAAA',
            sk: 'META',
            status: 'closed',
            createdAt: 1,
            round: 1,
            closedAt: 2,
            soothedAt: 3,
            creatorTokenHash: 'h',
            expiresAt: 9,
          },
        ],
        LastEvaluatedKey: { pk: 'SESSION#MS-AAAAAA', sk: 'META' },
      })
      .resolvesOnce({ Items: [{ pk: 'SESSION#MS-AAAAAA', sk: 'VOTE#voter-1', mood: 42, round: 1 }] });

    const state = await store.loadSession('MS-AAAAAA');

    expect(state).toEqual({
      meta: {
        code: 'MS-AAAAAA',
        status: 'closed',
        createdAt: 1,
        round: 1,
        closedAt: 2,
        soothedAt: 3,
        creatorTokenHash: 'h',
        expiresAt: 9,
      },
      votes: new Map([['voter-1', 42]]),
      connectionIds: ['c1'],
    });
    expect(dynamo.commandCalls(QueryCommand)[1].args[0].input.ExclusiveStartKey).toEqual({
      pk: 'SESSION#MS-AAAAAA',
      sk: 'META',
    });
  });

  it('returns null for a session without metadata', async () => {
    dynamo.on(QueryCommand).resolves({ Items: [] });

    expect(await store.loadSession('MS-AAAAAA')).toBeNull();
  });

  it('stores one vote item per voter', async () => {
    dynamo.on(PutCommand).resolves({});

    await store.putVote('MS-AAAAAA', 'voter-1', 77, 2, 5, 9);

    expect(dynamo.commandCalls(PutCommand)[0].args[0].input.Item).toEqual({
      pk: 'SESSION#MS-AAAAAA',
      sk: 'VOTE#voter-1',
      mood: 77,
      round: 2,
      updatedAt: 5,
      expiresAt: 9,
    });
  });

  it('closes a session', async () => {
    dynamo.on(UpdateCommand).resolves({});

    await store.closeSession('MS-AAAAAA', 7);

    expect(dynamo.commandCalls(UpdateCommand)[0].args[0].input).toMatchObject({
      Key: { pk: 'SESSION#MS-AAAAAA', sk: 'META' },
      ExpressionAttributeValues: { ':closed': 'closed', ':closedAt': 7 },
    });
  });

  it('marks a session as soothed', async () => {
    dynamo.on(UpdateCommand).resolves({});

    await store.sootheSession('MS-AAAAAA', 8);

    expect(dynamo.commandCalls(UpdateCommand)[0].args[0].input).toMatchObject({
      Key: { pk: 'SESSION#MS-AAAAAA', sk: 'META' },
      UpdateExpression: 'SET soothedAt = :soothedAt',
      ExpressionAttributeValues: { ':soothedAt': 8 },
    });
  });

  it('restarts a session as a new round in a single write', async () => {
    dynamo.on(UpdateCommand).resolves({});

    await store.restartSession('MS-AAAAAA', 2, 500);

    expect(dynamo.commandCalls(UpdateCommand)).toHaveLength(1);
    expect(dynamo.commandCalls(UpdateCommand)[0].args[0].input).toMatchObject({
      Key: { pk: 'SESSION#MS-AAAAAA', sk: 'META' },
      UpdateExpression: expect.stringContaining('REMOVE closedAt, soothedAt'),
      ExpressionAttributeValues: { ':open': 'open', ':round': 2, ':expiresAt': 500 },
    });
  });

  it('moves a connection between sessions', async () => {
    dynamo
      .on(PutCommand, { Item: { pk: 'CONN#c1' } })
      .resolves({ Attributes: { pk: 'CONN#c1', sk: 'CONN', sessionCode: 'MS-OLDOLD' } });
    dynamo.on(PutCommand, { Item: { pk: 'SESSION#MS-NEWNEW' } }).resolves({});
    dynamo.on(DeleteCommand).resolves({});

    expect(await store.attachConnection('c1', 'MS-NEWNEW', 9)).toBe('MS-OLDOLD');
    expect(dynamo.commandCalls(PutCommand).map((call) => call.args[0].input.Item)).toEqual([
      { pk: 'CONN#c1', sk: 'CONN', sessionCode: 'MS-NEWNEW', expiresAt: 9 },
      { pk: 'SESSION#MS-NEWNEW', sk: 'CONN#c1', expiresAt: 9 },
    ]);
    expect(dynamo.commandCalls(DeleteCommand)[0].args[0].input.Key).toEqual({
      pk: 'SESSION#MS-OLDOLD',
      sk: 'CONN#c1',
    });
  });

  it('detaches a connection using the reverse lookup', async () => {
    dynamo
      .on(DeleteCommand, { Key: { pk: 'CONN#c1', sk: 'CONN' } })
      .resolves({ Attributes: { sessionCode: 'MS-AAAAAA' } });
    dynamo.on(DeleteCommand, { Key: { pk: 'SESSION#MS-AAAAAA', sk: 'CONN#c1' } }).resolves({});

    expect(await store.detachConnection('c1')).toBe('MS-AAAAAA');
    expect(dynamo.commandCalls(DeleteCommand)).toHaveLength(2);
  });

  it('detaches an unknown connection without touching sessions', async () => {
    dynamo.on(DeleteCommand).resolves({});

    expect(await store.detachConnection('c1')).toBeUndefined();
    expect(dynamo.commandCalls(DeleteCommand)).toHaveLength(1);
  });
});
