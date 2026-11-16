import { describe, expect, it } from 'vitest';
import { isSessionCode, normalizeSessionCode, parseClientMessage } from './protocol';

const voterId = '6f0c1f1e-1a43-4bb6-9c7a-8f6f0d0b6c2d';

describe('session codes', () => {
  it('accepts canonical codes only', () => {
    expect(isSessionCode('MS-K7Q4XZ')).toBe(true);
    expect(isSessionCode('MS-K7Q4X')).toBe(false);
    expect(isSessionCode('MS-K7Q4XO')).toBe(false);
    expect(isSessionCode('ms-k7q4xz')).toBe(false);
  });

  it('normalizes what people type', () => {
    expect(normalizeSessionCode('k7q4xz')).toBe('MS-K7Q4XZ');
    expect(normalizeSessionCode(' ms-k7q 4xz ')).toBe('MS-K7Q4XZ');
    expect(normalizeSessionCode('hello')).toBeNull();
  });
});

describe('parseClientMessage', () => {
  it('parses every valid action', () => {
    expect(parseClientMessage('{"action":"createSession"}')).toEqual({ action: 'createSession' });
    expect(parseClientMessage('{"action":"ping"}')).toEqual({ action: 'ping' });
    expect(parseClientMessage(JSON.stringify({ action: 'join', code: 'MS-K7Q4XZ', voterId }))).toEqual({
      action: 'join',
      code: 'MS-K7Q4XZ',
      voterId,
    });
    expect(
      parseClientMessage(JSON.stringify({ action: 'vote', code: 'MS-K7Q4XZ', voterId, mood: 42 })),
    ).toEqual({ action: 'vote', code: 'MS-K7Q4XZ', voterId, mood: 42 });
    expect(
      parseClientMessage(
        JSON.stringify({ action: 'endSession', code: 'MS-K7Q4XZ', creatorToken: 'a'.repeat(43) }),
      ),
    ).toEqual({ action: 'endSession', code: 'MS-K7Q4XZ', creatorToken: 'a'.repeat(43) });
  });

  it('drops extra fields', () => {
    expect(parseClientMessage('{"action":"ping","extra":1}')).toEqual({ action: 'ping' });
  });

  it('rejects malformed messages', () => {
    expect(parseClientMessage('not json')).toBeNull();
    expect(parseClientMessage('[]')).toBeNull();
    expect(parseClientMessage('{"action":"dance"}')).toBeNull();
    expect(parseClientMessage(JSON.stringify({ action: 'vote', code: 'MS-K7Q4XZ', voterId, mood: 101 }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ action: 'vote', code: 'MS-K7Q4XZ', voterId, mood: 4.2 }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ action: 'join', code: 'nope', voterId }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ action: 'join', code: 'MS-K7Q4XZ', voterId: 'x' }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ action: 'endSession', code: 'MS-K7Q4XZ' }))).toBeNull();
  });

  it('rejects oversized messages', () => {
    expect(parseClientMessage(JSON.stringify({ action: 'ping', padding: 'x'.repeat(4000) }))).toBeNull();
  });
});
