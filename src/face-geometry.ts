import { moodBand, type MoodBand } from '../shared/mood';

/** Radius the face geometry is drawn at; scale the group for other sizes. */
export const FACE_RADIUS = 26;

export interface FaceGeometry {
  band: MoodBand;
  skin: string;
  /** -1 (deep frown) to 1 (big smile). */
  smile: number;
  /** Closed outline of the mouth; collapses to a curved line when the mouth is shut. */
  mouthPath: string;
  mouthFill: 'none' | 'open' | 'teeth';
  /** How far the laughing mouth is open, 0–1. */
  laughOpen: number;
  /** How hard the angry mouth grits its teeth, 0–1. */
  grit: number;
  /** Divider lines across gritted teeth. */
  teethLines: string;
  /** Upper teeth strip and tongue shown inside the laughing mouth. */
  upperTeeth: { y: number; height: number };
  tongue: { cx: number; cy: number; rx: number; ry: number };
  /** 1 = round eyes, 0 = squeezed-shut laughing arcs. */
  eyeOpen: number;
  /** Both eyes as one shape that squints from ovals into "^ ^" arcs, filled and stroked. */
  eyePath: string;
  eyeStrokeWidth: number;
  browPath: string;
  browOpacity: number;
  blushOpacity: number;
  tearOpacity: number;
  steamOpacity: number;
  veinOpacity: number;
}

const YELLOW = [0xff, 0xd2, 0x3f] as const;
const ORANGE = [0xff, 0xa2, 0x3a] as const;
const RED = [0xff, 0x5a, 0x3c] as const;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const lerp = (from: number, to: number, t: number) => from + (to - from) * t;
const round = (value: number) => Math.round(value * 100) / 100;

function mixColor(from: readonly number[], to: readonly number[], t: number): string {
  const channels = from.map((channel, index) => Math.round(lerp(channel, to[index], t)));

  return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * One eye as two curves between its corners. Open, they bulge apart into an
 * oval; while laughing the lower lid rises until both curves meet in an arc,
 * which the stroke then draws.
 */
function eyePath(centerX: number, closed: number, openBulge: number): string {
  const halfWidth = lerp(3.4, 5, closed);
  const cornerY = lerp(-5, -3, closed);
  const top = cornerY - (4 / 3) * lerp(openBulge, 3.5, closed);
  const bottom = cornerY + (4 / 3) * lerp(openBulge, -3.5, closed);
  // Controls above the corners make an oval; a third of the way in, a pointed arc.
  const reach = halfWidth * lerp(1, 1 / 3, closed);
  const x = (offset: number) => round(centerX + offset);

  return [
    `M ${x(-halfWidth)} ${round(cornerY)}`,
    `C ${x(-reach)} ${round(top)} ${x(reach)} ${round(top)} ${x(halfWidth)} ${round(cornerY)}`,
    `C ${x(reach)} ${round(bottom)} ${x(-reach)} ${round(bottom)} ${x(-halfWidth)} ${round(cornerY)} Z`,
  ].join(' ');
}

function skinColor(mood: number): string {
  if (mood >= 40) {
    return mixColor(YELLOW, YELLOW, 0);
  }

  return mood >= 20 ? mixColor(ORANGE, YELLOW, (mood - 20) / 20) : mixColor(RED, ORANGE, mood / 20);
}

/**
 * Everything needed to draw an emoji face for a (fractional) mood, morphing
 * smoothly from a crying-with-laughter grin down to a red, steaming scowl.
 */
export function faceGeometry(mood: number): FaceGeometry {
  const smile = (Math.min(100, Math.max(0, mood)) - 50) / 50;
  const laughOpen = clamp01((mood - 68) / 32);
  const grit = clamp01((22 - mood) / 22);
  const halfWidth = 9 + 4 * Math.abs(smile) + 2 * laughOpen;
  const mouthY = 9;
  const cornerY = mouthY - 5 * smile - 2 * laughOpen;
  const lineControlY = mouthY + 8 * smile;
  // The top lip flattens as the mouth opens; the bottom lip drops into a "D".
  const topControlY = lerp(lineControlY, cornerY + 1, laughOpen);
  const bottomControlY = lineControlY + laughOpen * 24 + grit * 11;
  const mouthPath = [
    `M ${round(-halfWidth)} ${round(cornerY)}`,
    `Q 0 ${round(topControlY)} ${round(halfWidth)} ${round(cornerY)}`,
    `Q 0 ${round(bottomControlY)} ${round(-halfWidth)} ${round(cornerY)} Z`,
  ].join(' ');
  const middleControlY = (topControlY + bottomControlY) / 2;
  const teethLines = [
    `M ${round(-halfWidth)} ${round(cornerY)} Q 0 ${round(middleControlY)} ${round(halfWidth)} ${round(cornerY)}`,
    ...[-0.5, 0, 0.5].map((f) => `M ${round(f * halfWidth)} ${round(cornerY - 8)} V ${round(cornerY + 14)}`),
  ].join(' ');
  // Midpoint of the lower lip's curve, for placing the tongue.
  const lowerLipY = (cornerY + bottomControlY) / 2;

  const squint = clamp01((mood - 78) / 7);
  const eyeClosed = squint * squint * (3 - 2 * squint);
  const angry = clamp01((35 - mood) / 35);
  const eyeBulge = 4.6 * (1 - 0.3 * angry);
  const browTilt = 3 + 7 * angry;
  const browPath = [
    `M -14.5 ${round(-13.5 - browTilt * 0.4)} L -4 ${round(-12.5 + browTilt * 0.6)}`,
    `M 14.5 ${round(-13.5 - browTilt * 0.4)} L 4 ${round(-12.5 + browTilt * 0.6)}`,
  ].join(' ');

  return {
    band: moodBand(mood).band,
    skin: skinColor(mood),
    smile,
    mouthPath,
    mouthFill: laughOpen > 0 ? 'open' : grit > 0 ? 'teeth' : 'none',
    laughOpen,
    grit,
    teethLines,
    upperTeeth: { y: round(cornerY - 2), height: round(1 + laughOpen * 4.5) },
    tongue: {
      cx: 0,
      cy: round(lowerLipY - 1),
      rx: round(halfWidth * 0.55),
      ry: round(1 + laughOpen * 4),
    },
    eyeOpen: 1 - eyeClosed,
    eyePath: [eyePath(-9, eyeClosed, eyeBulge), eyePath(9, eyeClosed, eyeBulge)].join(' '),
    eyeStrokeWidth: round(2.6 * eyeClosed),
    browPath,
    browOpacity: clamp01((42 - mood) / 12),
    blushOpacity: clamp01((mood - 55) / 20) * 0.6,
    tearOpacity: clamp01((mood - 88) / 8),
    steamOpacity: clamp01((15 - mood) / 10),
    veinOpacity: clamp01((30 - mood) / 12),
  };
}
