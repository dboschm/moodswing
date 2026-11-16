// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SessionSnapshot } from '../../shared/protocol';
import { SessionHeader } from './session-header';

const snapshot = (overrides: Partial<SessionSnapshot> = {}): SessionSnapshot => ({
  code: 'MS-K7Q4XZ',
  status: 'open',
  moods: [40, 70],
  online: 2,
  createdAt: 0,
  round: 0,
  ...overrides,
});

function renderHeader(current: SessionSnapshot, onEndSession = vi.fn()) {
  const props = { code: 'MS-K7Q4XZ', isCreator: true, onCopyLink: async () => true, onEndSession };
  const view = render(<SessionHeader {...props} snapshot={current} />);

  return { onEndSession, rerender: (next: SessionSnapshot) => view.rerender(<SessionHeader {...props} snapshot={next} />) };
}

describe('SessionHeader', () => {
  afterEach(cleanup);

  it('asks before ending the session', () => {
    const { onEndSession } = renderHeader(snapshot());

    fireEvent.click(screen.getByRole('button', { name: 'End session' }));
    expect(onEndSession).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Yes, end it' }));
    expect(onEndSession).toHaveBeenCalledOnce();
  });

  it('asks afresh after the session was ended and started again', () => {
    const { rerender } = renderHeader(snapshot());

    fireEvent.click(screen.getByRole('button', { name: 'End session' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, end it' }));
    rerender(snapshot({ status: 'closed', closedAt: 1 }));
    rerender(snapshot({ round: 1, moods: [] }));

    expect(screen.getByRole('button', { name: 'End session' })).toBeTruthy();
    expect(screen.queryByText('End for everyone?')).toBeNull();
  });
});
