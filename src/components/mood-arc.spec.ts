import { describe, expect, it } from 'vitest';
import { assignRings } from './mood-arc';

describe('assignRings', () => {
  it('keeps votes far apart on the inner ring', () => {
    expect(assignRings([0, 50, 100])).toEqual([0, 0, 0]);
  });

  it('pushes votes at similar moods outward, in the order they were given', () => {
    expect(assignRings([52, 50, 51, 90])).toEqual([0, 2, 1, 0]);
  });
});
