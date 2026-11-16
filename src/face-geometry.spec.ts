import { describe, expect, it } from 'vitest';
import { faceGeometry } from './face-geometry';

const moods = Array.from({ length: 101 }, (_, mood) => mood);

describe('faceGeometry', () => {
  it('smiles more the happier the mood', () => {
    const smiles = moods.map((mood) => faceGeometry(mood).smile);

    smiles.slice(1).forEach((smile, index) => expect(smile).toBeGreaterThan(smiles[index]));
    expect(faceGeometry(50).smile).toBe(0);
  });

  it('opens the mouth only when laughing and grits teeth only when angry', () => {
    expect(faceGeometry(100).mouthFill).toBe('open');
    expect(faceGeometry(50).mouthFill).toBe('none');
    expect(faceGeometry(5).mouthFill).toBe('teeth');
    expect(faceGeometry(60).laughOpen).toBe(0);
    expect(faceGeometry(40).grit).toBe(0);
  });

  it('squeezes the eyes shut when laughing hard', () => {
    expect(faceGeometry(95).eyeOpen).toBe(0);
    expect(faceGeometry(80).eyeOpen).toBeGreaterThan(0);
    expect(faceGeometry(50).eyeOpen).toBe(1);
  });

  it('squints the eyes into arcs gradually instead of swapping shapes', () => {
    const squint = Array.from({ length: 15 }, (_, step) => faceGeometry(78 + step / 2));

    squint.slice(1).forEach((face, index) => {
      expect(face.eyeOpen).toBeLessThan(squint[index].eyeOpen);
      expect(face.eyeStrokeWidth).toBeGreaterThan(squint[index].eyeStrokeWidth);
    });
    expect(faceGeometry(50).eyeStrokeWidth).toBe(0);
    // Fully shut, the lower lid lies on the upper one and only the stroke shows.
    const [upper, lower] = faceGeometry(95)
      .eyePath.split(' Z')[0]
      .split(' C ')
      .slice(1)
      .map((curve) => curve.split(' ').map(Number));
    expect([lower[1], lower[3]]).toEqual([upper[1], upper[3]]);
  });

  it('cries tears of joy only at 90 and above', () => {
    moods.forEach((mood) => {
      expect(faceGeometry(mood).tearOpacity > 0).toBe(mood >= 90 || (mood > 88 && mood < 90));
    });
    expect(faceGeometry(100).tearOpacity).toBe(1);
  });

  it('steams only below 15', () => {
    moods.forEach((mood) => expect(faceGeometry(mood).steamOpacity > 0).toBe(mood < 15));
  });

  it('warms from yellow through orange to red below 40', () => {
    expect(faceGeometry(100).skin).toBe('#ffd23f');
    expect(faceGeometry(40).skin).toBe('#ffd23f');
    expect(faceGeometry(20).skin).toBe('#ffa23a');
    expect(faceGeometry(0).skin).toBe('#ff5a3c');
  });

  it('shows angry brows and blush only in their ranges', () => {
    expect(faceGeometry(10).browOpacity).toBe(1);
    expect(faceGeometry(60).browOpacity).toBe(0);
    expect(faceGeometry(80).blushOpacity).toBeGreaterThan(0);
    expect(faceGeometry(40).blushOpacity).toBe(0);
  });

  it('keeps the shut mouth a line so it morphs without jumps', () => {
    const neutral = faceGeometry(50).mouthPath;

    expect(neutral).toBe('M -9 9 Q 0 9 9 9 Q 0 9 -9 9 Z');
  });
});
