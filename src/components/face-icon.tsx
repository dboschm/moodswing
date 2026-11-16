import { MoodFace } from './mood-face';

/** A mood face as a standalone inline icon for use outside the scene. */
export function FaceIcon({ mood, size, animated = false, className }: { mood: number; size: number; animated?: boolean; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="-34 -36 68 68" aria-hidden="true">
      <MoodFace mood={mood} animated={animated} />
    </svg>
  );
}
