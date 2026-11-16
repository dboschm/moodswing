import type { ReactNode } from 'react';
import { SCENE_HEIGHT, SCENE_WIDTH } from './scene-geometry';
import { SwingFrame } from './swing-frame';

interface MoodSceneProps {
  label: string;
  /** A short instruction under the diagram. */
  note?: ReactNode;
  children: ReactNode;
}

/** The swing diagram: the static frame with the swings and votes drawn on top. */
export function MoodScene({ label, note, children }: MoodSceneProps) {
  return (
    <figure className="drawing">
      <svg className="mood-scene" viewBox={`0 0 ${SCENE_WIDTH} ${SCENE_HEIGHT}`} role="group" aria-label={label}>
        <SwingFrame />
        {children}
      </svg>
      {note && <figcaption className="drawing__note">{note}</figcaption>}
    </figure>
  );
}
