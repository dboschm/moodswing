// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LAUGHING_SIDE } from '../../shared/mood';
import { Swing } from './swing';

function renderSwing(props: Parameters<typeof Swing>[0]) {
  return render(
    <svg>
      <Swing {...props} />
    </svg>,
  );
}

describe('Swing', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('exposes the mood as a slider', () => {
    renderSwing({ mood: 70 });
    const slider = screen.getByRole('slider', { name: 'Your mood' });

    expect(slider.getAttribute('aria-valuenow')).toBe('70');
    expect(slider.getAttribute('aria-valuetext')).toBe('Happy (70)');
  });

  it('invites a drag until a mood is chosen', () => {
    renderSwing({ mood: null });

    expect(screen.getByRole('slider').getAttribute('aria-valuetext')).toBe('Not chosen yet');
    expect(screen.getByText('Drag me')).toBeTruthy();
  });

  it('moves with the arrow keys and commits once the keys rest', () => {
    vi.useFakeTimers();
    const onCommit = vi.fn();
    renderSwing({ mood: 50, onCommit });
    const slider = screen.getByRole('slider');

    // Left moves the swing left on screen, which is towards laughing; up is always happier.
    fireEvent.keyDown(slider, { key: 'ArrowLeft' });
    fireEvent.keyDown(slider, { key: 'ArrowUp' });

    const expected = 50 - LAUGHING_SIDE * 5 + 5;
    expect(slider.getAttribute('aria-valuenow')).toBe(String(expected));
    expect(onCommit).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(onCommit).toHaveBeenCalledExactlyOnceWith(expected);
  });

  it('jumps to the extremes with Home and End', () => {
    renderSwing({ mood: 50 });
    const slider = screen.getByRole('slider');

    fireEvent.keyDown(slider, { key: 'End' });
    expect(slider.getAttribute('aria-valuenow')).toBe('100');

    fireEvent.keyDown(slider, { key: 'Home' });
    expect(slider.getAttribute('aria-valuenow')).toBe('0');
  });

  it('ignores input when disabled', () => {
    vi.useFakeTimers();
    const onCommit = vi.fn();
    renderSwing({ mood: 30, onCommit, disabled: true });
    const slider = screen.getByRole('slider');

    fireEvent.keyDown(slider, { key: 'ArrowUp' });
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(slider.getAttribute('aria-valuenow')).toBe('30');
    expect(onCommit).not.toHaveBeenCalled();
    expect(slider.getAttribute('tabindex')).toBe('-1');
  });
});
