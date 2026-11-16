import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { SESSION_CODE_ALPHABET, SESSION_CODE_LENGTH, SESSION_CODE_PREFIX } from '../shared/protocol';

export function generateSessionCode(randomIndex: (size: number) => number = randomInt): string {
  let suffix = '';

  for (let index = 0; index < SESSION_CODE_LENGTH; index += 1) {
    suffix += SESSION_CODE_ALPHABET[randomIndex(SESSION_CODE_ALPHABET.length)];
  }

  return `${SESSION_CODE_PREFIX}${suffix}`;
}

export function generateCreatorToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashCreatorToken(token: string): string {
  return createHash('sha256').update(token).digest('base64url');
}

export function creatorTokenMatches(token: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashCreatorToken(token));
  const expected = Buffer.from(expectedHash);

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
