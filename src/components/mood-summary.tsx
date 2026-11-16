import { useState } from 'react';
import { averageMood, bandCounts, moodBand } from '../../shared/mood';
import type { SessionSnapshot } from '../../shared/protocol';
import { FaceIcon } from './face-icon';

interface MoodSummaryProps {
  snapshot: SessionSnapshot;
  /** Only the session's creator can soothe and restart; everyone else sees those buttons greyed out. */
  isCreator: boolean;
  /** Soothing has started; `soothed` once every swing has come to rest. */
  soothing: boolean;
  soothed: boolean;
  onCopySummary: (text: string) => Promise<boolean>;
  onSoothe: () => void;
  onRestart: () => void;
}

export function summaryText(snapshot: SessionSnapshot): string {
  const average = averageMood(snapshot.moods);

  if (average === null) {
    return `moodswing ${snapshot.code}: nobody shared a mood.`;
  }

  const counts = bandCounts(snapshot.moods)
    .filter(({ count }) => count > 0)
    .map(({ info, count }) => `${info.emoji}×${count}`)
    .join(' ');
  const people = snapshot.moods.length === 1 ? '1 mood' : `${snapshot.moods.length} moods`;

  return `moodswing ${snapshot.code}: ${people}, the team feels ${moodBand(average).label.toLowerCase()} (${Math.round(average)}/100). ${counts}`;
}

/** The results board shown to everyone once the session has ended. */
export function MoodSummary({ snapshot, isCreator, soothing, soothed, onCopySummary, onSoothe, onRestart }: MoodSummaryProps) {
  const [copied, setCopied] = useState<boolean | null>(null);
  const average = averageMood(snapshot.moods);
  const counts = bandCounts(snapshot.moods);
  const most = Math.max(1, ...counts.map(({ count }) => count));
  const happiestFirst = [...snapshot.moods].sort((a, b) => b - a);
  const endedAt = snapshot.closedAt ? new Date(snapshot.closedAt) : null;

  const copy = async () => {
    setCopied(await onCopySummary(summaryText(snapshot)));
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <section className="summary" aria-labelledby="summary-title">
      <div className="summary__headline">
        <FaceIcon mood={average ?? 50} size={88} animated={average !== null} />
        <div>
          <p className="eyebrow">Final results</p>
          <h2 id="summary-title">
            {average === null ? 'Nobody shared a mood' : `The team is feeling ${moodBand(average).label.toLowerCase()}`}
          </h2>
          <p className="hint">
            {snapshot.moods.length === 1 ? '1 mood' : `${snapshot.moods.length} moods`}
            {average === null ? '' : ` · average ${Math.round(average)}/100`}
            {endedAt ? ` · ended ${endedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
          </p>
        </div>
      </div>

      <ul className="distribution" aria-label="Moods per band">
        {counts.map(({ info, count }) => (
          <li key={info.band}>
            <FaceIcon mood={info.sample} size={28} />
            <span className="distribution__label">{info.label}</span>
            <span className="distribution__bar" aria-hidden="true">
              <span style={{ width: `${(count / most) * 100}%` }} />
            </span>
            <span className="distribution__count">{count}</span>
          </li>
        ))}
      </ul>

      {happiestFirst.length > 0 && (
        <div className="all-moods">
          <p className="eyebrow">Every mood, happiest first</p>
          <div className="all-moods__faces">
            {happiestFirst.map((mood, index) => (
              <FaceIcon key={index} mood={mood} size={30} />
            ))}
          </div>
        </div>
      )}

      <div className="summary__actions">
        <button type="button" className="button button--secondary" onClick={copy}>
          {copied === true ? 'Copied!' : copied === false ? 'Copy failed' : 'Copy summary'}
        </button>
        {soothed ? (
          <button type="button" className="button" onClick={onRestart} disabled={!isCreator}>
            Start again
          </button>
        ) : soothing ? (
          <button type="button" className="button" disabled>
            soothing moodswing
          </button>
        ) : (
          <button type="button" className="button" onClick={onSoothe} disabled={!isCreator}>
            moodswing soothing
          </button>
        )}
      </div>
    </section>
  );
}
