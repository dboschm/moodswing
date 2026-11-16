import { useState } from 'react';
import { averageMood, moodBand } from '../../shared/mood';
import type { SessionSnapshot } from '../../shared/protocol';
import type { ConnectionStatus } from '../mood-socket';
import { FaceIcon } from './face-icon';

interface TeamPanelProps {
  code: string;
  snapshot: SessionSnapshot | null;
  myMood: number | null;
  isCreator: boolean;
  status: ConnectionStatus;
  onCopyLink: () => Promise<boolean>;
  onEndSession: () => void;
}

const STATUS_LABELS: Record<ConnectionStatus, string> = {
  connecting: 'Connecting…',
  live: 'Live',
  reconnecting: 'Reconnecting…',
};

export function TeamPanel({ code, snapshot, myMood, isCreator, status, onCopyLink, onEndSession }: TeamPanelProps) {
  const [copied, setCopied] = useState<boolean | null>(null);
  const [confirming, setConfirming] = useState(false);
  const average = snapshot ? averageMood(snapshot.moods) : null;

  const copy = async () => {
    setCopied(await onCopyLink());
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <section className="card team-panel" aria-labelledby="session-code">
      <div className="team-panel__header">
        <div>
          <p className="eyebrow">Session</p>
          <h2 id="session-code" className="session-code">
            {code}
          </h2>
        </div>
        <span className={`status status--${status}`}>{STATUS_LABELS[status]}</span>
      </div>

      <button type="button" className="button button--secondary" onClick={copy}>
        {copied === true ? 'Link copied!' : copied === false ? 'Copy failed: share the code instead' : 'Copy invite link'}
      </button>

      <dl className="stats">
        <div>
          <dt>Online</dt>
          <dd>{snapshot?.online ?? '–'}</dd>
        </div>
        <div>
          <dt>Moods shared</dt>
          <dd>{snapshot?.moods.length ?? '–'}</dd>
        </div>
      </dl>

      <div className="team-mood" aria-live="polite">
        <FaceIcon mood={average ?? 50} size={64} animated={average !== null} className={average === null ? 'face-icon--waiting' : undefined} />
        <div>
          <p className="eyebrow">Team mood</p>
          <p className="team-mood__label">
            {average === null ? 'Waiting for the first mood…' : `${moodBand(average).label} (${Math.round(average)}/100)`}
          </p>
        </div>
      </div>

      <p className="hint">
        {myMood === null
          ? 'Drag the swing (or use the arrow keys) to share your mood. Nobody can see who picked what.'
          : `You picked “${moodBand(myMood).label}”. Swing again whenever that changes.`}
      </p>

      {isCreator &&
        (confirming ? (
          <div className="confirm" role="group" aria-label="Confirm ending the session">
            <p>End the session for everyone and show the results?</p>
            <div className="confirm__actions">
              <button type="button" className="button button--danger" onClick={onEndSession}>
                Yes, end it
              </button>
              <button type="button" className="button button--secondary" onClick={() => setConfirming(false)}>
                Keep swinging
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="button button--danger" onClick={() => setConfirming(true)}>
            End session &amp; show results
          </button>
        ))}
    </section>
  );
}
