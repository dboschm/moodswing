import { MOOD_BANDS, averageMood, moodBand } from '../shared/mood';

export type MoodPattern =
  | 'none'
  | 'single'
  | 'pair'
  | 'aligned'
  | 'lowOutlier'
  | 'highOutlier'
  | 'opposingOutliers'
  | 'split'
  | 'lowMinority'
  | 'highMinority'
  | 'mixed'
  | 'leaning';

export interface MoodAnalysis {
  pattern: MoodPattern;
  /** One line on the team's mood that the average alone would hide. */
  headline: string;
}

/** Moods this close together count as one shared mood. */
const ALIGNED_RANGE = 20;
/** A jump this big between neighbouring moods separates groups. */
const GROUP_GAP = 25;
/** The smaller group needs this share of the team to call it a split. */
const SPLIT_SHARE = 0.3;
/** Standard deviation above which moods are too scattered to sum up. */
const WIDE_SPREAD = 22;
const CONTENT_MIN = MOOD_BANDS.find(({ band }) => band === 'content')!.min;
const HAPPY_MIN = MOOD_BANDS.find(({ band }) => band === 'happy')!.min;

const sameBand = (a: number, b: number) => moodBand(a).band === moodBand(b).band;
/** The band as it reads after "feel": nobody "feels laughing". */
const feels = (mood: number) => (moodBand(mood).band === 'laughing' ? 'great' : moodBand(mood).label.toLowerCase());

/** How a sorted group of moods feels, without claiming more than all of them share. */
function groupFeels(sorted: readonly number[]): string {
  const lowest = sorted[0];
  const highest = sorted[sorted.length - 1];

  if (sameBand(lowest, highest)) {
    return feels(lowest);
  }

  if (highest < CONTENT_MIN) {
    return 'down';
  }

  return lowest >= HAPPY_MIN ? 'good' : `${feels(lowest)} to ${feels(highest)}`;
}

function median(sorted: readonly number[]): number {
  const middle = (sorted.length - 1) / 2;

  return (sorted[Math.floor(middle)] + sorted[Math.ceil(middle)]) / 2;
}

function standardDeviation(values: readonly number[], mean: number): number {
  return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
}

/** Where the largest jump between neighbouring moods is, if it is big enough to split them into groups. */
function largestGap(sorted: readonly number[]): number | null {
  let index: number | null = null;
  let size = GROUP_GAP - 1;

  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i] - sorted[i - 1] > size) {
      size = sorted[i] - sorted[i - 1];
      index = i;
    }
  }

  return index;
}

function analyzeShape(sorted: readonly number[], average: number): MoodAnalysis {
  const count = sorted.length;
  const lowest = sorted[0];
  const highest = sorted[count - 1];

  if (highest - lowest <= ALIGNED_RANGE) {
    return { pattern: 'aligned', headline: sameBand(lowest, highest) ? `Everyone feels ${feels(lowest)}` : 'On the same page' };
  }

  // A lone mood at either end, far from its neighbour and in a different band from the rest.
  const lowOutlier = sorted[1] - lowest >= GROUP_GAP && !sameBand(lowest, median(sorted.slice(1)));
  const highOutlier = highest - sorted[count - 2] >= GROUP_GAP && !sameBand(highest, median(sorted.slice(0, -1)));

  if (lowOutlier && highOutlier && count >= 4) {
    return {
      pattern: 'opposingOutliers',
      headline: `Mostly ${groupFeels(sorted.slice(1, -1))}, but one feels ${feels(lowest)} and one ${feels(highest)}`,
    };
  }

  if (lowOutlier !== highOutlier) {
    const others = groupFeels(lowOutlier ? sorted.slice(1) : sorted.slice(0, -1));

    return {
      pattern: lowOutlier ? 'lowOutlier' : 'highOutlier',
      headline: `Mostly ${others}, but one person feels ${feels(lowOutlier ? lowest : highest)}`,
    };
  }

  // Three moods with a loner at each end have no group to speak of.
  const gap = lowOutlier && highOutlier ? null : largestGap(sorted);

  if (gap !== null) {
    const lower = sorted.slice(0, gap);
    const upper = sorted.slice(gap);

    if (!sameBand(median(lower), median(upper))) {
      if (Math.min(lower.length, upper.length) / count >= SPLIT_SHARE) {
        // Two groups only count as a split team when one is down and the other is doing well.
        const title = median(lower) < CONTENT_MIN && median(upper) >= HAPPY_MIN ? 'Split team' : 'Two groups';

        return {
          pattern: 'split',
          headline: `${title}: ${lower.length} feel ${groupFeels(lower)}, ${upper.length} feel ${groupFeels(upper)}`,
        };
      }

      return lower.length < upper.length
        ? { pattern: 'lowMinority', headline: `Mostly ${groupFeels(upper)}, but ${lower.length} feel ${groupFeels(lower)}` }
        : { pattern: 'highMinority', headline: `Mostly ${groupFeels(lower)}, but ${upper.length} feel ${groupFeels(upper)}` };
    }
  }

  return standardDeviation(sorted, average) >= WIDE_SPREAD
    ? { pattern: 'mixed', headline: 'Moods are all over the place' }
    : { pattern: 'leaning', headline: `The team feels ${feels(average)}` };
}

/**
 * Reads the shape of the team's moods, not just their average: whether the
 * team agrees, is split in two, or has a lone outlier or a small group apart.
 */
export function analyzeMoods(moods: readonly number[]): MoodAnalysis {
  const average = averageMood(moods);

  if (average === null) {
    return { pattern: 'none', headline: 'Nobody shared a mood' };
  }

  const sorted = [...moods].sort((a, b) => a - b);

  if (sorted.length === 1) {
    return { pattern: 'single', headline: `One mood so far: ${feels(sorted[0])}` };
  }

  if (sorted.length === 2) {
    const [low, high] = sorted;

    return {
      pattern: 'pair',
      headline: high - low <= ALIGNED_RANGE ? `Both feel ${feels(average)}` : `One feels ${feels(low)}, one ${feels(high)}`,
    };
  }

  return analyzeShape(sorted, average);
}
