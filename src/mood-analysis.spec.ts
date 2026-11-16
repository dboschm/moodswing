import { describe, expect, it } from 'vitest';
import { analyzeMoods } from './mood-analysis';

describe('analyzeMoods', () => {
  it('has nothing to say without moods', () => {
    expect(analyzeMoods([])).toEqual({ pattern: 'none', headline: 'Nobody shared a mood' });
  });

  it('does not speak for the team on a single mood', () => {
    expect(analyzeMoods([70])).toEqual({ pattern: 'single', headline: 'One mood so far: happy' });
  });

  it('tells two close moods from two far apart ones', () => {
    expect(analyzeMoods([62, 70]).headline).toBe('Both feel happy');
    expect(analyzeMoods([30, 93]).headline).toBe('One feels meh, one great');
  });

  it('recognises a team on the same page', () => {
    expect(analyzeMoods([50, 52, 55, 58, 61])).toEqual({ pattern: 'aligned', headline: 'On the same page' });
    expect(analyzeMoods([5, 10, 15]).headline).toBe('Everyone feels angry');
  });

  it('spots one angry person in an otherwise happy team', () => {
    expect(analyzeMoods([8, 65, 68, 72, 75, 78])).toEqual({
      pattern: 'lowOutlier',
      headline: 'Mostly happy, but one person feels angry',
    });
  });

  it('spots one laughing person in an otherwise flat team', () => {
    expect(analyzeMoods([30, 35, 38, 40, 92])).toEqual({
      pattern: 'highOutlier',
      headline: 'Mostly meh, but one person feels great',
    });
  });

  it('notices outliers both ways cancelling out in the average', () => {
    expect(analyzeMoods([5, 48, 50, 52, 55, 95])).toEqual({
      pattern: 'opposingOutliers',
      headline: 'Mostly content, but one feels angry and one great',
    });
  });

  it('calls out a split team that the average hides', () => {
    expect(analyzeMoods([10, 15, 22, 78, 85, 90])).toEqual({
      pattern: 'split',
      headline: 'Split team: 3 feel down, 3 feel good',
    });
    // Apart, but neither group is down: two groups rather than a split team.
    expect(analyzeMoods([45, 50, 90, 95]).headline).toBe('Two groups: 2 feel content, 2 feel great');
  });

  it('notices a small group having a harder time', () => {
    expect(analyzeMoods([12, 18, 70, 72, 75, 78, 80, 85])).toEqual({
      pattern: 'lowMinority',
      headline: 'Mostly good, but 2 feel angry',
    });
  });

  it('notices a small group lifting a low average', () => {
    expect(analyzeMoods([25, 28, 30, 32, 35, 38, 85, 90])).toEqual({
      pattern: 'highMinority',
      headline: 'Mostly meh, but 2 feel great',
    });
  });

  it('admits when moods are all over the place', () => {
    expect(analyzeMoods([12, 30, 47, 62, 75, 90]).pattern).toBe('mixed');
    expect(analyzeMoods([10, 50, 90]).pattern).toBe('mixed');
  });

  it('falls back to the average for an ordinary spread', () => {
    expect(analyzeMoods([40, 48, 52, 55, 60, 66])).toEqual({ pattern: 'leaning', headline: 'The team feels content' });
  });

  it('only names a band when the whole group is in it', () => {
    // 22 is meh, not angry, and 78 is happy, not laughing.
    expect(analyzeMoods([10, 15, 22, 78, 85, 90]).headline).not.toMatch(/angry|great/);
    expect(analyzeMoods([8, 50, 62, 70, 75]).headline).toBe('Mostly content to happy, but one person feels angry');
  });
});
