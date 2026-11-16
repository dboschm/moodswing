import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from 'react';
import { LAUGHING_SIDE, MAX_MOOD, MIN_MOOD, NEUTRAL_MOOD, angleToMood, clampAngle, moodToAngle, toMood } from '../../shared/mood';
import { PIVOT } from '../components/scene-geometry';
import {
  angleFromPointer,
  isSettled,
  releaseVelocity,
  stepSwing,
  type AngleSample,
  type SwingMotion,
} from '../swing-physics';

const KEY_STEP = 5;
const PAGE_STEP = 20;
const KEYBOARD_COMMIT_DELAY_MS = 400;
const MAX_SAMPLES = 12;

interface UseSwingOptions {
  /** The chosen mood; null hangs the swing straight down. */
  mood: number | null;
  disabled?: boolean;
  onCommit?: (mood: number) => void;
}

export interface SwingControls {
  angle: number;
  velocity: number;
  dragging: boolean;
  /** Fractional mood under the swing right now, for the morphing face. */
  liveMood: number;
  /** The mood the swing is heading to, for the slider value. */
  targetMood: number;
  /** Attach to the draggable element so touches on it never scroll the page. */
  handleRef: RefObject<SVGGElement>;
  handlers: {
    onPointerDown: (event: PointerEvent<SVGGElement>) => void;
    onPointerMove: (event: PointerEvent<SVGGElement>) => void;
    onPointerUp: (event: PointerEvent<SVGGElement>) => void;
    onPointerCancel: (event: PointerEvent<SVGGElement>) => void;
    onKeyDown: (event: KeyboardEvent<SVGGElement>) => void;
  };
}

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function pointerAngle(event: PointerEvent<SVGGElement>): number | null {
  const matrix = event.currentTarget.ownerSVGElement?.getScreenCTM();

  if (!matrix) {
    return null;
  }

  const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
  return angleFromPointer(PIVOT, point);
}

/** Drag, keyboard and spring physics for the mood swing. */
export function useSwing({ mood, disabled = false, onCommit }: UseSwingOptions): SwingControls {
  const initialTarget = mood === null ? 0 : moodToAngle(mood);
  const motionRef = useRef<SwingMotion>({ angle: initialTarget, velocity: 0 });
  const targetRef = useRef(initialTarget);
  const [motion, setMotion] = useState<SwingMotion>(motionRef.current);
  const [targetMood, setTargetMood] = useState(mood ?? NEUTRAL_MOOD);
  const [dragging, setDragging] = useState(false);
  const frameRef = useRef<number | undefined>(undefined);
  const lastFrameRef = useRef<number | undefined>(undefined);
  const dragRef = useRef<{ pointerId: number; grabOffset: number; samples: AngleSample[] } | null>(null);
  const commitTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;
  const handleRef = useRef<SVGGElement>(null);

  // iOS Safari may ignore touch-action on SVG children; a non-passive touchstart
  // listener reliably stops the page from scrolling while the swing is dragged.
  useEffect(() => {
    const handle = handleRef.current;

    if (!handle || disabled) {
      return;
    }

    const preventScroll = (event: TouchEvent) => event.preventDefault();
    handle.addEventListener('touchstart', preventScroll, { passive: false });
    return () => handle.removeEventListener('touchstart', preventScroll);
  }, [disabled]);

  const show = useCallback((next: SwingMotion) => {
    motionRef.current = next;
    setMotion(next);
  }, []);

  const stopAnimation = useCallback(() => {
    if (frameRef.current !== undefined) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = undefined;
    }
  }, []);

  const animate = useCallback(() => {
    if (prefersReducedMotion()) {
      stopAnimation();
      show({ angle: targetRef.current, velocity: 0 });
      return;
    }

    if (frameRef.current !== undefined) {
      return;
    }

    lastFrameRef.current = undefined;

    const tick = (time: number) => {
      const elapsed = lastFrameRef.current === undefined ? 0 : (time - lastFrameRef.current) / 1000;
      const next = stepSwing(motionRef.current, targetRef.current, elapsed);

      lastFrameRef.current = time;

      if (isSettled(next, targetRef.current)) {
        frameRef.current = undefined;
        show({ angle: targetRef.current, velocity: 0 });
        return;
      }

      show(next);
      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
  }, [show, stopAnimation]);

  const aimAt = useCallback(
    (nextMood: number) => {
      targetRef.current = moodToAngle(nextMood);
      setTargetMood(nextMood);
      animate();
    },
    [animate],
  );

  // Follow moods that arrive from elsewhere, like the server remembering an earlier vote.
  useEffect(() => {
    if (!dragRef.current && commitTimerRef.current === undefined) {
      aimAt(mood ?? NEUTRAL_MOOD);
    }
  }, [mood, aimAt]);

  useEffect(
    () => () => {
      stopAnimation();
      clearTimeout(commitTimerRef.current);
    },
    [stopAnimation],
  );

  const endDrag = (event: PointerEvent<SVGGElement>) => {
    const drag = dragRef.current;

    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    dragRef.current = null;
    setDragging(false);

    const committed = toMood(angleToMood(motionRef.current.angle));
    motionRef.current = { angle: motionRef.current.angle, velocity: releaseVelocity(drag.samples) };
    aimAt(committed);
    onCommitRef.current?.(committed);
  };

  const handlers: SwingControls['handlers'] = {
    onPointerDown(event) {
      if (disabled || event.button !== 0) {
        return;
      }

      const angle = pointerAngle(event);

      if (angle === null) {
        return;
      }

      event.preventDefault();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      stopAnimation();
      clearTimeout(commitTimerRef.current);
      commitTimerRef.current = undefined;
      dragRef.current = {
        pointerId: event.pointerId,
        // Keep the swing where it is under the finger instead of jumping to it.
        grabOffset: angle - motionRef.current.angle,
        samples: [{ time: performance.now(), angle: motionRef.current.angle }],
      };
      setDragging(true);
    },
    onPointerMove(event) {
      const drag = dragRef.current;
      const raw = drag && drag.pointerId === event.pointerId ? pointerAngle(event) : null;

      if (!drag || raw === null) {
        return;
      }

      const angle = clampAngle(raw - drag.grabOffset);

      drag.samples.push({ time: performance.now(), angle });
      drag.samples.splice(0, Math.max(0, drag.samples.length - MAX_SAMPLES));
      show({ angle, velocity: 0 });
    },
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
    onKeyDown(event) {
      if (disabled) {
        return;
      }

      // Left and right move the swing that way on screen; up and down are happier and grumpier.
      const towardsLeft = -LAUGHING_SIDE * KEY_STEP;
      const steps: Record<string, number> = {
        ArrowLeft: targetMood + towardsLeft,
        ArrowRight: targetMood - towardsLeft,
        ArrowUp: targetMood + KEY_STEP,
        ArrowDown: targetMood - KEY_STEP,
        PageUp: targetMood + PAGE_STEP,
        PageDown: targetMood - PAGE_STEP,
        Home: MIN_MOOD,
        End: MAX_MOOD,
      };

      if (!(event.key in steps)) {
        return;
      }

      event.preventDefault();
      const next = toMood(steps[event.key]);

      aimAt(next);
      clearTimeout(commitTimerRef.current);
      commitTimerRef.current = setTimeout(() => {
        commitTimerRef.current = undefined;
        onCommitRef.current?.(next);
      }, KEYBOARD_COMMIT_DELAY_MS);
    },
  };

  return {
    angle: motion.angle,
    velocity: motion.velocity,
    dragging,
    liveMood: angleToMood(motion.angle),
    targetMood,
    handleRef,
    handlers,
  };
}
