import { describe, expect, it } from 'vitest';
import {
  LAUGHING_SIDE,
  MAX_ANGLE_DEG,
  angleToMood,
  averageMood,
  bandCounts,
  isMood,
  moodBand,
  moodToAngle,
  toMood,
} from './mood';

describe('mood', () => {
  it('maps hanging straight down to neutral', () => {
    expect(angleToMood(0)).toBe(50);
    expect(moodToAngle(50)).toBeCloseTo(0);
  });

  it('puts laughing on the laughing side and angry on the other', () => {
    expect(angleToMood(MAX_ANGLE_DEG * LAUGHING_SIDE)).toBe(100);
    expect(angleToMood(-MAX_ANGLE_DEG * LAUGHING_SIDE)).toBe(0);
  });

  it('clamps angles beyond the swing range', () => {
    expect(angleToMood(MAX_ANGLE_DEG * LAUGHING_SIDE * 3)).toBe(100);
    expect(angleToMood(-MAX_ANGLE_DEG * LAUGHING_SIDE * 3)).toBe(0);
  });

  it('round-trips moods through angles', () => {
    for (let mood = 0; mood <= 100; mood += 5) {
      expect(toMood(angleToMood(moodToAngle(mood)))).toBe(mood);
    }
  });

  it('only accepts whole moods from 0 to 100', () => {
    expect(isMood(0)).toBe(true);
    expect(isMood(100)).toBe(true);
    expect(isMood(50.5)).toBe(false);
    expect(isMood(-1)).toBe(false);
    expect(isMood(101)).toBe(false);
    expect(isMood('50')).toBe(false);
  });

  it('sorts moods into bands', () => {
    expect(moodBand(100).band).toBe('laughing');
    expect(moodBand(80).band).toBe('laughing');
    expect(moodBand(79).band).toBe('happy');
    expect(moodBand(60).band).toBe('happy');
    expect(moodBand(59).band).toBe('content');
    expect(moodBand(45).band).toBe('content');
    expect(moodBand(44).band).toBe('meh');
    expect(moodBand(20).band).toBe('meh');
    expect(moodBand(19).band).toBe('angry');
    expect(moodBand(0).band).toBe('angry');
  });

  it('averages moods and has no average without moods', () => {
    expect(averageMood([])).toBeNull();
    expect(averageMood([0, 100, 50])).toBe(50);
  });

  it('counts moods per band in laughing-to-angry order', () => {
    const counts = bandCounts([100, 90, 70, 56, 10]);

    expect(counts.map(({ info, count }) => [info.band, count])).toEqual([
      ['laughing', 2],
      ['happy', 1],
      ['content', 1],
      ['meh', 0],
      ['angry', 1],
    ]);
  });
});
