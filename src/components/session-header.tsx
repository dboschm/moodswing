import { useState } from 'react';
import { averageMood, moodBand } from '../../shared/mood';
import type { SessionSnapshot } from '../../shared/protocol';
import type { ConnectionStatus } from '../mood-socket';
import { FaceIcon } from './face-icon';
import { TitleCell } from './title-cell';

interface SessionHeaderProps {
  code: string;
  snapshot: SessionSnapshot | null;
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

/** The session's title block cells: code and invite link, status, counts, team mood and ending it. */
export function SessionHeader({ code, snapshot, isCreator, status, onCopyLink, onEndSession }: SessionHeaderProps) {
  const [copied, setCopied] = useState<boolean | null>(null);
  const [confirming, setConfirming] = useState(false);
  const closed = snapshot?.status === 'closed';
  const average = snapshot ? averageMood(snapshot.moods) : null;

  const copy = async () => {
    setCopied(await onCopyLink());
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <>
      <TitleCell label="Session">
        <h2 id="session-code" className="session-code">
          {code}
        </h2>
        <button type="button" className="button button--secondary button--small" onClick={copy}>
          {copied === true ? 'Link copied' : copied === false ? 'Copy failed' : 'Copy link'}
        </button>
      </TitleCell>

      <TitleCell label="Status">
        <span className={`status status--${closed ? 'closed' : status}`}>{closed ? 'Closed' : STATUS_LABELS[status]}</span>
      </TitleCell>

      {!closed && <TitleCell label="Online">{snapshot?.online ?? '–'}</TitleCell>}
      <TitleCell label="Moods">{snapshot?.moods.length ?? '–'}</TitleCell>

      <TitleCell label="Team mood">
        <span className="team-mood" aria-live="polite">
          <FaceIcon
            mood={average ?? 50}
            size={30}
            animated={average !== null}
            className={average === null ? 'face-icon--waiting' : undefined}
          />
          {average === null ? 'Waiting…' : `${moodBand(average).label} ${Math.round(average)}/100`}
        </span>
      </TitleCell>

      {isCreator && !closed && (
        <TitleCell label="Creator">
          {confirming ? (
            <span className="confirm" role="group" aria-label="Confirm ending the session">
              End for everyone?
              <button type="button" className="button button--danger button--small" onClick={onEndSession}>
                Yes, end it
              </button>
              <button type="button" className="button button--secondary button--small" onClick={() => setConfirming(false)}>
                Cancel
              </button>
            </span>
          ) : (
            <button type="button" className="button button--danger button--small" onClick={() => setConfirming(true)}>
              End session
            </button>
          )}
        </TitleCell>
      )}
    </>
  );
}
