import type { ReactNode } from 'react';
import { SCENE_HEIGHT, SCENE_WIDTH } from './scene-geometry';
import { TreeScene } from './tree-scene';

/** A cartoon panel: the tree scene with a caption underneath. */
export function MoodScene({ label, caption, children }: { label: string; caption: string; children: ReactNode }) {
  return (
    <figure className="panel">
      <svg className="mood-scene" viewBox={`0 0 ${SCENE_WIDTH} ${SCENE_HEIGHT}`} role="group" aria-label={label}>
        <TreeScene />
        {children}
      </svg>
      <figcaption className="panel__caption">{caption}</figcaption>
    </figure>
  );
}
