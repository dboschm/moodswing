/** A mood is a whole number from 0 (angry) to 100 (laughing). */
export const MIN_MOOD = 0;
export const MAX_MOOD = 100;
export const NEUTRAL_MOOD = 50;

/** How far the swing can be pulled out, in degrees either side of hanging straight down. */
export const MAX_ANGLE_DEG = 50;

/** Which way the swing goes for laughing: -1 is left, 1 is right. */
export const LAUGHING_SIDE: -1 | 1 = -1;

export type MoodBand = 'laughing' | 'happy' | 'meh' | 'grumpy' | 'angry';

export interface MoodBandInfo {
  band: MoodBand;
  label: string;
  emoji: string;
  /** Lowest mood that still belongs to the band. */
  min: number;
  /** A typical mood for drawing the band's face. */
  sample: number;
}

/** Ordered from laughing to angry. */
export const MOOD_BANDS: readonly MoodBandInfo[] = [
  { band: 'laughing', label: 'Laughing', emoji: '😂', min: 80, sample: 95 },
  { band: 'happy', label: 'Happy', emoji: '😄', min: 60, sample: 70 },
  { band: 'meh', label: 'Meh', emoji: '😐', min: 40, sample: 50 },
  { band: 'grumpy', label: 'Grumpy', emoji: '😕', min: 20, sample: 30 },
  { band: 'angry', label: 'Angry', emoji: '😠', min: 0, sample: 5 },
];

export function isMood(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= MIN_MOOD && value <= MAX_MOOD;
}

/** Rounds and clamps any number into a valid mood. */
export function toMood(value: number): number {
  return Math.round(Math.min(MAX_MOOD, Math.max(MIN_MOOD, value)));
}

export function clampAngle(angleDeg: number): number {
  return Math.min(MAX_ANGLE_DEG, Math.max(-MAX_ANGLE_DEG, angleDeg));
}

/**
 * Swing angle in degrees (positive is swung to the right) to a fractional mood,
 * so faces can morph smoothly while the swing moves.
 */
export function angleToMood(angleDeg: number): number {
  const towardsLaughing = (clampAngle(angleDeg) * LAUGHING_SIDE) / MAX_ANGLE_DEG;
  return NEUTRAL_MOOD + towardsLaughing * (MAX_MOOD - NEUTRAL_MOOD);
}

export function moodToAngle(mood: number): number {
  return ((mood - NEUTRAL_MOOD) / (MAX_MOOD - NEUTRAL_MOOD)) * MAX_ANGLE_DEG * LAUGHING_SIDE;
}

export function moodBand(mood: number): MoodBandInfo {
  const rounded = toMood(mood);
  return MOOD_BANDS.find((info) => rounded >= info.min) ?? MOOD_BANDS[MOOD_BANDS.length - 1];
}

export function averageMood(moods: readonly number[]): number | null {
  if (moods.length === 0) {
    return null;
  }

  return moods.reduce((sum, mood) => sum + mood, 0) / moods.length;
}

/** How many moods fall into each band, in `MOOD_BANDS` order. */
export function bandCounts(moods: readonly number[]): { info: MoodBandInfo; count: number }[] {
  return MOOD_BANDS.map((info) => ({
    info,
    count: moods.filter((mood) => moodBand(mood).band === info.band).length,
  }));
}
