import { describe, expect, it } from 'vitest';
import type { SessionSnapshot } from '../../shared/protocol';
import { summaryText } from './mood-summary';

const snapshot = (moods: number[]): SessionSnapshot => ({
  code: 'MS-K7Q4XZ',
  status: 'closed',
  moods,
  online: 0,
  createdAt: 0,
  round: 0,
  closedAt: 1,
});

describe('summaryText', () => {
  it('leads with what the average hides, then the numbers', () => {
    expect(summaryText(snapshot([10, 15, 22, 78, 85, 90]))).toBe(
      'moodswing MS-K7Q4XZ: Split team: 3 feel down, 3 feel good. 6 moods, average 50/100. 😂×2 😄×1 😐×1 😠×2',
    );
  });

  it('says so when nobody shared a mood', () => {
    expect(summaryText(snapshot([]))).toBe('moodswing MS-K7Q4XZ: nobody shared a mood.');
  });
});
